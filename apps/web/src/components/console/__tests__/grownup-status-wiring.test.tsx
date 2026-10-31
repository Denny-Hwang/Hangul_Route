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
 * AMENDMENTS-GROWNUP-UX GX-1 (owner request 2026-10-31): on the class page a learner whose re-link waits shows the amber
 * **Needs your OK** chip right after the name with the reason and inline Approve / Deny; every other member shows the
 * quiet **In class**; a learner who joined this week with nothing synced shows **New**; learners asking to join (a
 * transfer or another teacher's move) get their own cards above the roster with Accept first; the counts include the
 * teacher moves; and the page asks for its re-links alone every 20 s. Rendered with react-test-renderer (no DOM).
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
const fakeWindow = {
  location: { pathname: '/teach/space', search: '', origin: 'https://app.hangulroute.com' },
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
  nav.query = 'id=space%3Asunflower';
  lang.locale = 'en';
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

describe('the class page shows a status next to every learner (GX-1, section 4)', () => {
  it('the re-link learner: an amber Needs your OK button named with its reason, the reason line, inline Approve / Deny', async () => {
    await render();
    const card = cardOf('Jaehan');
    const chip = chipIn(card) as ReactTestInstance;
    expect(chip.type).toBe('button');
    expect(textOf(chip)).toBe('Needs your OK');
    expect(chip.props['aria-label']).toBe('Needs your OK: New device · 8 min left');
    expect(chip.props.style.minHeight).toBeGreaterThanOrEqual(64);
    expect(chip.props.style.border).toContain(colors.feedback.nudge);
    expect(textOf(card)).toContain('New device · 8 min left');
    const approve = card.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'relink-approve-inline')[0] as ReactTestInstance;
    const deny = card.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'relink-deny-inline')[0] as ReactTestInstance;
    expect(textOf(approve)).toBe('Approve');
    expect(textOf(deny)).toBe('Deny');
    // "Approve" is read with whose request it is: the name and the reason line.
    const [nameId, reasonId] = String(approve.props['aria-describedby']).split(' ');
    expect(textOf(root().find((n) => n.props.id === nameId))).toBe('Jaehan');
    expect(textOf(root().find((n) => n.props.id === reasonId))).toBe('New device · 8 min left');
    expect(card.props.style.border).toContain(colors.feedback.nudge);
  });

  it('action cards come first; every other member shows the quiet In class chip', async () => {
    await render();
    expect(cards().map((c) => c.props['data-status'])).toEqual(['relink', 'in_class', 'new']);
    const yuhan = chipIn(cardOf('Yuhan')) as ReactTestInstance;
    expect(yuhan.type).toBe('span');
    expect(textOf(yuhan)).toBe('In class');
    expect(yuhan.props.style.backgroundColor).toBe(colors.feedback.successLight);
    expect(cardOf('Yuhan').props.style.border).not.toContain(colors.feedback.nudge);
  });

  it('a learner who joined this week with nothing synced shows New with what is true, never "not synced yet"', async () => {
    await render();
    const mina = cardOf('Mina');
    expect(textOf(chipIn(mina) as ReactTestInstance)).toBe('New');
    expect(textOf(mina)).toContain('No practice shared yet');
    expect(textOf(mina)).not.toContain('not synced yet');
  });

  it('the action chip moves focus to the inline Approve', async () => {
    await render();
    focused.length = 0;
    await press(chipIn(cardOf('Jaehan')) as ReactTestInstance);
    expect(focused).toEqual(['button, a']);
  });

  it('Approve inline answers the request, says so on the card, reads the re-links again and keeps the card in place 5 s', async () => {
    await render();
    const before = count('relinkRequests');
    state.relinks = [];
    await press(cardOf('Jaehan').find((n) => n.type === 'button' && n.props['data-testid'] === 'relink-approve-inline'));
    expect(calls.find((c) => c.name === 'decideRelink')?.args).toEqual(['space:sunflower', 'relink:jaehan', true]);
    expect(count('relinkRequests')).toBeGreaterThan(before);
    expect(textOf(cardOf('Jaehan'))).toContain('Jaehan can open their new device now.');
    expect(chipIn(cardOf('Jaehan'))).toBeUndefined();
    // Held at its place while the line shows, then the roster re-sorts.
    expect(cards()[0]?.props['data-status']).toBe('in_class');
    expect(textOf(cards()[0] as ReactTestInstance)).toContain('Jaehan');
    await act(async () => {
      vi.advanceTimersByTime(DECIDED_HOLD_MS);
    });
    expect(textOf(cardOf('Jaehan'))).not.toContain('Jaehan can open their new device now.');
    expect(cards().map((c) => c.findAll((n) => n.type === 'strong').map(textOf)[0])).toEqual(['Yuhan', 'Jaehan', 'Mina']);
    expect(textOf(chipIn(cardOf('Jaehan')) as ReactTestInstance)).toBe('In class');
  });

  it('a request that closed meanwhile says so calmly', async () => {
    await render();
    state.decide = { ok: false, error: 'unknown', status: 409, code: 'expired' };
    await press(cardOf('Jaehan').find((n) => n.type === 'button' && n.props['data-testid'] === 'relink-deny-inline'));
    expect(textOf(root())).toContain('This request already closed');
  });
});

describe('learners asking to join get their own cards above the roster (section 4.1)', () => {
  it('both sources, initials only, the Needs your OK chip, From {class}, Accept first', async () => {
    await render();
    const group = byTestId('asking-to-join')[0] as ReactTestInstance;
    expect(textOf(group.find((n) => n.type === 'h2'))).toBe('Asking to join this class');
    const items = byTestId('incoming-card');
    expect(items.map((c) => c.findAll((n) => n.type === 'strong').map(textOf)[0])).toEqual(['M. K.', 'J. K.']);
    expect(textOf(items[0] as ReactTestInstance)).toContain('From Class B');
    expect(textOf(items[1] as ReactTestInstance)).toContain('From Class C');
    for (const item of items) {
      const chip = item.find((n) => n.props['data-testid'] === 'incoming-status' && n.type === 'button');
      expect(textOf(chip)).toBe('Needs your OK');
      const buttons = item.findAll((n) => n.type === 'button' && String(n.props['data-testid']).startsWith('incoming-'));
      expect(buttons.map((b) => b.props['data-testid'])).toEqual(['incoming-status', 'incoming-accept', 'incoming-not-now']);
    }
    // The group sits above the roster: it comes before the first student card in the tree.
    const order = root().findAll((n) => n.props['data-testid'] === 'asking-to-join' || n.props['data-testid'] === 'student-card').map((n) => n.props['data-testid']);
    expect(order[0]).toBe('asking-to-join');
  });

  it("Accept on another teacher's move accepts it; on a transfer it agrees for this class", async () => {
    await render();
    await press(byTestId('incoming-card')[1]?.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-accept') as ReactTestInstance);
    expect(calls.find((c) => c.name === 'acceptClassMove')?.args).toEqual(['space:sunflower', 'move:in1']);
    await press(byTestId('incoming-card')[0]?.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-accept') as ReactTestInstance);
    expect(calls.find((c) => c.name === 'approveTransfer')?.args).toEqual(['space:sunflower', 'transfer:in1', { slots: ['destination'] }]);
  });

  it('Not now on a transfer keeps the reason step; on a teacher move it answers at once', async () => {
    await render();
    const transferCard = byTestId('incoming-card')[0] as ReactTestInstance;
    await press(transferCard.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-not-now'));
    await press(byTestId('incoming-card')[0]?.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-reason-no-room') as ReactTestInstance);
    expect(calls.find((c) => c.name === 'declineTransfer')?.args).toEqual(['space:sunflower', 'transfer:in1', { slot: 'destination', reason: 'no_room' }]);
    await press(byTestId('incoming-card')[1]?.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-not-now') as ReactTestInstance);
    expect(calls.find((c) => c.name === 'declineClassMove')?.args).toEqual(['space:sunflower', 'move:in1']);
  });

  it('no room: one calm line and Try again, never red', async () => {
    await render();
    state.decide = { ok: false, error: 'unknown', status: 409, code: 'move_blocked' };
    await press(byTestId('incoming-card')[1]?.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-accept') as ReactTestInstance);
    const card = byTestId('incoming-card')[1] as ReactTestInstance;
    expect(textOf(card)).toContain('No room in this class right now.');
    expect(textOf(card.find((n) => n.type === 'button' && n.props['data-testid'] === 'incoming-accept'))).toBe('Try again');
    expect(JSON.stringify(card.findAll((n) => typeof n.type === 'string').map((n) => n.props.style ?? {}))).not.toContain(colors.feedback.danger);
  });
});

describe('the counts and the reads (sections 3.4, 5.4)', () => {
  it('the class moves button counts the teacher move too; the re-link button counts the re-link', async () => {
    await render();
    const text = textOf(root());
    expect(text).toContain('2 class moves waiting');
    expect(text).toContain('1 re-link request');
  });

  it('reads its re-links alone every 20 s while the tab is in view, never the whole page', async () => {
    await render();
    const roster = count('roster');
    const relinks = count('relinkRequests');
    state.relinks = [relinkFor('profile:jaehan', 'Jaehan'), relinkFor('profile:yuhan', 'Yuhan')];
    await act(async () => {
      vi.advanceTimersByTime(CLASS_RELINK_REFRESH_MS);
    });
    expect(count('relinkRequests')).toBe(relinks + 1);
    expect(count('roster')).toBe(roster);
    expect(textOf(chipIn(cardOf('Yuhan')) as ReactTestInstance)).toBe('Needs your OK');
    fakeDocument.visibilityState = 'hidden';
    await act(async () => {
      vi.advanceTimersByTime(CLASS_RELINK_REFRESH_MS * 3);
    });
    fakeDocument.visibilityState = 'visible';
    expect(count('relinkRequests')).toBe(relinks + 1);
  });

  it('with class moves off the re-link chip still shows, and no move is asked for', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'off');
    await render();
    expect(textOf(chipIn(cardOf('Jaehan')) as ReactTestInstance)).toBe('Needs your OK');
    expect(byTestId('asking-to-join')).toEqual([]);
    expect(count('transferRequests')).toBe(0);
    expect(count('classMoves')).toBe(0);
  });

  it('a base-scope learner gets the muted line under the header, not a chip', async () => {
    state.learners = [member('profile:yuhan', 'Yuhan', { scope: 'base' })];
    await render();
    expect(textOf(cardOf('Yuhan'))).toContain('Words and more show once the family has read the update.');
    expect(textOf(chipIn(cardOf('Yuhan')) as ReactTestInstance)).toBe('In class');
  });
});

describe('the family roster (section 4)', () => {
  beforeEach(() => {
    state.kind = 'family';
    nav.query = 'id=space%3Akim-family';
    state.learners = [member('profile:yuhan', 'Yuhan'), member('profile:jaehan', 'Jaehan')];
    state.relinks = [];
    state.transfers = [familyMove];
    state.incoming = [];
  });

  it('no default chip; a move that waits for the family is Needs your OK with Review to the moves page', async () => {
    await render();
    expect(chipIn(cardOf('Jaehan'))).toBeUndefined();
    const yuhan = cardOf('Yuhan');
    expect(textOf(chipIn(yuhan) as ReactTestInstance)).toBe('Needs your OK');
    expect(textOf(yuhan)).toContain('Class move: Saturday Class B');
    const review = yuhan.find((n) => n.props['data-testid'] === 'move-review' && n.type === 'a');
    expect(review.props.href).toContain('transfers');
    expect(review.props.href).not.toContain('Yuhan');
    expect(textOf(review)).toBe('Review');
    expect(byTestId('asking-to-join')).toEqual([]);
    expect(count('classMoves')).toBe(0);
  });
});

describe('Korean and Spanish (section 10.1)', () => {
  it('ko: 승인 대기 beside the name, 참여 중 elsewhere, 이 반에 들어오려는 학생 above the roster', async () => {
    lang.locale = 'ko';
    await render();
    expect(textOf(chipIn(cardOf('Jaehan')) as ReactTestInstance)).toBe('승인 대기');
    expect(textOf(cardOf('Jaehan'))).toContain('새 기기 · 8분 남음');
    expect(textOf(chipIn(cardOf('Yuhan')) as ReactTestInstance)).toBe('참여 중');
    expect(textOf(root())).toContain('이 반에 들어오려는 학생');
    expect(textOf(root())).toContain('보낸 반: Class B');
  });

  it('es: Por aprobar, En la clase, Quieren unirse a esta clase', async () => {
    lang.locale = 'es';
    await render();
    expect(textOf(chipIn(cardOf('Jaehan')) as ReactTestInstance)).toBe('Por aprobar');
    expect(textOf(cardOf('Jaehan'))).toContain('Dispositivo nuevo · quedan 8 min');
    expect(textOf(chipIn(cardOf('Yuhan')) as ReactTestInstance)).toBe('En la clase');
    expect(textOf(root())).toContain('Quieren unirse a esta clase');
  });
});
