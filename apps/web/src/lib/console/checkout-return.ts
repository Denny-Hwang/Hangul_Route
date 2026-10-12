import { CHECKOUT_POLL_MAX, CHECKOUT_POLL_MS, PurchasablePlanKeySchema, type BillingSummary, type PurchasablePlanKey } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * Coming back from Stripe — F-BILL-002 B-7 (section 4.5, wireframe
 * billing/checkout-return). A pure state machine: the page reads the query
 * once (`readCheckoutReturn`), clears it from the address bar
 * (`cleanedReturnSearch` into `history.replaceState`), polls
 * `GET /api/billing/summary?poll=1` every `POLL_INTERVAL_MS` while
 * `shouldPoll`, and feeds each result, failure and connection change in as an
 * event. It never claims success before the card for the bought space shows
 * the bought plan as active (the webhook may be late).
 */

/** The billing summary is polled every 2 s (`CHECKOUT_POLL_MS`), at most `CHECKOUT_POLL_MAX` times per round. */
export const POLL_INTERVAL_MS = CHECKOUT_POLL_MS;

export type CheckoutReturn = { kind: 'success'; plan: PurchasablePlanKey; spaceId: string } | { kind: 'successUnknown' } | { kind: 'cancel' };

/** What was bought, for which space; null after an older return that did not say (done-unknown). */
export interface ReturnTarget {
  plan: PurchasablePlanKey;
  spaceId: string;
}

export type ReturnState =
  | { phase: 'checking'; target: ReturnTarget | null; attempts: number }
  | { phase: 'done'; target: ReturnTarget | null; nextStep: 'connectLearner' | null }
  | { phase: 'stillProcessing'; target: ReturnTarget | null }
  | { phase: 'offline'; target: ReturnTarget | null; attempts: number }
  | { phase: 'error'; target: ReturnTarget | null; attempts: number }
  | { phase: 'cancelled' };

export type ReturnEvent =
  | { type: 'polled'; summary: BillingSummary }
  | { type: 'pollFailed'; offline: boolean }
  | { type: 'offline' }
  | { type: 'online' }
  | { type: 'retry' }
  | { type: 'checkAgain' };

const RETURN_KEYS = ['checkout', 'plan', 'id'] as const;
const SPACE_ID = /^space:[a-z0-9-]+$/;

const paramsOf = (search: string | URLSearchParams): URLSearchParams => (typeof search === 'string' ? new URLSearchParams(search) : search);

/** `?checkout=success&plan=<k>&id=<spaceId>` (B-5), `?checkout=cancel`, or nothing. */
export function readCheckoutReturn(search: string | URLSearchParams): CheckoutReturn | null {
  const params = paramsOf(search);
  const checkout = params.get('checkout');
  if (checkout === 'cancel') return { kind: 'cancel' };
  if (checkout !== 'success') return null;
  const plan = PurchasablePlanKeySchema.safeParse(params.get('plan'));
  const spaceId = params.get('id') ?? '';
  return plan.success && SPACE_ID.test(spaceId) ? { kind: 'success', plan: plan.data, spaceId } : { kind: 'successUnknown' };
}

/** The query without `checkout`, `plan` and `id`, so a refresh or a copied URL does not repeat the notice. */
export function cleanedReturnSearch(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of RETURN_KEYS) params.delete(key);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export function initialReturnState(ret: CheckoutReturn | null): ReturnState | null {
  if (!ret) return null;
  if (ret.kind === 'cancel') return { phase: 'cancelled' };
  return { phase: 'checking', target: ret.kind === 'success' ? { plan: ret.plan, spaceId: ret.spaceId } : null, attempts: 0 };
}

/** The card for `target` holds the bought plan, active (a trial counts; a dated row only while its date is ahead). */
function boughtPlanActive(summary: BillingSummary, target: ReturnTarget, now: Date): boolean {
  const card = summary.cards.find((c) => c.spaceId === target.spaceId);
  const coverage = card?.coverage;
  if (coverage?.state !== 'own' || coverage.planKey !== target.plan) return false;
  if (coverage.status !== 'active' && coverage.status !== 'trial') return false;
  return coverage.expiresAt === null || Date.parse(coverage.expiresAt) > now.getTime();
}

function nextStepFor(summary: BillingSummary, target: ReturnTarget | null): 'connectLearner' | null {
  const card = target ? summary.cards.find((c) => c.spaceId === target.spaceId) : undefined;
  return card?.kind === 'family' && card.payer && card.usage?.learners === 0 ? 'connectLearner' : null;
}

/** One transition. Events that do not apply to a state leave it unchanged (the same object). */
export function returnStep(state: ReturnState, event: ReturnEvent, now: Date): ReturnState {
  if (state.phase === 'done' || state.phase === 'cancelled') return state;
  const { target } = state;
  const attempts = 'attempts' in state ? state.attempts : 0;
  switch (event.type) {
    case 'polled': {
      if (state.phase === 'stillProcessing') return state;
      // An older return knows nothing to wait for: one successful reload is enough.
      if (!target || boughtPlanActive(event.summary, target, now)) return { phase: 'done', target, nextStep: nextStepFor(event.summary, target) };
      // A late result while paused shows the plan if it landed, but uses no attempt.
      if (state.phase !== 'checking') return state;
      const used = attempts + 1;
      return used >= CHECKOUT_POLL_MAX ? { phase: 'stillProcessing', target } : { phase: 'checking', target, attempts: used };
    }
    case 'pollFailed':
      if (state.phase !== 'checking') return state;
      return event.offline ? { phase: 'offline', target, attempts } : { phase: 'error', target, attempts };
    case 'offline':
      return state.phase === 'checking' || state.phase === 'error' ? { phase: 'offline', target, attempts } : state;
    case 'online':
      return state.phase === 'offline' ? { phase: 'checking', target, attempts } : state;
    case 'retry':
      return state.phase === 'offline' || state.phase === 'error' ? { phase: 'checking', target, attempts } : state;
    case 'checkAgain':
      return state.phase === 'stillProcessing' ? { phase: 'checking', target, attempts: 0 } : state;
  }
}

/** Poll now? Only while checking: paused offline or on an error, polling waits for the grown-up or the connection. */
export function shouldPoll(state: ReturnState | null): boolean {
  return state?.phase === 'checking';
}

/** The polite live-region line, with the button the wireframe draws for that state. */
export function returnNotice(state: ReturnState | null, locale: UiLocale = DEFAULT_LOCALE): { text: string; action: { event: 'checkAgain' | 'retry'; label: string } | null } | null {
  if (!state) return null;
  const messages = getMessages(locale).console;
  const billing = messages.billing;
  switch (state.phase) {
    case 'checking':
      return { text: billing.checking, action: null };
    case 'done':
      return { text: billing.done, action: null };
    case 'stillProcessing':
      return { text: billing.stillProcessing, action: { event: 'checkAgain', label: billing.checkAgain.cta } };
    case 'offline':
      return { text: billing.offline, action: { event: 'retry', label: billing.retry.cta } };
    case 'error':
      return { text: billing.cantCheck, action: { event: 'retry', label: billing.retry.cta } };
    case 'cancelled':
      return { text: messages.billingCancelled, action: null };
  }
}

/** The card whose buttons stay disabled until the bought plan shows (no second purchase meanwhile). */
export function busyCardId(state: ReturnState | null): string | null {
  if (!state || state.phase === 'done' || state.phase === 'cancelled') return null;
  return state.target?.spaceId ?? null;
}

/** Where focus moves once done: the bought space's card heading. */
export function focusCardId(state: ReturnState | null): string | null {
  return state?.phase === 'done' ? (state.target?.spaceId ?? null) : null;
}
