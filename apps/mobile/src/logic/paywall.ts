import type { Tier, TierSource } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { planFreeLines, type FreePlanContext, type FreeSlot } from './plan-free-lines';
import type { DeviceAudience } from './profiles/learner-type';
import type { OpenLinkOutcome } from './story/source-link';

/**
 * The learner Plan screen (F-BILL-002 B-9, sections 4.7 and 4.8; wireframe billing/plan-status;
 * mock design/screens/billing/plan-status.md). The navigation route key stays `Paywall`. The screen
 * shows status only: no PIN, no price, no offer, and on native builds no link and no word about
 * the web. Everything it shows comes from `planView`, so a test that scans `planTexts` covers
 * every word it can render.
 */
export type PaywallState = 'covered' | 'premium' | 'free';

/** Three calm states from the tier and its source (F-ENT-001 §3.5, unchanged). */
export function paywallState(tier: Tier, source: TierSource | null): PaywallState {
  if (tier !== 'premium') return 'free';
  return source && source.kind !== 'family' ? 'covered' : 'premium';
}

export interface PlanView {
  state: PaywallState;
  /** Hoya's pose: idle on the free plan, cheering on the full route. Decoration only. */
  pose: 'idle' | 'cheering';
  /** The screen heading, "Plan". */
  heading: string;
  /** `a11y.planStatus`: the heading's accessible label, the screen's first accessible element (section 8). */
  summary: string;
  /** The state sentence, worded for the device's audience. */
  title: string;
  /** The lines under the title (none on the free plan: the free slot speaks there). */
  lines: readonly string[];
  /**
   * The free slot on the free plan (null otherwise): "Stage 1 is always free." (`caregiver.plan.free.open`)
   * while F-ENT-003's switch is off; with it on, F-ENT-003 section 3.9.1's free-plan line, the What
   * is free list and at most one situation line (`planFreeLines`, row E3-8).
   */
  freeSlot: FreeSlot | null;
  /** The guidance slot under the full-route lines: F-ENT-003's no-plan line (item 10, any switch) when the learner has no plan, else empty. */
  guidance: readonly string[];
  /**
   * Web only: the caption, the Open billing button, its hint and the line shown back from a correct
   * PIN (one more tap opens billing; see `pendingBillingStep`). Null on native builds (section 4.8).
   */
  billing: { caption: string; cta: string; hint: string; gateDone: string } | null;
  back: string;
}

export interface PlanViewInput {
  tier: Tier;
  source: TierSource | null;
  audience: DeviceAudience;
  /** The active profile's name; blank or missing reads "Your learner". */
  name: string | null;
  /** `Platform.OS`. Only `web` gets the billing block. */
  platform: string;
  /** F-ENT-003 section 3.9.1's data for the slots; omitted or null keeps F-BILL-002's lines. */
  freePlan?: FreePlanContext | null;
}

const named = (value: string | null | undefined): string | null => (value === null || value === undefined || value.trim() === '' ? null : value);

export function planView(input: PlanViewInput, messages: Pick<Messages, 'caregiver' | 'learner' | 'a11y'>): PlanView {
  const m = messages.caregiver.plan;
  const card = messages.learner.profile.plan;
  const state = paywallState(input.tier, input.source);
  const name = named(input.name) ?? m.learnerFallback;
  const family = input.audience === 'family';
  let title: string;
  let lines: string[] = [];
  if (state === 'covered') {
    const space = named(input.source?.name) ?? m.covered.sourceFallback;
    title = family ? m.covered.title.family(name, space) : m.covered.title.self(space);
    lines = [family ? m.covered.note.family : m.covered.note.self];
  } else if (state === 'premium') {
    title = family ? m.full.title.family(name) : m.full.title.self;
    lines = [input.source?.kind === 'family' ? (family ? m.full.fromFamily.family : m.full.fromFamily.self) : m.full.noSource];
  } else {
    title = family ? m.free.title.family(name) : m.free.title.self;
  }
  const slots = planFreeLines({ state, audience: input.audience, name, platform: input.platform, context: input.freePlan ?? null }, m);
  return {
    state,
    pose: state === 'free' ? 'idle' : 'cheering',
    heading: m.title,
    summary: messages.a11y.planStatus(name, state === 'free' ? card.free : card.fullRoute),
    title,
    lines,
    freeSlot: slots.free,
    guidance: slots.guidance,
    billing:
      input.platform === 'web'
        ? {
            caption: family ? m.openBilling.caption.family : m.openBilling.caption.self,
            cta: m.openBilling.cta,
            hint: m.openBilling.a11yHint,
            gateDone: m.gateDone,
          }
        : null,
    back: m.backToJourney.cta,
  };
}

/** Every string a view carries, in screen order: what a deny-list or banned-word scan reads. */
export function planTexts(view: PlanView): string[] {
  return [
    view.heading,
    view.summary,
    view.title,
    ...view.lines,
    ...(view.freeSlot === null ? [] : [...(view.freeSlot.line === null ? [] : [view.freeSlot.line]), ...view.freeSlot.list, ...(view.freeSlot.extra === null ? [] : [view.freeSlot.extra])]),
    ...view.guidance,
    ...(view.billing === null ? [] : [view.billing.caption, view.billing.cta, view.billing.hint, view.billing.gateDone]),
    view.back,
  ];
}

/** Open billing: inside the same tap when the gate opens directly (F-LEARN-001 L7), else through `PinEntry { next: 'Billing' }`. */
export function billingPressStep(gateOpensDirectly: boolean): 'open' | 'gate' {
  return gateOpensDirectly ? 'open' : 'gate';
}

/**
 * Back on the Plan screen after the gate (as Sources' `pendingLinkStep`): a cancelled gate drops the
 * waiting press, and a return with nothing waiting does nothing. Once the gate is through, billing
 * opens by itself where the hand-off needs no tap of its own (native), and the screen asks for one
 * more tap of Open billing where it does (web, `HAND_OFF_NEEDS_TAP`: a browser may block a tab
 * opened outside a tap; the grown-up session is open now, so that tap opens it directly).
 */
export function pendingBillingStep(pending: boolean, gateOpensDirectly: boolean, handOffNeedsTap: boolean): 'none' | 'open' | 'tap-again' | 'drop' {
  if (!pending) return 'none';
  if (!gateOpensDirectly) return 'drop';
  return handOffNeedsTap ? 'tap-again' : 'open';
}

/**
 * The line under Open billing: nothing once billing opened, else the address to type (section 4.7);
 * offline, it says a connection is needed first (as Sources' `openLinkNote`).
 */
export function billingNote(outcome: OpenLinkOutcome, url: string, messages: Pick<Messages, 'caregiver'>): string | null {
  if (outcome === 'opened') return null;
  const m = messages.caregiver.plan;
  return outcome === 'offline' ? `${m.needsConnection} ${m.openFailed(url)}` : m.openFailed(url);
}

/** `paywall.console_opened` (TELEMETRY-NAMES-2 §D): only for a hand-off that opened, with the state code only. */
export function billingOpenedEvent(
  outcome: OpenLinkOutcome,
  state: PaywallState,
): { name: 'paywall.console_opened'; payload: { state: PaywallState } } | null {
  return outcome === 'opened' ? { name: 'paywall.console_opened', payload: { state } } : null;
}

/**
 * What the Plan screen's Open billing reported (`platform/billing-handoff.ts` `openBilling`):
 * `browser` is B-9's console page in a new tab (flag off); `same-tab` is B-9b's hand-off to the
 * grown-up area (`openGrownUpArea`, flag on), which either left (`opened`) or needs a fresh PIN
 * first (`pin`).
 */
export type BillingOpenResult =
  | { kind: 'browser'; outcome: OpenLinkOutcome; url: string }
  | { kind: 'same-tab'; outcome: 'opened' | 'pin' };

export interface BillingHandOffStep {
  /** The line under Open billing, or null. */
  note: string | null;
  /** `paywall.console_opened`, for B-9's browser hand-off only. */
  event: ReturnType<typeof billingOpenedEvent>;
  /** Open the PIN screen for the grown-up area (destination `GrownUpArea`, verify only). */
  askPin: boolean;
}

/**
 * What the Plan screen does once Open billing reported back (section 4.7). The same-tab hand-off
 * shows no line and sends no `paywall.console_opened` (`openGrownUpArea` sends
 * `shell.grown_up_handoff`; TELEMETRY-NAMES-2 keeps `paywall.console_opened` for the flag off);
 * on `pin` the PIN screen opens and hands off itself after a correct PIN (F-APP-001 section 3.9).
 */
export function billingHandOffStep(
  result: BillingOpenResult,
  state: PaywallState,
  messages: Pick<Messages, 'caregiver'>,
): BillingHandOffStep {
  if (result.kind === 'same-tab') return { note: null, event: null, askPin: result.outcome === 'pin' };
  return { note: billingNote(result.outcome, result.url, messages), event: billingOpenedEvent(result.outcome, state), askPin: false };
}

export interface PlanCardView {
  title: string;
  note: string;
  pill: string;
  /** The pill and card tone: success on the full route, neutral (sunken card) on the free plan. */
  tone: 'success' | 'neutral';
  cta: string;
}

/** The Profile plan card (section 4.7, 6.3): Free plan or Full route, and Plan details on every tier. */
export function planCardView(tier: Tier, source: TierSource | null, m: Messages['learner']['profile']['plan']): PlanCardView {
  const full = tier === 'premium';
  return {
    title: full ? m.fullRoute : m.free,
    note: full ? m.open(named(source?.name)) : m.freeNote,
    pill: full ? m.pillActive : m.pillFree,
    tone: full ? 'success' : 'neutral',
    cta: m.details.cta,
  };
}

const DEFAULT_CONSOLE = 'https://hangulroute.com';

/** Where a grown-up manages billing on the web today (F-BILL-002 B-9b moves it to the app host behind the flag). */
// Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads, so the default spells the key out.
export function consoleBillingUrl(env: { EXPO_PUBLIC_CONSOLE_URL?: string } = { EXPO_PUBLIC_CONSOLE_URL: process.env.EXPO_PUBLIC_CONSOLE_URL }): string {
  const base = (env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_CONSOLE).replace(/\/$/, '');
  return `${base}/teach/billing`;
}
