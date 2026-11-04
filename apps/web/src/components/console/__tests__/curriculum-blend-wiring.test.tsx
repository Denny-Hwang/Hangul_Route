import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '@/app/(console)/teach/space/curriculum/page';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 10.1 (row BL-4): the class wizard's step 2 with `routeBlendEnabled()` off is
 * today's step exactly (class-day and homework-day chips, pace chips); on, the meeting block replaces them: Class
 * chips and length, the practice row, the suggested practice days, the mode cards with 1 or more practice days, and
 * a blended draft's preview (header and cycle table) whose saved plan carries `blend`. Rendered with
 * react-test-renderer on the frozen October 2026 catalogue.
 */
vi.mock('@hangul-route/content-schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/content-schema')>();
  const { CATALOG_2026_10 } = await import('@hangul-route/content-schema/testing/catalog-2026-10');
  return { ...actual, CATALOG: CATALOG_2026_10 };
});

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/DisplaySheet', () => ({ DisplayButton: () => null }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push }),
  useSearchParams: () => new URLSearchParams('id=space%3Ac1'),
}));

const CLASS = {
  id: 'space:c1',
  kind: 'class' as const,
  name: 'Sunflower',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const saved: { meta?: { params: { blend?: unknown; sessionDays?: unknown } } }[] = [];
const api = {
  roster: async () => ({ ok: true as const, data: { space: CLASS, learners: [], joinCode: null, joinCodeExpiresAt: null } }),
  entitlements: async () => ({ ok: true as const, data: [] }),
  listSpaces: async () => ({ ok: true as const, data: [] }),
  savePlan: async (_space: string, body: (typeof saved)[number]) => {
    saved.push(body);
    return { ok: true as const, data: { id: 'plan:new' } };
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const c = getMessages('en').console.curriculum;
const NOW = new Date('2026-11-02T12:00:00Z');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  saved.length = 0;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.useRealTimers();
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
async function click(root: ReactTestInstance, id: string): Promise<void> {
  const button = one(root, id);
  await act(async () => {
    (button.props.onClick as () => void)();
  });
}
async function choose(root: ReactTestInstance, id: string, value: string): Promise<void> {
  const select = one(root, id);
  await act(async () => {
    (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value } });
  });
}

async function stepTwo(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />, { createNodeMock: () => ({ focus: () => undefined }) });
  });
  if (!mounted) throw new Error('not mounted');
  await click(mounted.root, 'route-next');
  return mounted.root;
}

describe('the class wizard with the flag off (today exactly)', () => {
  it('keeps the class-day and homework-day chips and the pace chips; no meeting block', async () => {
    const root = await stepTwo();
    expect(byTestId(root, 'meeting-block')).toHaveLength(0);
    expect(byTestId(root, 'day-tue')).toHaveLength(1);
    expect(byTestId(root, 'pace-gentle')).toHaveLength(1);
    expect(textOf(root)).toContain(c.rhythm.daysHint.class);
  });
});

describe('the class wizard with the flag on (section 10.1)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ROUTE_BLEND_ENABLED', 'true');
  });

  it('replaces the day and pace chips with the meeting block and asks for a class day first', async () => {
    const root = await stepTwo();
    expect(byTestId(root, 'meeting-block')).toHaveLength(1);
    expect(byTestId(root, 'day-tue')).toHaveLength(0);
    expect(byTestId(root, 'pace-gentle')).toHaveLength(0);
    expect(textOf(root)).not.toContain(c.rhythm.daysHint.class);
    expect(textOf(one(root, 'route-problem'))).toBe(c.blend.meeting.pickClassDay);
    expect(one(root, 'route-next').props.disabled).toBe(true);
    // 0 practice days: no suggested days, no mode cards (a Class only plan).
    expect(byTestId(root, 'practice-line')).toHaveLength(0);
    expect(byTestId(root, 'blend-mode-overlap')).toHaveLength(0);
  });

  it('suggests the practice days, opens Change days, shows the mode cards and refuses a sixth class day', async () => {
    const root = await stepTwo();
    await click(root, 'class-day-tue');
    await choose(root, 'practice-count', '3');
    expect(textOf(one(root, 'practice-line'))).toBe('Practice on Wed, Fri, Sun');
    expect(one(root, 'blend-mode-overlap').props['aria-checked']).toBe(true);
    expect(byTestId(one(root, 'blend-mode-overlap'), 'suggested-tag')).toHaveLength(1);
    expect(one(root, 'practice-change').props['aria-expanded']).toBe(false);
    await click(root, 'practice-change');
    expect(one(root, 'practice-change').props['aria-expanded']).toBe(true);
    expect(one(root, 'practice-day-wed').props['aria-checked']).toBe(true);
    await click(root, 'practice-day-wed');
    expect(textOf(one(root, 'route-problem'))).toBe(c.blend.practice.pickDays(3));
    await click(root, 'practice-day-thu');
    expect(textOf(one(root, 'practice-line'))).toBe('Practice on Thu, Fri, Sun');
    for (const day of ['mon', 'wed', 'thu', 'fri']) await click(root, `class-day-${day}`);
    expect(textOf(root)).not.toContain(c.blend.meeting.maxClassDays);
    await click(root, 'class-day-sat');
    expect(textOf(root)).toContain(c.blend.meeting.maxClassDays);
    expect(one(root, 'class-day-sat').props['aria-checked']).toBe(false);
  });

  it('previews a blended draft with its header and cycle table, and saves blend', async () => {
    const root = await stepTwo();
    await click(root, 'class-day-tue');
    await choose(root, 'practice-count', '3');
    expect(byTestId(root, 'keep-average')).toHaveLength(1);
    await click(root, 'route-next');
    await click(root, 'route-see');
    expect(textOf(one(root, 'blend-preview-header'))).toContain('About 4 sessions a week: 1 class day (30 min) and 3 practice days (10 min each');
    expect(byTestId(root, 'cycle-table')).toHaveLength(1);
    expect(byTestId(root, 'cycle-row').length).toBeGreaterThan(0);
    await click(root, 'route-use');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.meta?.params.blend).toMatchObject({ mode: 'overlap', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 } });
  });

  it('with 0 practice days saves a Class only plan on the class days, without blend', async () => {
    const root = await stepTwo();
    await click(root, 'class-day-thu');
    await click(root, 'route-next');
    await click(root, 'route-see');
    expect(byTestId(root, 'blend-preview-header')).toHaveLength(0);
    await click(root, 'route-use');
    expect(saved[0]?.meta?.params.blend).toBeUndefined();
    expect(saved[0]?.meta?.params.sessionDays).toEqual(['thu']);
  });
});
