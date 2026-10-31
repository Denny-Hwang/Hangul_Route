import type { UiLocale } from '@hangul-route/i18n';
import { colors } from '@hangul-route/design-system/tokens';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STEADY } from '@/lib/console/__tests__/fixtures/report';
import { CLASS_RELINK_REFRESH_MS } from '@/lib/console/visible-refresh';
import { DECIDED_HOLD_MS } from '@/components/console/LearnerStatusParts';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';
import TeachSpacePage from '@/app/(console)/teach/space/page';

/**
 * AMENDMENTS-GROWNUP-UX GX-2 (owner request 2026-10-31: "a pop-up or a clearer alert"): on the class page the attention
 * banner under the title counts everything that needs this class's answer and opens the review sheet; a new re-link opens
 * the pop-up (once per request, once more at 2 minutes left after Later); an action chip opens the pop-up for a re-link
 * and the sheet at the item for a learner asking to join; `#attention` opens the sheet on load; the tab title carries
 * the count. Rendered with react-test-renderer (no DOM); the harness is the GX-1 wiring test's.
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
const min = (m: number): string => new Date(NOW.getTime() + m * 60_000).toISOString();

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number; code?: string };
const ok = (data: unknown): Result => ({ ok: true, data });

const spaceOf = (kind: 'class' | 'family') => ({
  id: kind === 'class' ? 'space:sunflower' : 'space:kim-family',
  kind,
  name: kind === 'class' ? 'Sunflower' : 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: state.archivedAt,
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
  summary: STEADY,
  ...over,
});
const relinkFor = (learnerId: string, name: string) => ({ id: `relink:${name.toLowerCase()}`, learnerId, learnerName: name, deviceId: 'device:new', platform: 'ios', requestedAt: min(-2), expiresAt: min(7.5), status: 'pending' });
const incomingTransfer = {
  id: 'transfer:in1',
  role: 'destination',
  status: 'requested',
  steps: { learner: 'yes', source: 'yes', destination: 'waiting' },
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: '2026-10-29T12:00:00.000Z',
  expiresAt: '2026-11-12T12:00:00.000Z',
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  learner: { name: 'M. K.', avatar: 'bear', level: '8-9' },
  comingFrom: { name: 'Class B' },
};
const teacherMoveIn = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'rabbit', level: '5-7' }, createdAt: '2026-10-30T12:00:00.000Z', at: null };
const familyMove = {
  id: 'transfer:f1',
  role: 'learner_side',
  status: 'requested',
  initiator: 'source',
  learner: { id: 'profile:yuhan', name: 'Yuhan' },
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
  learnerState: 'pending',
  sourceState: 'yes',
  destinationState: 'waiting',
  blockReason: null,
  executeAfter: null,
  createdAt: '2026-10-29T12:00:00.000Z',
  expiresAt: '2026-11-12T12:00:00.000Z',
};

const state = {
  kind: 'class' as 'class' | 'family',
  learners: [] as unknown[],
  relinks: [] as unknown[],
  transfers: [] as unknown[],
  incoming: [] as unknown[],
  decide: ok({}) as Result,
  archivedAt: null as string | null,
};
const calls: Array<{ name: string; args: unknown[] }> = [];

const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async (...args: unknown[]) => {
        calls.push({ name, args });
        if (name === 'roster') return ok({ space: spaceOf(state.kind), learners: state.learners, joinCode: 'ABCD', joinCodeExpiresAt: null });
        if (name === 'relinkRequests') return ok(state.relinks);
        if (name === 'transferRequests') return ok({ requests: state.transfers });
        if (name === 'classMoves') return ok({ outgoing: [], incoming: state.incoming });
        if (name === 'listSpaces') return ok([{ space: spaceOf(state.kind), role: 'teacher', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
        if (name === 'decideRelink' || name === 'acceptClassMove' || name === 'declineClassMove' || name === 'approveTransfer' || name === 'declineTransfer') return state.decide;
        return ok([]);
      },
  },
);

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'acct-gx', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages(lang.locale), locale: lang.locale }) };
});

const listeners = new Set<() => void>();
const session: Record<string, string> = {};
const fakeDocument = {
  title: 'Hangul Route for teachers',
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
const fakeWindow = {
  location: { pathname: '/teach/space', search: '', hash: '', origin: 'https://app.hangulroute.com' },
  sessionStorage: {
    getItem: (k: string) => session[k] ?? null,
    setItem: (k: string, v: string) => {
      session[k] = v;
    },
    removeItem: (k: string) => {
      delete session[k];
    },
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
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
  resetTransferLockForTests();
  state.kind = 'class';
  state.learners = [
    member('profile:yuhan', 'Yuhan'),
    member('profile:jaehan', 'Jaehan'),
    member('profile:mina', 'Mina', { joinedAt: '2026-10-30T08:00:00.000Z', summary: null, lastSyncedAt: null }),
  ];
  state.relinks = [relinkFor('profile:jaehan', 'Jaehan')];
  state.transfers = [incomingTransfer];
  state.incoming = [teacherMoveIn];
  state.decide = ok({});
  state.archivedAt = null;
  nav.query = 'id=space%3Asunflower';
  lang.locale = 'en';
  for (const k of Object.keys(session)) delete session[k];
  fakeWindow.location.hash = '';
  fakeDocument.title = 'Hangul Route for teachers';
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  listeners.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetTransferLockForTests();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}
const root = (): ReactTestInstance => (mounted as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance[] => root().findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const cards = (): ReactTestInstance[] => byTestId('student-card');
const cardOf = (name: string): ReactTestInstance => {
  const card = cards().find((c) => c.findAll((n) => n.type === 'strong').some((s) => textOf(s) === name));
  if (!card) throw new Error(`no card for ${name}`);
  return card;
};
const chipIn = (card: ReactTestInstance): ReactTestInstance | undefined => card.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === 'learner-status')[0];
const count = (name: string): number => calls.filter((c) => c.name === name).length;

/** What the page asked to focus: react-test-renderer has no DOM, so each ref gets a node that records it. */
const focused: string[] = [];
const nodeMock = () => ({ focus: () => focused.push('self'), querySelector: (selector: string) => ({ focus: () => focused.push(selector) }) });

async function render(): Promise<void> {
  await act(async () => {
    mounted = create(<TeachSpacePage />, { createNodeMock: nodeMock });
  });
  // The move lists are read after the roster names the kind.
  await act(async () => undefined);
}

async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onClick as () => void)();
  });
  await act(async () => undefined);
}

const popupOpen = (): ReactTestInstance | undefined => byTestId('relink-popup')[0];
const sheetOpen = (): ReactTestInstance | undefined => byTestId('attention-sheet')[0];

describe('the attention banner and the review sheet (sections 5.1, 5.2)', () => {
  it('the banner under the title counts every waiting request: 1 new device and 2 class moves (a transfer and a teacher move)', async () => {
    await render();
    const banner = byTestId('attention-banner')[0] as ReactTestInstance;
    expect(textOf(banner.find((n) => n.props.role === 'status'))).toBe('3 requests need your OK1 new device · 2 class moves');
    // Under the title, above everything else of the page (the asks to join come next, before the class code: GX-1).
    const order = root()
      .findAll((n) => typeof n.type === 'string' && ['space-head', 'attention-banner', 'join-code', 'asking-to-join'].includes(String(n.props['data-testid'])))
      .map((n) => n.props['data-testid']);
    expect(order).toEqual(['space-head', 'attention-banner', 'asking-to-join', 'join-code']);
  });

  it('Review now opens the sheet with the device, both learners asking to join and Accept first; nothing waiting: no banner', async () => {
    await render();
    await press(popupOpen()?.find((n) => n.props['data-testid'] === 'relink-popup-later' && n.type === 'button') as ReactTestInstance);
    await press(byTestId('attention-review-now')[0] as ReactTestInstance);
    const sheet = sheetOpen() as ReactTestInstance;
    expect(byTestId('sheet-device-row').map((r) => textOf(r))).toEqual([expect.stringContaining('Jaehan')]);
    expect(sheet.findAll((n) => n.props['data-testid'] === 'incoming-card' && typeof n.type === 'string')).toHaveLength(2);
    act(() => mounted?.unmount());
    state.relinks = [];
    state.transfers = [];
    state.incoming = [];
    await render();
    expect(byTestId('attention-banner')).toEqual([]);
    expect(popupOpen()).toBeUndefined();
  });

  it('approving in the sheet answers the request, notes the card, reads again and keeps the sheet open', async () => {
    await render();
    await press(popupOpen()?.find((n) => n.props['data-testid'] === 'relink-popup-later' && n.type === 'button') as ReactTestInstance);
    await press(byTestId('attention-review-now')[0] as ReactTestInstance);
    const reads = count('relinkRequests');
    state.relinks = [];
    await press(byTestId('sheet-device-approve')[0] as ReactTestInstance);
    expect(calls.find((c) => c.name === 'decideRelink')?.args).toEqual(['space:sunflower', 'relink:jaehan', true]);
    expect(count('relinkRequests')).toBeGreaterThan(reads);
    expect(textOf(cardOf('Jaehan'))).toContain('Jaehan can open their new device now.');
    expect(sheetOpen()).toBeDefined();
    expect(textOf(byTestId('attention-banner')[0] as ReactTestInstance)).toContain('2 requests need your OK');
  });

  it('#attention in the address opens the sheet on load (the hash carries no id), and the pop-up waits behind it', async () => {
    fakeWindow.location.hash = '#attention';
    await render();
    expect(sheetOpen()).toBeDefined();
    expect(popupOpen()).toBeUndefined();
    await press(byTestId('attention-sheet-close')[0] as ReactTestInstance);
    expect(sheetOpen()).toBeUndefined();
    // The sheet listed the device: it counts as shown, so no pop-up follows the sheet.
    expect(popupOpen()).toBeUndefined();
  });

  it("an asking-to-join card's chip opens the sheet at that item", async () => {
    state.relinks = [];
    await render();
    focused.length = 0;
    await press(byTestId('incoming-card')[0]?.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-status') as ReactTestInstance);
    expect(sheetOpen()).toBeDefined();
    expect(focused[0]).toBe('[data-sheet-key="incoming:transfer:transfer:in1"]');
  });

  it('the tab title carries the count, a number only, and loses it when nothing waits', async () => {
    await render();
    expect(fakeDocument.title).toBe('(3) Hangul Route for teachers');
    expect(fakeDocument.title).not.toContain('Jaehan');
    act(() => mounted?.unmount());
    mounted = null;
    expect(fakeDocument.title).toBe('Hangul Route for teachers');
  });
});

describe('the re-link pop-up (section 5.3)', () => {
  it('a pending re-link opens the pop-up on load; Later closes it and the 20 s read does not bring it back', async () => {
    await render();
    const popup = popupOpen() as ReactTestInstance;
    expect(popup.props.role).toBe('alertdialog');
    expect(textOf(popup)).toContain('New device request: Jaehan');
    expect(textOf(popup)).toContain('This request closes in 8 min.');
    await press(popup.find((n) => n.type === 'button' && n.props['data-testid'] === 'relink-popup-later'));
    expect(popupOpen()).toBeUndefined();
    // The chip and the banner stay.
    expect(textOf(chipIn(cardOf('Jaehan')) as ReactTestInstance)).toBe('Needs your OK');
    await act(async () => {
      vi.advanceTimersByTime(CLASS_RELINK_REFRESH_MS);
    });
    expect(popupOpen()).toBeUndefined();
    expect(JSON.parse(session['hr:console:relinkShown'] ?? '[]')).toEqual(['relink:jaehan']);
  });

  it('with nothing pending at load, a new re-link opens the pop-up within one 20 s read', async () => {
    state.relinks = [];
    await render();
    expect(popupOpen()).toBeUndefined();
    state.relinks = [relinkFor('profile:yuhan', 'Yuhan')];
    await act(async () => {
      vi.advanceTimersByTime(CLASS_RELINK_REFRESH_MS);
    });
    expect(textOf(popupOpen() as ReactTestInstance)).toContain('New device request: Yuhan');
  });

  it('Approve in the pop-up answers it, closes it and notes the learner card', async () => {
    await render();
    state.relinks = [];
    await press(popupOpen()?.find((n) => n.type === 'button' && n.props['data-testid'] === 'relink-popup-approve') as ReactTestInstance);
    expect(calls.find((c) => c.name === 'decideRelink')?.args).toEqual(['space:sunflower', 'relink:jaehan', true]);
    expect(popupOpen()).toBeUndefined();
    expect(textOf(cardOf('Jaehan'))).toContain('Jaehan can open their new device now.');
  });

  it("the re-link card's action chip opens the pop-up for its request again after Later", async () => {
    await render();
    await press(popupOpen()?.find((n) => n.type === 'button' && n.props['data-testid'] === 'relink-popup-later') as ReactTestInstance);
    await press(chipIn(cardOf('Jaehan')) as ReactTestInstance);
    expect(textOf(popupOpen() as ReactTestInstance)).toContain('New device request: Jaehan');
  });

  it('never while the review sheet is open', async () => {
    state.relinks = [];
    await render();
    await press(byTestId('attention-review-now')[0] as ReactTestInstance);
    state.relinks = [relinkFor('profile:yuhan', 'Yuhan')];
    await act(async () => {
      vi.advanceTimersByTime(CLASS_RELINK_REFRESH_MS);
    });
    expect(popupOpen()).toBeUndefined();
    expect(byTestId('sheet-device-row')).toHaveLength(1);
  });

  it('an archived class answers nothing here: no pop-up (the sheet and the cards are read-only too)', async () => {
    state.archivedAt = '2026-10-30T00:00:00.000Z';
    await render();
    expect(popupOpen()).toBeUndefined();
  });

  it('opening the sheet reads the classes once when the roster did not (Agree for both classes in the sheet)', async () => {
    await render();
    const before = count('listSpaces');
    await press(popupOpen()?.find((n) => n.props['data-testid'] === 'relink-popup-later' && n.type === 'button') as ReactTestInstance);
    await press(byTestId('attention-review-now')[0] as ReactTestInstance);
    expect(count('listSpaces')).toBe(before === 0 ? 1 : before);
  });

  it('the family roster gets the banner and the sheet, never the pop-up (it gets the re-link bar of GX-5)', async () => {
    state.kind = 'family';
    nav.query = 'id=space%3Akim-family';
    state.learners = [member('profile:yuhan', 'Yuhan'), member('profile:jaehan', 'Jaehan')];
    state.transfers = [familyMove];
    state.incoming = [];
    await render();
    expect(popupOpen()).toBeUndefined();
    expect(textOf(byTestId('attention-banner')[0] as ReactTestInstance)).toContain('2 requests need your OK');
    await press(byTestId('attention-review-now')[0] as ReactTestInstance);
    expect(textOf(byTestId('sheet-family-row')[0] as ReactTestInstance)).toContain('Class move: Saturday Class B');
  });
});

describe('Korean and Spanish (section 10.1)', () => {
  it('ko: the banner, the pop-up and the title count', async () => {
    lang.locale = 'ko';
    await render();
    expect(textOf(byTestId('attention-banner')[0] as ReactTestInstance)).toContain('승인을 기다리는 요청 3건');
    expect(textOf(byTestId('attention-banner')[0] as ReactTestInstance)).toContain('새 기기 1건 · 반 이동 2건');
    expect(textOf(popupOpen() as ReactTestInstance)).toContain('새 기기 연결 요청: Jaehan');
  });

  it('es: the banner and the pop-up', async () => {
    lang.locale = 'es';
    await render();
    expect(textOf(byTestId('attention-banner')[0] as ReactTestInstance)).toContain('3 solicitudes esperan tu aprobación');
    expect(textOf(popupOpen() as ReactTestInstance)).toContain('Solicitud de dispositivo nuevo: Jaehan');
  });
});

it('keeps tokens: the banner fill is amber light, never the danger colour', async () => {
  await render();
  const style = (byTestId('attention-banner')[0] as ReactTestInstance).props.style;
  expect(style.backgroundColor).toBe(colors.feedback.nudgeLight);
  expect(JSON.stringify(style)).not.toContain(colors.feedback.danger);
  expect(DECIDED_HOLD_MS).toBeGreaterThan(0);
});
