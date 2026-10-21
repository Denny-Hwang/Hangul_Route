import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster, RosterLearner, SpaceListItem } from '@/lib/console/api';
import { findBannedWord } from '@/lib/console/banned-text';
import { codeExpiry } from '@/lib/console/rollup';

/**
 * F-APP-001 A-5b, section 3.8 (design/screens/app-shell/parent-home.md): the family home. Cards in
 * join order (never by activity), minutes labelled "last 7 days", card actions by flag, the empty
 * family with the join code and the hand-off to the learner app, the no-family state, cross-links,
 * one family failing on its own, no banned words, links with ids under /parent/space.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const nav = vi.hoisted(() => ({ pushed: [] as string[] }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => nav.pushed.push(url), replace: () => undefined }),
}));

const shellWrites = vi.hoisted(() => ({ personas: [] as string[] }));
vi.mock('@/lib/console/shell-store', () => ({
  writeLastPersona: async (persona: string) => {
    shellWrites.personas.push(persona);
    return true;
  },
}));

const handoff = vi.hoisted(() => ({ calls: [] as Array<{ code: string }> }));
vi.mock('@/lib/console/join-handoff', () => ({
  openAppWithJoinCode: (input: { code: string }) => {
    handoff.calls.push({ code: input.code });
  },
}));

// The frame has its own tests (adult-frame.test.tsx); here it records the spaces the page hands it.
const frame = vi.hoisted(() => ({ spaces: [] as unknown[] }));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, spaces }: { children: ReactNode; spaces?: unknown }) => {
    frame.spaces.push(spaces);
    return <main>{children}</main>;
  },
}));

const data = vi.hoisted(() => ({
  list: null as unknown,
  rosters: {} as Record<string, unknown>,
  rosterCalls: [] as string[],
  regenerated: [] as string[],
  regenerate: null as null | (() => Promise<unknown>),
  listPending: false,
  /** [TV] The family's class-scope read: the default lists nobody, so no card shows. */
  scope: null as unknown,
  scopeThrows: false,
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  // One api object for the whole test, as the real hook keeps it (the page's load depends on it).
  const api = {
    listSpaces: () => (data.listPending ? new Promise(() => undefined) : Promise.resolve(data.list)),
    roster: async (id: string) => {
      data.rosterCalls.push(id);
      return data.rosters[id] ?? { ok: false, error: 'network' };
    },
    regenerateCode: async (id: string) => {
      data.regenerated.push(id);
      if (data.regenerate) return data.regenerate();
      return { ok: true, data: { joinCode: 'NEWCD7', expiresAt: '2026-11-01T00:00:00Z' } };
    },
    // [TV] the family class cards (FamilyClassCards) read these on every live family section.
    classScope: async () => {
      if (data.scopeThrows) throw new Error('network');
      return data.scope ?? { ok: true, data: { current: 'class-scope-2026-10', learners: [] } };
    },
    acknowledgeClassScope: async () => ({ ok: true, data: { version: 'class-scope-2026-10', ackedAt: '2026-10-12T12:00:00Z' } }),
    moveNotices: async () => ({ ok: true, data: [] }),
    markMoveSeen: async () => ({ ok: true, data: { seen: true } }),
  };
  const session = { accountId: 'acc_1', displayName: 'Ms Kim' };
  const signOut = (): undefined => undefined;
  return {
    useConsole: () => ({ ready: true, session, api, signOut, m: messages('en'), locale: 'en' }),
  };
});

import ParentHomePage from '@/app/(console)/parent/page';

const en = getMessages('en');
const p = en.console.parentHome;

function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], name = `${id} name`, createdAt = '2026-10-01T00:00:00Z'): SpaceListItem {
  return {
    space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt },
    role,
    counts: { learners: 2, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

function learner(id: string, name: string, joinedAt: string, minutes: number, lastActiveAt = '2026-10-12T08:00:00Z'): RosterLearner {
  return {
    id,
    displayName: name,
    ageGroup: '5-7',
    avatar: 'cub',
    joinedAt,
    lastActiveAt,
    lastSyncedAt: lastActiveAt,
    summary: { minutesLast7d: minutes } as RosterLearner['summary'],
  } as RosterLearner;
}

function roster(space: SpaceListItem, learners: RosterLearner[], joinCode: string | null = 'K7MPQ4'): { ok: true; data: Roster } {
  return { ok: true, data: { space: space.space, learners, joinCode, joinCodeExpiresAt: '2026-11-01T00:00:00Z' } as Roster };
}

const family = item('sp_f', 'family', 'owner', 'Kim family');
const grandma = item('sp_g', 'family', 'caregiver', "Grandma's house", '2026-10-05T00:00:00Z');
const klass = item('sp_c', 'class', 'teacher');
const sam = learner('profile:sam', 'Sam', '2026-09-01T00:00:00Z', 42);
const mina = learner('profile:mina', 'Mina', '2026-09-05T00:00:00Z', 15, '2026-10-06T08:00:00Z');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  nav.pushed = [];
  shellWrites.personas = [];
  handoff.calls = [];
  frame.spaces = [];
  data.rosters = {};
  data.rosterCalls = [];
  data.regenerated = [];
  data.regenerate = null;
  data.listPending = false;
  data.scope = null;
  data.scopeThrows = false;
  vi.unstubAllEnvs();
  // Reports are on by default since F-REPORT-001 RP-11; these cases start from every sibling flag off and switch on what they need.
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'false');
  // Notes are on by default since FB-14; this suite's baseline is every sibling flag off.
  vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'false');
  // Lecture mode is on by default since AMENDMENTS-LECTURE-V2 LV-7; its card has its own suite (lecture-mode-card.test.tsx).
  vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'off');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function render(list: SpaceListItem[] | 'fail'): Promise<ReactTestRenderer> {
  data.list = list === 'fail' ? { ok: false, error: 'network' } : { ok: true, data: list };
  await act(async () => {
    mounted = create(<ParentHomePage />);
  });
  return mounted as unknown as ReactTestRenderer;
}

const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const allText = (r: ReactTestRenderer): string => textOf(r.root);
const cardNames = (r: ReactTestRenderer): string[] => byTestId(r, 'learner-card').map((card) => card.props['aria-label'] as string);
const hrefs = (r: ReactTestRenderer): string[] => r.root.findAll((n) => n.type === 'a').map((n) => n.props.href as string);

describe('the family home (F-APP-001 A-5b)', () => {
  it('the Lecture mode card is drawn with the launch default (on since AMENDMENTS-LECTURE-V2 LV-7) and not with the kill switch off', async () => {
    vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', undefined);
    vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com', hash: '' }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    data.rosters = { sp_f: roster(family, [sam]) };
    let r = await render([family]);
    expect(byTestId(r, 'lecture-card')).toHaveLength(1);
    act(() => mounted?.unmount());
    vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'off');
    r = await render([family]);
    expect(byTestId(r, 'lecture-card')).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('one section per family, headed by its name, with one card per learner in join order', async () => {
    data.rosters = { sp_f: roster(family, [mina, sam]) };
    const r = await render([family, klass]);
    expect(r.root.findAll((n) => n.type === 'h2').map(textOf)).toEqual(['Kim family']);
    expect(cardNames(r)).toEqual(['Sam', 'Mina']);
    expect(r.root.findAll((n) => n.type === 'h1').map(textOf)).toEqual([p.title]);
  });

  it('keeps the order when activity changes (behaviour 25), and labels minutes "last 7 days"', async () => {
    data.rosters = { sp_f: roster(family, [learner('profile:mina', 'Mina', mina.joinedAt, 300, '2026-10-12T11:00:00Z'), learner('profile:sam', 'Sam', sam.joinedAt, 0, '2026-09-01T00:00:00Z')]) };
    const r = await render([family]);
    expect(cardNames(r)).toEqual(['Sam', 'Mina']);
    expect(allText(r)).toContain('Minutes, last 7 days: 0');
    expect(allText(r)).toContain('Minutes, last 7 days: 300');
    expect(allText(r)).toContain('Last active today');
  });

  it('flags off (today): each card offers Open to the family roster only', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family]);
    const card = byTestId(r, 'learner-card')[0] as ReactTestInstance;
    const links = card.findAll((n) => n.type === 'a');
    expect(links.map((a) => [textOf(a), a.props.href])).toEqual([[p.child.open, '/parent/space?id=sp_f']]);
  });

  it('reports, notes and the Learning Route on: See report, Send a note and Learning Route (behaviour 26)', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family]);
    const card = byTestId(r, 'learner-card')[0] as ReactTestInstance;
    expect(card.findAll((n) => n.type === 'a').map(textOf)).toEqual([p.child.seeReport, p.child.sendNote, p.child.route]);
  });

  it('family actions: Plan the week, Plan the term and Family settings under /parent/space; Lessons with the lesson browser on', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    let r = await render([family]);
    expect(byTestId(r, 'family-plan-week')[0]?.props.href).toBe('/parent/space/plan?id=sp_f');
    expect(byTestId(r, 'family-plan-term')[0]?.props.href).toBe('/parent/space/curriculum?id=sp_f');
    expect(byTestId(r, 'family-settings')[0]?.props.href).toBe('/parent/space/settings?id=sp_f');
    expect(byTestId(r, 'family-lessons')).toHaveLength(0);
    act(() => mounted?.unmount());
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com' } });
    r = await render([family]);
    expect(byTestId(r, 'family-lessons')[0]?.props.href).toBe('/browse#s=nav');
    // The action grid's cell is the link's wrapper: the link grows to fill it, as the other actions do.
    expect(byTestId(r, 'family-lessons')[0]?.props.style).toMatchObject({ flex: '1 1 auto' });
    vi.unstubAllGlobals();
  });

  it('Lessons opens through the All lessons opener: a plain click is held for the pass, never a bare navigation (#518/#525 follow-up 1)', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com' } });
    const r = await render([family]);
    const link = byTestId(r, 'family-lessons')[0];
    const preventDefault = vi.fn();
    await act(async () => {
      link?.props.onClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault });
    });
    await act(async () => undefined);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    // This test window has no session storage, so the opener stays and says why (section 4.3 step 4).
    expect(textOf(byTestId(r, 'family-lessons-notice')[0] as ReactTestInstance)).toBe(getMessages('en').console.browse.storageBlocked);
    vi.unstubAllGlobals();
  });

  it('Add a learner is a disclosure: it opens the join code panel and the join line, and a second press closes it', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family]);
    const button = byTestId(r, 'family-add-learner')[0] as ReactTestInstance;
    expect(button.props['aria-expanded']).toBe(false);
    expect(byTestId(r, 'join-panel')).toHaveLength(0);
    act(() => button.props.onClick());
    expect((byTestId(r, 'family-add-learner')[0] as ReactTestInstance).props['aria-expanded']).toBe(true);
    const panel = byTestId(r, 'join-panel')[0] as ReactTestInstance;
    const region = r.root.findAll((n) => typeof n.type === 'string' && n.props.id === button.props['aria-controls']);
    expect(region).toHaveLength(1);
    expect(region[0]?.props.hidden).toBeUndefined();
    expect(region[0]?.findAll((n) => n === panel)).toHaveLength(1);
    expect(textOf(panel)).toContain('K7MPQ4');
    expect(byTestId(r, 'open-app')).toHaveLength(0);
    act(() => (byTestId(r, 'family-add-learner')[0] as ReactTestInstance).props.onClick());
    expect(byTestId(r, 'join-panel')).toHaveLength(0);
  });

  it('Add a learner points aria-controls at a region that is in the page while collapsed, hidden until opened', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family]);
    const button = byTestId(r, 'family-add-learner')[0] as ReactTestInstance;
    const region = r.root.findAll((n) => typeof n.type === 'string' && n.props.id === button.props['aria-controls']);
    expect(region).toHaveLength(1);
    expect(region[0]?.props.hidden).toBe(true);
  });

  it("names each family's actions apart from its section, so two landmarks never share a name", async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family]);
    const aside = r.root.findByType('aside');
    expect(aside.props['aria-label']).toBe(p.actionsFor('Kim family'));
    expect(aside.props['aria-label']).not.toBe('Kim family');
  });

  it('shows when the join code expires under the code', async () => {
    data.rosters = { sp_f: roster(family, []) };
    const r = await render([family]);
    expect(allText(r)).toContain(codeExpiry('2026-11-01T00:00:00Z', new Date('2026-10-12T12:00:00Z'), 'en'));
  });

  it('draws no minutes line for a learner with no summary yet (never a 0 that was not measured)', async () => {
    data.rosters = { sp_f: roster(family, [{ ...sam, summary: null } as RosterLearner, mina]) };
    const r = await render([family]);
    const [samCard, minaCard] = byTestId(r, 'learner-card') as [ReactTestInstance, ReactTestInstance];
    expect(textOf(samCard)).not.toContain('Minutes, last 7 days');
    expect(textOf(minaCard)).toContain('Minutes, last 7 days: 15');
  });

  it('[TV] a learner whose family has not read the class update gets the class-scope card in the family section', async () => {
    data.rosters = { sp_f: roster(family, [mina]) };
    data.scope = { ok: true, data: { current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:mina', name: 'Mina', needed: true }] } };
    const r = await render([family]);
    expect(byTestId(r, 'class-scope-card')).toHaveLength(1);
    expect(cardNames(r)).toEqual(['Mina']);
  });

  it('[TV] no class-scope card when nobody needs it, and a failed class-scope read leaves the page as it is', async () => {
    data.rosters = { sp_f: roster(family, [mina]) };
    const r = await render([family]);
    expect(byTestId(r, 'family-class-cards')).toHaveLength(0);
    act(() => mounted?.unmount());
    data.scopeThrows = true;
    const failed = await render([family]);
    expect(byTestId(failed, 'family-class-cards')).toHaveLength(0);
    expect(cardNames(failed)).toEqual(['Mina']);
  });

  it('cards carry the card shadow token', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family]);
    expect(String((byTestId(r, 'learner-card')[0] as ReactTestInstance).props.style.boxShadow)).toMatch(/^0 2px 8px #2A1F14/);
  });

  it('loading: skeleton cards with no numbers and aria-busy, no learner card', async () => {
    data.listPending = true;
    const r = await render([family]);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props['aria-busy'] === true).length).toBeGreaterThan(0);
    expect(byTestId(r, 'learner-card')).toHaveLength(0);
    const visible = (n: ReactTestInstance): string => (n.type === 'style' ? '' : n.children.map((child) => (typeof child === 'string' ? child : visible(child))).join(''));
    expect(visible(r.root)).not.toMatch(/\d/);
  });

  it('an archived family: after the live ones, labelled archived, with Family settings only (no join code, no hand-off, no plans, no Add a learner)', async () => {
    const archived: SpaceListItem = { ...item('sp_old', 'family', 'owner', 'Old family', '2026-08-01T00:00:00Z'), space: { ...item('sp_old', 'family', 'owner', 'Old family', '2026-08-01T00:00:00Z').space, archivedAt: '2026-10-09T00:00:00Z' } };
    data.rosters = { sp_f: roster(family, [sam]), sp_old: roster(archived, []) };
    const r = await render([archived, family]);
    const sections = r.root.findAll((n) => n.type === 'section' && typeof n.props['aria-labelledby'] === 'string');
    expect(sections.map((section) => textOf(section.findByType('h2')))).toEqual(['Kim family', `Old family ${en.console.home.archived}`]);
    const old = sections[1] as ReactTestInstance;
    const ids = old.findAll((n) => typeof n.type === 'string' && typeof n.props['data-testid'] === 'string').map((n) => n.props['data-testid'] as string);
    expect(ids).toContain('family-settings');
    for (const hidden of ['join-panel', 'open-app', 'create-code', 'family-plan-week', 'family-plan-term', 'family-add-learner']) expect(ids).not.toContain(hidden);
    expect(textOf(old)).not.toContain('K7MPQ4');
  });

  it('an archived family with learners keeps their cards and Family settings, and no Add a learner', async () => {
    const archived: SpaceListItem = { ...family, space: { ...family.space, archivedAt: '2026-10-09T00:00:00Z' } };
    data.rosters = { sp_f: roster(archived, [sam]) };
    const r = await render([archived]);
    expect(cardNames(r)).toEqual(['Sam']);
    expect(byTestId(r, 'family-add-learner')).toHaveLength(0);
    expect(byTestId(r, 'family-settings')).toHaveLength(1);
  });

  it('a caregiver (not the owner) gets no Create a code: a line asks the family owner instead (the API answers 403)', async () => {
    data.rosters = { sp_g: roster(grandma, [], null) };
    const r = await render([grandma]);
    expect(byTestId(r, 'create-code')).toHaveLength(0);
    expect(byTestId(r, 'open-app')).toHaveLength(0);
    expect(allText(r)).toContain(p.askOwner);
  });

  it('Create a code is disabled while it runs (no second code on a double tap) and says so when it fails', async () => {
    let finish: (value: unknown) => void = () => undefined;
    data.regenerate = () => new Promise((resolve) => (finish = resolve));
    data.rosters = { sp_f: roster(family, [], null) };
    const r = await render([family]);
    await act(async () => (byTestId(r, 'create-code')[0] as ReactTestInstance).props.onClick());
    expect((byTestId(r, 'create-code')[0] as ReactTestInstance).props.disabled).toBe(true);
    await act(async () => (byTestId(r, 'create-code')[0] as ReactTestInstance).props.onClick());
    expect(data.regenerated).toEqual(['sp_f']);
    await act(async () => finish({ ok: false, status: 403, error: 'forbidden' }));
    expect((byTestId(r, 'create-code')[0] as ReactTestInstance).props.disabled).toBe(false);
    expect(allText(r)).toContain(en.console.space.regenerateFailed);
    expect(byTestId(r, 'open-app')).toHaveLength(0);
  });

  it('a failed copy says so; the code stays on screen', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } });
    data.rosters = { sp_f: roster(family, []) };
    const r = await render([family]);
    const copyButton = r.root.findAll((n) => n.type === 'button' && textOf(n) === en.console.joinCode.copy.cta)[0] as ReactTestInstance;
    await act(async () => copyButton.props.onClick());
    expect(allText(r)).toContain(p.copyFailed);
    expect(allText(r)).toContain('K7MPQ4');
    vi.unstubAllGlobals();
  });

  it('a family with no learner: the join code large, the line with the learner app labels, and Open the app on this device (behaviour 28)', async () => {
    data.rosters = { sp_f: roster(family, []) };
    const r = await render([family]);
    expect(allText(r)).toContain(p.empty.title);
    expect(allText(r)).toContain(p.empty.line(en.learner.home.profileLabel, en.caregiver.spaces.title, en.caregiver.spaces.join.cta));
    const code = byTestId(r, 'join-code')[0] as ReactTestInstance;
    expect(code.props['aria-hidden']).toBe(true);
    expect(allText(r)).toContain('K 7 M P Q 4');
    expect(byTestId(r, 'family-add-learner')).toHaveLength(0);
    act(() => (byTestId(r, 'open-app')[0] as ReactTestInstance).props.onClick());
    expect(handoff.calls).toEqual([{ code: 'K7MPQ4' }]);
  });

  it('a family with no learner and no code yet: Create a code, then the code', async () => {
    data.rosters = { sp_f: roster(family, [], null) };
    const r = await render([family]);
    expect(byTestId(r, 'open-app')).toHaveLength(0);
    await act(async () => (byTestId(r, 'create-code')[0] as ReactTestInstance).props.onClick());
    expect(data.regenerated).toEqual(['sp_f']);
    expect(allText(r)).toContain('NEWCD7');
    expect(byTestId(r, 'open-app')).toHaveLength(1);
  });

  it('no family persona: You don\'t have a family space yet, Set up my family, and Go to Classes for a teacher (behaviour 24)', async () => {
    let r = await render([klass]);
    expect(r.root.findAll((n) => n.type === 'h1').map(textOf)).toEqual([p.noFamily.title]);
    expect(byTestId(r, 'no-family-set-up')[0]?.props.href).toBe('/start?persona=parent');
    expect(byTestId(r, 'no-family-go-teacher')[0]?.props.href).toBe('/teach/home');
    expect(data.rosterCalls).toEqual([]);
    act(() => mounted?.unmount());
    r = await render([]);
    expect(byTestId(r, 'no-family-go-teacher')).toHaveLength(0);
    expect(byTestId(r, 'learner-card')).toHaveLength(0);
  });

  it('cross-links: Also teach a class? without the teacher persona; Your classes are under Teacher switches persona', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    let r = await render([family]);
    expect(byTestId(r, 'cross-add-class')[0]?.props.href).toBe('/start?persona=teacher');
    act(() => mounted?.unmount());
    r = await render([family, klass]);
    expect(byTestId(r, 'cross-add-class')).toHaveLength(0);
    act(() => (byTestId(r, 'cross-to-teacher')[0] as ReactTestInstance).props.onClick());
    expect(shellWrites.personas).toEqual(['teacher']);
    expect(nav.pushed).toEqual(['/teach/home']);
  });

  it('one family failing: that section shows Try again, the other family renders', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    const r = await render([family, grandma]);
    expect(r.root.findAll((n) => n.type === 'h2').map(textOf)).toEqual(['Kim family', "Grandma's house"]);
    expect(cardNames(r)).toEqual(['Sam']);
    const retry = byTestId(r, 'family-retry-sp_g')[0] as ReactTestInstance;
    expect(allText(r)).toContain(en.console.cantReach);
    data.rosters.sp_g = roster(grandma, [mina]);
    await act(async () => retry.props.onClick());
    expect(cardNames(r)).toEqual(['Sam', 'Mina']);
  });

  it('the spaces read failing: Can\'t reach and Try again; the frame draws no nav', async () => {
    const r = await render('fail');
    expect(frame.spaces.at(-1)).toBe('failed');
    expect(allText(r)).toContain(en.console.cantReach);
  });

  it('hands its spaces list to the frame', async () => {
    data.rosters = { sp_f: roster(family, [sam]) };
    await render([family]);
    expect(frame.spaces.at(-1)).toEqual([family]);
  });

  it('no banned word, no ranking, and every link carries ids only under a persona prefix', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    data.rosters = { sp_f: roster(family, [sam, mina]) };
    const r = await render([family]);
    expect(findBannedWord(allText(r))).toBeNull();
    for (const href of hrefs(r)) {
      expect(href).not.toMatch(/Sam|Mina|Kim/);
      expect(href.startsWith('/parent') || href.startsWith('/teach/space/learner') || href.startsWith('/start') || href === '/browse').toBe(true);
    }
  });
});
