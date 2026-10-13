import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster, RosterLearner, SpaceListItem } from '@/lib/console/api';
import { findBannedWord } from '@/lib/console/banned-text';

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
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  // One api object for the whole test, as the real hook keeps it (the page's load depends on it).
  const api = {
    listSpaces: async () => data.list,
    roster: async (id: string) => {
      data.rosterCalls.push(id);
      return data.rosters[id] ?? { ok: false, error: 'network' };
    },
    regenerateCode: async (id: string) => {
      data.regenerated.push(id);
      return { ok: true, data: { joinCode: 'NEWCD7', expiresAt: '2026-11-01T00:00:00Z' } };
    },
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
  vi.unstubAllEnvs();
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
    expect(byTestId(r, 'family-lessons')[0]?.props.href).toBe('/browse');
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
    expect(panel.props.id).toBe(button.props['aria-controls']);
    expect(textOf(panel)).toContain('K7MPQ4');
    expect(byTestId(r, 'open-app')).toHaveLength(0);
    act(() => (byTestId(r, 'family-add-learner')[0] as ReactTestInstance).props.onClick());
    expect(byTestId(r, 'join-panel')).toHaveLength(0);
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
