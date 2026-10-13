import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpaceRole } from '@hangul-route/content-schema';

/**
 * F-REPORT-001 RP-7a2 (section 3.1): each student card on the roster gains **See report**, the learner's week report
 * with `from=roster`, ids only, for a class and a family, and only while `reportsEnabled(locale)` holds. Rendered with
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


const plans: unknown[] = [];
const report = getMessages('en').report;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  role = 'owner';
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

const seeReport = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'a' && textOf(n) === report.action.seeReport);

describe('the roster card See report (RP-7a2)', () => {
  it('reports off (the default): no See report link', async () => {
    const root = await roster();
    expect(seeReport(root)).toHaveLength(0);
  });

  it('reports on: one See report per student card, the week report from the roster, ids only', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    const root = await roster();
    const links = seeReport(root);
    expect(links).toHaveLength(1);
    expect(links[0]?.props.href).toBe('/teach/space/learner?id=space%3Ac1&learner=l%3A1&period=week&from=roster');
    expect(links[0]?.props.href).not.toContain('Mina');
  });

  it('a family roster opens the family report at /parent/learner (RP-7c)', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    SPACE.kind = 'family';
    const root = await roster();
    expect(seeReport(root)[0]?.props.href).toBe('/parent/learner?id=space%3Ac1&learner=l%3A1&period=week&from=roster');
  });

  it('adds no request to the roster page', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    await roster();
    expect(calls).not.toContain('getLearnerReport');
  });
});

describe('the roll-up Class report link (RP-8)', () => {
  const classLink = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'a' && textOf(n) === report.class.link);

  it('a class with reports on: one Class report link in the roll-up, the class id only', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    const root = await roster();
    expect(classLink(root).map((a) => a.props.href)).toEqual(['/teach/space/report?id=space%3Ac1&period=week']);
  });

  it('none with reports off, and none for a family (siblings are never compared)', async () => {
    let root = await roster();
    expect(classLink(root)).toHaveLength(0);
    act(() => mounted?.unmount());
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    SPACE.kind = 'family';
    root = await roster();
    expect(classLink(root)).toHaveLength(0);
  });
});
