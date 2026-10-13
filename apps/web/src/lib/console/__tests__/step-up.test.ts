import { describe, expect, it } from 'vitest';
import { isReverificationCancelled, isStepUpHint, settleReverify } from '../step-up';

/**
 * F-BILL-002 B-8b (sections 4.4, 4.12; wireframe billing/step-up): money calls answer `403` with Clerk's
 * reverification hint when the sign-in is older than 10 minutes (B-5). The page shows "Confirm it's you", runs
 * Clerk's reverification, retries once, and never loops: a second hint, a Clerk failure or an unreachable Clerk is
 * "Can't confirm right now", a cancel is "Nothing was changed."
 */

/** The body B-5 sends, as the console API client carries it on a failed result (`api.ts`, `ClerkErrorHint`). */
const HINT = {
  ok: false,
  error: 'forbidden',
  status: 403,
  code: 'reverify_required',
  clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
};

describe('isStepUpHint', () => {
  it('recognises the reverification hint the way Clerk does (type and reason)', () => {
    expect(isStepUpHint(HINT)).toBe(true);
    expect(isStepUpHint({ clerk_error: { type: 'forbidden', reason: 'reverification-error' } })).toBe(true);
  });

  it('anything else is not a hint', () => {
    expect(isStepUpHint({ ok: true, data: { url: 'https://checkout.stripe.com/x' } })).toBe(false);
    expect(isStepUpHint({ ok: false, error: 'forbidden', status: 403, code: 'forbidden' })).toBe(false);
    expect(isStepUpHint({ clerk_error: { type: 'forbidden', reason: 'other' } })).toBe(false);
    expect(isStepUpHint({ clerk_error: null })).toBe(false);
    expect(isStepUpHint(null)).toBe(false);
    expect(isStepUpHint('reverification-error')).toBe(false);
  });
});

describe('isReverificationCancelled', () => {
  it('Clerk rejects a cancelled reverification with the code reverification_cancelled', () => {
    expect(isReverificationCancelled(Object.assign(new Error('User cancelled attempted verification'), { code: 'reverification_cancelled' }))).toBe(true);
    expect(isReverificationCancelled({ code: 'reverification_cancelled' })).toBe(true);
    expect(isReverificationCancelled(new Error('network'))).toBe(false);
    expect(isReverificationCancelled(null)).toBe(false);
    expect(isReverificationCancelled('reverification_cancelled')).toBe(false);
  });
});

describe('settleReverify', () => {
  it('the retried request answers: its result', async () => {
    const result = { ok: true, data: { url: 'https://checkout.stripe.com/x' } };
    expect(await settleReverify(async () => result)).toEqual({ kind: 'result', result });
  });

  it('the retry is refused again (a token without fva): unavailable, never a loop', async () => {
    let calls = 0;
    const outcome = await settleReverify(async () => {
      calls += 1;
      return HINT;
    });
    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(1);
  });

  it('a cancelled reverification: cancelled', async () => {
    expect(
      await settleReverify(async () => {
        throw Object.assign(new Error('cancelled'), { code: 'reverification_cancelled' });
      }),
    ).toEqual({ kind: 'cancelled' });
  });

  it('Clerk cannot be reached: unavailable', async () => {
    expect(
      await settleReverify(async () => {
        throw new Error('network');
      }),
    ).toEqual({ kind: 'unavailable' });
  });
});
