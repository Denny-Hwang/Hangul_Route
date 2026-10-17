import type { UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
// Imported at module scope (the vi.mock calls below are hoisted above it): a dynamic import inside
// the first test spent most of the 5 s default timeout under turbo load (as route-groups did, #431).
import Page from '@/app/(console)/teach/space/page';

/**
 * F-VOC-005 P-4, the roster page's wiring (section 3.8, behaviour 14): a card shows its word lines
 * only when the roster carries `summary.vocab` (today it never does: `vocab` stays on
 * `TEACHER_HIDDEN_SUMMARY_KEYS`), the week names the class's words to revisit together, and the
 * cards keep the roster's own order (no ranking). Rendered with react-test-renderer.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/DisplaySheet', () => ({ DisplayButton: () => null }));

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
  kind: 'class' as const,
  name: 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const MINA = {
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
  },
};

const words = (needsPractice: string[], collected = 12, strong = 4) => ({ collected, strong, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.5, needsPractice });
/** The slice as P-4b's roster projection will carry it: the first-try rate dropped for every roster viewer. */
const wordsWithoutRate = (needsPractice: string[]) => {
  const { firstTryRate: _rate, ...rest } = words(needsPractice);
  return rest;
};
const learner = (id: string, displayName: string, vocab: ReturnType<typeof words> | ReturnType<typeof wordsWithoutRate> | undefined) => ({
  ...MINA,
  id,
  displayName,
  summary: vocab ? { ...MINA.summary, vocab } : MINA.summary,
});

let learners: ReturnType<typeof learner>[] = [];
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => ok({ space: SPACE, learners, joinCode: null, joinCodeExpiresAt: null }),
  listPlans: async () => ok([]),
  relinkRequests: async () => ok([]),
  listSpaces: async () => ok([]),
  entitlements: async () => ok([]),
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  learners = [];
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function roster(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);

describe('the roster with word counts', () => {
  it('shows no word line while the roster carries no summary.vocab (vocab stays hidden)', async () => {
    learners = [learner('l:1', 'Mina', undefined), learner('l:2', 'Sam', undefined)];
    const root = await roster();
    expect(byTestId(root, 'student-card')).toHaveLength(2);
    expect(byTestId(root, 'student-words')).toHaveLength(0);
    expect(byTestId(root, 'student-words-revisit')).toHaveLength(0);
    expect(byTestId(root, 'week-words-revisit')).toHaveLength(0);
  });

  it('reads the counts and the words to revisit on a card that carries summary.vocab', async () => {
    learners = [learner('l:1', 'Mina', words(['vocab:sagwa-apple', 'vocab:nun-eye'])), learner('l:2', 'Sam', undefined)];
    const root = await roster();
    const [mina, sam] = byTestId(root, 'student-card');
    if (!mina || !sam) throw new Error('cards');
    expect(byTestId(mina, 'student-words').map(textOf)).toEqual(['Words: 12 collected · 4 strong']);
    expect(byTestId(mina, 'student-words-revisit').map(textOf)).toEqual(['Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)']);
    expect(mina.findAll((node) => node.type === 'span' && node.props.lang === 'ko').map(textOf)).toEqual(['사과', '눈']);
    expect(byTestId(sam, 'student-words')).toHaveLength(0);
    // The first-try rate stays off the roster.
    expect(textOf(mina)).not.toMatch(/%|0\.5/);
  });

  it('draws the lines and the week from slices without firstTryRate, as P-4b will send them', async () => {
    learners = [learner('l:1', 'Mina', wordsWithoutRate(['vocab:uyu'])), learner('l:2', 'Sam', wordsWithoutRate(['vocab:uyu', 'vocab:ppang']))];
    const root = await roster();
    const [mina] = byTestId(root, 'student-card');
    if (!mina) throw new Error('cards');
    expect(byTestId(mina, 'student-words').map(textOf)).toEqual(['Words: 12 collected · 4 strong']);
    expect(byTestId(mina, 'student-words-revisit').map(textOf)).toEqual(['Words to revisit: 우유 uyu (milk)']);
    expect(byTestId(root, 'week-words-revisit').map(textOf)).toEqual(['Words to revisit together: 우유 uyu (milk) · 빵 ppang (bread)']);
  });

  it('names the class words to revisit together in the week, and keeps the roster order', async () => {
    learners = [
      learner('l:1', 'Mina', words(['vocab:uyu'], 3, 0)),
      learner('l:2', 'Sam', words(['vocab:sagwa-apple', 'vocab:uyu'], 30, 20)),
      learner('l:3', 'Ana', words(['vocab:sagwa-apple', 'vocab:uyu', 'vocab:ppang'])),
    ];
    const root = await roster();
    expect(byTestId(root, 'week-words-revisit').map(textOf)).toEqual(['Words to revisit together: 우유 uyu (milk) · 사과 sagwa (apple) · 빵 ppang (bread)']);
    // Cards stay in the order the roster sent them, whatever the word counts.
    expect(byTestId(root, 'student-card').map((card) => card.findByType('strong').children.join(''))).toEqual(['Mina', 'Sam', 'Ana']);
  });
});
