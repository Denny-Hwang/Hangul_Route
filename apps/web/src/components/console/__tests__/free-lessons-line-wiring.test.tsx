import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpaceRole } from '@hangul-route/content-schema';

/**
 * F-ENT-003 E3-12, the roster page's wiring (review 2026-10-12): with the console's free-plan
 * switch on, the page reads the viewer's spaces and entitlements, and the owner of an uncovered
 * class reads the free-lessons line with **Open billing** on a learner's card; a co-teacher reads
 * nothing; with the switch off the page makes no entitlements read and shows no line. Rendered
 * with react-test-renderer (the repo's web tests have no DOM).
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
  kind: 'class' as const,
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
    return ok([PLAN]);
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

const en = getMessages('en').console.access;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  role = 'owner';
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

const lines = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((node) => node.type === 'div' && node.props['data-testid'] === 'free-lessons-line');

describe('the roster card with the free-plan switch', () => {
  it('off: no entitlements read and no line', async () => {
    const root = await roster();
    expect(calls).toEqual(expect.arrayContaining(['roster', 'listPlans', 'relinkRequests']));
    expect(calls).not.toContain('entitlements');
    expect(lines(root)).toHaveLength(0);
  });

  it('on, the owner of an uncovered class: the plan-waiting line and Open billing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    const root = await roster();
    expect(calls).toEqual(expect.arrayContaining(['listSpaces', 'entitlements']));
    const [line] = lines(root);
    if (!line) throw new Error('no line');
    expect(textOf(line)).toBe(`${en.planWaiting('Mina', 3, en.product.class)}${en.openBilling.cta}`);
    const [link] = line.findAllByType('a');
    expect(link?.props.href).toBe('/teach/billing');
    expect(link?.props['aria-describedby']).toBe(line.findByType('p').props.id);
  });

  it('on, a co-teacher: no line', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    role = 'teacher';
    const root = await roster();
    expect(calls).toContain('entitlements');
    expect(lines(root)).toHaveLength(0);
  });
});
