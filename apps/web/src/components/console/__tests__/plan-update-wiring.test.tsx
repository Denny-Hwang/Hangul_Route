import { addDays, generateCurriculum, toMeta, toPlanItems } from '@hangul-route/content-schema';
import { CATALOG_2026_10 } from '@hangul-route/content-schema/testing/catalog-2026-10';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlanSave } from '@/lib/console/api';

/**
 * F-PLAN-002 PR P2-6b (section 3.8 step 4, FP-B5): a family learner card whose newest level check
 * found a later start than the learner's own live route shows "Sam's newest check found a later
 * place to start." and **Update the plan**. The button confirms first, then saves the same plan
 * re-seeded from today (`reseed`), still published, with the same end date. A class card never
 * shows it. Rendered with react-test-renderer on the frozen October 2026 catalogue.
 */
vi.mock('@hangul-route/content-schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/content-schema')>();
  const { CATALOG_2026_10: frozen } = await import('@hangul-route/content-schema/testing/catalog-2026-10');
  return { ...actual, CATALOG: frozen };
});

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Af1'),
}));

const today = new Date().toISOString().slice(0, 10);
const START = addDays(today, -14);
const space = (kind: 'family' | 'class') => ({
  id: 'space:f1',
  kind,
  name: kind === 'family' ? 'The Parks' : 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

/** A 12-week family route for Sam from "Brand new", started two weeks ago. */
function samRoute() {
  const draft = generateCurriculum(
    { audience: 'family', level: { stage: 'stage1', band: 0 }, startDate: START, weeks: 12, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'] },
    CATALOG_2026_10,
  );
  return {
    id: 'plan:route-sam',
    spaceId: 'space:f1',
    authorAccountId: 'parent-park',
    title: 'Route · 12 weeks',
    items: toPlanItems(draft),
    meta: toMeta(draft),
    targetLearnerIds: ['l:sam'],
    publishedAt: `${START}T08:00:00.000Z`,
    archivedAt: null,
    createdAt: `${START}T08:00:00.000Z`,
    updatedAt: `${START}T08:00:00.000Z`,
  };
}

const SAM = {
  id: 'l:sam',
  displayName: 'Sam',
  ageGroup: '10-11',
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: `${today}T08:00:00.000Z`,
  lastSyncedAt: `${today}T08:05:00.000Z`,
  summary: {
    schemaVersion: 1,
    lastActiveAt: `${today}T08:00:00.000Z`,
    streakDays: 2,
    stage1: { questsDone: 4, questsTotal: 15, anchorAccuracy: null },
    cardsUnlocked: 1,
    minutesLast7d: 12,
    jamoRecognized: [],
    needsPractice: [],
    planProgress: {},
    placement: { takenAt: `${today}T07:00:00.000Z`, level: { stage: 'stage1', band: 3 }, oralStage: null, strands: {}, beyondContent: false, overridden: false },
  },
};

let kind: 'family' | 'class' = 'family';
let saveOk = true;
const saved: { spaceId: string; body: PlanSave }[] = [];
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => ok({ space: space(kind), learners: [SAM], joinCode: null, joinCodeExpiresAt: null }),
  listPlans: async () => ok([samRoute()]),
  relinkRequests: async () => ok([]),
  listSpaces: async () => ok([]),
  entitlements: async () => ok([]),
  savePlan: async (spaceId: string, body: PlanSave) => {
    saved.push({ spaceId, body });
    return saveOk ? ok({ ...samRoute(), ...body }) : { ok: false as const, error: 'server' };
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'parent-park', displayName: 'Jun' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const words = getMessages('en').console.curriculum.update;
const confirm = vi.fn(() => true);

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('window', { confirm });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  kind = 'family';
  saveOk = true;
  saved.length = 0;
  confirm.mockClear();
  confirm.mockImplementation(() => true);
});

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function rosterPage(): Promise<ReactTestInstance> {
  const { default: Page } = await import('@/app/(console)/teach/space/page');
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

async function press(root: ReactTestInstance): Promise<void> {
  const [button] = byTestId(root, 'plan-update-cta');
  if (!button) throw new Error('no Update the plan');
  await act(async () => {
    (button.props.onClick as () => void)();
  });
}

describe('Update the plan on a family learner card', () => {
  it('shows the line and the button, named with the learner', async () => {
    const root = await rosterPage();
    const [line] = byTestId(root, 'plan-update');
    if (!line) throw new Error('no line');
    expect(textOf(line)).toBe(`${words.line('Sam')}${words.cta}`);
    expect(byTestId(root, 'plan-update-cta')[0]?.props['aria-label']).toBe(words.label('Sam'));
  });

  it('confirms, then saves the same plan re-seeded from today, still published, with the same end date', async () => {
    const root = await rosterPage();
    await press(root);
    expect(confirm).toHaveBeenCalledTimes(1);
    const ask = String((confirm.mock.calls[0] as unknown[] | undefined)?.[0]);
    expect(ask.startsWith('Update the plan? It moves ahead from today and keeps the same end date.')).toBe(true);
    expect(saved).toHaveLength(1);
    const body = saved[0]?.body;
    expect(saved[0]?.spaceId).toBe('space:f1');
    expect(body).toMatchObject({ id: 'plan:route-sam', title: 'Route · 12 weeks', targetLearnerIds: ['l:sam'], publish: true });
    expect(body?.meta?.params.level).toEqual({ stage: 'stage1', band: 3 });
    expect(body?.meta?.params.startDate).toBe(START);
    expect(body?.meta?.params.weeks).toBe(12);
    const plan = samRoute();
    const past = (items: PlanSave['items']) => items.filter((item) => item.targetDate !== undefined && item.targetDate < today);
    expect(past(body?.items ?? [])).toEqual(past(plan.items));
    expect(byTestId(root, 'plan-update-done').map(textOf)).toEqual([words.done]);
  });

  it('saves nothing when the grown-up cancels the confirm, and says so calmly when the save fails', async () => {
    confirm.mockImplementation(() => false);
    const root = await rosterPage();
    await press(root);
    expect(saved).toHaveLength(0);
    confirm.mockImplementation(() => true);
    saveOk = false;
    await press(root);
    expect(saved).toHaveLength(1);
    expect(textOf(root)).toContain(words.failed);
  });

  it('never shows on a class card', async () => {
    kind = 'class';
    const root = await rosterPage();
    expect(byTestId(root, 'plan-update')).toHaveLength(0);
  });

  it('a stored route this build cannot read shows no offer and the card still renders', async () => {
    const readable = api.listPlans;
    api.listPlans = async () => {
      const plan = samRoute();
      return ok([{ ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, goals: { focus: 'speaking' } } } } as unknown as ReturnType<typeof samRoute>]);
    };
    try {
      const root = await rosterPage();
      expect(byTestId(root, 'plan-update')).toHaveLength(0);
      expect(textOf(root)).toContain('Sam');
    } finally {
      api.listPlans = readable;
    }
  });

  it('announces the saved line as a status', async () => {
    const root = await rosterPage();
    await press(root);
    const [done] = byTestId(root, 'plan-update-done');
    expect(done?.props.role).toBe('status');
    expect(done?.props.tabIndex).toBe(-1);
  });
});

describe('PlanUpdateLine without an api (signed-out or loading)', () => {
  it('shows the button disabled and never saves', async () => {
    const { PlanUpdateLine } = await import('@/components/console/PlanUpdateParts');
    await act(async () => {
      mounted = create(<PlanUpdateLine kind="family" learner={SAM as unknown as Parameters<typeof PlanUpdateLine>[0]["learner"]} plans={[samRoute()]} today={today} api={null} spaceId="space:f1" onSaved={() => undefined} />);
    });
    if (!mounted) throw new Error('not mounted');
    const [button] = byTestId(mounted.root, 'plan-update-cta');
    expect(button?.props.disabled).toBe(true);
    await act(async () => {
      (button?.props.onClick as () => void)();
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });
});
