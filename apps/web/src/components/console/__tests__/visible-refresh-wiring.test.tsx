import type { UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, STEADY, response } from '@/lib/console/__tests__/fixtures/report';
import { VISIBLE_POLL_MS, VISIBLE_REFRESH_GAP_MS } from '@/lib/console/visible-refresh';
import { getMessages } from '@hangul-route/i18n';
import TeachSpacePage from '@/app/(console)/teach/space/page';
import ParentSpacePage from '@/app/(console)/parent/space/page';
import ParentHomePage from '@/app/(console)/parent/page';
import ParentLearnerPage from '@/app/(console)/parent/learner/page';
import TeachLearnerPage from '@/app/(console)/teach/space/learner/page';

/**
 * F-LEARN-001 section 3.11: a learner renamed on their device ("Test" to "Sungjoo") shows on a console tab that stayed
 * open, without a reload. The teacher roster, the family roster and home, the parent chooser and the learner report
 * read again when the tab comes back into view (`visibilitychange` to `visible`), at most every 30 seconds; a failed
 * read in the background keeps what is drawn. Rendered with react-test-renderer (no DOM); `document` is a stub that
 * holds the listeners.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));
// The family home's class-scope cards read their own routes; this test is about the learner names only.
vi.mock('@/components/console/FamilyClassCards', () => ({ FamilyClassCards: () => null }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const nav = { query: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });
const down: Result = { ok: false, error: 'network', status: 0 };

const state: { name: string; failing: boolean; rosterFails: boolean; hold: Promise<void> | null; failWith: Result | null } = { name: 'Test', failing: false, rosterFails: false, hold: null, failWith: null };
const calls: string[] = [];
/** The options each report read passed (the background read says `refresh`). */
const reportOptions: unknown[] = [];

function space(kind: 'class' | 'family') {
  return {
    id: kind === 'class' ? 'space:sunflower' : 'space:kim-family',
    kind,
    name: kind === 'class' ? 'Sunflower' : 'Kim family',
    parentSpaceId: null,
    settings: { consentMode: 'parent', anonymizeRoster: false },
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}
const learner = (name: string = state.name) => ({
  id: 'profile:mina',
  displayName: name,
  ageGroup: 'starter',
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: '2026-10-15T09:30:00.000Z',
  lastSyncedAt: '2026-10-15T09:31:00.000Z',
  summary: STEADY,
});
const hana = { ...learner(), id: 'profile:hana', displayName: 'Hana', joinedAt: '2026-09-03T00:00:00.000Z' };
const kindOf = (spaceId: unknown): 'class' | 'family' => (spaceId === 'space:sunflower' ? 'class' : 'family');
const listed = () => [
  { space: space('class'), role: 'teacher', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null },
  { space: space('family'), role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null },
];

const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async (...args: unknown[]) => {
        calls.push(name);
        if (name === 'getLearnerReport') reportOptions.push(args[3]);
        // The name as the server holds it when the read starts; `hold` keeps this read open (a slow network).
        const atStart = state.name;
        if (name === 'roster' && state.hold) await state.hold;
        if (state.rosterFails && name === 'roster') return down;
        if (state.failing && (name === 'roster' || name === 'getLearnerReport' || name === 'listSpaces')) return state.failWith ?? down;
        if (name === 'listSpaces') return ok(listed());
        // The family has a second learner, so the parent chooser lists both instead of opening the one report.
        if (name === 'roster') return ok({ space: space(kindOf(args[0])), learners: kindOf(args[0]) === 'family' ? [learner(atStart), hana] : [learner(atStart)], joinCode: null, joinCodeExpiresAt: null });
        if (name === 'transferRequests') return ok({ requests: [] });
        if (name === 'getLearnerReport') return ok(response(STEADY, { kind: kindOf(args[0]), name: state.name }));
        return ok([]);
      },
  },
);

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'acct-refresh', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

/** A document stub that holds the visibilitychange listeners, so a test can bring the tab back into view. */
const listeners = new Set<() => void>();
/** The window's `focus` and `pageshow` listeners: a desktop window brought back to the front. */
const windowListeners = new Set<() => void>();
const fakeWindow = {
  location: { pathname: '/teach/space', search: '', origin: 'https://app.hangulroute.com' },
  print: () => undefined,
  confirm: () => false,
  addEventListener: (type: string, l: () => void) => {
    if (type === 'focus' || type === 'pageshow') windowListeners.add(l);
  },
  removeEventListener: (type: string, l: () => void) => {
    if (type === 'focus' || type === 'pageshow') windowListeners.delete(l);
  },
};
const fakeDocument = {
  title: 'Console',
  activeElement: null as unknown,
  body: {},
  visibilityState: 'visible',
  addEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.add(l);
  },
  removeEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.delete(l);
  },
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  reportOptions.length = 0;
  listeners.clear();
  windowListeners.clear();
  state.name = 'Test';
  state.failing = false;
  state.rosterFails = false;
  state.hold = null;
  state.failWith = null;
  nav.query = '';
  fakeDocument.visibilityState = 'visible';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function render(Page: () => JSX.Element, query: string): Promise<() => string> {
  nav.query = query;
  await act(async () => {
    mounted = create(<Page />);
  });
  return () => (mounted ? textOf(mounted.root) : '');
}

/** The learner renames on their device; the tab comes back into view `afterMs` later. */
async function comeBack(afterMs: number, visibility = 'visible'): Promise<void> {
  vi.setSystemTime(NOW.getTime() + afterMs);
  fakeDocument.visibilityState = visibility;
  await act(async () => {
    for (const l of [...listeners]) l();
  });
}

const count = (name: string): number => calls.filter((c) => c === name).length;

const PAGES = [
  { label: 'the teacher roster (/teach/space)', Page: TeachSpacePage, query: 'id=space%3Asunflower', read: 'roster' },
  { label: 'the family roster (/parent/space)', Page: ParentSpacePage, query: 'id=space%3Akim-family', read: 'roster' },
  { label: 'the family home (/parent)', Page: ParentHomePage, query: '', read: 'roster' },
  { label: 'the parent chooser (/parent/learner)', Page: ParentLearnerPage, query: '', read: 'roster' },
  { label: 'the class learner report (/teach/space/learner)', Page: TeachLearnerPage, query: 'id=space%3Asunflower&learner=profile%3Amina&period=week', read: 'getLearnerReport' },
  { label: 'the family learner report (/parent/learner?learner=)', Page: ParentLearnerPage, query: 'id=space%3Akim-family&learner=profile%3Amina&period=week', read: 'getLearnerReport' },
] as const;

describe('an open console tab shows a renamed learner (F-LEARN-001 section 3.11)', () => {
  for (const { label, Page, query, read } of PAGES) {
    describe(label, () => {
      it('reads again when the tab comes back into view after 30 seconds: "Test" becomes "Sungjoo"', async () => {
        const text = await render(Page, query);
        expect(text()).toContain('Test');
        const first = count(read);
        state.name = 'Sungjoo';
        await comeBack(VISIBLE_REFRESH_GAP_MS);
        expect(count(read)).toBeGreaterThan(first);
        expect(text()).toContain('Sungjoo');
        expect(text()).not.toContain('Test');
      });

      it('waits 30 seconds between reads, and never reads while the tab is hidden', async () => {
        await render(Page, query);
        const first = count(read);
        await comeBack(5_000);
        await comeBack(VISIBLE_REFRESH_GAP_MS * 2, 'hidden');
        expect(count(read)).toBe(first);
      });

      it('a background read that fails keeps the drawn page', async () => {
        const text = await render(Page, query);
        const before = text();
        state.failing = true;
        await comeBack(VISIBLE_REFRESH_GAP_MS);
        expect(text()).toBe(before);
      });
    });
  }

  it('a report read again is marked as a background read, so the Worker counts no new view', async () => {
    await render(TeachLearnerPage, PAGES[4].query);
    expect(reportOptions).toEqual([undefined]);
    await comeBack(VISIBLE_REFRESH_GAP_MS);
    expect(reportOptions).toEqual([undefined, { refresh: true }]);
  });

  it('the learner report header reads "Sungjoo: report" after the read again', async () => {
    await render(TeachLearnerPage, 'id=space%3Asunflower&learner=profile%3Amina&period=week');
    const h1 = (): string[] => (mounted ? mounted.root.findAll((n) => n.type === 'h1').map(textOf) : []);
    expect(h1()).toContain('Test: report');
    state.name = 'Sungjoo';
    await comeBack(VISIBLE_REFRESH_GAP_MS);
    expect(h1()).toContain('Sungjoo: report');
  });

  it('stops listening when the page leaves', async () => {
    await render(TeachSpacePage, 'id=space%3Asunflower');
    expect(listeners.size).toBeGreaterThan(0);
    expect(windowListeners.size).toBeGreaterThan(0);
    act(() => mounted?.unmount());
    mounted = null;
    expect(listeners.size).toBe(0);
    expect(windowListeners.size).toBe(0);
  });

  for (const { label, Page, query } of [PAGES[0], PAGES[4]]) {
    it(`${label}: a window that gets focus again reads again (two desktop windows side by side never hide the tab)`, async () => {
      const text = await render(Page, query);
      expect(text()).toContain('Test');
      state.name = 'Sungjoo';
      vi.setSystemTime(NOW.getTime() + VISIBLE_REFRESH_GAP_MS);
      await act(async () => {
        for (const l of [...windowListeners]) l();
      });
      expect(text()).toContain('Sungjoo');
    });
  }

  it('a roster that stays in front reads again every 90 seconds; a report never polls', async () => {
    // The clock beforeEach installed fakes Date only; this test also needs the interval.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    const text = await render(TeachSpacePage, 'id=space%3Asunflower');
    expect(text()).toContain('Test');
    state.name = 'Sungjoo';
    const before = count('roster');
    await act(async () => {
      vi.advanceTimersByTime(VISIBLE_POLL_MS);
    });
    expect(count('roster')).toBeGreaterThan(before);
    expect(text()).toContain('Sungjoo');
    act(() => mounted?.unmount());
    mounted = null;

    await render(TeachLearnerPage, PAGES[4].query);
    const reads = count('getLearnerReport');
    await act(async () => {
      vi.advanceTimersByTime(VISIBLE_POLL_MS * 3);
    });
    expect(count('getLearnerReport')).toBe(reads);
  });

  it('a background read that says the teacher was removed shows that line, drops the old roster and stops reading (/teach/space)', async () => {
    const text = await render(TeachSpacePage, 'id=space%3Asunflower');
    expect(text()).toContain('Test');
    state.failing = true;
    state.failWith = { ok: false, error: 'forbidden', status: 403 };
    await comeBack(VISIBLE_REFRESH_GAP_MS);
    expect(text()).toContain(getMessages('en').console.space.forbidden);
    expect(text()).not.toContain('Test');
    const reads = count('roster');
    await comeBack(VISIBLE_REFRESH_GAP_MS * 3);
    expect(count('roster')).toBe(reads);
  });

  it('a background read that cannot reach the Worker three times in a row shows the usual line and stops reading (/parent)', async () => {
    const text = await render(ParentHomePage, '');
    const cantReach = getMessages('en').console.cantReach;
    state.failing = true;
    await comeBack(VISIBLE_REFRESH_GAP_MS);
    await comeBack(VISIBLE_REFRESH_GAP_MS * 2);
    expect(text()).not.toContain(cantReach);
    await comeBack(VISIBLE_REFRESH_GAP_MS * 3);
    expect(text()).toContain(cantReach);
    const reads = count('listSpaces');
    await comeBack(VISIBLE_REFRESH_GAP_MS * 4);
    expect(count('listSpaces')).toBe(reads);
  });

  it('a background read answered signed out stops at once and shows the usual line (/parent)', async () => {
    const text = await render(ParentHomePage, '');
    state.failing = true;
    state.failWith = { ok: false, error: 'unauthorized', status: 401 };
    await comeBack(VISIBLE_REFRESH_GAP_MS);
    expect(text()).toContain(getMessages('en').console.cantReach);
    const reads = count('listSpaces');
    await comeBack(VISIBLE_REFRESH_GAP_MS * 2);
    expect(count('listSpaces')).toBe(reads);
  });

  it('a slow background read that ends after a newer Try again never puts the old name back (/parent)', async () => {
    // The family roster fails first, so its card offers Try again.
    state.rosterFails = true;
    const text = await render(ParentHomePage, '');
    state.rosterFails = false;
    const retry = (): ReactTestInstance => mounted!.root.find((n) => n.type === 'button' && n.props['data-testid'] === 'family-retry-space:kim-family');
    expect(retry()).toBeTruthy();
    // A background read starts while the server still says "Test", and its roster read hangs.
    let release!: () => void;
    state.hold = new Promise<void>((resolve) => (release = resolve));
    await comeBack(VISIBLE_REFRESH_GAP_MS);
    // The learner renames; the grown-up taps Try again, which answers at once.
    state.name = 'Sungjoo';
    const held = state.hold;
    state.hold = null;
    await act(async () => {
      retry().props.onClick();
    });
    expect(text()).toContain('Sungjoo');
    // The slow read ends last, with the old name: it is dropped.
    state.hold = held;
    await act(async () => {
      release();
      await held;
    });
    expect(text()).toContain('Sungjoo');
    expect(text()).not.toContain('Test');
  });
});
