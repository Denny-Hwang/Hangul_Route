import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLERK_MODAL_SELECTOR, CLERK_UI_OPEN_TIMEOUT_MS, CLERK_UI_POLL_MS, clerkUiOpen, guardReverify, isReverificationCancelled, isStepUpHint, settleReverify, type ReverifyOutcome } from '../step-up';

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

describe('guardReverify: a way out when Clerk cannot be reached (section 4.12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const never = (): Promise<ReverifyOutcome<string>> => new Promise(() => undefined);

  it('offline: unavailable at once, and Clerk is never asked', async () => {
    let asked = 0;
    const outcome = await guardReverify(
      async () => {
        asked += 1;
        return { kind: 'result', result: 'x' };
      },
      { online: () => false, uiOpen: () => false },
    );
    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(asked).toBe(0);
  });

  it('the attempt settles: its outcome, and the timer is gone', async () => {
    const outcome = guardReverify(async () => ({ kind: 'result', result: 'url' }) as const, { online: () => true, uiOpen: () => false });
    await vi.advanceTimersByTimeAsync(0);
    expect(await outcome).toEqual({ kind: 'result', result: 'url' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Clerk’s UI never opens (its script blocked): unavailable after the open timeout, not before', async () => {
    let done: ReverifyOutcome<string> | null = null;
    void guardReverify(never, { online: () => true, uiOpen: () => false }).then((o) => {
      done = o;
    });
    await vi.advanceTimersByTimeAsync(CLERK_UI_OPEN_TIMEOUT_MS - CLERK_UI_POLL_MS);
    expect(done).toBeNull();
    await vi.advanceTimersByTimeAsync(CLERK_UI_POLL_MS);
    expect(done).toEqual({ kind: 'unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Clerk’s UI opened: no timeout, however long the grown-up takes; the late answer is the outcome', async () => {
    let resolveAttempt: (o: ReverifyOutcome<string>) => void = () => undefined;
    let done: ReverifyOutcome<string> | null = null;
    let open = false;
    void guardReverify<string>(() => new Promise<ReverifyOutcome<string>>((r) => (resolveAttempt = r)), { online: () => true, uiOpen: () => open }).then((o) => {
      done = o;
    });
    open = true;
    await vi.advanceTimersByTimeAsync(CLERK_UI_OPEN_TIMEOUT_MS * 6);
    expect(done).toBeNull();
    resolveAttempt({ kind: 'cancelled' });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toEqual({ kind: 'cancelled' });
  });

  it('an attempt that throws: unavailable', async () => {
    const outcome = guardReverify(() => Promise.reject(new Error('boom')), { online: () => true, uiOpen: () => false });
    await vi.advanceTimersByTimeAsync(0);
    expect(await outcome).toEqual({ kind: 'unavailable' });
  });

  it('clerkUiOpen looks for Clerk’s modal backdrop; false without a DOM', () => {
    expect(clerkUiOpen()).toBe(false);
    const seen: string[] = [];
    vi.stubGlobal('document', { querySelector: (q: string) => (seen.push(q), q === CLERK_MODAL_SELECTOR ? {} : null) });
    expect(clerkUiOpen()).toBe(true);
    expect(seen).toEqual([CLERK_MODAL_SELECTOR]);
  });
});
