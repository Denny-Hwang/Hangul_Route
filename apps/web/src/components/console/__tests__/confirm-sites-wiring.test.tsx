import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleApi, EntitlementView, SchoolView } from '@/lib/console/api';
import RelinkPage from '@/app/(console)/teach/space/relink/page';
import { SchoolAdmin } from '@/components/console/SchoolAdmin';

/**
 * The last console confirms on the page's own dialog (review of #734): making a rescue code on the relink page and
 * making a new teacher invite code on the school page ask in the console language (`ConfirmDialog`, Cancel first),
 * never with the browser's `window.confirm`; OK goes on, Cancel changes nothing. Rendered with react-test-renderer
 * in a browser that draws a modal `<dialog>`.
 */

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Af1'),
}));

const en = getMessages('en');
const c = en.console;
const ok = <T,>(data: T) => ({ ok: true as const, data });
const issued: string[] = [];
const regenerated: string[] = [];
const MINA = { id: 'l:mina', displayName: 'Mina', ageGroup: '10-11', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: null, lastSyncedAt: null, summary: null };

const relinkApi = {
  roster: async () =>
    ok({
      space: { id: 'space:f1', kind: 'family', name: 'The Parks', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
      learners: [MINA],
      joinCode: null,
      joinCodeExpiresAt: null,
    }),
  relinkRequests: async () => ok([]),
  issueRescueCode: async (learnerId: string) => {
    issued.push(learnerId);
    return ok({ code: 'R3SCU3' });
  },
};

vi.mock('@/components/console/use-console', () => ({
  useConsole: () => ({ ready: true, session: { accountId: 'parent-park', displayName: 'Jun' }, api: relinkApi, signOut: () => undefined, m: getMessages('en'), locale: 'en' }),
}));

const license: EntitlementView & { active: boolean } = {
  id: 'ent:1',
  subjectKind: 'space',
  subjectId: 'space:sch',
  planKey: 'group_license',
  status: 'active',
  provider: 'manual',
  providerRef: null,
  customerRef: null,
  seats: 300,
  expiresAt: null,
  promoCode: null,
  updatedAt: '2026-09-20T00:00:00.000Z',
  active: true,
} as EntitlementView & { active: boolean };
const schoolView: SchoolView = {
  school: { id: 'space:sch', kind: 'school', name: 'Seoul school', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: true }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  invite: { joinCode: 'T3ACH9', joinCodeExpiresAt: '2026-10-20T00:00:00.000Z' },
  license,
  limits: { licensed: true, students: 300, teachers: 10 },
  usage: { students: 280, teachers: 4 },
  thisWeek: { students: 38, practiced: 31, classes: 0, classesWithPlan: 0 },
  classes: [],
} as SchoolView;
const schoolApi = {
  school: async () => ok(schoolView),
  members: async () => ok([]),
  regenerateCode: async (spaceId: string) => {
    regenerated.push(spaceId);
    return ok({ joinCode: 'N3WC0D', expiresAt: '2026-10-27T00:00:00.000Z' });
  },
} as unknown as ConsoleApi;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const browserConfirm = vi.fn(() => true);
beforeEach(() => {
  vi.stubGlobal('HTMLDialogElement', class { showModal(): void {} });
  vi.stubGlobal('window', { confirm: browserConfirm });
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  issued.length = 0;
  regenerated.length = 0;
  browserConfirm.mockClear();
  vi.unstubAllGlobals();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function mount(element: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(element);
  });
  await act(async () => undefined);
  if (!mounted) throw new Error('not mounted');
  return (mounted as ReactTestRenderer).root;
}

async function click(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onClick as () => void)();
  });
  await act(async () => undefined);
}

const buttonNamed = (root: ReactTestInstance, label: string): ReactTestInstance => root.find((n) => n.type === 'button' && textOf(n) === label);
const dialogOf = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'dialog');
const answer = async (root: ReactTestInstance, yes: boolean): Promise<void> => {
  const dialog = dialogOf(root)[0] as ReactTestInstance;
  await click(dialog.find((n) => n.type === 'button' && n.props['data-testid'] === (yes ? 'console-confirm-ok' : 'console-confirm-cancel')));
};

describe('the relink page: a new rescue code', () => {
  async function pickMina(): Promise<ReactTestInstance> {
    const root = await mount(<RelinkPage />);
    const select = root.find((n) => n.type === 'select');
    await act(async () => {
      (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: MINA.id } });
    });
    return root;
  }

  it('asks in the console dialog with the learner and that the old code stops; Cancel makes nothing', async () => {
    const root = await pickMina();
    await click(buttonNamed(root, c.relink.issue.cta));
    const [dialog] = dialogOf(root);
    expect(textOf((dialog as ReactTestInstance).find((n) => n.type === 'p'))).toBe(`${c.relink.issueAsk('Mina')} ${c.oldCodeStops}`);
    await answer(root, false);
    expect(issued).toEqual([]);
    expect(dialogOf(root)).toHaveLength(0);
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it('OK makes the code and shows it', async () => {
    const root = await pickMina();
    await click(buttonNamed(root, c.relink.issue.cta));
    await answer(root, true);
    expect(issued).toEqual([MINA.id]);
    expect(textOf(root.find((n) => n.props['data-testid'] === 'rescue-code'))).toBe('R3SCU3');
    expect(browserConfirm).not.toHaveBeenCalled();
  });
});

describe('the school page: a new teacher invite code', () => {
  it('asks in the console dialog that the old code stops; Cancel keeps the code, OK makes a new one', async () => {
    const root = await mount(<SchoolAdmin api={schoolApi} spaceId="space:sch" onSignOut={() => undefined} />);
    await click(buttonNamed(root, c.school.invite.regenerate.cta));
    const [dialog] = dialogOf(root);
    expect(textOf((dialog as ReactTestInstance).find((n) => n.type === 'p'))).toBe(`${c.school.invite.regenerateAsk} ${c.oldCodeStops}`);
    await answer(root, false);
    expect(regenerated).toEqual([]);
    await click(buttonNamed(root, c.school.invite.regenerate.cta));
    await answer(root, true);
    expect(regenerated).toEqual(['space:sch']);
    expect(browserConfirm).not.toHaveBeenCalled();
  });
});
