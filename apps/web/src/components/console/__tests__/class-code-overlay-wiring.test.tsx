import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STEADY } from '@/lib/console/__tests__/fixtures/report';
import { CODE_OVERLAY_FLAG } from '@/lib/console/class-code-overlay';
import { qrModules, qrPath } from '@/lib/console/join-link';
import { CLASS_RELINK_REFRESH_MS, VISIBLE_POLL_MS } from '@/lib/console/visible-refresh';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';
import TeachSpacePage from '@/app/(console)/teach/space/page';

/**
 * AMENDMENTS-CLASS-CODE-OVERLAY CO-1 (section 3.1, 3.3, 3.6; tests section 6 item 4): the class page's Show the code
 * opens an overlay that renders no learner name and no progress, whatever the roster holds; the new-device pop-up
 * waits while it is open; opening reads the roster once and then every 20 s, and a new code redraws the code and the QR;
 * a code that ends closes it with focus on the page head (or the error panel); a session flag brings it back after a
 * grown-up lock. Rendered with react-test-renderer (no DOM); the harness is the GX-2 wiring test's.
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

const NOW = new Date('2026-11-24T12:00:00.000Z');
const min = (m: number): string => new Date(NOW.getTime() + m * 60_000).toISOString();
type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });

const spaceOf = (kind: 'class' | 'family') => ({
  id: kind === 'class' ? 'space:sunflower' : 'space:kim-family',
  kind,
  name: kind === 'class' ? 'Sunday Class A' : 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: state.anonymize },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});
const member = (id: string, name: string, summary: Record<string, unknown> | null): Record<string, unknown> => ({
  id,
  displayName: name,
  ageGroup: '5-7',
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: '2026-11-23T09:30:00.000Z',
  lastSyncedAt: '2026-11-23T09:31:00.000Z',
  summary,
});
const NEEDS = ['ㅂ', 'ㅅ'];
const learnersFor = (anonymize: boolean): unknown[] => [
  member('profile:yuhan', anonymize ? 'Y. K.' : '김유한', { ...STEADY, lastActiveAt: '2026-11-23T09:30:00.000Z', needsPractice: NEEDS }),
  member('profile:jaehan', anonymize ? 'J. O.' : "Jaehan O'Neil-Núñez", {
    ...STEADY,
    lastActiveAt: '2026-11-23T09:30:00.000Z',
    needsPractice: [],
    vocab: { collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, needsPractice: ['vocab:sagwa-apple', 'vocab:nun-eye'] },
  }),
  member('profile:mina', anonymize ? 'M. K.' : 'Mina Kim', { ...STEADY, lastActiveAt: '2026-11-23T09:30:00.000Z', needsPractice: ['ㄱ'] }),
];
const PLAN = { id: 'plan:family-week', spaceId: 'space:sunflower', authorAccountId: 'acct', title: 'Plan of the Pine week', items: [{}, {}] as unknown[], targetLearnerIds: null, publishedAt: '2026-11-20T09:00:00.000Z', archivedAt: null, createdAt: '2026-11-20T09:00:00.000Z', updatedAt: '2026-11-20T09:00:00.000Z' };
const relinkFor = (learnerId: string, name: string) => ({ id: `relink:${learnerId}`, learnerId, learnerName: name, deviceId: 'device:new', platform: 'ios', requestedAt: min(-2), expiresAt: min(7.5), status: 'pending' });

const state = {
  kind: 'class' as 'class' | 'family',
  anonymize: false,
  learners: [] as unknown[],
  relinks: [] as unknown[],
  code: 'SUN234' as string | null,
  expires: '2026-12-12T12:00:00.000Z' as string | null,
  rosterError: null as null | 'forbidden',
  rosterCalls: 0,
  incoming: [] as unknown[],
  hold: null as Promise<void> | null,
};
const MOVE_IN = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'rabbit', level: '5-7' }, createdAt: '2026-11-23T12:00:00.000Z', at: null };

const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async () => {
        if (name === 'roster') {
          state.rosterCalls += 1;
          if (state.hold) await state.hold;
          if (state.rosterError) return { ok: false, error: state.rosterError, status: 403 } satisfies Result;
          return ok({ space: spaceOf(state.kind), learners: state.learners, joinCode: state.code, joinCodeExpiresAt: state.expires });
        }
        if (name === 'regenerateCode') return ok({ joinCode: 'ZZZ999', expiresAt: '2026-12-20T12:00:00.000Z' });
        if (name === 'listPlans') return ok([PLAN]);
        if (name === 'relinkRequests') return ok(state.relinks);
        if (name === 'transferRequests') return ok({ requests: [] });
        if (name === 'classMoves') return ok({ outgoing: [], incoming: state.incoming });
        if (name === 'listSpaces') return ok([{ space: spaceOf(state.kind), role: 'owner', counts: { learners: 3, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
        return ok([]);
      },
  },
);
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'acct-co', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages(lang.locale), locale: lang.locale }) };
});

type DocListener = (event: { key: string; shiftKey: boolean; defaultPrevented?: boolean; preventDefault: () => void }) => void;
const keydown = new Set<DocListener>();
const visibility = new Set<() => void>();
const fakeDocument = {
  title: 'Hangul Route for teachers',
  activeElement: null as unknown,
  body: {},
  visibilityState: 'visible',
  documentElement: { setAttribute: () => undefined, removeAttribute: () => undefined, style: { overflow: '' } },
  addEventListener: (type: string, l: DocListener | (() => void)) => {
    if (type === 'keydown') keydown.add(l as DocListener);
    if (type === 'visibilitychange') visibility.add(l as () => void);
  },
  removeEventListener: (type: string, l: DocListener | (() => void)) => {
    if (type === 'keydown') keydown.delete(l as DocListener);
    if (type === 'visibilitychange') visibility.delete(l as () => void);
  },
};
const session: Record<string, string> = {};
const pagehide = new Set<() => void>();
const fakeWindow = {
  location: { pathname: '/teach/space', search: '?id=space%3Asunflower', hash: '', origin: 'https://app.hangulroute.com' },
  sessionStorage: {
    getItem: (k: string) => session[k] ?? null,
    setItem: (k: string, v: string) => {
      session[k] = v;
    },
    removeItem: (k: string) => {
      delete session[k];
    },
  },
  addEventListener: (type: string, l: () => void) => {
    if (type === 'pagehide') pagehide.add(l);
  },
  removeEventListener: (type: string, l: () => void) => {
    if (type === 'pagehide') pagehide.delete(l);
  },
};

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
  resetTransferLockForTests();
  state.kind = 'class';
  state.anonymize = false;
  state.learners = learnersFor(false);
  state.relinks = [];
  state.code = 'SUN234';
  state.expires = '2026-12-12T12:00:00.000Z';
  state.rosterError = null;
  state.rosterCalls = 0;
  state.incoming = [];
  state.hold = null;
  pagehide.clear();
  nav.query = 'id=space%3Asunflower';
  lang.locale = 'en';
  fakeWindow.location.pathname = '/teach/space';
  fakeWindow.location.search = '?id=space%3Asunflower';
  for (const k of Object.keys(session)) delete session[k];
  focused.length = 0;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  keydown.clear();
  visibility.clear();
  pagehide.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetTransferLockForTests();
});

const textOf = (node: ReactTestInstance | string): string => (typeof node === 'string' ? node : node.children.map((child) => textOf(child)).join(''));
const root = (): ReactTestInstance => (mounted as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance[] => root().findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const one = (id: string): ReactTestInstance => {
  const [found] = byTestId(id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const overlay = (): ReactTestInstance | undefined => byTestId('class-code-overlay')[0];

/** What the page asked to focus, by test id: react-test-renderer has no DOM, so each ref gets a node that records it. */
const focused: string[] = [];
const nodeMock = (el: { props: Record<string, unknown>; type: unknown }) => ({
  focus: () => focused.push(String(el.props['data-testid'] ?? el.type)),
  querySelector: (selector: string) => ({ focus: () => focused.push(selector) }),
  querySelectorAll: () => [],
});

async function render(): Promise<void> {
  await act(async () => {
    mounted = create(<TeachSpacePage />, { createNodeMock: nodeMock });
  });
  await act(async () => undefined);
}
async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onClick as () => void)();
  });
  await act(async () => undefined);
}
async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => undefined);
}
async function escape(): Promise<void> {
  await act(async () => {
    for (const l of [...keydown]) l({ key: 'Escape', shiftKey: false, preventDefault: () => undefined });
  });
}

/** Every text node and every attribute value that names something (`aria-label`, `title`, `alt`) inside `node`. */
function shown(node: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string): void => {
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (typeof n.type === 'string') for (const key of ['aria-label', 'title', 'alt'] as const) if (typeof n.props[key] === 'string') out.push(n.props[key] as string);
    n.children.forEach(walk);
  };
  walk(node);
  return out.map((s) => s.trim()).filter(Boolean);
}

const c = (): ReturnType<typeof getMessages>['console'] => getMessages(lang.locale).console;
const allowed = (): string[] => {
  const m = getMessages(lang.locale);
  return [
    'Sunday Class A',
    m.console.space.codeLabel.class,
    'SUN234',
    'S U N 2 3 4',
    'expires in 18 days',
    m.console.space.codeOverlay.howToJoin(m.caregiver.spaces.join.cta),
    m.console.space.joinLink.qr.label,
    m.console.space.joinLink.qr.caption,
    m.common.buttons.close,
  ];
};

describe('Show the code in the bar (3.1)', () => {
  it('a class with a live code: the button after Class report and before More, with aria-haspopup', async () => {
    await render();
    const ids = byTestId('class-actions')[0]!
      .findAll((n) => (n.type === 'button' || n.type === 'a') && typeof n.props['data-testid'] === 'string')
      .map((n) => n.props['data-testid']);
    expect(ids).toEqual(['open-plan', 'plan-term', 'open-lecture', 'class-report-link', 'class-code-open', 'class-more-toggle']);
    const button = one('class-code-open');
    expect(textOf(button)).toBe('Show the code');
    expect(button.props.type).toBe('button');
    expect(button.props['aria-haspopup']).toBe('dialog');
    expect(overlay()).toBeUndefined();
  });

  it.each(['en', 'es', 'ko'] as UiLocale[])('%s: the button says Show the code in the console language', async (locale) => {
    lang.locale = locale;
    await render();
    expect(textOf(one('class-code-open'))).toBe(getMessages(locale).console.space.codeOverlay.open.cta);
  });

  it('an empty class shows it too', async () => {
    state.learners = [];
    await render();
    expect(byTestId('class-code-open')).toHaveLength(1);
  });

  it('no code, an expired code, a family roster: no button', async () => {
    state.code = null;
    state.expires = null;
    await render();
    expect(byTestId('class-code-open')).toHaveLength(0);
    act(() => mounted?.unmount());
    state.code = 'SUN234';
    state.expires = '2026-11-01T00:00:00.000Z';
    await render();
    expect(byTestId('class-code-open')).toHaveLength(0);
    act(() => mounted?.unmount());
    state.expires = '2026-12-12T12:00:00.000Z';
    state.kind = 'family';
    nav.query = 'id=space%3Akim-family';
    await render();
    expect(byTestId('class-code-open')).toHaveLength(0);
  });
});

describe('the overlay renders no learner name and no progress (section 6 item 4)', () => {
  it.each([false, true])('anonymizeRoster %s: every text and every attribute inside is one of the allowed strings', async (anonymize) => {
    state.anonymize = anonymize;
    state.learners = learnersFor(anonymize);
    state.relinks = [relinkFor('profile:yuhan', anonymize ? 'Y. K.' : '김유한')];
    // The pop-up of the pending new device would open over the page first: open the page without it, then add it.
    const pending = state.relinks;
    state.relinks = [];
    await render();
    state.relinks = pending;
    await press(one('class-code-open'));
    const dialog = overlay() as ReactTestInstance;
    expect(dialog).toBeDefined();
    const strings = shown(dialog);
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) expect(allowed(), `"${s}" is not on the allow-list`).toContain(s);
    const text = strings.join(' | ');
    const m = c();
    for (const forbidden of ['김유한', "Jaehan O'Neil-Núñez", 'Mina Kim', 'Y. K.', 'J. O.', 'M. K.', 'ㅂ', 'ㅅ', 'ㄱ', 'sagwa', 'nun', '사과', 'Plan of the Pine week']) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    for (const line of [m.space.learner.revisit('X'), m.space.learner.words(1, 1), m.space.learner.wordsRevisit('X'), m.space.learner.practiced('today', 1), m.space.learner.planReadout('X', 'Y')]) {
      expect(text).not.toContain(line.slice(0, 6));
    }
    expect(byTestId('student-card').filter((card) => dialog.findAll((n) => n === card).length > 0)).toHaveLength(0);
    expect(dialog.findAll((n) => n.props['data-testid'] === 'student-card')).toHaveLength(0);
    expect(dialog.findAll((n) => typeof n.type === 'string' && n.type === 'button')).toHaveLength(1);
  });

  it('the dialog is drawn from the roster\'s name and code, and the QR path is the join link\'s', async () => {
    await render();
    await press(one('class-code-open'));
    expect(textOf(one('class-code'))).toBe('SUN234');
    expect(one('class-code-qr').findByType('path').props.d).toBe(qrPath(qrModules('https://app.hangulroute.com/join#c=SUN234')));
  });

  it('opening it moves focus to its heading; Close and Escape put it back on Show the code', async () => {
    await render();
    await press(one('class-code-open'));
    expect(focused).toContain('h2');
    focused.length = 0;
    await press(one('class-code-close'));
    expect(overlay()).toBeUndefined();
    expect(focused).toEqual(['class-code-open']);
    await press(one('class-code-open'));
    focused.length = 0;
    await escape();
    expect(overlay()).toBeUndefined();
    expect(focused).toEqual(['class-code-open']);
  });
});

describe('while the overlay is open (3.6)', () => {
  it('the new-device pop-up waits, and opens after Close', async () => {
    await render();
    await press(one('class-code-open'));
    state.relinks = [relinkFor('profile:jaehan', "Jaehan O'Neil-Núñez")];
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(byTestId('relink-popup')).toHaveLength(0);
    expect(shown(overlay() as ReactTestInstance).join(' ')).not.toContain('Jaehan');
    await press(one('class-code-close'));
    expect(byTestId('relink-popup')).toHaveLength(1);
  });

  it('opening reads the roster once more; while open it reads every 20 s, not every 90 s; after Close the slow read is back', async () => {
    await render();
    const before = state.rosterCalls;
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(state.rosterCalls).toBe(before);
    await press(one('class-code-open'));
    expect(state.rosterCalls).toBe(before + 1);
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(state.rosterCalls).toBe(before + 2);
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(state.rosterCalls).toBe(before + 3);
    await press(one('class-code-close'));
    const closed = state.rosterCalls;
    await advance(CLASS_RELINK_REFRESH_MS * 2);
    expect(state.rosterCalls).toBe(closed);
    await advance(VISIBLE_POLL_MS);
    expect(state.rosterCalls).toBeGreaterThan(closed);
  });

  it('a re-read with a new code redraws the code and the QR in place', async () => {
    await render();
    await press(one('class-code-open'));
    state.code = 'NEW567';
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(textOf(one('class-code'))).toBe('NEW567');
    expect(one('class-code-qr').findByType('path').props.d).toBe(qrPath(qrModules('https://app.hangulroute.com/join#c=NEW567')));
    expect(shown(overlay() as ReactTestInstance)).toContain('N E W 5 6 7');
  });

  it('a re-read that finds no live code closes it, with focus on the page head and the flag removed', async () => {
    await render();
    await press(one('class-code-open'));
    expect(session[CODE_OVERLAY_FLAG]).toBe('space:sunflower');
    state.code = null;
    state.expires = null;
    focused.length = 0;
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(overlay()).toBeUndefined();
    expect(byTestId('class-code-open')).toHaveLength(0);
    expect(focused).toEqual(['space-head']);
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
  });

  it('a re-read that says forbidden closes it, with focus on the error panel', async () => {
    await render();
    await press(one('class-code-open'));
    state.rosterError = 'forbidden';
    focused.length = 0;
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(overlay()).toBeUndefined();
    expect(byTestId('space-error')).toHaveLength(1);
    expect(focused).toEqual(['space-error']);
    expect(byTestId('space-error')[0]!.props.tabIndex).toBe(-1);
  });

  it('Regenerate tells the other console tabs', async () => {
    const posts: unknown[] = [];
    class FakeChannel {
      postMessage(message: unknown): void {
        posts.push(message);
      }
      close(): void {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    await render();
    await press(one('invite-toggle'));
    const regenerate = root().findAll((n) => n.type === 'button' && textOf(n) === c().space.regenerate.cta)[0] as ReactTestInstance;
    await press(regenerate);
    // The confirm step opens first: answer it.
    const yes = one('confirm-sheet-confirm');
    await press(yes);
    expect(posts).toHaveLength(1);
    expect((posts[0] as { type: string }).type).toBe('roster-changed');
  });
});

describe('the session flag (3.6)', () => {
  it('opening writes the space id only; Close and Escape remove it', async () => {
    await render();
    await press(one('class-code-open'));
    expect(session).toEqual({ [CODE_OVERLAY_FLAG]: 'space:sunflower' });
    await press(one('class-code-close'));
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
    await press(one('class-code-open'));
    await escape();
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
  });

  it('a page that mounts with the flag naming its space draws the overlay with the roster; Close removes the flag', async () => {
    session[CODE_OVERLAY_FLAG] = 'space:sunflower';
    // Before the roster has been read, nothing is drawn: no roster card and no overlay.
    act(() => {
      mounted = create(<TeachSpacePage />, { createNodeMock: nodeMock });
    });
    expect(byTestId('student-card')).toHaveLength(0);
    expect(overlay()).toBeUndefined();
    await act(async () => undefined);
    await act(async () => undefined);
    expect(overlay()).toBeDefined();
    expect(textOf(one('class-code'))).toBe('SUN234');
    await press(one('class-code-close'));
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
    expect(overlay()).toBeUndefined();
  });

  it('a flag for another space is ignored; a flag with no live code is removed and nothing opens', async () => {
    session[CODE_OVERLAY_FLAG] = 'space:other';
    await render();
    expect(overlay()).toBeUndefined();
    act(() => mounted?.unmount());
    session[CODE_OVERLAY_FLAG] = 'space:sunflower';
    state.code = null;
    state.expires = null;
    await render();
    expect(overlay()).toBeUndefined();
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
  });

  it('a lock unmounts the page with the address unchanged: the flag stays, and the next mount reopens; a navigation removes it', async () => {
    await render();
    await press(one('class-code-open'));
    act(() => mounted?.unmount());
    mounted = null;
    await advance(1);
    expect(session[CODE_OVERLAY_FLAG]).toBe('space:sunflower');
    await render();
    expect(overlay()).toBeDefined();
    // A navigation to another page: the address no longer names this class.
    fakeWindow.location.pathname = '/teach/home';
    fakeWindow.location.search = '';
    act(() => mounted?.unmount());
    mounted = null;
    await advance(1);
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
  });
});

describe('a family roster', () => {
  it('has no Show the code and no overlay, whatever the session holds', async () => {
    state.kind = 'family';
    nav.query = 'id=space%3Akim-family';
    session[CODE_OVERLAY_FLAG] = 'space:kim-family';
    await render();
    expect(byTestId('class-code-open')).toHaveLength(0);
    expect(overlay()).toBeUndefined();
  });
});


/** The nearest ancestor (or the node itself) that carries the `inert` attribute, or null. */
const inertAncestor = (node: ReactTestInstance): ReactTestInstance | null => {
  for (let n: ReactTestInstance | null = node; n; n = n.parent) if (typeof n.type === 'string' && n.props.inert !== undefined) return n;
  return null;
};

describe('the page behind is inert as a whole, also for parts that mount later (3.3, review)', () => {
  it('the page content is one container: inert while the overlay shows, not before and not after', async () => {
    await render();
    expect(one('class-page-content').props.inert).toBeUndefined();
    await press(one('class-code-open'));
    expect(one('class-page-content').props.inert).toBe('');
    expect(inertAncestor(one('student-card'))).not.toBeNull();
    expect(inertAncestor(overlay() as ReactTestInstance)).toBeNull();
    await press(one('class-code-close'));
    expect(one('class-page-content').props.inert).toBeUndefined();
  });

  it('a learner asking to join and the attention banner that arrive on a re-read while it is open are inert, so neither prints nor is reached by a screen reader', async () => {
    await render();
    expect(byTestId('asking-to-join')).toHaveLength(0);
    await press(one('class-code-open'));
    state.incoming = [MOVE_IN];
    await advance(CLASS_RELINK_REFRESH_MS);
    const asking = one('asking-to-join');
    expect(textOf(asking)).toContain('J. K.');
    expect(inertAncestor(asking)).not.toBeNull();
    expect(inertAncestor(one('attention-banner'))).not.toBeNull();
    // The overlay itself shows none of it.
    expect(shown(overlay() as ReactTestInstance).join(' ')).not.toContain('J. K.');
    expect(inertAncestor(overlay() as ReactTestInstance)).toBeNull();
  });

  it('a read error that closes the overlay leaves nothing held inert for the page that shows its error', async () => {
    await render();
    await press(one('class-code-open'));
    state.rosterError = 'forbidden';
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(overlay()).toBeUndefined();
    expect(one('class-page-content').props.inert).toBeUndefined();
    expect(inertAncestor(one('space-error'))).toBeNull();
  });
});

describe('the flag follows the page, not a stale roster (review)', () => {
  it('a pagehide (a closing, reloading or leaving tab) removes the flag; a lock, which fires none, keeps it', async () => {
    await render();
    await press(one('class-code-open'));
    expect(session[CODE_OVERLAY_FLAG]).toBe('space:sunflower');
    expect(pagehide.size).toBe(1);
    await act(async () => {
      for (const l of [...pagehide]) l();
    });
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
  });

  it("the address moving from class A to class B closes the overlay, offers no entry from A's roster and writes no flag for B", async () => {
    await render();
    await press(one('class-code-open'));
    expect(session[CODE_OVERLAY_FLAG]).toBe('space:sunflower');
    // B's read is slow: A's roster is still in memory when the address changes.
    let release: () => void = () => undefined;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    nav.query = 'id=space%3Aother';
    fakeWindow.location.search = '?id=space%3Aother';
    await act(async () => {
      (mounted as ReactTestRenderer).update(<TeachSpacePage />);
    });
    await act(async () => undefined);
    expect(overlay()).toBeUndefined();
    expect(byTestId('class-code-open')).toHaveLength(0);
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
    expect(one('class-page-content').props.inert).toBeUndefined();
    state.hold = null;
    release();
    await act(async () => undefined);
    await advance(1);
    // B's roster lands: no overlay opened by itself, no flag.
    expect(overlay()).toBeUndefined();
    expect(session[CODE_OVERLAY_FLAG]).toBeUndefined();
  });
});
