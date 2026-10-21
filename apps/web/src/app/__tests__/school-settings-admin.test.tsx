import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MemberView } from '@/lib/console/api';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 "School Settings for an admin" (row SA-4; mock admins-panel.html board 27,
 * SA-0b D16): control by control for the owner (unchanged), an administrator (Rename shown; Remove only where the
 * Worker's `canRemove` says so; consent mode and Anonymize roster as read-only text with `ownerOnly`; no Danger zone)
 * and a teacher member (the Worker refuses the school's settings: the page's own forbidden line). Also the school page:
 * no Manage billing for an administrator (D9). react-test-renderer, no DOM.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Amaple'),
}));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/console/auth-context', () => ({ useConsoleAuth: () => ({ reverify: async () => ({ kind: 'unavailable' }) }) }));

const SCHOOL = {
  id: 'space:maple',
  kind: 'school' as const,
  name: 'Maple School',
  parentSpaceId: null,
  settings: { consentMode: 'school' as 'parent' | 'school', anonymizeRoster: true },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const member = (memberId: string, role: MemberView['role'], name: string, canRemove?: boolean): MemberView => ({
  memberKind: 'account',
  memberId,
  role,
  joinedAt: '2026-09-01T00:00:00.000Z',
  name,
  isOwner: role === 'owner',
  ...(canRemove === undefined ? {} : { canRemove }),
});
const state = vi.hoisted(() => ({ viewer: 'ms-park', forbidden: false, removes: [] as string[], patches: [] as unknown[] }));
const MEMBERS = (): MemberView[] => [
  member('ms-park', 'owner', 'Ms Park', state.viewer === 'ms-park' ? false : false),
  member('mr-lee', 'admin', 'Mr Lee', state.viewer === 'ms-park'),
  member('dr-cho', 'admin', 'Dr Cho', state.viewer === 'ms-park'),
  member('ms-han', 'teacher', 'Ms Han', true),
];
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => (state.forbidden ? { ok: false, error: 'forbidden', status: 403 } : ok({ space: { ...SCHOOL }, learners: [], joinCode: 'SCH234', joinCodeExpiresAt: '2026-11-30T00:00:00.000Z', canRename: true, openMoves: false })),
  members: async () => ok(MEMBERS()),
  billingSummary: async () => ({ ok: false, error: 'network', status: -1 }),
  transferRequests: async () => ok({ options: [] }),
  removeMember: async (_s: string, _k: string, id: string) => {
    state.removes.push(id);
    return ok({ removed: true });
  },
  patchSettings: async (_s: string, patch: unknown) => {
    state.patches.push(patch);
    return ok({ space: SCHOOL });
  },
  school: async () =>
    ok({
      school: { ...SCHOOL },
      invite: { joinCode: 'SCH234', joinCodeExpiresAt: '2026-11-30T00:00:00.000Z' },
      license: null,
      limits: { licensed: false, students: 50, teachers: null },
      usage: { students: 12, teachers: 2 },
      thisWeek: { students: 12, practiced: 3, classes: 1, classesWithPlan: 1 },
      classes: [],
      canRename: true,
    }),
  admins: async () => ok({ owner: { accountId: 'ms-park', name: 'Ms Park' }, admins: [], limit: 2 }),
};
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: state.viewer, displayName: 'Viewer' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

import SettingsPage from '@/app/(console)/teach/space/settings/page';
import { SchoolAdmin } from '@/components/console/SchoolAdmin';

const m = getMessages('en');
const s = m.console.settings;
const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.type === 'style' ? '' : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const buttons = (root: ReactTestInstance, label: string): ReactTestInstance[] => root.findAll((n) => n.type === 'button' && textOf(n) === label);

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  Object.assign(state, { viewer: 'ms-park', forbidden: false, removes: [], patches: [] });
});
async function render(node: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(node, { createNodeMock: () => ({ focus: () => undefined, select: () => undefined }) });
  });
  for (let i = 0; i < 4; i += 1) await act(async () => Promise.resolve());
  return (mounted as unknown as ReactTestRenderer).root;
}
const grownUps = (root: ReactTestInstance): ReactTestInstance => root.find((n) => n.type === 'section' && n.props['aria-label'] === s.grownUps.label);

describe('school Settings, control by control', () => {
  it('the owner: unchanged (the switches, Remove on every grown-up but the owner, the Danger zone)', async () => {
    const root = await render(<SettingsPage />);
    expect(byTestId(root, 'settings-rename')).toHaveLength(1);
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio')).toHaveLength(2);
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'checkbox')).toHaveLength(1);
    expect(byTestId(root, 'settings-owner-only')).toHaveLength(0);
    expect(buttons(grownUps(root), s.grownUps.remove.cta)).toHaveLength(3);
    expect(textOf(root)).toContain(s.danger.title);
    expect(textOf(root)).toContain(s.danger.archive.school.cta);
  });

  it('an administrator: Rename shown, the settings as read-only text with ownerOnly, Remove on teachers only, no Danger zone', async () => {
    state.viewer = 'dr-cho';
    const root = await render(<SettingsPage />);
    expect(byTestId(root, 'settings-rename')).toHaveLength(1);
    expect(root.findAll((n) => n.type === 'input' && (n.props.type === 'radio' || n.props.type === 'checkbox'))).toHaveLength(0);
    expect(textOf(byTestId(root, 'settings-consent-readonly')[0] as ReactTestInstance)).toContain(s.consent.school);
    const privacy = textOf(byTestId(root, 'settings-privacy-readonly')[0] as ReactTestInstance);
    expect(privacy).toContain(s.privacy.anonymize);
    expect(privacy).toContain('Rosters show initials.');
    expect(textOf(byTestId(root, 'settings-owner-only')[0] as ReactTestInstance)).toBe("Only the school's owner can change these settings.");
    const remove = buttons(grownUps(root), s.grownUps.remove.cta);
    expect(remove).toHaveLength(1);
    // The one Remove is Ms Han's, the teacher; the owner and the other administrator have none.
    const hanRow = grownUps(root).findAll((n) => n.type === 'div' && textOf(n).startsWith('Ms Han'))[0] as ReactTestInstance;
    expect(buttons(hanRow, s.grownUps.remove.cta)).toHaveLength(1);
    await act(async () => remove[0]?.props.onClick());
    expect(textOf(root)).not.toContain(s.danger.title);
    expect(textOf(root)).not.toContain(s.danger.archive.school.cta);
    expect(textOf(root)).not.toContain(s.danger.deleteTitle);
    // The join code stays theirs (owner and admins).
    expect(textOf(root)).toContain('SCH234');
  });

  it('an administrator, roster names shown: "Rosters show names."', async () => {
    state.viewer = 'dr-cho';
    SCHOOL.settings.anonymizeRoster = false;
    const root = await render(<SettingsPage />);
    expect(textOf(byTestId(root, 'settings-privacy-readonly')[0] as ReactTestInstance)).toContain('Rosters show names.');
    SCHOOL.settings.anonymizeRoster = true;
  });

  it('a teacher member: the Worker refuses, the page says so', async () => {
    state.viewer = 'ms-han';
    state.forbidden = true;
    const root = await render(<SettingsPage />);
    expect(textOf(root)).toContain(s.forbidden);
    expect(byTestId(root, 'settings-owner-only')).toHaveLength(0);
  });
});

describe('the school page', () => {
  it('the owner keeps Manage billing; an administrator has none (D9); both get the Administrators panel', async () => {
    let root = await render(<SchoolAdmin api={api as never} spaceId="space:maple" onSignOut={() => undefined} accountId="ms-park" />);
    expect(buttons(root, m.console.school.licence.manage.cta)).toHaveLength(1);
    expect(byTestId(root, 'admins-panel')).toHaveLength(1);
    act(() => mounted?.unmount());
    mounted = null;
    root = await render(<SchoolAdmin api={api as never} spaceId="space:maple" onSignOut={() => undefined} accountId="dr-cho" />);
    expect(buttons(root, m.console.school.licence.manage.cta)).toHaveLength(0);
    expect(byTestId(root, 'admins-panel')).toHaveLength(1);
  });
});
