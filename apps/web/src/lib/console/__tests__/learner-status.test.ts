import { readFileSync } from 'node:fs';
import { getMessages, LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { RelinkView, RosterLearner, TransferDestinationView, TransferLearnerSideView, TransferSourceView } from '../api';
import { readMoveLists, type ClassMoveLists } from '../class-moves';
import { NEW_LEARNER_MS, attentionModel, minutesShown, readPending, rosterOrder, statusExpiry, statusWords, type AttentionInput, type LearnerStatus } from '../learner-status';

/** AMENDMENTS-GROWNUP-UX GX-1 (sections 3 and 4): one status per learner, the incoming items and the totals. */

const NOW = new Date('2026-10-31T12:00:00.000Z');
const min = (m: number): string => new Date(NOW.getTime() + m * 60_000).toISOString();
const day = (d: number): string => new Date(NOW.getTime() + d * 86_400_000).toISOString();

function learner(id: string, over: Partial<RosterLearner> = {}): RosterLearner {
  return {
    id,
    displayName: id.replace('profile:', ''),
    ageGroup: '5-7',
    avatar: 'tiger',
    joinedAt: '2026-09-01T00:00:00.000Z',
    lastActiveAt: '2026-10-30T00:00:00.000Z',
    summary: {} as RosterLearner['summary'],
    lastSyncedAt: '2026-10-30T00:00:00.000Z',
    ...over,
  };
}

function relink(learnerId: string, over: Partial<RelinkView> = {}): RelinkView {
  return { id: `relink:${learnerId.slice(8)}`, learnerId, learnerName: learnerId.slice(8), deviceId: 'device:x', platform: 'ios', requestedAt: min(-2), expiresAt: min(8), status: 'pending', ...over };
}

const common = {
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: '2026-10-29T12:00:00.000Z',
  expiresAt: day(12),
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
    learner: { name: 'Suji', avatar: 'rabbit' },
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
    steps: { learner: 'yes', source: 'yes', destination: 'waiting' },
    learner: { name: 'M. K.', avatar: 'tiger', level: 'some-reading' },
    comingFrom: { name: 'Class B' },
    ...over,
  };
}

function family(over: Partial<TransferLearnerSideView> = {}): TransferLearnerSideView {
  return {
    id: 'transfer:f1',
    role: 'learner_side',
    status: 'requested',
    initiator: 'source',
    learner: { id: 'profile:mina', name: 'Mina' },
    from: { spaceId: 'space:a', name: 'Sunday Class A' },
    to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
    learnerState: 'pending',
    sourceState: 'yes',
    destinationState: 'waiting',
    introduce: false,
    premiumChange: 'none',
    destinationConsentMode: 'parent',
    relinkAffected: false,
    sourcePlansAffected: false,
    visibleToday: [],
    blockReason: null,
    executeAfter: null,
    createdAt: '2026-10-29T12:00:00.000Z',
    expiresAt: day(12),
    executedAt: null,
    endedAt: null,
    learnerRoute: 'caregiver',
    endedFrom: null,
    termsDigest: 'a'.repeat(64),
    ...over,
  };
}

const teacherMoves = (over: Partial<ClassMoveLists> = {}): ClassMoveLists => ({ outgoing: [], incoming: [], ...over });
const incomingMove = (id: string, over: Record<string, unknown> = {}) =>
  readMoveLists({ incoming: [{ id, kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'bear', level: 'starter' }, createdAt: '2026-10-30T12:00:00.000Z', at: null, ...over }] }).incoming;

function model(over: Partial<AttentionInput> = {}) {
  return attentionModel({ kind: 'class', roster: [], relinks: [], transfers: [], classMoves: teacherMoves(), now: NOW, ...over });
}

describe('attentionModel: one status per learner (section 3.2)', () => {
  it('a member with nothing waiting is In class; a family member has no default chip', () => {
    expect(model({ roster: [learner('profile:yuhan')] }).byLearner['profile:yuhan']).toEqual({ learnerId: 'profile:yuhan', kind: 'in_class', action: false, scopeBase: false });
    expect(model({ kind: 'family', roster: [learner('profile:yuhan')] }).byLearner['profile:yuhan']?.kind).toBe('none');
    expect(model({ kind: 'school', roster: [learner('profile:yuhan')] }).byLearner['profile:yuhan']?.kind).toBe('in_class');
  });

  it('a pending re-link is an action state with its id and expiry', () => {
    const status = model({ roster: [learner('profile:jaehan')], relinks: [relink('profile:jaehan')] }).byLearner['profile:jaehan'];
    expect(status).toMatchObject({ kind: 'relink', action: true, relink: { id: 'relink:jaehan', expiresAt: min(8) } });
  });

  it('an expired, approved or denied re-link is dropped before ranking', () => {
    const roster = [learner('profile:jaehan')];
    expect(model({ roster, relinks: [relink('profile:jaehan', { expiresAt: min(-1) })] }).byLearner['profile:jaehan']?.kind).toBe('in_class');
    expect(model({ roster, relinks: [relink('profile:jaehan', { status: 'approved' })] }).byLearner['profile:jaehan']?.kind).toBe('in_class');
    expect(model({ roster, relinks: [relink('profile:jaehan', { status: 'denied' })] }).totals.relinks).toBe(0);
  });

  it('never matches by name: two learners with one name, only the id of the re-link gets it', () => {
    const roster = [learner('profile:a', { displayName: 'Min' }), learner('profile:b', { displayName: 'Min' })];
    const m = model({ roster, relinks: [relink('profile:b', { learnerName: 'Min' })] });
    expect(m.byLearner['profile:a']?.kind).toBe('in_class');
    expect(m.byLearner['profile:b']?.kind).toBe('relink');
  });

  it('New: joined in the last 7 days with no summary; not after 7 days, not once something synced', () => {
    const fresh = learner('profile:mina', { joinedAt: day(-1), summary: null });
    expect(model({ roster: [fresh] }).byLearner['profile:mina']?.kind).toBe('new');
    expect(model({ roster: [{ ...fresh, joinedAt: new Date(NOW.getTime() - NEW_LEARNER_MS - 1).toISOString() }] }).byLearner['profile:mina']?.kind).toBe('in_class');
    expect(model({ roster: [{ ...fresh, summary: {} as RosterLearner['summary'] }] }).byLearner['profile:mina']?.kind).toBe('in_class');
    expect(model({ kind: 'family', roster: [fresh] }).byLearner['profile:mina']?.kind).toBe('new');
  });

  it('a base-scope row is a flag, never a chip', () => {
    const status = model({ roster: [learner('profile:yuhan', { scope: 'base' })] }).byLearner['profile:yuhan'];
    expect(status).toMatchObject({ kind: 'in_class', scopeBase: true });
  });

  it('class-started move out: waiting for others, waiting for a seat, scheduled; the priority order holds', () => {
    const roster = [learner('profile:suji')];
    const started = { initiator: 'source' as const, learnerId: 'profile:suji', destination: { spaceId: 'space:d', name: 'Evening Class D' } };
    const others = model({ roster, transfers: [source({ ...started, steps: { learner: 'waiting', source: 'yes', destination: 'waiting' } })] }).byLearner['profile:suji'];
    expect(others).toMatchObject({ kind: 'move_others', action: false, move: { source: 'transfer', id: 'transfer:s1', to: 'Evening Class D' } });
    const room = model({ roster, transfers: [source({ ...started, status: 'approved', blockReason: 'cap_class' })] }).byLearner['profile:suji'];
    expect(room?.kind).toBe('move_room');
    const scheduled = model({ roster, transfers: [source({ ...started, status: 'approved', scheduledFor: day(3) })] }).byLearner['profile:suji'];
    expect(scheduled).toMatchObject({ kind: 'move_scheduled', move: { on: day(3) } });
    // A re-link outranks every move; a seat wait outranks a scheduled move.
    const both = model({ roster, relinks: [relink('profile:suji')], transfers: [source({ ...started, status: 'approved', blockReason: 'cap_class' })] }).byLearner['profile:suji'];
    expect(both?.kind).toBe('relink');
    const two = model({ roster, transfers: [source({ ...started, id: 't1', status: 'approved', scheduledFor: day(3) }), source({ ...started, id: 't2', status: 'approved', blockReason: 'cap_class' })] }).byLearner['profile:suji'];
    expect(two?.kind).toBe('move_room');
    // An approved move with no date and no block still reads as a move waiting.
    expect(model({ roster, transfers: [source({ ...started, status: 'approved' })] }).byLearner['profile:suji']?.kind).toBe('move_others');
  });

  it('a move that is no longer open is not a status', () => {
    const roster = [learner('profile:suji')];
    const started = { initiator: 'source' as const, learnerId: 'profile:suji' };
    expect(model({ roster, transfers: [source({ ...started, status: 'ended' })] }).byLearner['profile:suji']?.kind).toBe('in_class');
    expect(model({ roster, transfers: [source({ ...started, status: 'executed' })] }).byLearner['profile:suji']?.kind).toBe('in_class');
  });

  it('a family-started source view (learnerId null) gives no chip, but is counted and listed as outgoing', () => {
    const m = model({ roster: [learner('profile:suji')], transfers: [source()] });
    expect(m.byLearner['profile:suji']?.kind).toBe('in_class');
    expect(m.totals.moves).toBe(1);
    expect(m.outgoing).toEqual([{ source: 'transfer', id: 'transfer:s1', learnerId: null, name: 'Suji', avatar: 'rabbit', to: null, expiresAt: day(12) }]);
  });

  it('with the learner id (GX-W) a move out that waits for this class is move_yours', () => {
    const m = model({ roster: [learner('profile:suji')], transfers: [source({ learnerId: 'profile:suji', destination: { spaceId: 'space:d', name: 'Evening Class D' } })] });
    expect(m.byLearner['profile:suji']).toMatchObject({ kind: 'move_yours', action: true, move: { to: 'Evening Class D', expiresAt: day(12) } });
  });

  it('family views: the family step waits = move_yours; scheduled from executeAfter; others waiting', () => {
    const roster = [learner('profile:mina')];
    expect(model({ kind: 'family', roster, transfers: [family()] }).byLearner['profile:mina']).toMatchObject({ kind: 'move_yours', action: true, move: { to: 'Saturday Class B' } });
    expect(model({ kind: 'family', roster, transfers: [family({ learnerState: 'consented' })] }).byLearner['profile:mina']?.kind).toBe('move_others');
    expect(model({ kind: 'family', roster, transfers: [family({ status: 'approved', learnerState: 'consented', executeAfter: day(2) })] }).byLearner['profile:mina']).toMatchObject({ kind: 'move_scheduled', move: { on: day(2) } });
    expect(model({ kind: 'family', roster, transfers: [family({ status: 'approved', learnerState: 'consented', blockReason: 'cap_learner' })] }).byLearner['profile:mina']?.kind).toBe('move_room');
    expect(model({ kind: 'family', roster, transfers: [family()] }).totals.moves).toBe(1);
  });

  it('a class-scheduled move reads scheduledFor (class), not executeAfter', () => {
    const view = source({ initiator: 'source', learnerId: 'profile:suji', status: 'approved', scheduledFor: day(1) });
    expect(model({ roster: [learner('profile:suji')], transfers: [view] }).byLearner['profile:suji']?.move?.on).toBe(day(1));
  });

  it('an outgoing teacher move is matched only by its learner id (GX-W); without one it is not shown', () => {
    const lists = readMoveLists({ outgoing: [{ id: 'move:o1', kind: 'accept', status: 'waiting', to: { spaceId: 'space:e', name: 'Class E' }, learner: { name: 'Suji', avatar: 'rabbit' }, createdAt: '2026-10-30T12:00:00.000Z', at: null }] });
    expect(model({ roster: [learner('profile:suji')], classMoves: lists }).byLearner['profile:suji']?.kind).toBe('in_class');
    const withId = readMoveLists({ outgoing: [{ id: 'move:o1', kind: 'accept', status: 'waiting', to: { spaceId: 'space:e', name: 'Class E' }, learner: null, createdAt: '2026-10-30T12:00:00.000Z', at: null, learnerId: 'profile:suji' }] });
    expect(model({ roster: [learner('profile:suji')], classMoves: withId }).byLearner['profile:suji']).toMatchObject({ kind: 'move_others', move: { source: 'teacher', to: 'Class E' } });
  });
});

describe('attentionModel: the roster pending field (GX-W) is preferred when present', () => {
  it('reads pending.relink and pending.move steps', () => {
    const roster = [
      learner('profile:a', { pending: { relink: { id: 'relink:a', expiresAt: min(5) } } }),
      learner('profile:b', { pending: { move: { source: 'transfer', id: 't', step: 'yours', to: 'Class D', on: null, expiresAt: day(3) } } }),
      learner('profile:c', { pending: { move: { source: 'teacher', id: 'm', step: 'scheduled', to: null, on: day(2), expiresAt: null } } }),
      learner('profile:d', { pending: {} }),
    ];
    const m = model({ roster, relinks: null, transfers: null, classMoves: null });
    expect(m.byLearner['profile:a']).toMatchObject({ kind: 'relink', relink: { id: 'relink:a' } });
    expect(m.byLearner['profile:b']).toMatchObject({ kind: 'move_yours', action: true, move: { to: 'Class D' } });
    expect(m.byLearner['profile:c']).toMatchObject({ kind: 'move_scheduled', move: { on: day(2) } });
    expect(m.byLearner['profile:d']?.kind).toBe('in_class');
    // With no list read, the re-link total comes from the rows.
    expect(m.totals.relinks).toBe(1);
  });

  it('a row with pending ignores the lists for that learner; a row without it falls back to them', () => {
    const roster = [learner('profile:a', { pending: {} }), learner('profile:b')];
    const m = model({ roster, relinks: [relink('profile:a'), relink('profile:b')] });
    expect(m.byLearner['profile:a']?.kind).toBe('in_class');
    expect(m.byLearner['profile:b']?.kind).toBe('relink');
  });

  it('readPending is lenient: unknown shapes are no state; no field reads as null', () => {
    expect(readPending({})).toBeNull();
    expect(readPending(null)).toBeNull();
    expect(readPending({ pending: 'x' })).toEqual([]);
    expect(readPending({ pending: { relink: { id: 1 }, move: { source: 'transfer', id: 't', step: 'later' } } })).toEqual([]);
    expect(readPending({ pending: { move: { source: 'elsewhere', id: 't', step: 'yours' } } })).toEqual([]);
    expect(readPending({ pending: { move: { source: 'teacher', id: 't', step: 'others', to: 7 } } })).toEqual([{ kind: 'move_others', move: { source: 'teacher', id: 't', to: null, on: null, expiresAt: null } }]);
  });

  it('an expired pending re-link is dropped', () => {
    const m = model({ roster: [learner('profile:a', { pending: { relink: { id: 'relink:a', expiresAt: min(-1) } } })], relinks: null });
    expect(m.byLearner['profile:a']?.kind).toBe('in_class');
    expect(m.totals.relinks).toBe(0);
  });
});

describe('attentionModel: incoming items and totals (sections 3.4, 4.1)', () => {
  it('transfers whose destination step waits and teacher moves to accept are incoming, initials only', () => {
    const m = model({ transfers: [destination()], classMoves: teacherMoves({ incoming: incomingMove('move:i1') }) });
    expect(m.incoming).toEqual([
      { source: 'transfer', id: 'transfer:d1', alias: 'M. K.', avatar: 'tiger', level: 'some-reading', from: 'Class B', expiresAt: day(12), createdAt: common.createdAt },
      { source: 'teacher', id: 'move:i1', alias: 'J. K.', avatar: 'bear', level: 'starter', from: 'Class C', expiresAt: null, createdAt: '2026-10-30T12:00:00.000Z' },
    ]);
    expect(m.totals).toEqual({ relinks: 0, moves: 2, all: 2 });
  });

  it('a teacher move is counted (it was missing before GX-1); a direct, moved or ended one is not', () => {
    const m = model({
      classMoves: teacherMoves({ incoming: [...incomingMove('move:a'), ...incomingMove('move:b', { kind: 'direct' }), ...incomingMove('move:c', { status: 'moved' }), ...incomingMove('move:d', { status: 'ended' })] }),
    });
    expect(m.totals.moves).toBe(1);
    expect(m.incoming.map((i) => i.id)).toEqual(['move:a']);
  });

  it('a destination view whose own step is done is not incoming', () => {
    expect(model({ transfers: [destination({ steps: { learner: 'waiting', source: 'yes', destination: 'yes' } })] }).incoming).toEqual([]);
  });

  it('re-links count whatever the move reads say (moves hidden: null reads add nothing)', () => {
    const m = model({ roster: [learner('profile:a')], relinks: [relink('profile:a'), relink('profile:gone', { id: 'relink:gone' })], transfers: null, classMoves: null });
    expect(m.totals).toEqual({ relinks: 2, moves: 0, all: 2 });
  });

  it('a failed re-link read adds nothing', () => {
    expect(model({ roster: [learner('profile:a')], relinks: null }).totals.relinks).toBe(0);
  });

  it('incoming orders by soonest expiry, a missing one last, then the oldest first', () => {
    const m = model({
      transfers: [destination({ id: 'late', expiresAt: day(10) }), destination({ id: 'soon', expiresAt: day(2) })],
      classMoves: teacherMoves({ incoming: [...incomingMove('move:new', { createdAt: '2026-10-30T12:00:00.000Z' }), ...incomingMove('move:old', { createdAt: '2026-10-20T12:00:00.000Z' })] }),
    });
    expect(m.incoming.map((i) => i.id)).toEqual(['soon', 'late', 'move:old', 'move:new']);
  });
});

describe('rosterOrder (section 4 "Ordering")', () => {
  const roster = [learner('profile:a'), learner('profile:b'), learner('profile:c'), learner('profile:d')];
  const by = (entries: Record<string, Partial<LearnerStatus>>): Record<string, LearnerStatus> =>
    Object.fromEntries(roster.map((l) => [l.id, { learnerId: l.id, kind: 'in_class', action: false, scopeBase: false, ...entries[l.id] } as LearnerStatus]));

  it('action cards first by soonest expiry (a re-link before a move), then the shipped order', () => {
    const statuses = by({
      'profile:c': { kind: 'move_yours', action: true, move: { source: 'transfer', id: 't', to: null, on: null, expiresAt: day(3) } },
      'profile:d': { kind: 'relink', action: true, relink: { id: 'r', expiresAt: min(4) } },
    });
    expect(rosterOrder(roster, statuses).map((l) => l.id)).toEqual(['profile:d', 'profile:c', 'profile:a', 'profile:b']);
  });

  it('an action with no expiry goes after the ones that have one', () => {
    const statuses = by({
      'profile:b': { kind: 'move_yours', action: true, move: { source: 'teacher', id: 'm', to: null, on: null, expiresAt: null } },
      'profile:c': { kind: 'move_yours', action: true, move: { source: 'transfer', id: 't', to: null, on: null, expiresAt: day(3) } },
    });
    expect(rosterOrder(roster, statuses).map((l) => l.id)).toEqual(['profile:c', 'profile:b', 'profile:a', 'profile:d']);
  });

  it('a pinned (just decided) card keeps its previous place; the others fill around it', () => {
    const previous = ['profile:d', 'profile:a', 'profile:b', 'profile:c'];
    const statuses = by({});
    expect(rosterOrder(roster, statuses, new Set(['profile:d']), previous).map((l) => l.id)).toEqual(['profile:d', 'profile:a', 'profile:b', 'profile:c']);
    expect(rosterOrder(roster, statuses, new Set(), previous).map((l) => l.id)).toEqual(['profile:a', 'profile:b', 'profile:c', 'profile:d']);
    // A pinned id no longer on the roster is ignored.
    expect(rosterOrder(roster, statuses, new Set(['profile:x']), previous).map((l) => l.id)).toEqual(['profile:a', 'profile:b', 'profile:c', 'profile:d']);
  });

  it('statusExpiry: only action states have one', () => {
    expect(statusExpiry(undefined)).toBeNull();
    expect(statusExpiry({ learnerId: 'a', kind: 'move_others', action: false, scopeBase: false, move: { source: 'transfer', id: 't', to: null, on: null, expiresAt: day(1) } })).toBeNull();
  });
});

describe('statusWords (section 4 table)', () => {
  const s = (over: Partial<LearnerStatus>): LearnerStatus => ({ learnerId: 'a', kind: 'in_class', action: false, scopeBase: false, ...over });

  it('every kind in English', () => {
    expect(statusWords(s({ kind: 'relink', action: true, relink: { id: 'r', expiresAt: min(7.5) } }), NOW, 'en')).toEqual({ chip: 'Needs your OK', reason: 'New device · 8 min left', tone: 'action' });
    expect(statusWords(s({ kind: 'move_yours', action: true, move: { source: 'transfer', id: 't', to: 'Evening Class D', on: null, expiresAt: null } }), NOW, 'en')).toEqual({ chip: 'Needs your OK', reason: 'Class move: Evening Class D', tone: 'action' });
    expect(statusWords(s({ kind: 'move_yours', action: true, move: { source: 'transfer', id: 't', to: null, on: null, expiresAt: null } }), NOW, 'en')?.reason).toBeNull();
    expect(statusWords(s({ kind: 'move_room' }), NOW, 'en')).toEqual({ chip: 'Waiting for a seat', reason: null, tone: 'quiet' });
    expect(statusWords(s({ kind: 'move_scheduled', move: { source: 'transfer', id: 't', to: null, on: '2026-11-03T00:00:00.000Z', expiresAt: null } }), NOW, 'en')).toEqual({ chip: 'Moving Nov 3', reason: null, tone: 'info' });
    expect(statusWords(s({ kind: 'move_scheduled' }), NOW, 'en')).toEqual({ chip: 'Move waiting', reason: null, tone: 'quiet' });
    expect(statusWords(s({ kind: 'move_others', move: { source: 'transfer', id: 't', to: 'Class D', on: null, expiresAt: null } }), NOW, 'en')).toEqual({ chip: 'Move waiting', reason: 'Waiting for: Class D', tone: 'quiet' });
    expect(statusWords(s({ kind: 'move_others' }), NOW, 'en')?.reason).toBeNull();
    expect(statusWords(s({ kind: 'new' }), NOW, 'en')).toEqual({ chip: 'New', reason: 'No practice shared yet', tone: 'info' });
    expect(statusWords(s({ kind: 'in_class' }), NOW, 'en')).toEqual({ chip: 'In class', reason: null, tone: 'in' });
    expect(statusWords(s({ kind: 'none' }), NOW, 'en')).toBeNull();
  });

  it('Korean and Spanish use the one action wording of section 10.1', () => {
    const r = s({ kind: 'relink', action: true, relink: { id: 'r', expiresAt: min(1) } });
    expect(statusWords(r, NOW, 'ko')).toMatchObject({ chip: '승인 대기', reason: '새 기기 · 1분 남음' });
    expect(statusWords(r, NOW, 'es')).toMatchObject({ chip: 'Por aprobar', reason: 'Dispositivo nuevo · queda 1 min' });
    expect(statusWords(s({ kind: 'relink', action: true, relink: { id: 'r', expiresAt: min(5) } }), NOW, 'es')?.reason).toBe('Dispositivo nuevo · quedan 5 min');
    expect(statusWords(s({ kind: 'in_class' }), NOW, 'ko')?.chip).toBe('참여 중');
    expect(statusWords(s({ kind: 'new' }), NOW, 'ko')).toMatchObject({ chip: '새로 참여', reason: '아직 연습 기록이 없어요' });
  });

  it('every locale has every chip word, and no word of shame', () => {
    for (const locale of LOCALES) {
      const t = getMessages(locale).console.status;
      for (const word of [t.inClass, t.needsOk, t.moveWaiting, t.waitingSeat, t.new, t.noPractice, t.review.cta]) {
        expect(word.length).toBeGreaterThan(0);
        expect(word.toLowerCase()).not.toMatch(/late|behind|missing|overdue/);
      }
    }
  });

  it('minutes are whole, rounded up, at least 1 while the request is open', () => {
    expect(minutesShown(min(7.2), NOW)).toBe(8);
    expect(minutesShown(min(0.1), NOW)).toBe(1);
    expect(minutesShown(min(-3), NOW)).toBe(1);
  });
});

describe('learner-status.ts stays pure and anti-shame (section 11)', () => {
  const src = readFileSync(new URL('../learner-status.ts', import.meta.url), 'utf8');
  it('imports no React and no colour token; never the danger colour', () => {
    expect(src).not.toMatch(/from 'react'/);
    expect(src).not.toMatch(/feedback\.danger|#[0-9a-fA-F]{3,6}\b/);
  });
});
