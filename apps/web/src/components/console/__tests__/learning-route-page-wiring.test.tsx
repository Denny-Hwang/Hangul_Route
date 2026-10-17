import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as curriculumMeta } from '@/lib/console/__tests__/fixtures/learning-route';
import Page from '@/app/(console)/teach/space/route/page';
import { GrownUpLocationContext } from '@/components/console/grown-up-location';

/**
 * Learning Route LR-8 (amendment section 6.1): the stage list page `/teach/space/route?id=&learner=`.
 * It shows only while `learningRouteEnabled()` is on (off: back to the space page, no request); it
 * loads the roster and the space's plans the roster page already loads, and nothing else (no new
 * endpoint, no entitlements call: progress visibility is not a paid feature, LR-OD-9). Rendered with
 * react-test-renderer (the repo's web tests have no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/DisplaySheet', () => ({ DisplayButton: () => null }));

// The adult frame (F-APP-001 A-5a) reads the spaces list and draws its own links; adult-frame.test.tsx covers it.
// Here it passes the page through, so the calls and the links below are the page's own.
// The frame draws its PageBack (AMENDMENTS-DISPLAY-NAV section 7.3) as a link before the page; the stand-in does too.
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) => (
    <>
      {back ? <a href={back.href}>{back.label}</a> : null}
      {children}
    </>
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const nav = { query: 'id=space%3Ac1&learner=l%3A1', replaced: [] as string[] };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (to: string) => nav.replaced.push(to), push: () => undefined }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

const NOW = new Date();
const today = NOW.toISOString().slice(0, 10);
const SPACE = {
  id: 'space:c1',
  kind: 'class' as string,
  name: 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const LEARNER: { id: string; displayName: string; summary: Record<string, unknown> } & Record<string, unknown> = {
  id: 'l:1',
  displayName: 'Mina',
  ageGroup: 'starter',
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: `${today}T08:00:00.000Z`,
  lastSyncedAt: `${today}T08:05:00.000Z`,
  summary: {
    schemaVersion: 1,
    lastActiveAt: `${today}T08:00:00.000Z`,
    streakDays: 2,
    stage1: { questsDone: 1, questsTotal: 15, anchorAccuracy: null },
    cardsUnlocked: 1,
    minutesLast7d: 12,
    jamoRecognized: [],
    needsPractice: [],
    planProgress: {},
    journey: {
      v: 1,
      here: 'stage1',
      stages: [
        { stage: 'stage1', state: 'open', done: 1, known: 0, total: 15 },
        { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 },
        { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
      ],
    },
  },
};

/** A published, unarchived curriculum plan for the whole class, started today. */
const curriculumPlan = () => ({
  id: 'plan:route',
  spaceId: SPACE.id,
  authorAccountId: 'teacher-kim',
  title: 'Term route',
  items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  targetLearnerIds: null,
  publishedAt: `${today}T07:00:00.000Z`,
  archivedAt: null,
  createdAt: `${today}T06:00:00.000Z`,
  updatedAt: `${today}T07:00:00.000Z`,
  meta: curriculumMeta(today, 4),
});

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
const calls: string[] = [];
const responses: { roster: () => Result<unknown> | Promise<Result<unknown>>; plans: () => Result<unknown> } = { roster: () => ok(roster()), plans: () => ok([]) };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const roster = () => ({ space: SPACE, learners: [LEARNER], joinCode: null, joinCodeExpiresAt: null });
const api = new Proxy(
  {},
  {
    get: (_target, name: string) => async () => {
      calls.push(name);
      if (name === 'roster') return responses.roster();
      if (name === 'listPlans') return responses.plans();
      return ok([]);
    },
  },
);

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const en = getMessages('en').console;
const lr = en.learningRoute;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  nav.replaced.length = 0;
  nav.query = 'id=space%3Ac1&learner=l%3A1';
  SPACE.kind = 'class';
  responses.roster = () => ok(roster());
  responses.plans = () => ok([]);
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function page(pathname?: string): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(
      pathname ? (
        <GrownUpLocationContext.Provider value={{ pathname, search: nav.query }}>
          <Page />
        </GrownUpLocationContext.Provider>
      ) : (
        <Page />
      ),
    );
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

describe('the Learning Route page switch (learningRouteEnabled, default off)', () => {
  it('off: no request and back to the space page', async () => {
    const root = await page();
    expect(calls).toEqual([]);
    expect(nav.replaced).toEqual(['/teach/space?id=space%3Ac1']);
    expect(root.findAll((n) => n.type === 'h1')).toHaveLength(0);
  });

  it('off without a space id: to the console home', async () => {
    nav.query = '';
    await page();
    expect(nav.replaced).toEqual(['/teach/home']);
  });

  it('off under /parent/space/route: back to the family page and, with no space id, the family home (the prefix of the page)', async () => {
    await page('/parent/space/route');
    expect(nav.replaced).toEqual(['/parent/space?id=space%3Ac1']);
    act(() => mounted?.unmount());
    nav.replaced.length = 0;
    nav.query = '';
    await page('/parent/space/route');
    expect(nav.replaced).toEqual(['/parent']);
  });
});

describe('the way back before the roster names the kind, under /parent/space/route (A-5b review)', () => {
  it('cannot reach the roster: the way back stays under /parent/space', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.roster = () => ({ ok: false, error: 'network', status: -1 });
    const root = await page('/parent/space/route');
    expect(root.findAll((n) => n.type === 'a' && n.props.href === '/parent/space?id=space%3Ac1' && textOf(n) === lr.back.space)).toHaveLength(1);
  });
});

describe('the Learning Route page, switched on', () => {
  it('loads the roster and the plans only (no entitlements, no new endpoint) and draws the learner', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    const root = await page();
    expect([...calls].sort()).toEqual(['listPlans', 'roster']);
    expect(nav.replaced).toEqual([]);
    const [h1] = root.findAll((n) => n.type === 'h1');
    expect(h1 && textOf(h1)).toBe(lr.title('Mina'));
    const card = root.find((n) => n.type === 'section' && n.props['aria-label'] === lr.section);
    expect(textOf(card)).toContain(lr.now('Mina', 1, 'Hangul'));
    expect(textOf(card)).toContain(lr.nextOpen(1, 'Hangul'));
    expect(root.findAll((n) => n.type === 'li')).toHaveLength(3);
    const back = root.findAll((n) => n.type === 'a').find((a) => textOf(a) === lr.back.class);
    expect(back?.props.href).toBe('/teach/space?id=space%3Ac1');
    // No billing link on the page body (owner item 12, LR-OD-8): the only billing link is the frame's own (passed through here).
    expect(root.findAll((n) => n.type === 'a' && String(n.props.href).includes('billing'))).toHaveLength(0);
  });

  it('a classic plan (no curriculum meta) is homework, not a route: still case 3, no Plan goal tag', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.plans = () =>
      ok([
        {
          id: 'plan:1',
          spaceId: SPACE.id,
          authorAccountId: 'teacher-kim',
          title: 'Term',
          items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
          targetLearnerIds: null,
          publishedAt: `${today}T07:00:00.000Z`,
          archivedAt: null,
          createdAt: `${today}T06:00:00.000Z`,
          updatedAt: `${today}T07:00:00.000Z`,
          meta: null,
        },
      ]);
    const root = await page();
    // A classic plan (no curriculum meta) is homework, not a route: still case 3.
    expect(textOf(root)).toContain(lr.nextOpen(1, 'Hangul'));
    expect(textOf(root)).not.toContain(lr.planGoalTag);
  });

  it('a live whole-class curriculum plan reaches the view: "Your class\'s weekly plan reaches ...", its end and the Plan goal tag', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.plans = () => ok([curriculumPlan()]);
    const root = await page();
    const card = root.find((n) => n.type === 'section' && n.props['aria-label'] === lr.section);
    expect(textOf(card)).toContain(lr.planReaches.class(1, 'Hangul'));
    expect(textOf(card)).toContain(lr.planEnds('').trim());
    expect(textOf(card)).not.toContain(lr.nextOpen(1, 'Hangul'));
    const [first] = root.findAll((n) => n.type === 'li');
    expect(first && textOf(first)).toContain(lr.planGoalTag);
  });

  it('a family space: the goal the learner\'s device shows (case 1) and "Back to the family"', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    SPACE.kind = 'family';
    const withGoal = { ...LEARNER, summary: { ...LEARNER.summary, routeGoal: { stage: 'stage2', from: 'class' } } };
    responses.roster = () => ok({ ...roster(), learners: [withGoal] });
    const root = await page();
    const card = root.find((n) => n.type === 'section' && n.props['aria-label'] === lr.section);
    expect(textOf(card)).toContain(lr.learnerGoal('Mina', 2, 'Words'));
    expect(textOf(card)).toContain(lr.fromLead.class);
    const back = root.findAll((n) => n.type === 'a').find((a) => textOf(a) === lr.back.family);
    expect(back?.props.href).toBe('/parent/space?id=space%3Ac1');
  });

  it('loading: the kind-neutral way back to the space, then the placeholders', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.roster = () => new Promise(() => undefined);
    const root = await page();
    expect(root.findAll((n) => n.props['aria-busy'] === 'true')).toHaveLength(1);
    const back = root.findAll((n) => n.type === 'a').find((a) => textOf(a) === lr.back.space);
    expect(back?.props.href).toBe('/teach/space?id=space%3Ac1');
  });

  it('only the newest load draws: an older answer that arrives late is dropped', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    let releaseOld: (r: Result<unknown>) => void = () => undefined;
    responses.roster = () => new Promise((resolve) => (releaseOld = resolve));
    const root = await page();
    // The address changes to another space before the first roster answers.
    nav.query = 'id=space%3Ac2&learner=l%3A1';
    responses.roster = () => ok({ ...roster(), learners: [{ ...LEARNER, displayName: 'Jun' }] });
    await act(async () => {
      mounted?.update(<Page />);
    });
    expect(textOf(root)).toContain(lr.title('Jun'));
    await act(async () => {
      releaseOld(ok(roster()));
    });
    expect(textOf(root)).toContain(lr.title('Jun'));
    expect(textOf(root)).not.toContain(lr.title('Mina'));
  });

  it('a learner id that is not on this roster: the message and the way back, no other learner', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    nav.query = 'id=space%3Ac1&learner=l%3A9';
    const root = await page();
    const text = textOf(root);
    expect(text).toContain(lr.notFound);
    expect(text).toContain(lr.back.class);
    expect(text).not.toContain('Mina');
  });

  it('a space with no roster view (a school): back to the space page, which draws it', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    SPACE.kind = 'school';
    await page();
    expect(nav.replaced).toEqual(['/teach/space?id=space%3Ac1']);
  });

  it('cannot reach the roster: the console wording, Try again, and the way back to the space', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.roster = () => ({ ok: false, error: 'network', status: -1 });
    const root = await page();
    expect(textOf(root)).toContain(en.cantReach);
    expect(root.findAll((n) => n.type === 'a' && n.props.href === '/teach/space?id=space%3Ac1' && textOf(n) === lr.back.space)).toHaveLength(1);
    const retry = root.find((n) => n.type === 'button' && textOf(n) === en.tryAgain);
    responses.roster = () => ok(roster());
    await act(async () => {
      retry.props.onClick();
    });
    expect(textOf(root)).toContain(lr.title('Mina'));
  });

  it('forbidden or gone: the space wording, and no Try again that would get the same answer', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    const noRetry = (root: ReactTestInstance) => root.findAll((n) => n.type === 'button' && textOf(n) === en.tryAgain);
    responses.roster = () => ({ ok: false, error: 'forbidden', status: 403 });
    const forbidden = await page();
    expect(textOf(forbidden)).toContain(en.space.forbidden);
    expect(noRetry(forbidden)).toHaveLength(0);
    act(() => mounted?.unmount());
    responses.roster = () => ({ ok: false, error: 'not_found', status: 404 });
    const gone = await page();
    expect(textOf(gone)).toContain(en.space.gone);
    expect(noRetry(gone)).toHaveLength(0);
  });

  it('a failed read with no space id in the address: the way back is the console home', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    nav.query = 'learner=l%3A1';
    responses.roster = () => ({ ok: false, error: 'network', status: -1 });
    const root = await page();
    expect(root.findAll((n) => n.type === 'a' && n.props.href === '/teach/home' && textOf(n) === en.shell.home).length).toBeGreaterThanOrEqual(1);
  });

  it('the plans did not load: no card that could miss a plan; the console wording instead', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.plans = () => ({ ok: false, error: 'network', status: -1 });
    const root = await page();
    expect(textOf(root)).toContain(en.cantReach);
    expect(root.findAll((n) => n.type === 'h1')).toHaveLength(0);
  });
});

describe('the page source', () => {
  const source = readFileSync(new URL('../../../app/(console)/teach/space/route/page.tsx', import.meta.url), 'utf8');

  it('is the one LearningRoutePage component A-5b re-exports under /parent/space/route', () => {
    expect(source).toMatch(/export default function LearningRoutePage\(/);
  });

  it('sends nothing: no telemetry, no write, no entitlements read', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/telemetry|track\(|entitlements|method: 'POST'|\.(create|update|archive|publish)\w*\(/i);
  });
});
