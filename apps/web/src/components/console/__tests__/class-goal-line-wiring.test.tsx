import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpaceRole } from '@hangul-route/content-schema';
import { meta } from '@/lib/console/__tests__/fixtures/learning-route';

/**
 * Learning Route LR-9 (amendment section 6.3, LR-OD-10; wireframe console/learning-route.md T1), the
 * roster page's wiring: a class roster header shows one line about the newest live whole-class
 * curriculum plan, from the plans the page already loads (no new request). A plan for some students,
 * a draft, an archived plan or a classic plan gives no line; a family roster has none. Rendered with
 * react-test-renderer (the repo's web tests have no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));

// next/link needs the app router's context; a plain anchor keeps its href, its text and its description.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; 'aria-describedby'?: string }) => (
    <a href={href} aria-describedby={rest['aria-describedby']}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Ac1'),
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
const PLAN = {
  id: 'plan:1',
  spaceId: SPACE.id,
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quest', id: 'quest:stage2-life-q1' },
    { kind: 'quest', id: 'quest:stage2-nature-q1' },
    { kind: 'quest', id: 'quest:stage4-rites-q1' },
  ],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
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
    planProgress: { 'plan:1': { done: 1, total: 1, notReady: 3 } },
  },
};

const calls: string[] = [];
let role: SpaceRole = 'owner';
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => {
    calls.push('roster');
    return ok({ space: SPACE, learners: [LEARNER], joinCode: null, joinCodeExpiresAt: null });
  },
  listPlans: async () => {
    calls.push('listPlans');
    return ok(plans);
  },
  relinkRequests: async () => {
    calls.push('relinkRequests');
    return ok([]);
  },
  listSpaces: async () => {
    calls.push('listSpaces');
    return ok([{ space: SPACE, role, counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
  },
  entitlements: async () => {
    calls.push('entitlements');
    return ok([]);
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});


const lr = getMessages('en').console.learningRoute;
// A curriculum plan of 11 weeks from this Monday-ish date: live today, ending in 11 weeks.
const start = new Date(NOW.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
const LIVE = { ...PLAN, id: 'plan:term', title: 'Term', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], meta: meta(start, 11) };
let plans: unknown[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  role = 'owner';
  plans = [];
  SPACE.kind = 'class';
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function roster(): Promise<ReactTestInstance> {
  const { default: Page } = await import('@/app/(console)/teach/space/page');
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const goalLines = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((node) => node.type === 'div' && node.props['data-testid'] === 'class-goal-line');

describe('the class plan goal line on the roster header (LR-9)', () => {
  it('a live whole-class curriculum plan: one line about the plan, with its end, from the plans already loaded', async () => {
    plans = [LIVE];
    const root = await roster();
    expect(calls.filter((c) => c === 'listPlans')).toHaveLength(1);
    const [line] = goalLines(root);
    if (!line) throw new Error('no line');
    expect(textOf(line).startsWith(lr.planReaches.class(1, 'Hangul'))).toBe(true);
    expect(textOf(line)).toContain(lr.planEnds(''));
    // A statement about the plan only: never a learner's name or a count of learners.
    expect(textOf(line)).not.toContain('Mina');
    expect(textOf(line)).not.toMatch(/student|learner|\d+ ?\/ ?\d+|%/i);
  });

  it('sits in the header: after the join code, before the plan actions', async () => {
    plans = [LIVE];
    const root = await roster();
    const order = root.findAll((node) => typeof node.type === 'string' && (node.props['data-testid'] === 'join-code' || node.props['data-testid'] === 'class-goal-line' || node.props['data-testid'] === 'plan-term'));
    expect(order.map((node) => node.props['data-testid'])).toEqual(['join-code', 'class-goal-line', 'plan-term']);
  });

  it('a plan for some students, a draft, an archived plan or a classic plan: no line', async () => {
    for (const p of [
      { ...LIVE, targetLearnerIds: ['l:1'] },
      { ...LIVE, publishedAt: null },
      { ...LIVE, archivedAt: `${today}T09:00:00.000Z` },
      { ...LIVE, meta: null },
    ]) {
      plans = [p];
      const root = await roster();
      expect(goalLines(root)).toHaveLength(0);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('a family roster: no header line', async () => {
    SPACE.kind = 'family';
    plans = [LIVE];
    const root = await roster();
    expect(goalLines(root)).toHaveLength(0);
  });
});
