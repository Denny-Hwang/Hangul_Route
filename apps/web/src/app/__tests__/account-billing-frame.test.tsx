import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '@/lib/console/api';

/**
 * F-APP-001 A-5c (review): `/account/billing` already reads the spaces list, so it hands that list to the
 * adult frame instead of letting the frame read `GET /api/spaces` a second time.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

// The frame has its own tests (adult-frame.test.tsx); here it records the spaces the page hands it.
const frame = vi.hoisted(() => ({ spaces: [] as unknown[] }));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, spaces }: { children: ReactNode; spaces?: unknown }) => {
    frame.spaces.push(spaces);
    return <main>{children}</main>;
  },
}));

const calls = vi.hoisted(() => ({ listSpaces: 0, spaces: null as unknown, entitlements: null as unknown, api: true }));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    listSpaces: async () => {
      calls.listSpaces += 1;
      return calls.spaces;
    },
    entitlements: async () => calls.entitlements,
  };
  const session = { accountId: 'acc_1', displayName: 'Kim' };
  const signOut = (): undefined => undefined;
  return {
    useConsole: () => ({ ready: true, session, api: calls.api ? api : null, signOut, m: messages('en'), locale: 'en' }),
  };
});

import BillingPage from '@/app/(console)/account/billing/page';

const family: SpaceListItem = {
  space: { id: 'sp_f', kind: 'family', name: 'Home', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
  role: 'owner',
  counts: { learners: 1, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  frame.spaces = [];
  calls.listSpaces = 0;
  calls.api = true;
  calls.spaces = { ok: true, data: [family] };
  calls.entitlements = { ok: true, data: [] };
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

async function render(): Promise<void> {
  await act(async () => {
    mounted = create(<BillingPage />);
  });
}

describe('/account/billing hands its spaces to the frame (F-APP-001 A-5c)', () => {
  it('loading, then the list it read: the frame never reads its own', async () => {
    await render();
    expect(frame.spaces[0]).toBeNull();
    expect(frame.spaces.at(-1)).toEqual([family]);
    expect(frame.spaces.every((entry) => entry !== undefined)).toBe(true);
    expect(calls.listSpaces).toBe(1);
  });

  it('a failed spaces read reaches the frame as failed; a failed entitlements read keeps the spaces', async () => {
    calls.spaces = { ok: false, error: 'network' };
    await render();
    expect(frame.spaces.at(-1)).toBe('failed');
    act(() => mounted?.unmount());
    mounted = null;
    calls.spaces = { ok: true, data: [family] };
    calls.entitlements = { ok: false, error: 'network' };
    await render();
    expect(frame.spaces.at(-1)).toEqual([family]);
  });

  it('without an API address the frame is told the list failed (no nav), as it would decide itself', async () => {
    calls.api = false;
    await render();
    expect(frame.spaces.at(-1)).toBe('failed');
  });
});
