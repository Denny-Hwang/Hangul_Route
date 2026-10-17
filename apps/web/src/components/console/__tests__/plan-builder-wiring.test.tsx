import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { CATALOG, PLAN_MAX_ITEMS, type Entitlement, type PlanItem, type SpaceRole } from '@hangul-route/content-schema';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlanSave, PlanView } from '@/lib/console/api';
import { lessonsPastStages, planMinutes } from '@/lib/console/lesson-picker';
import Page from '@/app/(console)/teach/space/plan/page';

/**
 * The plan builder's wiring (AMENDMENTS-LESSON-CHOOSER row LV-3a; review of #729): the grouped picker lists the
 * stages the space's learners can open (the curriculum wizard's rule: every stage when a Family Plan or a Group
 * License covers the space, else Stage 1, with the wizard's left-out line by the free-plan switch and the
 * viewer's coverage), a stored draft opens on its own stage, the sticky bar counts the draft with its minutes,
 * and the room follows the plan kind. Rendered with react-test-renderer (the repo's web tests have no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
// One router and one address for every render: the page's load callback depends on the router.
const nav = vi.hoisted(() => ({ router: { replace: () => undefined, push: () => undefined }, params: new URLSearchParams('id=space%3Ac1') }));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.params,
}));

const SPACE = {
  id: 'space:c1',
  kind: 'class' as const,
  name: 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};

const LICENSE: Entitlement = {
  id: 'ent:a',
  subjectKind: 'space',
  subjectId: SPACE.id,
  planKey: 'group_license',
  status: 'active',
  provider: 'stripe',
  providerRef: null,
  customerRef: null,
  seats: null,
  expiresAt: '2099-10-01T00:00:00.000Z',
  promoCode: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const draftPlan = (items: PlanItem[], meta: PlanView['meta'] = null): PlanView => ({
  id: 'plan:d',
  spaceId: SPACE.id,
  authorAccountId: 'teacher-kim',
  title: 'Week 3',
  items,
  targetLearnerIds: null,
  publishedAt: null,
  archivedAt: null,
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  meta,
});

const state = {
  role: 'owner' as SpaceRole,
  entitlements: { ok: true, data: [] as Entitlement[] } as { ok: true; data: Entitlement[] } | { ok: false; error: string },
  plans: [] as PlanView[],
  saved: [] as PlanSave[],
};

const api = {
  roster: async () => ({ ok: true as const, data: { space: SPACE, learners: [], joinCode: null, joinCodeExpiresAt: null } }),
  listPlans: async () => ({ ok: true as const, data: state.plans }),
  entitlements: async () => state.entitlements,
  listSpaces: async () => ({ ok: true as const, data: [{ space: SPACE, role: state.role, counts: { learners: 0, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }] }),
  savePlan: async (_spaceId: string, body: PlanSave) => {
    state.saved.push(body);
    return { ok: true as const, data: { ...draftPlan(body.items), title: body.title, publishedAt: body.publish ? '2026-10-17T00:00:00.000Z' : null } };
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const en = getMessages('en').console;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  state.role = 'owner';
  state.entitlements = { ok: true, data: [] };
  state.plans = [];
  state.saved = [];
  vi.unstubAllEnvs();
});

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const [node] = byTestId(root, id);
  if (!node) throw new Error(`no ${id}`);
  return node;
};
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}
const chips = (root: ReactTestInstance): string[] =>
  root.findAll((n) => n.type === 'input' && n.props.type === 'radio' && String(n.props['data-testid'] ?? '').startsWith('plan-picker-chip-')).map((n) => String(n.props['data-testid']).slice('plan-picker-chip-'.length));

async function open(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />, { createNodeMock: () => ({ indeterminate: false, focus: () => undefined, getBoundingClientRect: () => ({ height: 96 }) }) });
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const past = lessonsPastStages(['stage1']);

describe('the plan builder lists the stages the space opens', () => {
  it('a covered class: every ready stage, no line; a Stage 2 lesson goes in the plan and the bar counts it', async () => {
    state.entitlements = { ok: true, data: [LICENSE] };
    const root = await open();
    expect(chips(root)).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
    expect(byTestId(root, 'plan-picker-notice')).toHaveLength(0);
    await act(async () => one(root, 'plan-picker-chip-stage2').props.onChange());
    await act(async () => one(root, 'plan-picker-lesson-quest:stage2-life-q1').props.onChange());
    const quest = CATALOG.quests.find((q) => q.id === 'quest:stage2-life-q1')!;
    expect(textOf(one(root, 'plan-bar-count'))).toBe(en.chooser.chosen(1, quest.minutes));
    expect(one(root, 'plan-bar').props.role).toBe('region');
    expect(one(root, 'plan-bar').props['aria-label']).toBe(en.chooser.bar);
  });

  it('an uncovered class, switch off: Stage 1 only, the wizard line and See plans', async () => {
    const root = await open();
    expect(chips(root)).toEqual(['stage1']);
    const notice = textOf(one(root, 'plan-picker-notice'));
    expect(notice).toBe(`${en.curriculum.preview.warnings.premium(past)} ${en.curriculum.preview.warnings.seePlans.cta}`);
  });

  it('an uncovered class, switch on, its owner: the free plan, a Group License and Open billing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    const root = await open();
    expect(chips(root)).toEqual(['stage1']);
    expect(textOf(one(root, 'plan-picker-notice'))).toBe(`${en.curriculum.freeDays.warningNoLessons(past, en.access.product.class)} ${en.access.openBilling.cta}`);
  });

  it('switch on, a co-teacher (coverage unknown): Stage 1 only with the neutral words and no link', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    state.role = 'teacher';
    const root = await open();
    expect(chips(root)).toEqual(['stage1']);
    expect(textOf(one(root, 'plan-picker-notice'))).toBe(en.curriculum.freeDays.warningNeutral(past));
    expect(one(root, 'plan-picker-notice').findAll((n) => n.type === 'a')).toHaveLength(0);
  });

  it('the entitlement list does not load: Stage 1 only, never more than the learners get', async () => {
    state.entitlements = { ok: false, error: 'network' };
    const root = await open();
    expect(chips(root)).toEqual(['stage1']);
  });
});

describe('the stored draft, the room and the bar', () => {
  it('a stored draft opens the picker on its own stage, and the bar counts it with its minutes', async () => {
    state.entitlements = { ok: true, data: [LICENSE] };
    const items: PlanItem[] = [
      { kind: 'quest', id: 'quest:stage4-life-q1', targetDate: '2026-10-20', note: 'Bring a lunch box' },
      { kind: 'episode', id: 'episode:stage1-letters' },
    ];
    state.plans = [draftPlan(items)];
    const root = await open();
    expect(one(root, 'plan-picker-chip-stage4').props.checked).toBe(true);
    expect(one(root, 'plan-picker-lesson-quest:stage4-life-q1').props.checked).toBe(true);
    expect(textOf(one(root, 'plan-bar-count'))).toBe(en.chooser.chosen(2, planMinutes(items)));
  });

  it('a classic plan holds 30 items: at 30 a box that adds is off and the full line shows; the bar stays', async () => {
    state.entitlements = { ok: true, data: [LICENSE] };
    const ids = CATALOG.quests.filter((q) => q.id.startsWith('quest:stage2-') || q.id.startsWith('quest:stage3-')).map((q) => q.id).slice(0, PLAN_MAX_ITEMS);
    state.plans = [draftPlan(ids.map((id) => ({ kind: 'quest', id })))];
    const root = await open();
    expect(root.findAll((n) => n.type === 'p' && n.props.className === 'hr-pick-note').map(textOf)).toContain(en.chooser.full);
    await act(async () => one(root, 'plan-picker-chip-stage5').props.onChange());
    expect(one(root, 'plan-picker-row-episode:stage5-life').props.disabled).toBe(true);
    expect(byTestId(root, 'publish-plan')).toHaveLength(1);
  });

  it('a route draft (meta) holds more: the same 30 items leave room', async () => {
    state.entitlements = { ok: true, data: [LICENSE] };
    const ids = CATALOG.quests.filter((q) => q.id.startsWith('quest:stage2-') || q.id.startsWith('quest:stage3-')).map((q) => q.id).slice(0, PLAN_MAX_ITEMS);
    const meta = { version: 1, params: {}, weeks: [], generatedAt: '2026-10-10T00:00:00.000Z' } as unknown as PlanView['meta'];
    state.plans = [draftPlan(ids.map((id, i) => ({ kind: 'quest', id, week: 1 + Math.floor(i / 5) })), meta)];
    const root = await open();
    expect(root.findAll((n) => n.type === 'p' && n.props.className === 'hr-pick-note').map(textOf)).not.toContain(en.chooser.full);
    await act(async () => one(root, 'plan-picker-chip-stage5').props.onChange());
    expect(one(root, 'plan-picker-row-episode:stage5-life').props.disabled).toBe(false);
  });

  it('the page is padded by the sticky bar while the builder shows it (keyboard focus never under the bar)', async () => {
    state.entitlements = { ok: true, data: [LICENSE] };
    const root = { style: { scrollPaddingBottom: '' } };
    vi.stubGlobal('document', { documentElement: root });
    try {
      await open();
      expect(root.style.scrollPaddingBottom).toMatch(/^\d+px$/);
      act(() => mounted?.unmount());
      mounted = null;
      expect(root.style.scrollPaddingBottom).toBe('');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
