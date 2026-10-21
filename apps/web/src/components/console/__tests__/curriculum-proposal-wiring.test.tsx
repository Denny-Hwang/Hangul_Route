import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '@/app/(console)/teach/space/curriculum/page';

/**
 * F-PLAN-002 PR P2-6b (section 3.8 steps 1 and 2, FP-B5; OD-12 / OD-13): the wizard page starts
 * from `proposeRoute`. Step 2 shows the pace chips with the suggested pace pre-selected and tagged
 * *Suggested*, the suggested length pre-selected and tagged, one preview line under each preset
 * length, and the length follows the pace until the grown-up picks one. Rendered with
 * react-test-renderer (the repo's web tests have no DOM) on the frozen October 2026 catalogue.
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
// The adult frame (F-APP-001 A-5a) has its own tests; here it passes the page through.
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Af1'),
}));

const FAMILY = {
  id: 'space:f1',
  kind: 'family' as const,
  name: 'The Parks',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const placement = (band: number) => ({ takenAt: '2026-10-01T00:00:00.000Z', level: { stage: 'stage1', band }, oralStage: null, strands: {}, beyondContent: false, overridden: false });
const learner = (id: string, displayName: string, ageGroup: string, band: number | null) => ({
  id,
  displayName,
  ageGroup,
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: '2026-10-10T08:00:00.000Z',
  lastSyncedAt: '2026-10-10T08:05:00.000Z',
  summary: band === null ? null : { stage1: { questsDone: 0, questsTotal: 15 }, placement: placement(band) },
});

let learners = [learner('l:sam', 'Sam', '10-11', 2)];
const api = {
  roster: async () => ({ ok: true as const, data: { space: FAMILY, learners, joinCode: null, joinCodeExpiresAt: null } }),
  entitlements: async () => ({ ok: true as const, data: [] }),
  listSpaces: async () => ({ ok: true as const, data: [] }),
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'parent-park', displayName: 'Jun' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const c = getMessages('en').console.curriculum;

/** The wizard's "today", fixed as in `curriculum-free-days-wiring.test.tsx` (#761): the real clock can shift the week. */
const NOW = new Date('2026-10-14T12:00:00Z');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  learners = [learner('l:sam', 'Sam', '10-11', 2)];
  vi.useRealTimers();
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
const checked = (root: ReactTestInstance, id: string): boolean => one(root, id).props['aria-checked'] === true;
const tagged = (root: ReactTestInstance, id: string): boolean => byTestId(one(root, id), 'suggested-tag').length === 1;

async function stepTwo(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />, { createNodeMock: (element) => (element.type === 'h1' ? { focus: () => undefined } : null) });
  });
  if (!mounted) throw new Error('not mounted');
  await click(mounted.root, 'route-next');
  return mounted.root;
}

describe('the wizard pre-selects proposeRoute\'s pace and length (P2-6b)', () => {
  it('prefills the only learner\'s start and pre-selects Steady and 4 weeks, both tagged Suggested', async () => {
    await act(async () => {
      mounted = create(<Page />, { createNodeMock: () => null });
    });
    if (!mounted) throw new Error('not mounted');
    const root = mounted.root;
    expect(checked(root, 'start-all-letters')).toBe(true);
    await click(root, 'route-next');
    expect(checked(root, 'pace-steady')).toBe(true);
    expect(tagged(root, 'pace-steady')).toBe(true);
    expect(tagged(root, 'pace-gentle')).toBe(false);
    expect(textOf(one(root, 'pace-gentle'))).toBe(c.rhythm.paceOption(c.rhythm.paces.gentle, 2));
    expect(checked(root, 'length-4-week')).toBe(true);
    expect(tagged(root, 'length-4-week')).toBe(true);
    expect(tagged(root, 'length-12-week')).toBe(false);
    expect(byTestId(root, 'route-problem')).toHaveLength(0);
  });

  it('shows one honest preview line under each preset length, none under Choose weeks', async () => {
    const root = await stepTwo();
    for (const id of ['4-week', '12-week', '6-month']) expect(textOf(one(root, `length-line-${id}`)).length).toBeGreaterThan(0);
    expect(byTestId(root, 'length-line-custom')).toHaveLength(0);
    // Band 2 at Steady: every lesson fits in 4 weeks (1.2 column A), then heritage stories.
    expect(textOf(one(root, 'length-line-4-week'))).toMatch(/^Stage 1 is done around week [1-4], then heritage stories\.$/);
  });

  it('moves the suggested length with the pace until the grown-up picks a length', async () => {
    const root = await stepTwo();
    await click(root, 'pace-gentle');
    expect(checked(root, 'pace-gentle')).toBe(true);
    expect(checked(root, 'length-12-week')).toBe(true);
    expect(tagged(root, 'length-12-week')).toBe(true);
    // Gentle cannot hold every lesson in 4 weeks: the card says so and claims no finish.
    expect(textOf(one(root, 'length-line-4-week'))).toBe(c.proposal.lessonsCutShort(4));
    await click(root, 'length-6-month');
    await click(root, 'pace-brisk');
    expect(checked(root, 'pace-brisk')).toBe(true);
    expect(checked(root, 'length-6-month')).toBe(true);
  });

  it('weekdays off the chips: no pace selected, a plain line, the length kept', async () => {
    const root = await stepTwo();
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri']) await click(root, `day-${day}`);
    expect(['gentle', 'steady', 'brisk'].some((pace) => checked(root, `pace-${pace}`))).toBe(false);
    expect(textOf(root)).toContain(c.rhythm.offChips);
    expect(checked(root, 'length-4-week')).toBe(true);
    // The suggested pace keeps its tag; no length is suggested off the chips.
    expect(byTestId(root, 'suggested-tag')).toHaveLength(1);
    expect(tagged(root, 'pace-steady')).toBe(true);
    expect(byTestId(root, 'length-line-4-week')).toHaveLength(0);
  });

  it('a Pictures-first learner picked from several: Gentle and 12 weeks', async () => {
    learners = [learner('l:sam', 'Sam', '10-11', 2), learner('l:kid', 'Kid', '5-7', null)];
    await act(async () => {
      mounted = create(<Page />, { createNodeMock: () => null });
    });
    if (!mounted) throw new Error('not mounted');
    const root = mounted.root;
    const select = one(root, 'route-learner');
    await act(async () => {
      (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'l:kid' } });
    });
    await click(root, 'route-next');
    expect(checked(root, 'pace-gentle')).toBe(true);
    expect(tagged(root, 'pace-gentle')).toBe(true);
    expect(checked(root, 'length-12-week')).toBe(true);
  });

  it('a learner re-picked after step 2 keeps the pace, minutes and start day the grown-up set; the start follows the learner', async () => {
    learners = [learner('l:sam', 'Sam', '10-11', 3), learner('l:kid', 'Kid', '5-7', null)];
    await act(async () => {
      mounted = create(<Page />, { createNodeMock: () => null });
    });
    if (!mounted) throw new Error('not mounted');
    const root = mounted.root;
    const pick = async (id: string): Promise<void> => {
      const select = one(root, 'route-learner');
      await act(async () => {
        (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: id } });
      });
    };
    await pick('l:kid');
    await click(root, 'route-next');
    await click(root, 'pace-brisk');
    const minutes = root.findAll((node) => node.type === 'button' && textOf(node) === c.rhythm.minutesOption(20))[0];
    if (!minutes) throw new Error('no 20 min');
    await act(async () => {
      (minutes.props.onClick as () => void)();
    });
    const back = root.findAll((node) => node.type === 'button' && textOf(node) === c.previous.cta)[0];
    if (!back) throw new Error('no back');
    await act(async () => {
      (back.props.onClick as () => void)();
    });
    await pick('l:sam');
    expect(checked(root, 'start-reads-words')).toBe(true);
    await click(root, 'route-next');
    expect(checked(root, 'pace-brisk')).toBe(true);
    const twenty = root.findAll((node) => node.type === 'button' && textOf(node) === c.rhythm.minutesOption(20))[0];
    expect(twenty?.props['aria-checked']).toBe(true);
  });
});
