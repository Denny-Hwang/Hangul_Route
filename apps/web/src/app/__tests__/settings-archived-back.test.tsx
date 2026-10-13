import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * F-APP-001 A-5b review (section 3.11: links built after A-5b use the prefix of the space kind): an archived
 * space's settings page sends "Back to console" to the home of the space's persona, so a family-only owner who
 * archives their family lands on the family home, never on the teacher home's "no class yet" state.
 */
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const nav = vi.hoisted(() => ({ pushed: [] as string[] }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => nav.pushed.push(url), replace: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=sp_1'),
}));

vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/console/SettingsParts', () => ({ SettingsSections: () => null }));

const kind = vi.hoisted(() => ({ value: 'family' as string }));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    roster: async () => ({
      ok: true,
      data: {
        space: { id: 'sp_1', kind: kind.value, name: 'Kim family', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: '2026-10-09T00:00:00Z', createdAt: '2026-10-01T00:00:00Z' },
        learners: [],
        joinCode: null,
        joinCodeExpiresAt: null,
      },
    }),
    members: async () => ({ ok: true, data: [] }),
  };
  const session = { accountId: 'acc_1', displayName: 'Kim' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

import SettingsPage from '@/app/(console)/teach/space/settings/page';

const s = getMessages('en').console.settings;
const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  nav.pushed = [];
  kind.value = 'family';
});

async function backToConsole(): Promise<string[]> {
  await act(async () => {
    mounted = create(<SettingsPage />);
  });
  const root = (mounted as unknown as ReactTestRenderer).root;
  const button = root.findAll((n) => n.type === 'button' && textOf(n) === s.backToConsole.cta)[0] as ReactTestInstance;
  act(() => button.props.onClick());
  return nav.pushed;
}

describe('settings of an archived space: Back to console (F-APP-001 A-5b)', () => {
  it('a family goes to the family home', async () => {
    expect(await backToConsole()).toEqual(['/parent']);
  });

  it('a class goes to the teacher home', async () => {
    kind.value = 'class';
    expect(await backToConsole()).toEqual(['/teach/home']);
  });
});
