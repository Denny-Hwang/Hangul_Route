import type { DeviceSettings } from '@hangul-route/content-schema';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Owner items 6 and 7: one UI language per account. After a sign-in, once the device record is
 * read, the newer-wins merge runs once per user: an account that wins is applied to the device
 * record (which tells every tab), a device that wins is copied to the account. A language chosen
 * afterwards in this tab goes to the account. Clerk's `user.update` replaces `unsafeMetadata`
 * whole, so the adult step's `adultAffirmedAt` always rides along.
 */
const view = vi.hoisted(() => ({
  ready: true,
  record: null as DeviceSettings | null,
  lastChoice: null as { uiLocale: 'en' | 'es' | 'ko'; uiLocaleAt: string } | null,
  applied: [] as DeviceSettings[],
}));
vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({
    ready: view.ready,
    record: view.record,
    lastChoice: view.lastChoice,
    applyRecord: (r: DeviceSettings) => view.applied.push(r),
    locale: 'en',
  }),
}));
vi.mock('@clerk/clerk-react', () => ({}));

import { AccountLocaleSync } from '../auth-context';

const NOW = '2026-10-16T12:00:00.000Z';
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
  view.ready = true;
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
    mounted = create(<AccountLocaleSync user={user} now={() => NOW} />);
  });
}

function rerender(user: ReturnType<typeof fakeUser>['user'] | null): void {
  act(() => {
    mounted?.update(<AccountLocaleSync user={user} now={() => NOW} />);
  });
}

describe('AccountLocaleSync: the sign-in merge', () => {
  it('an account language seeds a device that never chose; the account is not written', () => {
    view.record = { textSize: 'large' };
    const u = fakeUser({ adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' });
    render(u.user);
    expect(view.applied).toEqual([{ textSize: 'large', uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' }]);
    expect(u.updates).toEqual([]);
  });

  it('a device choice without a time wins and is copied to the account, keeping adultAffirmedAt', () => {
    view.record = { uiLocale: 'en' };
    const u = fakeUser({ adultAffirmedAt: AFFIRMED, uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' });
    render(u.user);
    expect(view.applied).toEqual([]);
    expect(u.updates).toEqual([{ adultAffirmedAt: AFFIRMED, uiLocale: 'en', uiLocaleAt: NOW }]);
  });

  it('waits for the record, then merges once per user', () => {
    view.ready = false;
    const u = fakeUser({ uiLocale: 'es', uiLocaleAt: NOW });
    render(u.user);
    expect(view.applied).toEqual([]);
    view.ready = true;
    view.record = {};
    rerender(u.user);
    expect(view.applied).toEqual([{ uiLocale: 'es', uiLocaleAt: NOW }]);
    rerender(u.user);
    expect(view.applied).toHaveLength(1);
    // Another account signing in on this tab gets its own merge.
    const other = fakeUser({ uiLocale: 'ko', uiLocaleAt: NOW }, 'user_2');
    rerender(other.user);
    expect(view.applied).toHaveLength(2);
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

  it('a choice made before the merge waits for it (the merge decides first)', () => {
    view.ready = false;
    view.lastChoice = { uiLocale: 'es', uiLocaleAt: NOW };
    const u = fakeUser({});
    render(u.user);
    expect(u.updates).toEqual([]);
  });
});
