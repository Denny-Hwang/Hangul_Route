import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleAuthProvider, useConsoleAuth, type ConsoleAuth } from '../auth-context';

/**
 * F-APP-001 A-4b (sections 3.7, 3.9): the console's auth without a Clerk key (the dev bridge).
 * Sign out removes the grown-up unlock and the console session from this tab before it leaves,
 * and goes where it is told (the lock's Sign in again passes `/signin?next=…`); the session id is
 * what the router matches a sign-in record to.
 */
const store = new Map<string, string>();
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
};
const assigned: string[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');
  vi.stubGlobal('window', { sessionStorage: storage, localStorage: storage, location: { assign: (url: string) => assigned.push(url) } });
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('ConsoleAuthProvider without Clerk (dev bridge)', () => {
  it('exposes the account id as the session id and signs out with the tab cleared', async () => {
    store.set('hr:console:session', JSON.stringify({ token: 'kim', accountId: 'kim', displayName: 'Ms Kim' }));
    store.set('hr:grownup:unlock', JSON.stringify({ v: 1, at: 1, seen: 1, src: 'signin' }));
    let view: ConsoleAuth | null = null;
    function Probe(): null {
      view = useConsoleAuth();
      return null;
    }
    let r: ReactTestRenderer | null = null;
    await act(async () => {
      r = create(
        <ConsoleAuthProvider>
          <Probe />
        </ConsoleAuthProvider>,
      );
    });
    expect(view).toMatchObject({ mode: 'dev', ready: true, sessionId: 'kim', session: { accountId: 'kim' } });

    await act(async () => {
      await (view as unknown as ConsoleAuth).signOut('/signin?next=%2Fteach%2Fhome');
    });
    expect(store.has('hr:console:session')).toBe(false);
    expect(store.has('hr:grownup:unlock')).toBe(false);
    expect(assigned).toEqual(['/signin?next=%2Fteach%2Fhome']);
    expect(view).toMatchObject({ session: null, sessionId: null });

    // Without a target the caller navigates (useConsole's Sign out).
    await act(async () => {
      await (view as unknown as ConsoleAuth).signOut();
    });
    expect(assigned).toEqual(['/signin?next=%2Fteach%2Fhome']);
    act(() => (r as unknown as ReactTestRenderer).unmount());
  });
});
