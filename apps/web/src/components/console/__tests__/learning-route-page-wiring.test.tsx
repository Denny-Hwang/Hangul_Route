import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));

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
const LEARNER = {
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

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
const calls: string[] = [];
const responses: { roster: () => Result<unknown>; plans: () => Result<unknown> } = { roster: () => ok(roster()), plans: () => ok([]) };
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

async function page(): Promise<ReactTestInstance> {
  const { default: Page } = await import('@/app/(console)/teach/space/route/page');
  await act(async () => {
    mounted = create(<Page />);
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
    // No billing link on the page body (owner item 12, LR-OD-8): the only billing link is the shell's own.
    expect(root.findAll((n) => n.type === 'a' && String(n.props.href).includes('billing'))).toHaveLength(1);
  });

  it('a class plan for everyone: "Your class\'s weekly plan reaches ..." and its Plan goal tag', async () => {
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

  it('cannot reach the roster: the console wording, Try again, and a way back', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.roster = () => ({ ok: false, error: 'network', status: -1 });
    const root = await page();
    expect(textOf(root)).toContain(en.cantReach);
    expect(root.findAll((n) => n.type === 'a' && n.props.href === '/teach/home' && textOf(n) === en.shell.home).length).toBeGreaterThanOrEqual(1);
    const retry = root.find((n) => n.type === 'button' && textOf(n) === en.tryAgain);
    responses.roster = () => ok(roster());
    await act(async () => {
      retry.props.onClick();
    });
    expect(textOf(root)).toContain(lr.title('Mina'));
  });

  it('forbidden or gone: the space wording', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    responses.roster = () => ({ ok: false, error: 'forbidden', status: 403 });
    expect(textOf(await page())).toContain(en.space.forbidden);
    act(() => mounted?.unmount());
    responses.roster = () => ({ ok: false, error: 'not_found', status: 404 });
    expect(textOf(await page())).toContain(en.space.gone);
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
