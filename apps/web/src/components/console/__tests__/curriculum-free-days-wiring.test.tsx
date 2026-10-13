import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpaceRole } from '@hangul-route/content-schema';

/**
 * F-ENT-003 E3-9, the wizard page's wiring (review 2026-10-12): with the console's free-plan
 * switch on, the page reads the viewer's spaces and entitlements, words the left-out line for an
 * uncovered space's owner, shows the short-plan line and its **Use {weeks} weeks** button (which
 * re-runs the preview and moves focus to the heading); a co-teacher reads the neutral line; with
 * the switch off the page makes no extra request and keeps today's words. Rendered with
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

vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));

// next/link needs the app router's context; a plain anchor keeps its href and text.
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));

// The adult frame (F-APP-001 A-5a) reads the spaces list and draws its own links; adult-frame.test.tsx covers it.
// Here it passes the page through, so the calls and the links below are the page's own.
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Ac1'),
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

const calls: string[] = [];
let role: SpaceRole = 'owner';
const api = {
  roster: async () => {
    calls.push('roster');
    return { ok: true as const, data: { space: SPACE, learners: [], joinCode: null, joinCodeExpiresAt: null } };
  },
  entitlements: async () => {
    calls.push('entitlements');
    return { ok: true as const, data: [] };
  },
  listSpaces: async () => {
    calls.push('listSpaces');
    return { ok: true as const, data: [{ space: SPACE, role, counts: { learners: 0, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }] };
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const en = getMessages('en').console;
const focus = vi.fn();

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  role = 'owner';
  focus.mockClear();
  vi.unstubAllEnvs();
});

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function click(root: ReactTestInstance, id: string): Promise<void> {
  const [button] = byTestId(root, id);
  if (!button) throw new Error(`no ${id}`);
  await act(async () => {
    (button.props.onClick as () => void)();
  });
}

/** Opens the wizard and walks to the preview with the given length preset. */
async function preview(length: string): Promise<ReactTestInstance> {
  const { default: Page } = await import('@/app/(console)/teach/space/curriculum/page');
  await act(async () => {
    mounted = create(<Page />, { createNodeMock: (element) => (element.type === 'h1' ? { focus } : null) });
  });
  if (!mounted) throw new Error('not mounted');
  const root = mounted.root;
  await click(root, 'route-next');
  await click(root, `length-${length}`);
  await click(root, 'route-next');
  await click(root, 'route-see');
  return root;
}

const warningTexts = (root: ReactTestInstance): string[] => byTestId(root, 'route-warning').map(textOf);

describe('the curriculum wizard with the free-plan switch', () => {
  it('off: no spaces read, today\'s left-out words and See plans, no short-plan line', async () => {
    const root = await preview('6-month');
    expect(calls).not.toContain('listSpaces');
    expect(calls).toEqual(expect.arrayContaining(['roster', 'entitlements']));
    const texts = warningTexts(root);
    expect(texts.some((t) => t.startsWith(en.curriculum.preview.warnings.premium(3)) && t.includes(en.curriculum.preview.warnings.seePlans.cta))).toBe(true);
    expect(texts.some((t) => t.includes(en.access.openBilling.cta))).toBe(false);
    expect(byTestId(root, 'route-short-plan')).toHaveLength(0);
  });

  it('on, the owner of an uncovered class: the free-plan words, Open billing, and Use 12 weeks re-runs the preview', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    const root = await preview('6-month');
    expect(calls).toEqual(expect.arrayContaining(['roster', 'entitlements', 'listSpaces']));
    const texts = warningTexts(root);
    expect(texts.some((t) => t.startsWith('The free plan covers Stage 1 (lessons in weeks 1 to ') && t.endsWith(en.access.openBilling.cta))).toBe(true);
    // The 6-month plan's coming-soon placeholder is past Stage 1: it opens with the product once released, not on its date.
    expect(texts).toContain(en.curriculum.freeDays.comingSoon(1, 1, en.access.product.class));
    expect(texts.some((t) => t.includes('Premium'))).toBe(false);
    const [line] = byTestId(root, 'route-short-plan');
    if (!line) throw new Error('no short-plan line');
    expect(textOf(line)).toContain(en.curriculum.freeDays.useWeeks.cta(12));
    focus.mockClear();
    await click(root, 'route-use-weeks');
    expect(focus).toHaveBeenCalled();
    // The 12-week plan holds every lesson; its lessons end in week 11 and no shorter preset holds them all.
    const [after] = byTestId(root, 'route-short-plan');
    if (!after) throw new Error('no short-plan line after');
    expect(textOf(after)).toContain(en.curriculum.freeDays.shortPlan(11));
    expect(byTestId(root, 'route-use-weeks')).toHaveLength(0);
  });

  it('on, a co-teacher: the neutral left-out line, no link, no short-plan line', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    role = 'teacher';
    const root = await preview('6-month');
    const texts = warningTexts(root);
    expect(texts).toContain(en.curriculum.freeDays.warningNeutral(3));
    expect(texts.some((t) => t.includes(en.access.openBilling.cta) || t.includes(en.curriculum.preview.warnings.seePlans.cta))).toBe(false);
    expect(byTestId(root, 'route-short-plan')).toHaveLength(0);
  });
});
