import { formatDate, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
// Imported at module scope (the vi.mock calls below are hoisted above it), as vocab-words-wiring does.
import Page from '@/app/(console)/teach/space/page';

/**
 * AMENDMENTS-GROWNUP-UX row GX-8, the roster page's wiring: the week's anchor line hides while nobody has one (T8), a
 * learner who joined today is not one who "hasn't opened the app" (T7), the quest line names the stage or says the
 * first quest is under way (T10), the plan line says when the plan reaches the device or that it is not started (T9),
 * and a family roster keeps join order under its own heading with a dated join (P4). Rendered with react-test-renderer.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/DisplaySheet', () => ({ DisplayButton: () => null }));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Ax1'),
}));

const NOW = Date.now();
const DAY_MS = 86_400_000;
const ago = (days: number): string => new Date(NOW - days * DAY_MS).toISOString();

const space = (kind: 'class' | 'family') => ({
  id: 'space:x1',
  kind,
  name: kind === 'class' ? 'Room 4' : 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const summary = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  lastActiveAt: ago(0),
  streakDays: 1,
  stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 4,
  minutesLast7d: 12,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
  ...over,
});

const learner = (id: string, displayName: string, over: Record<string, unknown> = {}) => ({
  id,
  displayName,
  ageGroup: 'starter',
  avatar: 'tiger',
  joinedAt: ago(30),
  lastActiveAt: ago(0),
  lastSyncedAt: ago(0),
  summary: summary(),
  ...over,
});

type Learner = ReturnType<typeof learner>;
let kind: 'class' | 'family' = 'class';
let learners: Learner[] = [];
let plans: unknown[] = [];
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => ok({ space: space(kind), learners, joinCode: null, joinCodeExpiresAt: null }),
  listPlans: async () => ok(plans),
  relinkRequests: async () => ok([]),
  listSpaces: async () => ok([]),
  entitlements: async () => ok([]),
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'grown-up-kim', displayName: 'Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  kind = 'class';
  learners = [];
  plans = [];
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function page(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
const names = (root: ReactTestInstance): string[] => byTestId(root, 'student-card').map((card) => textOf(card.findByType('strong')));

describe('the roster readouts (GX-8)', () => {
  it('T8: no anchor line while nobody has a Stage 1 first-try figure; "first-try answers" once someone does', async () => {
    learners = [learner('l:1', 'Mina'), learner('l:2', 'Sam')];
    let root = await page();
    expect(byTestId(root, 'week-anchor')).toHaveLength(0);
    expect(textOf(root)).not.toMatch(/anchor|–/);
    act(() => mounted?.unmount());
    learners = [learner('l:1', 'Mina', { summary: summary({ stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: 0.8 } }) })];
    root = await page();
    expect(byTestId(root, 'week-anchor').map(textOf)).toEqual(['Stage 1 first-try answers: 80%']);
  });

  it('T7: a learner who joined today, with nothing synced, is not counted as away for a week', async () => {
    learners = [learner('l:1', 'Mina'), learner('l:2', 'New', { joinedAt: ago(0), lastSyncedAt: null, summary: null }), learner('l:3', 'Away', { joinedAt: ago(40), summary: summary({ lastActiveAt: ago(9) }) })];
    const root = await page();
    expect(byTestId(root, 'week-not-synced').map(textOf)).toEqual(["1 hasn't opened the app in over a week"]);
  });

  it('T10: the quest line names Stage 1, and a learner with minutes but no quest done is on the first quest', async () => {
    learners = [learner('l:1', 'Mina'), learner('l:2', 'Sam', { summary: summary({ stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 2 }) })];
    const root = await page();
    expect(byTestId(root, 'quests-line').map(textOf)).toEqual(['Stage 1 quests: 3 of 15 · 4 cards', 'Working on the first quest']);
  });

  it('T9: the plan line says when the plan reaches a device, or that a learner who synced after it has not started', async () => {
    const published = ago(1);
    plans = [{ id: 'plan:w1', spaceId: 'space:x1', authorAccountId: 'grown-up-kim', title: 'Week 1', items: [{ kind: 'quest', id: 'q1' }, { kind: 'quest', id: 'q2' }], targetLearnerIds: null, publishedAt: published, archivedAt: null, createdAt: published, updatedAt: published }];
    learners = [
      learner('l:1', 'Before', { lastSyncedAt: ago(2) }),
      learner('l:2', 'After', { lastSyncedAt: ago(0) }),
      learner('l:3', 'Going', { summary: summary({ planProgress: { 'plan:w1': { done: 1, total: 2, notReady: 0 } } }) }),
    ];
    const root = await page();
    const text = textOf(root);
    expect(text).toContain('Week 1: Gets this plan next time the app opens');
    expect(text).toContain('Week 1: Not started yet (0 / 2)');
    expect(text).toContain('Week 1: 1 / 2');
    expect(text).not.toMatch(/next sync/);
  });

  it('P4: a family roster in join order, headed "Learners", with the family practiced line and a dated join', async () => {
    kind = 'family';
    // The Worker sends most recent activity first; the family page shows the order the learners joined in.
    learners = [
      learner('l:2', 'Junho', { joinedAt: '2026-10-14T09:00:00.000Z', lastSyncedAt: null, summary: null }),
      learner('l:1', 'Mina', { joinedAt: '2026-09-02T09:00:00.000Z' }),
    ];
    const root = await page();
    expect(names(root)).toEqual(['Mina', 'Junho']);
    expect(byTestId(root, 'roster-heading').map(textOf)).toEqual(['Learners']);
    expect(textOf(root)).toContain('1 of 2 learners practiced this week');
    expect(textOf(root)).not.toMatch(/Most recent activity first|Students/);
    const junho = byTestId(root, 'student-card')[1];
    if (!junho) throw new Error('card');
    // The date is the viewer's local day, as the page shows it, so the test holds in any time zone.
    expect(textOf(junho)).toContain(`Joined ${formatDate('en', '2026-10-14T09:00:00.000Z', 'monthDay')} · not synced yet`);
  });

  it('P4: a class roster keeps the order the Worker sent and its heading', async () => {
    learners = [learner('l:2', 'Sam', { joinedAt: ago(3) }), learner('l:1', 'Mina', { joinedAt: ago(40) })];
    const root = await page();
    expect(names(root)).toEqual(['Sam', 'Mina']);
    expect(byTestId(root, 'roster-heading').map(textOf)).toEqual(['Most recent activity first']);
    expect(textOf(root)).toContain('2 of 2 practiced this week');
  });
});
