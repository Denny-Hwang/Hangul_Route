import type { DeviceSettings } from '@hangul-route/content-schema';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Owner items 6 and 7: one UI language per account. Once the device record read has settled, the
 * newer-wins merge runs once per user: an account that wins is applied to the device record
 * (which tells every tab), a device that wins is copied to the account with its own time. A
 * language chosen afterwards in this tab goes to the account. Clerk's `user.update` replaces
 * `unsafeMetadata` whole, so the adult step's `adultAffirmedAt` always rides along. The sync sits
 * inside the grown-up lock (`AccountLocaleSlot`), so it runs only on an open page.
 */
const view = vi.hoisted(() => ({
  settled: true,
  record: null as DeviceSettings | null,
  lastChoice: null as { uiLocale: 'en' | 'es' | 'ko'; uiLocaleAt: string } | null,
  applied: [] as unknown[],
}));
vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({
    // `ready` (the paint) may come from the wait running out; only `recordSettled` lets the merge run.
    ready: true,
    recordSettled: view.settled,
    record: view.record,
    lastChoice: view.lastChoice,
    applyAccount: (account: unknown) => view.applied.push(account),
    locale: 'en',
  }),
}));
vi.mock('@clerk/clerk-react', () => ({}));

import { AccountLocaleSlot, AccountLocaleSync } from '../auth-context';

const NOW = '2026-10-16T12:00:00.000Z';
const EPOCH = '1970-01-01T00:00:00.000Z';
const AFFIRMED = '2026-10-01T00:00:00.000Z';

function fakeUser(metadata: Record<string, unknown>, id = 'user_1') {
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    user: {
      id,
      unsafeMetadata: metadata,
      update: vi.fn(async (params: { unsafeMetadata: Record<string, unknown> }) => {
        updates.push(params.unsafeMetadata);
        return {};
      }),
    },
  };
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  view.settled = true;
  view.record = null;
  view.lastChoice = null;
  view.applied = [];
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

function render(user: ReturnType<typeof fakeUser>['user'] | null): void {
  act(() => {
    mounted = create(<AccountLocaleSync user={user} />);
  });
}

function rerender(user: ReturnType<typeof fakeUser>['user'] | null): void {
  act(() => {
    mounted?.update(<AccountLocaleSync user={user} />);
  });
}

describe('AccountLocaleSync: the sign-in merge', () => {
  it('an account language seeds a device that never chose; the account is not written', () => {
    view.record = { textSize: 'large' };
    const account = { adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' };
    const u = fakeUser(account);
    render(u.user);
    expect(view.applied).toEqual([{ uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' }]);
    expect(u.updates).toEqual([]);
  });

  it('a device language without a time (from before timestamps, or migrated) loses to the account choice', () => {
    view.record = { uiLocale: 'en' };
    const u = fakeUser({ adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' });
    render(u.user);
    expect(view.applied).toEqual([{ uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' }]);
    expect(u.updates).toEqual([]);
  });

  it('a seeded device language (a ?lang= hand-off, stamped 1970) never overwrites the account', () => {
    view.record = { uiLocale: 'en', uiLocaleAt: EPOCH };
    const u = fakeUser({ adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-01T00:00:00.000Z' });
    render(u.user);
    expect(u.updates).toEqual([]);
    expect(view.applied).toHaveLength(1);
  });

  it('a newer device choice wins and is copied to the account with its own time, keeping adultAffirmedAt', () => {
    view.record = { uiLocale: 'en', uiLocaleAt: NOW };
    const u = fakeUser({ adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' });
    render(u.user);
    expect(view.applied).toEqual([]);
    expect(u.updates).toEqual([{ adultAffirmedAt: AFFIRMED, uiLocale: 'en', uiLocaleAt: NOW }]);
  });

  it('a device language without a time goes to an account with none, stamped 1970', () => {
    view.record = { uiLocale: 'es' };
    const u = fakeUser({ adultAffirmedAt: AFFIRMED });
    render(u.user);
    expect(u.updates).toEqual([{ adultAffirmedAt: AFFIRMED, uiLocale: 'es', uiLocaleAt: EPOCH }]);
  });

  it('waits until the record read has settled (not the paint timeout), then merges once per user', () => {
    // The paint wait ran out while IndexedDB is slow: the record is still null and the merge must not run.
    view.settled = false;
    view.record = null;
    const u = fakeUser({ uiLocale: 'es', uiLocaleAt: '2026-10-01T00:00:00.000Z' });
    render(u.user);
    expect(view.applied).toEqual([]);
    expect(u.updates).toEqual([]);
    // The read arrives: a newer device choice than the account's.
    view.settled = true;
    view.record = { uiLocale: 'ko', uiLocaleAt: NOW };
    rerender(u.user);
    expect(view.applied).toEqual([]);
    expect(u.updates).toEqual([{ uiLocale: 'ko', uiLocaleAt: NOW }]);
    rerender(u.user);
    expect(u.updates).toHaveLength(1);
    // Another account signing in on this tab gets its own merge.
    const other = fakeUser({ uiLocale: 'es', uiLocaleAt: '2026-10-17T00:00:00.000Z' }, 'user_2');
    rerender(other.user);
    expect(view.applied).toHaveLength(1);
  });

  it('a record that cannot be read (settled, null): the account language applies', () => {
    view.record = null;
    const u = fakeUser({ uiLocale: 'ko', uiLocaleAt: NOW });
    render(u.user);
    expect(view.applied).toEqual([{ uiLocale: 'ko', uiLocaleAt: NOW }]);
  });

  it('signed out: nothing is read or written', () => {
    view.record = { uiLocale: 'en' };
    render(null);
    expect(view.applied).toEqual([]);
  });

  it('a refused update is swallowed: the device keeps the choice', async () => {
    view.record = { uiLocale: 'es', uiLocaleAt: NOW };
    const u = fakeUser({});
    u.user.update.mockRejectedValueOnce(new Error('offline'));
    render(u.user);
    await act(async () => undefined);
    expect(u.user.update).toHaveBeenCalledTimes(1);
  });
});

describe('AccountLocaleSync: a language chosen here while signed in', () => {
  it('goes to the account once per choice, merged into the existing metadata', () => {
    view.record = {};
    const u = fakeUser({ adultAffirmedAt: AFFIRMED });
    render(u.user);
    expect(u.updates).toEqual([]);
    view.lastChoice = { uiLocale: 'ko', uiLocaleAt: '2026-10-16T13:00:00.000Z' };
    rerender(u.user);
    expect(u.updates).toEqual([{ adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-16T13:00:00.000Z' }]);
    rerender(u.user);
    expect(u.updates).toHaveLength(1);
  });

  it('a choice made before the merge waits for it, and the merge sends it once', () => {
    view.settled = false;
    view.lastChoice = { uiLocale: 'es', uiLocaleAt: NOW };
    const u = fakeUser({});
    render(u.user);
    expect(u.updates).toEqual([]);
    view.settled = true;
    view.record = { uiLocale: 'es', uiLocaleAt: NOW };
    rerender(u.user);
    expect(u.updates).toEqual([{ uiLocale: 'es', uiLocaleAt: NOW }]);
  });
});

describe('AccountLocaleSlot', () => {
  it('renders the sync only for a signed-in Clerk user', () => {
    act(() => {
      mounted = create(<AccountLocaleSlot />);
    });
    expect(mounted!.toJSON()).toBeNull();
  });
});
