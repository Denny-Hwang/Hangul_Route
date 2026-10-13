/**
 * Step-up before money moves or a receipt opens — F-BILL-002 B-8b (sections 4.4, 4.10, 4.12; wireframe
 * billing/step-up). The Worker answers a checkout, portal or receipt-link call with `403` and Clerk's
 * reverification hint when the session's first factor is older than `STEP_UP_MAX_AGE_MIN` (B-5). The page asks
 * "Confirm it's you"; Continue runs Clerk's `useReverification`, which shows Clerk's own verification and retries
 * the request once. Pure helpers, so the outcomes are tested without Clerk.
 */

/** What Continue led to: the retried request's result, a cancel, or "Can't confirm right now" (no second prompt). */
export type ReverifyOutcome<T> = { kind: 'result'; result: T } | { kind: 'cancelled' } | { kind: 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The reverification hint, recognised the way `useReverification` does (`clerk_error.type === 'forbidden'` and
 * `reason === 'reverification-error'`). The console API client carries the hint on a failed result as is.
 */
export function isStepUpHint(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hint = value.clerk_error;
  return isRecord(hint) && hint.type === 'forbidden' && hint.reason === 'reverification-error';
}

/** Clerk rejects a reverification the grown-up closed with the code `reverification_cancelled`. */
export function isReverificationCancelled(error: unknown): boolean {
  return isRecord(error) && error.code === 'reverification_cancelled';
}

/**
 * Runs one reverification attempt (Clerk's enhanced fetcher: verify, then retry once) and settles it. A retry that
 * is refused again (for example a session token without `fva`) is `unavailable`, so the dialog never loops.
 */
export async function settleReverify<T>(attempt: () => Promise<T>): Promise<ReverifyOutcome<T>> {
  try {
    const result = await attempt();
    return isStepUpHint(result) ? { kind: 'unavailable' } : { kind: 'result', result };
  } catch (error) {
    return isReverificationCancelled(error) ? { kind: 'cancelled' } : { kind: 'unavailable' };
  }
}

/**
 * Clerk's modal backdrop, by its stable appearance class (`cl-` + the element descriptor, Clerk's documented
 * `appearance.elements` key `modalBackdrop`). Its presence means Clerk's own verification UI opened.
 */
export const CLERK_MODAL_SELECTOR = '.cl-modalBackdrop';

/**
 * How long Continue waits for Clerk's verification UI to open before it reads "Can't confirm right now". Clerk's
 * handler only settles once its UI calls back; if the UI never mounts (its script blocked or offline), the promise
 * never settles, so a missing UI is the "Clerk cannot be reached" row of section 4.12.
 */
export const CLERK_UI_OPEN_TIMEOUT_MS = 10_000;
/** How often the guard looks for Clerk's UI while it waits. */
export const CLERK_UI_POLL_MS = 250;

export interface ReverifyGuard {
  /** False when the browser says it is offline: Clerk cannot be reached, so no attempt is made. */
  online: () => boolean;
  /** True once Clerk's verification UI is on the page. */
  uiOpen: () => boolean;
  openTimeoutMs?: number;
  pollMs?: number;
}

/**
 * Runs one reverification attempt with a way out: offline is `unavailable` at once, and an attempt whose Clerk UI
 * has not opened within `openTimeoutMs` is `unavailable` (its late answer, if any, is dropped). Once Clerk's UI has
 * been seen, the attempt settles on its own (verified and retried, or cancelled), however long the grown-up takes.
 */
export function guardReverify<T>(attempt: () => Promise<ReverifyOutcome<T>>, guard: ReverifyGuard): Promise<ReverifyOutcome<T>> {
  if (!guard.online()) return Promise.resolve({ kind: 'unavailable' });
  const openTimeoutMs = guard.openTimeoutMs ?? CLERK_UI_OPEN_TIMEOUT_MS;
  const pollMs = guard.pollMs ?? CLERK_UI_POLL_MS;
  return new Promise<ReverifyOutcome<T>>((resolve) => {
    let settled = false;
    let waited = 0;
    const finish = (outcome: ReverifyOutcome<T>): void => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve(outcome);
    };
    const timer = setInterval(() => {
      if (guard.uiOpen()) {
        clearInterval(timer);
        return;
      }
      waited += pollMs;
      if (waited >= openTimeoutMs) finish({ kind: 'unavailable' });
    }, pollMs);
    attempt().then(finish, () => finish({ kind: 'unavailable' }));
  });
}

/** Whether Clerk's verification UI is on the page (false without a DOM). */
export function clerkUiOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector(CLERK_MODAL_SELECTOR) !== null;
}

/** False only when the browser says it is offline. */
export function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
