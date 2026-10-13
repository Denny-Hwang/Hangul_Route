import { getMessages } from '@hangul-route/i18n';
import type { SpaceRole } from '@hangul-route/content-schema';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * F-ENT-003 E3-12c (section 3.9.2 Console; wireframe design/wireframes/console/free-lessons-line.md,
 * host design/screens/app-shell/parent-home.md): the F-APP-001 parent home child card shows the
 * `plan-waiting` free-lessons line under the card's figures for the owner of an uncovered family
 * with the console's free-plan switch on, with **Open billing** to the console Billing route,
 * described by its line. A co-caregiver reads nothing; with the switch off the page reads no
 * plans and no entitlements and shows no line. Rendered with react-test-renderer (no DOM).
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));

vi.mock('@/lib/console/shell-store', () => ({ writeLastPersona: async () => true }));
vi.mock('@/lib/console/join-handoff', () => ({ openAppWithJoinCode: () => undefined }));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const NOW = new Date();
const today = NOW.toISOString().slice(0, 10);
const SPACE = {
  id: 'space:f1',
  kind: 'family' as const,
  name: 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const PLAN = {
  id: 'plan:1',
  spaceId: SPACE.id,
  authorAccountId: 'acc_1',
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

const state = vi.hoisted(() => ({ calls: [] as string[], role: 'owner' as string }));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  const api = {
    listSpaces: async () => {
      state.calls.push('listSpaces');
      return ok([{ space: SPACE, role: state.role, counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
    },
    roster: async () => {
      state.calls.push('roster');
      return ok({ space: SPACE, learners: [LEARNER], joinCode: null, joinCodeExpiresAt: null });
    },
    listPlans: async () => {
      state.calls.push('listPlans');
      return ok([PLAN]);
    },
    entitlements: async () => {
      state.calls.push('entitlements');
      return ok([]);
    },
  };
  const session = { accountId: 'acc_1', displayName: 'Ms Kim' };
  const signOut = (): undefined => undefined;
  return { useConsole: () => ({ ready: true, session, api, signOut, m: messages('en'), locale: 'en' }) };
});

const en = getMessages('en').console.access;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  state.calls.length = 0;
  state.role = 'owner';
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function home(): Promise<ReactTestInstance> {
  const { default: Page } = await import('@/app/(console)/parent/page');
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const cards = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((node) => node.type === 'article' && node.props['data-testid'] === 'learner-card');
const lines = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((node) => node.type === 'div' && node.props['data-testid'] === 'free-lessons-line');

describe('the parent home child card with the free-plan switch (F-ENT-003 E3-12c)', () => {
  it('off: no plans or entitlements read, and no line on the card', async () => {
    const root = await home();
    expect(cards(root)).toHaveLength(1);
    expect(state.calls).toEqual(expect.arrayContaining(['listSpaces', 'roster']));
    expect(state.calls).not.toContain('listPlans');
    expect(state.calls).not.toContain('entitlements');
    expect(lines(root)).toHaveLength(0);
  });

  it('on, the owner of an uncovered family: the plan-waiting line on the card and Open billing described by it', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    const root = await home();
    expect(state.calls).toEqual(expect.arrayContaining(['listPlans', 'entitlements']));
    const [card] = cards(root);
    if (!card) throw new Error('no card');
    const [line] = card.findAll((node) => node.type === 'div' && node.props['data-testid'] === 'free-lessons-line');
    if (!line) throw new Error('no line');
    expect(textOf(line)).toBe(`${en.planWaiting('Mina', 3, en.product.family)}${en.openBilling.cta}`);
    const [link] = line.findAllByType('a');
    expect(link?.props.href).toBe('/account/billing');
    expect(link?.props['aria-describedby']).toBe(line.findByType('p').props.id);
  });

  it('on, a co-caregiver of the family: no line', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    state.role = 'caregiver' satisfies SpaceRole;
    const root = await home();
    expect(cards(root)).toHaveLength(1);
    expect(lines(root)).toHaveLength(0);
  });
});
