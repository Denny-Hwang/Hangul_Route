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
