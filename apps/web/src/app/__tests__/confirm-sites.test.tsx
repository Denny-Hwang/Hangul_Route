import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-DISPLAY-NAV section 8 (row DN-6, review): each confirm site, rendered, opens the console ConfirmSheet
 * with its own question and its `console.confirm.*` verb when its control is pressed; Cancel calls no API, the verb
 * calls it once. The source scan of `confirm-sheet.test.tsx` holds the labels; this holds the wiring, so a site that
 * draws the sheet in one return branch only, or wires its verb to the wrong button, would leave a dead button here.
 * The class moves (the transfers page's prop), the plan update and the settings archive are opened end to end in
 * `class-transfer.test.tsx`, `plan-update-wiring.test.tsx` and `settings-archive-plan-confirm.test.tsx`.
 */
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams('id=space%3Ac1'), router: { push: () => undefined, replace: () => undefined, refresh: () => undefined } }));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.params,
  usePathname: () => '/teach/space',
}));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

/** The API each case sets; every call is recorded by name. A method a case does not set answers "not found". */
const fake = vi.hoisted(() => ({ calls: [] as string[], impl: {} as Record<string, (...args: unknown[]) => unknown> }));
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  const api = new Proxy(
    {},
    {
      get: (_target, name) =>
        typeof name !== 'string' || name === 'then'
          ? undefined
          : (...args: unknown[]) => {
              fake.calls.push(name);
              const impl = fake.impl[name];
              return impl ? Promise.resolve(impl(...args)) : Promise.resolve({ ok: false, error: 'not_found', status: 404 });
            },
    },
  );
  return { useConsole: () => ({ ready: true, session: { accountId: 'acct-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

import SpacePage from '@/app/(console)/teach/space/page';
import SettingsPage from '@/app/(console)/teach/space/settings/page';
import RelinkPage from '@/app/(console)/teach/space/relink/page';
import PlanPage from '@/app/(console)/teach/space/plan/page';
import LecturePage from '@/app/(console)/teach/space/lecture/page';
import { SchoolAdmin } from '@/components/console/SchoolAdmin';

const en = getMessages('en');
const c = en.console;
const T = '2026-09-01T00:00:00.000Z';
const space = (kind: string, name = 'Sunflower') => ({ id: 'space:c1', kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });
const learner = { id: 'profile:mina', displayName: 'Mina', avatar: 'hoya-orange', ageGroup: 'starter', joinedAt: T, lastActiveAt: T, lastSyncedAt: T, summary: null };
const roster = (kind = 'class', joinCode: string | null = 'SUN234') => ({ ok: true, data: { space: space(kind), learners: [learner], joinCode, joinCodeExpiresAt: joinCode ? '2099-11-15T12:00:00.000Z' : null } });
const ok = (data: unknown = {}) => ({ ok: true, data });

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  fake.calls = [];
  fake.impl = {};
  nav.params = new URLSearchParams('id=space%3Ac1');
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);

async function mount(element: JSX.Element): Promise<ReactTestInstance> {
  vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined, location: { origin: 'https://app.test', assign: () => undefined } });
  await act(async () => {
    mounted = create(element, { createNodeMock: () => ({ focus: () => undefined, querySelectorAll: () => [], getBoundingClientRect: () => ({ height: 96 }) }) });
  });
  await act(async () => undefined);
  return (mounted as unknown as ReactTestRenderer).root;
}

/** The button whose words are `label` (the first, or the one inside `scope`). */
function button(scope: ReactTestInstance, label: string): ReactTestInstance {
  const found = scope.findAll((n) => n.type === 'button' && textOf(n).trim() === label);
  if (found.length === 0) throw new Error(`no button "${label}" among ${JSON.stringify(scope.findAll((n) => n.type === 'button').map((n) => textOf(n).trim()))}`);
  return found[0]!;
}

async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    node.props.onClick?.();
  });
  await act(async () => undefined);
}

/** The open sheet: its question and its verb. */
function sheetOf(root: ReactTestInstance): { title: string; verb: string } | null {
  const [sheet] = byTestId(root, 'confirm-sheet');
  if (!sheet) return null;
  expect(sheet.props.role).toBe('alertdialog');
  return { title: textOf(sheet.findByType('h2')), verb: textOf(byTestId(root, 'confirm-sheet-confirm')[0]!) };
}

async function answer(root: ReactTestInstance, yes: boolean): Promise<void> {
  await press(byTestId(root, yes ? 'confirm-sheet-confirm' : 'confirm-sheet-cancel')[0]!);
}

/** Presses `open`, checks the question and the verb, cancels (no `apiCall`), presses again and confirms (one `apiCall`). */
async function askThenAnswer(root: () => ReactTestInstance, open: () => ReactTestInstance, expected: { title: string; verb: string }, apiCall: string): Promise<void> {
  await press(open());
  expect(sheetOf(root())).toEqual(expected);
  await answer(root(), false);
  expect(sheetOf(root())).toBeNull();
  expect(fake.calls.filter((name) => name === apiCall)).toEqual([]);
  await press(open());
  expect(sheetOf(root())).toEqual(expected);
  await answer(root(), true);
  expect(sheetOf(root())).toBeNull();
  expect(fake.calls.filter((name) => name === apiCall)).toEqual([apiCall]);
}

describe('each confirm site opens the ConfirmSheet with its verb, and only the verb acts (AMENDMENTS-DISPLAY-NAV section 8)', () => {
  it('the space page: a new join code (console.confirm.newCode)', async () => {
    fake.impl = { roster: () => roster(), listPlans: () => ok([]), relinkRequests: () => ok([]), regenerateCode: () => ok({ joinCode: 'SUN456', expiresAt: '2099-11-15T12:00:00.000Z' }) };
    const root = await mount(<SpacePage />);
    await askThenAnswer(() => root, () => button(root, c.space.regenerate.cta), { title: c.space.regenerateAsk('Sunflower'), verb: c.confirm.newCode }, 'regenerateCode');
  });

  it('a school\'s page: a new invite code (console.confirm.newCode)', async () => {
    const school = {
      school: { ...space('school', 'Seoul school'), id: 'space:sch' },
      invite: { joinCode: 'T3ACH9', joinCodeExpiresAt: '2099-10-20T00:00:00.000Z' },
      license: null,
      limits: { licensed: false, students: null, teachers: null },
      usage: { students: 0, teachers: 1 },
      thisWeek: { students: 0, practiced: 0, classes: 0, classesWithPlan: 0 },
      classes: [],
    };
    fake.impl = { school: () => ok(school), members: () => ok([]), regenerateCode: () => ok({ joinCode: 'T3ACH0', expiresAt: '2099-10-20T00:00:00.000Z' }) };
    const api = (await import('@/components/console/use-console')).useConsole().api;
    const root = await mount(<SchoolAdmin api={api as never} spaceId="space:sch" onSignOut={() => undefined} />);
    await askThenAnswer(() => root, () => button(root, c.school.invite.regenerate.cta), { title: c.school.invite.regenerateAsk, verb: c.confirm.newCode }, 'regenerateCode');
  });

  describe('the settings page', () => {
    const members = [
      { memberKind: 'account', memberId: 'acct-kim', role: 'owner', joinedAt: T, name: 'Ms Kim', isOwner: true },
      { memberKind: 'account', memberId: 'acct-lee', role: 'teacher', joinedAt: T, name: 'Mr Lee', isOwner: false },
      { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: T, name: 'Mina', isOwner: false },
    ];
    const settings = () => ({ roster: () => roster(), members: () => ok(members), regenerateCode: () => ok({ joinCode: 'SUN456', expiresAt: '2099-11-15T12:00:00.000Z' }), removeMember: () => ok({}) });

    it('a new join code (console.confirm.newCode)', async () => {
      fake.impl = settings();
      const root = await mount(<SettingsPage />);
      await askThenAnswer(() => root, () => button(root, c.settings.joinCode.regenerate.cta), { title: c.settings.joinCode.regenerateAsk, verb: c.confirm.newCode }, 'regenerateCode');
    });

    it('remove a grown-up (console.confirm.remove)', async () => {
      fake.impl = settings();
      const root = await mount(<SettingsPage />);
      const section = () => root.find((n) => n.type === 'section' && n.props['aria-label'] === c.settings.grownUps.label);
      await askThenAnswer(() => root, () => button(section(), c.settings.grownUps.remove.cta), { title: c.settings.grownUps.removeAsk('Mr Lee', 'Sunflower'), verb: c.confirm.remove }, 'removeMember');
    });

    it('remove a learner (console.confirm.remove)', async () => {
      fake.impl = settings();
      const root = await mount(<SettingsPage />);
      const section = () => root.find((n) => n.type === 'section' && n.props['aria-label'] === c.settings.learners.label);
      await askThenAnswer(() => root, () => button(section(), c.settings.learners.remove.class.cta), { title: c.settings.learners.removeAsk('Mina', 'Sunflower'), verb: c.confirm.remove }, 'removeMember');
    });
  });

  it('the relink page: a rescue code for a learner of a family (console.confirm.issueCode)', async () => {
    // Only a family re-issues a rescue code (SEC-4).
    fake.impl = { roster: () => roster('family'), relinkRequests: () => ok([]), issueRescueCode: () => ok({ code: 'TIGER-MOON-RIVER-APPLE-482139' }) };
    const root = await mount(<RelinkPage />);
    const select = root.find((n) => n.type === 'select' && n.props['aria-label'] === c.relink.learnerLabel);
    await act(async () => {
      select.props.onChange({ target: { value: learner.id } });
    });
    await askThenAnswer(() => root, () => button(root, c.relink.issue.cta), { title: c.relink.issueAsk('Mina'), verb: c.confirm.issueCode }, 'issueRescueCode');
  });

  describe('the plan page', () => {
    const plan = (id: string, title: string, publishedAt: string | null) => ({
      id,
      spaceId: 'space:c1',
      authorAccountId: 'acct-kim',
      title,
      items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', day: null }],
      targetLearnerIds: null,
      publishedAt,
      archivedAt: null,
      createdAt: T,
      updatedAt: T,
      meta: null,
    });

    it('archive the plan (console.confirm.archive)', async () => {
      fake.impl = { roster: () => roster(), listPlans: () => ok([plan('plan:p', 'Week 3', T)]), entitlements: () => ok([]), archivePlan: () => ok({}) };
      const root = await mount(<PlanPage />);
      await askThenAnswer(() => root, () => button(root, c.plan.archive.cta), { title: c.archivePlanConfirm, verb: c.confirm.archive }, 'archivePlan');
    });

    it('open another plan with changes not saved (console.confirm.discard)', async () => {
      nav.params = new URLSearchParams('id=space%3Ac1&plan=plan%3Ad');
      fake.impl = { roster: () => roster(), listPlans: () => ok([plan('plan:d', 'Week 4 draft', null), plan('plan:p', 'Week 3', T)]), entitlements: () => ok([]) };
      const root = await mount(<PlanPage />);
      // An edit in the builder: the plan is for some learners only.
      const only = root.find((n) => n.type === 'input' && n.props.type === 'radio' && n.props.name === 'targets' && n.props.checked === false);
      await act(async () => {
        only.props.onChange();
      });
      const chipOf = (title: string) => byTestId(root, 'plan-chip').find((n) => textOf(n).includes(title))!;
      await press(chipOf('Week 3'));
      expect(sheetOf(root)).toEqual({ title: c.curriculum.builder.discardEdits, verb: c.confirm.discard });
      await answer(root, false);
      // Cancel keeps the draft open, its edit included.
      expect(root.find((n) => n.type === 'input' && n.props.type === 'radio' && n.props.name === 'targets' && n.props.checked === true).props.onChange).toBe(only.props.onChange);
      await press(chipOf('Week 3'));
      expect(sheetOf(root)?.verb).toBe(c.confirm.discard);
      await answer(root, true);
      expect(sheetOf(root)).toBeNull();
      // The published plan is open now: its readout, with its Archive.
      expect(root.findAll((n) => n.type === 'button' && textOf(n).trim() === c.plan.archive.cta)).toHaveLength(1);
    });
  });

  describe('the lecture page', () => {
    const lessonPlan = {
      id: 'plan:p',
      spaceId: 'space:c1',
      authorAccountId: 'acct-kim',
      title: 'Week 3',
      items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', day: null }],
      targetLearnerIds: null,
      publishedAt: T,
      archivedAt: null,
      createdAt: T,
      updatedAt: T,
      meta: null,
    };

    async function lectureWithCode(kind = 'class'): Promise<ReactTestInstance> {
      vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'enabled');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
      fake.impl = { roster: () => roster(kind), listPlans: () => ok([lessonPlan]) };
      const root = await mount(<LecturePage />);
      // Customize, then the plan's outline gets its join code: the outline is edited and the link would carry the code.
      await press(byTestId(root, 'lecture-customize-toggle')[0]!);
      await press(button(root, kind === 'family' ? c.lecture.outline.addFamilyCode.cta : c.lecture.outline.addClassCode.cta));
      return root;
    }

    it('copy a link that holds the family join code: the family words (AMENDMENTS-LECTURE-V2 section 6)', async () => {
      const root = await lectureWithCode('family');
      vi.stubGlobal('navigator', { clipboard: { writeText: async () => undefined } });
      await press(byTestId(root, 'copy-presenter-link')[0]!);
      expect(sheetOf(root)).toEqual({ title: c.lecture.copyHasFamilyCode, verb: c.confirm.copyAnyway });
      await answer(root, false);
    });

    it('copy a link that holds the join code (console.confirm.copyAnyway)', async () => {
      const writes: string[] = [];
      const root = await lectureWithCode();
      vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => void writes.push(text) } });
      const copy = () => byTestId(root, 'copy-presenter-link')[0]!;
      await press(copy());
      expect(sheetOf(root)).toEqual({ title: c.lecture.copyHasCode, verb: c.confirm.copyAnyway });
      await answer(root, false);
      expect(writes).toEqual([]);
      await press(copy());
      await answer(root, true);
      expect(writes).toHaveLength(1);
    });

    it('a new source over an edited outline (console.confirm.replace)', async () => {
      const root = await lectureWithCode();
      const catalogue = () => root.find((n) => n.type === 'input' && n.props.type === 'radio' && n.props.name === 'source' && n.props.checked === false && !n.props.disabled);
      await act(async () => {
        catalogue().props.onChange();
      });
      await act(async () => undefined);
      expect(sheetOf(root)).toEqual({ title: c.lecture.replaceOutline, verb: c.confirm.replace });
      await answer(root, false);
      // Cancel keeps the edited outline (its class code still in it).
      expect(byTestId(root, 'copy-presenter-link')[0]!.props.disabled).toBeFalsy();
      await act(async () => {
        catalogue().props.onChange();
      });
      await act(async () => undefined);
      await answer(root, true);
      expect(sheetOf(root)).toBeNull();
    });
  });
});
