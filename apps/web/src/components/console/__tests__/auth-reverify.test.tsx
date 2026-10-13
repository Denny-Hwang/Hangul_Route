import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BILL-002 B-8b (section 4.4): under Clerk, `useConsoleAuth().reverify` runs the request through Clerk's
 * `useReverification`. The hook is mocked at the fetcher boundary with Clerk's own handler logic (call; on the
 * reverification hint open the verification; on complete retry once, on cancel reject with
 * `reverification_cancelled`), and the request answers with the hint body the Worker sends (B-5).
 */
const HINT = {
  ok: false,
  error: 'forbidden',
  status: 403,
  code: 'reverify_required',
  clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
};

const clerk = vi.hoisted(() => ({ verification: 'complete' as 'complete' | 'cancel' | 'throw', opened: 0 }));
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useUser: () => ({ isLoaded: true, user: { id: 'user_1', firstName: 'Kim', primaryEmailAddress: null } }),
  useAuth: () => ({ getToken: async () => 'token', sessionId: 'sess_1' }),
  useClerk: () => ({ signOut: async () => undefined }),
  useReverification:
    (fetcher: (...args: unknown[]) => Promise<unknown>) =>
    async (...args: unknown[]): Promise<unknown> => {
      const first = await fetcher(...args);
      const hint = (first as { clerk_error?: { type?: string; reason?: string } }).clerk_error;
      if (hint?.type !== 'forbidden' || hint.reason !== 'reverification-error') return first;
      clerk.opened += 1;
      if (clerk.verification === 'throw') throw new Error('Clerk could not be reached');
      if (clerk.verification === 'cancel') throw Object.assign(new Error('User cancelled attempted verification'), { code: 'reverification_cancelled' });
      return fetcher(...args);
    },
}));

import { ConsoleAuthProvider, useConsoleAuth, type ConsoleAuth } from '@/components/console/auth-context';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let auth: ConsoleAuth | null = null;
function Probe(): null {
  auth = useConsoleAuth();
  return null;
}

let mounted: ReactTestRenderer | null = null;
beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
  clerk.verification = 'complete';
  clerk.opened = 0;
  await act(async () => {
    mounted = create(
      <ConsoleAuthProvider>
        <Probe />
      </ConsoleAuthProvider>,
    );
  });
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  auth = null;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const reverify = <T,>(fetcher: () => Promise<T>, first: T = HINT as T) => (auth as ConsoleAuth).reverify(fetcher, first);

describe('reverify under Clerk (useReverification at the fetcher boundary)', () => {
  it('the stale request is verified and retried once: its answer; the hint in hand is not sent again', async () => {
    const answer = { ok: true, data: { url: 'https://checkout.stripe.com/c/pay/cs_test_1' } };
    let calls = 0;
    const outcome = await reverify(async () => {
      calls += 1;
      return answer as unknown;
    });
    expect(outcome).toEqual({ kind: 'result', result: answer });
    // Only Clerk's retry reaches the Worker: one refused call per step-up, one refused-checkout diagnostic.
    expect(calls).toBe(1);
    expect(clerk.opened).toBe(1);
  });

  it('refused again after verifying (a token without fva): unavailable, one retry only', async () => {
    let calls = 0;
    const outcome = await reverify(async () => {
      calls += 1;
      return HINT;
    });
    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(1);
  });

  it('offline: unavailable without opening Clerk or sending the request', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    let calls = 0;
    const outcome = await reverify(async () => {
      calls += 1;
      return HINT;
    });
    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);
    expect(clerk.opened).toBe(0);
  });

  it('the grown-up closes Clerk’s verification: cancelled', async () => {
    clerk.verification = 'cancel';
    expect(await reverify(async () => HINT)).toEqual({ kind: 'cancelled' });
  });

  it('Clerk cannot be reached: unavailable', async () => {
    clerk.verification = 'throw';
    expect(await reverify(async () => HINT)).toEqual({ kind: 'unavailable' });
  });
});
