import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-3 (sections 7.1, 7.2 and 7.4): the auth bridge's part. Sign out deletes
 * `deviceUses` before it leaves; Use a passkey is Clerk's session verification with the passkey factor; the moment-3
 * reverification refuses when one of the account's passkeys was used since the dialog opened (Clerk does not name the
 * factor its dialog used). The dev bridge offers no passkey and counts the dev bearer as a password.
 */
const shell = vi.hoisted(() => ({ deleted: 0, order: [] as string[] }));
vi.mock('@/lib/console/shell-store', async (original) => ({
  ...(await original<typeof import('@/lib/console/shell-store')>()),
  deleteDeviceUses: async () => {
    shell.deleted += 1;
    shell.order.push('deleteDeviceUses');
    return true;
  },
}));

type Passkey = { lastUsedAt: Date | null };
const clerk = vi.hoisted(() => ({
  dialog: 'verify' as 'verify' | 'cancel',
  passkeys: [] as Passkey[],
  reloaded: [] as Passkey[] | 'fail',
  session: null as null | { startVerification: (p: unknown) => Promise<unknown>; verifyWithPasskey: () => Promise<{ status: string }> },
  calls: [] as string[],
}));
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useUser: () => ({
    isLoaded: true,
    user: {
      id: 'user_1',
      firstName: 'Kim',
      primaryEmailAddress: null,
      passkeys: clerk.passkeys,
      reload: async () => {
        if (clerk.reloaded === 'fail') throw new Error('offline');
        return { passkeys: clerk.reloaded };
      },
    },
  }),
  useAuth: () => ({ getToken: async () => 'token', sessionId: 'sess_1' }),
  useClerk: () => ({
    session: clerk.session,
    signOut: async () => {
      shell.order.push('clerk.signOut');
    },
  }),
  // Clerk's handler: a reverification hint opens the dialog; success retries, a cancel rejects as Clerk does.
  useReverification:
    (fetcher: (...args: unknown[]) => Promise<unknown>) =>
    async (...args: unknown[]) => {
      const first = (await fetcher(...args)) as { clerk_error?: unknown };
      if (!first || !('clerk_error' in first)) return first;
      if (clerk.dialog === 'cancel') throw Object.assign(new Error('cancelled'), { code: 'reverification_cancelled' });
      return fetcher(...args);
    },
}));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const current = () => ({ locale: 'en', messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined, recordSettled: false, record: null, lastChoice: null, applyAccount: () => undefined });
  return { useConsoleLocale: current, useMessages: () => current().messages, useLocale: () => 'en' };
});

import { ConsoleAuthProvider, SIGN_OUT_DELETE_MS, forgetDeviceUses, useConsoleAuth, type ConsoleAuth } from '../auth-context';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  shell.deleted = 0;
  shell.order = [];
  clerk.dialog = 'verify';
  clerk.passkeys = [];
  clerk.reloaded = [];
  clerk.session = null;
  clerk.calls = [];
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllEnvs();
});

async function mount(clerkMode: boolean): Promise<ConsoleAuth> {
  if (clerkMode) vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
  else vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');
  const seen: { auth: ConsoleAuth | null } = { auth: null };
  function Probe(): null {
    seen.auth = useConsoleAuth();
    return null;
  }
  await act(async () => {
    mounted = create(
      <ConsoleAuthProvider>
        <Probe />
      </ConsoleAuthProvider>,
    );
  });
  return seen.auth as unknown as ConsoleAuth;
}

describe('Sign out deletes deviceUses (section 7.1)', () => {
  it('under Clerk, before Clerk signs out', async () => {
    const auth = await mount(true);
    await act(async () => {
      await auth.signOut();
    });
    expect(shell.order).toEqual(['deleteDeviceUses', 'clerk.signOut']);
  });

  it('in the dev bridge too', async () => {
    const auth = await mount(false);
    await act(async () => {
      await auth.signOut();
    });
    expect(shell.deleted).toBe(1);
  });

  it('forgetDeviceUses never waits longer than the limit', () => {
    expect(SIGN_OUT_DELETE_MS).toBe(1_000);
    return expect(forgetDeviceUses()).resolves.toBe(true);
  });
});

describe('verifyPasskey: Clerk session verification with the passkey factor (section 7.4)', () => {
  it('starts a first-factor verification, runs the passkey, and is true when complete', async () => {
    clerk.session = {
      startVerification: async (params) => {
        clerk.calls.push(`start:${JSON.stringify(params)}`);
        return {};
      },
      verifyWithPasskey: async () => {
        clerk.calls.push('passkey');
        return { status: 'complete' };
      },
    };
    const auth = await mount(true);
    expect(await auth.verifyPasskey()).toBe(true);
    expect(clerk.calls).toEqual(['start:{"level":"first_factor"}', 'passkey']);
  });

  it('is false when it does not complete, throws, or there is no session', async () => {
    clerk.session = { startVerification: async () => ({}), verifyWithPasskey: async () => ({ status: 'needs_first_factor' }) };
    expect(await (await mount(true)).verifyPasskey()).toBe(false);
    act(() => mounted?.unmount());
    clerk.session = { startVerification: async () => ({}), verifyWithPasskey: async () => Promise.reject(new Error('NotAllowedError')) };
    expect(await (await mount(true)).verifyPasskey()).toBe(false);
    act(() => mounted?.unmount());
    clerk.session = null;
    expect(await (await mount(true)).verifyPasskey()).toBe(false);
  });

  it('the dev bridge offers no passkey', async () => {
    expect(await (await mount(false)).verifyPasskey()).toBe(false);
  });
});

describe('reverifySecret: moment 3 takes a password or a code, never a passkey (section 7.2)', () => {
  it('an account without passkeys is done after the dialog', async () => {
    expect(await (await mount(true)).reverifySecret()).toBe('done');
  });

  it('a passkey of the account used since the dialog opened refuses it', async () => {
    clerk.passkeys = [{ lastUsedAt: null }];
    clerk.reloaded = [{ lastUsedAt: new Date(Date.now() + 1_000) }];
    expect(await (await mount(true)).reverifySecret()).toBe('refused');
  });

  it('a passkey not used since is done', async () => {
    clerk.passkeys = [{ lastUsedAt: new Date(Date.now() - 24 * 60 * 60_000) }];
    clerk.reloaded = [{ lastUsedAt: new Date(Date.now() - 24 * 60 * 60_000) }];
    expect(await (await mount(true)).reverifySecret()).toBe('done');
  });

  it('an account that cannot be read again, holding a passkey, fails closed', async () => {
    clerk.passkeys = [{ lastUsedAt: null }];
    clerk.reloaded = 'fail';
    expect(await (await mount(true)).reverifySecret()).toBe('refused');
  });

  it('a closed dialog is cancelled', async () => {
    clerk.dialog = 'cancel';
    expect(await (await mount(true)).reverifySecret()).toBe('cancelled');
  });

  it('the dev bridge counts the dev bearer as a password', async () => {
    expect(await (await mount(false)).reverifySecret()).toBe('done');
  });
});
