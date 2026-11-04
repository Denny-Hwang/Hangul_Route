import type { UiLocale } from '@hangul-route/i18n';
import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STEADY } from '@/lib/console/__tests__/fixtures/report';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';
import TeachSpacePage from '@/app/(console)/teach/space/page';

/**
 * AMENDMENTS-GROWNUP-UX GX-7 (section 8 T3 to T5; section 14 "render tests of the class page and card"): the class
 * page reads title, banner, This week, the action bar (More holding Notes, New devices, Class moves and Settings),
 * the roster and, last, the Invite students disclosure, collapsed while the class has learners; a roster card is
 * avatar · name · chip … level, the activity line, the stage segments with the quests, what to revisit, the plan
 * lines, then Report and Note in one row; an empty class shows its three first steps, the invite open and hero-size,
 * and leaves out Re-link, Class moves, Notes and Lecture mode. A family roster keeps its shipped order.
 */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/console/DisplaySheet', () => ({ DisplayButton: () => null }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const nav = { query: 'id=space%3Asunflower' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

const NOW = new Date('2026-10-31T12:00:00.000Z');
const MOVE_IN = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'rabbit', level: '5-7' }, createdAt: '2026-10-30T12:00:00.000Z', at: null };
type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });

const spaceOf = (kind: 'class' | 'family') => ({
  id: kind === 'class' ? 'space:sunflower' : 'space:kim-family',
  kind,
  name: kind === 'class' ? 'Sunflower' : 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});
const member = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  displayName: name,
  ageGroup: '5-7',
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: '2026-10-30T09:30:00.000Z',
  lastSyncedAt: '2026-10-30T09:31:00.000Z',
  summary: { ...STEADY, lastActiveAt: '2026-10-30T09:30:00.000Z' },
  ...over,
});

const state = { kind: 'class' as 'class' | 'family', learners: [] as unknown[], incoming: [] as unknown[], seats: undefined as undefined | { learners: number; cap: number } };
const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async () => {
        if (name === 'roster') return ok({ space: spaceOf(state.kind), learners: state.learners, joinCode: 'ABC234', joinCodeExpiresAt: '2026-11-20T00:00:00.000Z', ...(state.seats ? { seats: state.seats } : {}) });
        if (name === 'transferRequests') return ok({ requests: [] });
        if (name === 'classMoves') return ok({ outgoing: [], incoming: state.incoming });
        if (name === 'listSpaces') return ok([{ space: spaceOf(state.kind), role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
        return ok([]);
      },
  },
);
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'acct-gx', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages(lang.locale), locale: lang.locale }) };
});

const fakeDocument = { title: 'Console', activeElement: null, body: {}, visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined };
const fakeWindow = { location: { pathname: '/teach/space', search: '', origin: 'https://app.hangulroute.com' }, addEventListener: () => undefined, removeEventListener: () => undefined };

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);
  vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
  vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'enabled');
  vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
  resetTransferLockForTests();
  state.kind = 'class';
  state.learners = [member('profile:yuhan', 'Yuhan'), member('profile:mina', 'Mina', { summary: null, lastSyncedAt: null, joinedAt: '2026-09-10T00:00:00.000Z' })];
  state.incoming = [];
  state.seats = undefined;
  nav.query = 'id=space%3Asunflower';
  lang.locale = 'en';
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetTransferLockForTests();
});

const textOf = (node: ReactTestInstance | string): string => (typeof node === 'string' ? node : node.children.map((child) => textOf(child)).join(''));
const root = (): ReactTestInstance => (mounted as ReactTestRenderer).root;
const byTestId = (id: string, scope: ReactTestInstance = root()): ReactTestInstance[] => scope.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const one = (id: string, scope?: ReactTestInstance): ReactTestInstance => {
  const [found] = byTestId(id, scope);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
/** The buttons and links with a test id inside `scope`, in document order. */
const controlsIn = (scope: ReactTestInstance): string[] => scope.findAll((n) => (n.type === 'button' || n.type === 'a') && typeof n.props['data-testid'] === 'string').map((n) => String(n.props['data-testid']));

async function render(): Promise<void> {
  await act(async () => {
    mounted = create(<TeachSpacePage />);
  });
  await act(async () => undefined);
}
async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onClick as () => void)();
  });
}

/** The page's sections in document order, by test id. */
const orderOf = (ids: string[]): string[] => root().findAll((n) => typeof n.type === 'string' && ids.includes(String(n.props['data-testid']))).map((n) => String(n.props['data-testid']));

describe('a class with learners (T3)', () => {
  it('reads title, This week, the action bar, the roster, then Invite students', async () => {
    await render();
    expect(orderOf(['space-head', 'this-week', 'class-actions', 'student-card', 'invite'])).toEqual(['space-head', 'this-week', 'class-actions', 'student-card', 'student-card', 'invite']);
  });

  it('the bar shows Plan this week (primary), Term plan, Lecture mode and Class report; More holds Notes, New devices, Class moves and Settings', async () => {
    await render();
    const c = getMessages('en').console;
    expect(controlsIn(one('class-actions'))).toEqual(['open-plan', 'plan-term', 'open-lecture', 'class-report-link', 'class-more-toggle']);
    expect(textOf(one('open-plan'))).toBe(c.planThisWeek);
    // Class report left This week for the bar.
    expect(byTestId('class-report-link', one('this-week'))).toHaveLength(0);
    await press(one('class-more-toggle'));
    expect(controlsIn(one('class-more'))).toEqual(['roster-notes', 'relink-requests', 'class-moves', 'space-settings']);
  });

  it('Invite students is collapsed: its button carries the code; a tap shows the code at display size with Copy and Regenerate', async () => {
    await render();
    const toggle = one('invite-toggle');
    expect(textOf(toggle)).toBe(getMessages('en').console.space.invite('ABC234'));
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(byTestId('join-code')).toHaveLength(0);
    await press(toggle);
    expect(textOf(one('join-code'))).toBe('ABC234');
    expect(textOf(one('invite-body'))).toContain(getMessages('en').console.space.regenerate.cta);
    expect(byTestId('first-run')).toHaveLength(0);
  });

  it('a waiting class move stands in the bar with its count, not behind More (GX-7 review)', async () => {
    state.incoming = [MOVE_IN];
    await render();
    const c = getMessages('en').console;
    expect(controlsIn(one('class-actions'))).toEqual(['open-plan', 'plan-term', 'open-lecture', 'class-report-link', 'class-moves', 'class-more-toggle']);
    expect(textOf(one('class-moves'))).toBe(c.transfer.waiting(1));
    await press(one('class-more-toggle'));
    expect(controlsIn(one('class-more'))).toEqual(['roster-notes', 'relink-requests', 'space-settings']);
  });

  it('a seat-cap notice stays near the top, before This week and the roster, never at the end (GX-7 review)', async () => {
    state.seats = { learners: 2, cap: 2 };
    await render();
    const c = getMessages('en').console;
    const text = textOf(root());
    const at = c.seats.class.at(2);
    expect(text).toContain(at);
    expect(text.indexOf(at)).toBeLessThan(text.indexOf(c.space.week.title));
  });

  it.each(['en', 'es', 'ko'] as UiLocale[])('%s: the invite button and More in the console language', async (locale) => {
    lang.locale = locale;
    await render();
    const c = getMessages(locale).console;
    expect(textOf(one('invite-toggle'))).toBe(c.space.invite('ABC234'));
    expect(textOf(one('class-more-toggle'))).toBe(c.space.more);
  });
});

describe('the roster card (T4)', () => {
  it('a learner who practiced: the activity line, the segments with the quests, the revisit line, then Report, Note (and Suggest a different start) in one row', async () => {
    await render();
    const c = getMessages('en').console;
    const card = byTestId('student-card')[0] as ReactTestInstance;
    expect(textOf(one('practiced-line', card))).toBe(c.space.learner.practiced('yesterday', 36));
    const strip = one('journey-strip', card);
    expect(strip.props['data-variant']).toBe('card');
    expect(textOf(strip)).toContain(c.space.learner.questsCards(7, 15, 5));
    expect(textOf(strip)).not.toContain(c.journey.title);
    expect(card.findAll((n) => n.type === 'details')).toHaveLength(0);
    // The old separate lines are gone.
    expect(textOf(card)).not.toContain(c.space.learner.lastActive('yesterday'));
    expect(card.findAll((n) => typeof n.type === 'string' && n.children.length === 1 && n.children[0] === c.space.learner.minutesThisWeek(36))).toHaveLength(0);
    expect(controlsIn(one('card-actions', card))).toEqual(['see-report', 'send-note', 'suggest-start']);
  });

  it.each(['en', 'es', 'ko'] as UiLocale[])('%s: past Stage 1, the quests (Stage 1\'s) take a line of their own that names Stage 1, never "On Stage 2 · Quests"', async (locale) => {
    lang.locale = locale;
    const journey = {
      v: 1,
      here: 'stage2',
      stages: [
        { stage: 'stage1', state: 'complete', done: 15, known: 0, total: 15 },
        { stage: 'stage2', state: 'open', done: 1, known: 0, total: 2 },
      ],
    };
    state.learners = [member('profile:yuhan', 'Yuhan', { summary: { ...STEADY, stage1: { ...STEADY.stage1, questsDone: 15 }, journey, lastActiveAt: '2026-10-30T09:30:00.000Z' } })];
    await render();
    const c = getMessages(locale).console;
    const card = byTestId('student-card')[0] as ReactTestInstance;
    const quests = c.space.learner.questsCards(15, 15, 5);
    expect(textOf(one('journey-strip', card))).not.toContain(quests);
    expect(textOf(one('journey-strip', card))).toContain(c.journey.onStage(2));
    // GX-8 (T10): the quests text names Stage 1 itself ("Stage 1 quests: 15 of 15 · 5 cards"), so it is not wrapped again.
    expect(textOf(one('quests-line', card))).toBe(quests);
  });

  it('Suggest a different start sits in the card\'s one row of buttons, after See report and Send a note (GX-7 review)', async () => {
    await render();
    const card = byTestId('student-card')[0] as ReactTestInstance;
    expect(byTestId('starting-spot', card)).toHaveLength(1);
    expect(byTestId('suggest-start', one('starting-spot', card))).toHaveLength(0);
    expect(controlsIn(one('card-actions', card))).toEqual(['see-report', 'send-note', 'suggest-start']);
  });

  it('a learner with no journey yet: the quests text on its own line', async () => {
    state.learners = [member('profile:yuhan', 'Yuhan', { summary: { ...STEADY, journey: undefined, lastActiveAt: '2026-10-30T09:30:00.000Z' } })];
    await render();
    const card = byTestId('student-card')[0] as ReactTestInstance;
    expect(byTestId('journey-strip', card)).toHaveLength(0);
    expect(textOf(one('quests-line', card))).toBe(getMessages('en').console.space.learner.questsCards(7, 15, 5));
  });
});

describe('an empty class (T5)', () => {
  beforeEach(() => {
    state.learners = [];
  });

  it('Invite students open with the code hero-size, then the first steps, then the bar; no This week and no roster', async () => {
    await render();
    expect(orderOf(['space-head', 'first-run', 'invite', 'class-actions', 'this-week', 'student-card'])).toEqual(['space-head', 'invite', 'first-run', 'class-actions']);
    expect(one('invite-toggle').props['aria-expanded']).toBe(true);
    expect(textOf(one('join-code'))).toBe('ABC234');
    expect(textOf(one('invite-body'))).toContain(getMessages('en').console.writeOnBoard);
    const steps = one('first-run').findByType('ol').findAllByType('li').map(textOf);
    expect(steps).toEqual([...getMessages('en').console.space.firstRun.steps]);
  });

  it('Lecture mode, Class report, Notes, New devices and Class moves stay hidden; More holds Settings', async () => {
    await render();
    expect(byTestId('open-lecture')).toHaveLength(0);
    expect(byTestId('class-report-link')).toHaveLength(0);
    await press(one('class-more-toggle'));
    expect(controlsIn(one('class-more'))).toEqual(['space-settings']);
  });

  it('a teacher move into the empty class: Class moves comes back, in the bar with its count', async () => {
    state.incoming = [MOVE_IN];
    await render();
    expect(controlsIn(one('class-actions'))).toEqual(['open-plan', 'plan-term', 'class-moves', 'class-more-toggle']);
    await press(one('class-more-toggle'));
    expect(controlsIn(one('class-more'))).toEqual(['space-settings']);
  });
});

describe('a family roster keeps its shipped order', () => {
  it('the code panel first, no Invite students disclosure, no More; the compact card applies', async () => {
    state.kind = 'family';
    nav.query = 'id=space%3Akim-family';
    await render();
    expect(byTestId('invite')).toHaveLength(0);
    expect(byTestId('class-more-toggle')).toHaveLength(0);
    expect(orderOf(['join-code', 'this-week', 'student-card'])[0]).toBe('join-code');
    expect(byTestId('space-settings')).toHaveLength(1);
    expect(byTestId('practiced-line').length).toBeGreaterThan(0);
  });
});
