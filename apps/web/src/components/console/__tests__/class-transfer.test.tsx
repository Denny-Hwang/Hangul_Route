import { colors } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiResult, TransferDestinationView, TransferList, TransferSourceView, TransferView } from '@/lib/console/api';

/**
 * F-SPACE-002 T-6b (spec 4.8 "Requests page" and "State coverage"; design/screens/transfer/requests-page.md, the
 * T-0b mockups): the class requests page's body in every state of section 5 (loading, 401, 403, empty, waiting,
 * scheduled, blocked, ended, locked) and every answer a card offers.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

import { ClassMoves, type ClassMovesApi } from '@/components/console/ClassTransferParts';
import type { ConfirmAsk } from '../ConfirmSheet';

const t = getMessages('en').console.transfer;
const c = getMessages('en').console;
const NOW = Date.parse('2026-10-12T12:00:00.000Z');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.useRealTimers();
});

const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance => root().find((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const allTestId = (id: string): ReactTestInstance[] => root().findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const text = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const buttons = (node: ReactTestInstance): string[] => node.findAll((n) => n.type === 'button').map((b) => text(b));

const common = {
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: '2026-10-10T12:00:00.000Z',
  expiresAt: '2026-10-24T12:00:00.000Z',
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
} as const;

function source(over: Partial<TransferSourceView> = {}): TransferSourceView {
  return {
    ...common,
    id: 'transfer:s1',
    role: 'source',
    status: 'requested',
    steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
    initiator: 'learner_side',
    learnerId: null,
    learner: { name: 'Jun', avatar: 'tiger' },
    destination: null,
    ...over,
  };
}

function destination(over: Partial<TransferDestinationView> = {}): TransferDestinationView {
  return {
    ...common,
    id: 'transfer:d1',
    role: 'destination',
    status: 'requested',
    steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
    learner: { name: 'M. K.', avatar: 'fox', level: 'reading' },
    comingFrom: null,
    ...over,
  };
}

type Call = [string, ...unknown[]];

function fakeApi(lists: Array<ApiResult<TransferList>>, answers: Partial<Record<'approve' | 'decline' | 'cancel' | 'retry' | 'regenerate', ApiResult<unknown>[]>> = {}) {
  const calls: Call[] = [];
  let reads = 0;
  const next = (kind: keyof typeof answers): ApiResult<unknown> => answers[kind]?.shift() ?? { ok: true, data: {} };
  const api: ClassMovesApi = {
    transferRequests: async (id) => {
      calls.push(['list', id]);
      const r = lists[Math.min(reads, lists.length - 1)] as ApiResult<TransferList>;
      reads += 1;
      return r;
    },
    approveTransfer: async (id, tid, body) => {
      calls.push(['approve', id, tid, body]);
      return next('approve') as ApiResult<TransferView>;
    },
    declineTransfer: async (id, tid, body) => {
      calls.push(['decline', id, tid, body]);
      return next('decline') as ApiResult<TransferView>;
    },
    cancelTransfer: async (id, tid) => {
      calls.push(['cancel', id, tid]);
      return next('cancel') as ApiResult<TransferView>;
    },
    retryTransfer: async (id, tid) => {
      calls.push(['retry', id, tid]);
      return next('retry') as ApiResult<TransferView>;
    },
    regenerateCode: async (id) => {
      calls.push(['regenerate', id]);
      return next('regenerate') as ApiResult<{ joinCode: string; expiresAt: string }>;
    },
  };
  return { api, calls };
}

const list = (...requests: TransferView[]): ApiResult<TransferList> => ({ ok: true, data: { requests } });

async function renderMoves(
  api: ClassMovesApi,
  props: Partial<{ readOnly: boolean; direct: ReadonlySet<string>; confirm: (ask: ConfirmAsk) => Promise<boolean>; online: boolean }> = {},
): Promise<{ states: string[] }> {
  const states: string[] = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await act(async () => {
    renderer = create(
      <ClassMoves
        spaceId="space:a"
        spaceName="Sunday Class A"
        api={api}
        online={props.online ?? true}
        refreshMs={60_000}
        readOnly={props.readOnly ?? false}
        direct={props.direct ?? new Set()}
        confirm={props.confirm ?? (async () => true)}
        onPageState={(s) => states.push(s)}
      />,
      { createNodeMock: () => ({}) },
    );
  });
  await act(async () => undefined);
  return { states };
}

describe('page states', () => {
  it('loading: skeleton cards, aria-busy, no text', async () => {
    const api: ClassMovesApi = { ...fakeApi([]).api, transferRequests: () => new Promise(() => undefined) };
    await renderMoves(api);
    const loading = byTestId('class-moves-loading');
    expect(loading.props['aria-busy']).toBe('true');
    expect(text(loading).trim()).toBe('');
  });

  it.each([
    [{ ok: false, error: 'unauthorized', status: 401 }, 'signIn'],
    [{ ok: false, error: 'forbidden', status: 403, code: 'forbidden' }, 'forbidden'],
    [{ ok: false, error: 'not_found', status: 404, code: 'not_found' }, 'forbidden'],
    [{ ok: false, error: 'unknown', status: 422, code: 'transfers_locked' }, 'locked'],
  ] as const)('a list answer %j is the page state %s', async (result, state) => {
    const { api } = fakeApi([result as ApiResult<TransferList>]);
    const { states } = await renderMoves(api);
    expect(states).toEqual([state]);
  });

  it('a failed read that is none of those: "Didn\'t go through", no card, not busy, and Try again reads again', async () => {
    const { api, calls } = fakeApi([{ ok: false, error: 'network', status: -1 }, list(source())]);
    await renderMoves(api);
    expect(text(root())).toContain(t.states.failed);
    expect(byTestId('class-moves-loading').props['aria-busy']).toBe('false');
    expect(allTestId('move-card')).toEqual([]);
    await act(async () => byTestId('move-load-again').props.onClick());
    expect(calls.filter((c) => c[0] === 'list')).toHaveLength(2);
    expect(allTestId('move-card')).toHaveLength(1);
    expect(text(root())).not.toContain(t.states.failed);
  });

  it('empty: both groups say "Nothing waiting."', async () => {
    const { api } = fakeApi([list()]);
    await renderMoves(api);
    const body = text(root());
    expect(body).toContain(t.groups.leaving);
    expect(body).toContain(t.groups.joining);
    expect(body.split(t.empty).length - 1).toBe(2);
  });
});

describe('Leaving this class', () => {
  it('a family-started card that waits for this class: steps in words, the line, Agree and a plain Not now, no Cancel', async () => {
    const { api, calls } = fakeApi([list(source())]);
    await renderMoves(api);
    const card = byTestId('move-card');
    const body = text(card);
    expect(body).toContain('Jun');
    expect(body).toContain(t.meta.askedByFamily(2));
    expect(body).not.toContain(t.meta.daysLeft(12));
    const steps = card.find((n) => n.type === 'ol');
    expect(steps.props['aria-label']).toBe(t.a11y.steps);
    expect(text(steps)).toContain(`${t.steps.family} ${t.steps.saidYes}`);
    expect(text(steps)).toContain(`${t.steps.thisClass} ${t.steps.waiting}`);
    expect(body).toContain(t.lines.familyAsked('Jun'));
    expect(buttons(card)).toEqual([t.actions.agree.cta, t.actions.notNow.cta]);
    await act(async () => byTestId('move-agree').props.onClick());
    expect(calls).toContainEqual(['approve', 'space:a', 'transfer:s1', { slots: ['source'] }]);
    await act(async () => byTestId('move-not-now').props.onClick());
    expect(calls).toContainEqual(['decline', 'space:a', 'transfer:s1', { slot: 'source' }]);
  });

  it('a class-started card that waits for the family: "Waiting for the family.", the new class, days left and Cancel request', async () => {
    const view = source({ initiator: 'source', steps: { learner: 'waiting', source: 'yes', destination: 'waiting' }, destination: { spaceId: 'space:b', name: 'Saturday Class B' } });
    const { api, calls } = fakeApi([list(view)]);
    await renderMoves(api);
    const body = text(byTestId('move-card'));
    expect(body).toContain(t.meta.asked(2));
    expect(body).toContain(t.meta.daysLeft(12));
    expect(body).toContain(`${t.steps.thisClass} ${t.steps.youSaidYes}`);
    expect(body).toContain(t.lines.waitingFamily);
    expect(body).toContain(t.lines.newClass('Saturday Class B'));
    expect(buttons(byTestId('move-card'))).toEqual([t.actions.cancelRequest.cta]);
    await act(async () => byTestId('move-cancel').props.onClick());
    expect(calls).toContainEqual(['cancel', 'space:a', 'transfer:s1']);
  });

  it('the family named the new class: the line names it', async () => {
    const { api } = fakeApi([list(source({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } }))]);
    await renderMoves(api);
    expect(text(byTestId('move-card'))).toContain(t.lines.familyAskedTo('Jun', 'Saturday Class B'));
  });

  it('one account teaching both classes: Agree for both classes, one click for both teacher slots', async () => {
    const { api, calls } = fakeApi([list(source({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } }))]);
    await renderMoves(api, { direct: new Set(['space:a', 'space:b']) });
    expect(buttons(byTestId('move-card'))).toEqual([t.actions.agreeBoth.cta, t.actions.notNow.cta]);
    await act(async () => byTestId('move-agree').props.onClick());
    expect(calls).toContainEqual(['approve', 'space:a', 'transfer:s1', { slots: ['source', 'destination'] }]);
  });

  it('a school admin on a child class who owns the new class: plain Agree with this class\'s slot only (T11)', async () => {
    const { api, calls } = fakeApi([list(source({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } }))]);
    await renderMoves(api, { direct: new Set(['space:b']) });
    expect(buttons(byTestId('move-card'))).toEqual([t.actions.agree.cta, t.actions.notNow.cta]);
    await act(async () => byTestId('move-agree').props.onClick());
    expect(calls).toContainEqual(['approve', 'space:a', 'transfer:s1', { slots: ['source'] }]);
  });

  it('two slots refused (one_slot_per_action): "Didn\'t go through", and Try again names this class\'s slot only', async () => {
    const { api, calls } = fakeApi([list(source({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } }))], {
      approve: [{ ok: false, error: 'unknown', status: 422, code: 'one_slot_per_action' }],
    });
    await renderMoves(api, { direct: new Set(['space:a', 'space:b']) });
    await act(async () => byTestId('move-agree').props.onClick());
    expect(text(byTestId('move-card').find((n) => n.props.role === 'alert'))).toBe(t.states.failed);
    await act(async () => byTestId('move-try-again').props.onClick());
    const approves = calls.filter((c) => c[0] === 'approve');
    expect(approves).toEqual([
      ['approve', 'space:a', 'transfer:s1', { slots: ['source', 'destination'] }],
      ['approve', 'space:a', 'transfer:s1', { slots: ['source'] }],
    ]);
  });

  it('waiting for others after this class said yes: "Nothing changes until all three say yes." and no answer', async () => {
    const { api } = fakeApi([list(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }))]);
    await renderMoves(api);
    expect(text(byTestId('move-card'))).toContain(t.lines.waitingAll);
    expect(buttons(byTestId('move-card'))).toEqual([]);
  });

  it('the school admin agreed for this class: the neutral line from this view only', async () => {
    const { api } = fakeApi([list(source({ agreedBySchoolAdmin: true, steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }))]);
    await renderMoves(api);
    expect(text(byTestId('move-card'))).toContain(t.lines.agreedBySchoolAdmin);
  });

  it('scheduled: "Everyone agreed. The move happens on Oct 14." with no steps; Cancel only when this class started it', async () => {
    const scheduled = { status: 'approved' as const, scheduledFor: '2026-10-14T12:00:00.000Z', steps: { learner: 'yes' as const, source: 'yes' as const, destination: 'yes' as const } };
    const { api } = fakeApi([list(source({ ...scheduled, id: 'transfer:a' }), source({ ...scheduled, id: 'transfer:b', initiator: 'source' }))]);
    await renderMoves(api);
    const cards = allTestId('move-card');
    expect(text(cards[0] as ReactTestInstance)).toContain(t.lines.scheduled('Oct 14'));
    expect((cards[0] as ReactTestInstance).findAll((n) => n.type === 'ol')).toEqual([]);
    expect(buttons(cards[0] as ReactTestInstance)).toEqual([]);
    expect(buttons(cards[1] as ReactTestInstance)).toEqual([t.actions.cancelRequest.cta]);
    // The class-started scheduled card keeps its "asked" meta (the mock); no days left once scheduled.
    expect(text(cards[1] as ReactTestInstance)).toContain(t.meta.asked(2));
    expect(text(cards[1] as ReactTestInstance)).not.toContain(t.meta.daysLeft(12));
    expect(text(cards[0] as ReactTestInstance)).not.toContain(t.meta.askedByFamily(2));
  });

  it('blocked for room: the room block in nudge tint with words, never "full" on the source', async () => {
    const { api } = fakeApi([list(source({ status: 'approved', blockReason: 'cap_class', initiator: 'source', steps: { learner: 'yes', source: 'yes', destination: 'yes' } }))]);
    await renderMoves(api);
    const block = byTestId('move-room-block');
    expect(text(block)).toContain(t.lines.waitingRoom);
    expect(block.props.style.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(JSON.stringify(block.props.style)).not.toContain(colors.feedback.danger);
    expect(text(byTestId('move-card'))).not.toContain('full');
    expect(buttons(byTestId('move-card'))).toEqual([t.actions.cancelRequest.cta]);
  });

  it('ended and moved: history lines with a date, never a name or who said no', async () => {
    const { api } = fakeApi([
      list(
        source({ id: 'transfer:e', status: 'ended', steps: null, learner: null, endedAt: '2026-10-01T12:00:00.000Z', endedByYou: true, endReason: 'declined_source' }),
        source({ id: 'transfer:x', status: 'executed', learner: null, executedAt: '2026-10-03T12:00:00.000Z' }),
      ),
    ]);
    await renderMoves(api);
    const rows = allTestId('move-history-row').map(text);
    expect(rows[0]).toContain(t.history.movedOut('student'));
    expect(rows[0]).toContain('Oct 3');
    expect(rows[1]).toContain(t.history.ended);
    expect(rows[1]).toContain('Oct 1');
    expect(rows.join(' ')).not.toContain('Jun');
  });
});

describe('Joining this class', () => {
  it('the family said yes: initials, the level pill, Accept and a Not now disclosure with two quiet reasons', async () => {
    const { api, calls } = fakeApi([list(destination({ comingFrom: { name: 'Sunday Class A' } }))]);
    await renderMoves(api);
    const card = byTestId('move-card');
    const body = text(card);
    expect(body).toContain('M. K.');
    expect(body).toContain(t.lines.comingFrom('Sunday Class A'));
    expect(body).toContain(t.lines.familySaidYes);
    expect(card.findAll((n) => n.type === 'ol')).toEqual([]);
    const disclosure = byTestId('move-not-now-reasons');
    expect(disclosure.props['aria-expanded']).toBe(false);
    expect(disclosure.props['aria-label']).toBe(t.a11y.notNowReasons);
    await act(async () => disclosure.props.onClick());
    expect(byTestId('move-not-now-reasons').props['aria-expanded']).toBe(true);
    const group = root().find((n) => n.props.role === 'group');
    expect(group.props['aria-label']).toBe(t.a11y.reasons);
    expect(buttons(group)).toEqual([t.actions.notNow.cta, t.actions.noRoom.cta]);
    await act(async () => byTestId('move-no-room').props.onClick());
    expect(calls).toContainEqual(['decline', 'space:a', 'transfer:d1', { slot: 'destination', reason: 'no_room' }]);
    await act(async () => byTestId('move-accept').props.onClick());
    expect(calls).toContainEqual(['approve', 'space:a', 'transfer:d1', { slots: ['destination'] }]);
  });

  it('Not now inside the disclosure sends the not_now reason', async () => {
    const { api, calls } = fakeApi([list(destination())]);
    await renderMoves(api);
    await act(async () => byTestId('move-not-now-reasons').props.onClick());
    await act(async () => byTestId('move-reason-not-now').props.onClick());
    expect(calls).toContainEqual(['decline', 'space:a', 'transfer:d1', { slot: 'destination', reason: 'not_now' }]);
  });

  it('after its own yes: one general line, no actions, never which side it waits for', async () => {
    const { api } = fakeApi([list(destination({ steps: { learner: 'yes', source: 'waiting', destination: 'yes' } }))]);
    await renderMoves(api);
    expect(text(byTestId('move-card'))).toContain(t.lines.youSaidYes);
    expect(buttons(byTestId('move-card'))).toEqual([]);
  });

  it('blocked by its own cap: "This class is full right now." and Try again (retry); cap_learner: no Try again', async () => {
    const approved = { status: 'approved' as const, steps: { learner: 'yes' as const, source: 'yes' as const, destination: 'yes' as const } };
    const { api, calls } = fakeApi([list(destination({ ...approved, blockReason: 'cap_class' }), destination({ ...approved, id: 'transfer:d2', blockReason: 'cap_learner' }))]);
    await renderMoves(api);
    const cards = allTestId('move-card');
    expect(text(cards[0] as ReactTestInstance)).toContain(t.lines.fullClass);
    expect(buttons(cards[0] as ReactTestInstance)).toEqual([t.actions.tryAgain.cta]);
    expect(text(cards[1] as ReactTestInstance)).toContain(t.lines.moveWaiting);
    expect(buttons(cards[1] as ReactTestInstance)).toEqual([]);
    await act(async () => byTestId('move-retry').props.onClick());
    expect(calls).toContainEqual(['retry', 'space:a', 'transfer:d1']);
  });

  it('after a move into this class: the history line and New class code, which runs the regenerate flow with its confirm', async () => {
    const asked: ConfirmAsk[] = [];
    const { api, calls } = fakeApi([list(destination({ status: 'executed', executedAt: '2026-10-11T12:00:00.000Z', learner: { name: 'Mina Kim', avatar: 'fox', level: 'reading' } }))]);
    await renderMoves(api, {
      confirm: async (ask) => {
        asked.push(ask);
        return true;
      },
    });
    expect(text(byTestId('move-history-row'))).toContain(t.history.joined('student'));
    expect(text(byTestId('move-history-row'))).not.toContain('Mina');
    expect(text(byTestId('move-new-code'))).toContain(t.lines.newCode);
    await act(async () => byTestId('move-new-code-button').props.onClick());
    // The ConfirmSheet's question, its line and the verb (AMENDMENTS-DISPLAY-NAV section 8).
    expect(asked).toEqual([{ title: c.space.regenerateAsk('Sunday Class A'), message: c.oldCodeStops, confirmLabel: c.confirm.newCode }]);
    expect(calls).toContainEqual(['regenerate', 'space:a']);
    expect(allTestId('move-new-code')).toEqual([]);
  });

  it('New class code that does not go through: "Didn\'t go through" and the button stays', async () => {
    const { api } = fakeApi([list(destination({ status: 'executed', executedAt: '2026-10-11T12:00:00.000Z' }))], { regenerate: [{ ok: false, error: 'network', status: -1 }] });
    await renderMoves(api);
    await act(async () => byTestId('move-new-code-button').props.onClick());
    expect(text(byTestId('move-new-code'))).toContain(t.states.failed);
    expect(allTestId('move-new-code-button')).toHaveLength(1);
  });

  it('New class code asks first; No keeps the code', async () => {
    const { api, calls } = fakeApi([list(destination({ status: 'executed', executedAt: '2026-10-11T12:00:00.000Z' }))]);
    await renderMoves(api, { confirm: async () => false });
    await act(async () => byTestId('move-new-code-button').props.onClick());
    expect(calls.some((c) => c[0] === 'regenerate')).toBe(false);
  });
});

describe('answers that do not go through (requests-page.md "States")', () => {
  it('a failure keeps the card with "Didn\'t go through" (alert) and Try again repeats the same answer', async () => {
    const { api, calls } = fakeApi([list(source())], { approve: [{ ok: false, error: 'network', status: -1 }] });
    await renderMoves(api);
    await act(async () => byTestId('move-agree').props.onClick());
    const alert = byTestId('move-card').find((n) => n.props.role === 'alert');
    expect(text(alert)).toBe(t.states.failed);
    expect(text(byTestId('move-try-again'))).toBe(t.actions.tryAgain.cta);
    await act(async () => byTestId('move-try-again').props.onClick());
    expect(calls.filter((c) => c[0] === 'approve')).toHaveLength(2);
    expect(byTestId('move-card').findAll((n) => n.props.role === 'alert')).toEqual([]);
  });

  it('a lost race: "Something changed. Look again." and Refresh re-reads the list', async () => {
    const { api, calls } = fakeApi([list(destination())], { approve: [{ ok: false, error: 'unknown', status: 409, code: 'request_changed' }] });
    await renderMoves(api);
    await act(async () => byTestId('move-accept').props.onClick());
    expect(text(byTestId('move-card').find((n) => n.props.role === 'alert'))).toBe(t.states.changed);
    const before = calls.filter((c) => c[0] === 'list').length;
    await act(async () => byTestId('move-refresh').props.onClick());
    expect(calls.filter((c) => c[0] === 'list').length).toBe(before + 1);
  });

  it('ended meanwhile: the reload draws it as the ended line, no failure text', async () => {
    const { api } = fakeApi([list(source()), list(source({ status: 'ended', steps: null, learner: null, endedAt: '2026-10-12T10:00:00.000Z' }))], {
      approve: [{ ok: false, error: 'unknown', status: 409, code: 'not_open' }],
    });
    await renderMoves(api);
    await act(async () => byTestId('move-agree').props.onClick());
    expect(allTestId('move-card')).toEqual([]);
    expect(text(byTestId('move-history-row'))).toContain(t.history.ended);
    expect(text(root())).not.toContain(t.states.failed);
  });

  it('a 401, 403 or lock on an answer becomes the page state', async () => {
    const { api } = fakeApi([list(source())], { approve: [{ ok: false, error: 'unknown', status: 422, code: 'transfers_locked' }] });
    const { states } = await renderMoves(api);
    await act(async () => byTestId('move-agree').props.onClick());
    expect(states).toEqual(['locked']);
  });

  it('offline: answers are inactive with "This needs internet."', async () => {
    const { api, calls } = fakeApi([list(source())]);
    await renderMoves(api, { online: false });
    expect(text(root())).toContain(t.states.offline);
    expect(byTestId('move-agree').props.disabled).toBe(true);
    expect(calls.some((c) => c[0] === 'approve')).toBe(false);
  });
});

describe('an archived class is read-only', () => {
  it('no Agree, Accept or Cancel; history stays', async () => {
    const { api } = fakeApi([list(source(), destination(), source({ id: 'transfer:h', status: 'ended', steps: null, learner: null, endedAt: '2026-10-01T12:00:00.000Z' }))]);
    await renderMoves(api, { readOnly: true });
    for (const card of allTestId('move-card')) expect(buttons(card)).toEqual([]);
    expect(allTestId('move-history-row')).toHaveLength(1);
  });
});

describe('refresh', () => {
  it('re-reads every refreshMs and announces a change once through the one polite live region', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { api } = fakeApi([list(source()), list(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }))]);
    await act(async () => {
      renderer = create(<ClassMoves spaceId="space:a" spaceName="A" api={api} online refreshMs={30_000} readOnly={false} direct={new Set()} confirm={async () => true} onPageState={() => undefined} />, {
        createNodeMock: () => ({}),
      });
    });
    const live = (): ReactTestInstance[] => root().findAll((n) => n.props['aria-live'] === 'polite');
    expect(live()).toHaveLength(1);
    expect(text(live()[0] as ReactTestInstance)).toBe('');
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(text(live()[0] as ReactTestInstance)).toBe(t.a11y.updated);
    expect(root().findAll((n) => n.props.role === 'status')).toEqual([]);
  });
});

describe('refresh, continued', () => {
  const mount = async (api: ClassMovesApi, online = true): Promise<void> => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    await act(async () => {
      renderer = create(
        <ClassMoves spaceId="space:a" spaceName="A" api={api} online={online} refreshMs={30_000} readOnly={false} direct={new Set()} confirm={async () => true} onPageState={() => undefined} />,
        { createNodeMock: () => ({}) },
      );
    });
  };
  const tick = async (): Promise<void> => {
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
  };
  const live = (): ReactTestInstance => root().find((n) => n.props['aria-live'] === 'polite');

  it('every change is announced again: the region is cleared and rewritten each time', async () => {
    const { api } = fakeApi([
      list(source()),
      list(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } })),
      list(source({ steps: { learner: 'yes', source: 'yes', destination: 'yes' }, status: 'approved', scheduledFor: '2026-10-14T12:00:00.000Z' })),
    ]);
    await mount(api);
    await tick();
    expect(text(live())).toBe(t.a11y.updated);
    expect(live().props['data-announced']).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(text(live())).toBe('');
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(text(live())).toBe(t.a11y.updated);
    expect(live().props['data-announced']).toBe(2);
  });

  it('unmounting before the announce timer fires leaves no timer and writes nothing after unmount (#560 follow-up 4)', async () => {
    const { api } = fakeApi([list(source()), list(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }))]);
    await mount(api);
    const set = vi.spyOn(globalThis, 'setTimeout');
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    // The change is seen: the region is cleared and the rewrite waits for its 100 ms gap.
    expect(text(live())).toBe('');
    const announceIndex = set.mock.calls.findIndex((call) => call[1] === 100);
    expect(announceIndex).toBeGreaterThanOrEqual(0);
    const announceId = set.mock.results[announceIndex]?.value as unknown;
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    act(() => renderer?.unmount());
    renderer = null;
    expect(clear.mock.calls.some((call) => call[0] === announceId)).toBe(true);
    set.mockRestore();
    clear.mockRestore();
  });

  it('nothing auto-dismisses: a card that ends between timer reads stays a card, without answers, until a manual read', async () => {
    const ended = source({ status: 'ended', steps: null, endedAt: '2026-10-12T11:00:00.000Z' });
    const other = destination();
    const { api } = fakeApi([list(source(), other), list(ended, other)]);
    await mount(api);
    expect(allTestId('move-card')).toHaveLength(2);
    await tick();
    await tick();
    const cards = allTestId('move-card');
    expect(cards).toHaveLength(2);
    expect(text(cards[0] as ReactTestInstance)).toContain(t.history.ended);
    expect(buttons(cards[0] as ReactTestInstance)).toEqual([]);
    expect((cards[0] as ReactTestInstance).findAll((n) => n.type === 'ol')).toEqual([]);
    expect(allTestId('move-history-row')).toEqual([]);
    // An answer on another card is a manual read: the finished card joins the history.
    await act(async () => byTestId('move-accept').props.onClick());
    expect(allTestId('move-card')).toHaveLength(1);
    expect(text(byTestId('move-history-row'))).toContain(t.history.ended);
  });

  it('offline: the timer reads nothing and no "Didn\'t go through" joins "This needs internet."', async () => {
    const { api, calls } = fakeApi([list(source()), { ok: false, error: 'network', status: -1 }]);
    await mount(api, false);
    await tick();
    await tick();
    expect(calls.filter((c) => c[0] === 'list')).toHaveLength(1);
    expect(text(root())).toContain(t.states.offline);
    expect(text(root())).not.toContain(t.states.failed);
  });
});
