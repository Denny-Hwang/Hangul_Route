import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ApiResult, SpaceListItem, TransferDestinationView, TransferSourceView, TransferView } from '../api';
import {
  actionOutcome,
  canAgreeBoth,
  cardRank,
  classMoveGroups,
  directClassIds,
  historyDate,
  ownAnswerWaits,
  retryShown,
  schoolMoveLinks,
} from '../transfer-requests';

/**
 * F-SPACE-002 T-6b (spec 4.8 "Requests page", "Roster chip"; design/screens/transfer/requests-page.md): the class
 * requests page's pure parts, the card order, the answers it may give and what a failed answer means.
 */

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
    learner: { name: 'M. K.', avatar: 'fox', level: 'some_reading' },
    comingFrom: null,
    ...over,
  };
}

const fail = (status: number, code?: string, error: 'unauthorized' | 'forbidden' | 'not_found' | 'network' | 'unknown' = 'unknown'): ApiResult<unknown> => ({ ok: false, error, status, code });

describe('cardRank: waiting for this class, then for others, then scheduled', () => {
  it('ranks an own answer first, a wait for others next, a scheduled move last', () => {
    expect(cardRank(source())).toBe(0);
    expect(cardRank(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }))).toBe(1);
    expect(cardRank(source({ status: 'approved', blockReason: 'cap_class' }))).toBe(1);
    expect(cardRank(source({ status: 'approved', scheduledFor: '2026-10-14T12:00:00.000Z' }))).toBe(2);
    expect(cardRank(destination())).toBe(0);
    expect(cardRank(destination({ steps: { learner: 'yes', source: 'waiting', destination: 'yes' } }))).toBe(1);
  });
});

describe('classMoveGroups', () => {
  it('splits open cards from the 30-day history per side, cards by rank then age, history newest first', () => {
    const views: TransferView[] = [
      source({ id: 'a', steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }),
      source({ id: 'b', createdAt: '2026-10-11T12:00:00.000Z' }),
      source({ id: 'c', createdAt: '2026-10-09T12:00:00.000Z' }),
      source({ id: 'd', status: 'approved', scheduledFor: '2026-10-14T12:00:00.000Z' }),
      source({ id: 'e', status: 'executed', learner: null, executedAt: '2026-10-03T12:00:00.000Z' }),
      source({ id: 'f', status: 'ended', steps: null, learner: null, endedAt: '2026-10-05T12:00:00.000Z' }),
      destination({ id: 'g' }),
      destination({ id: 'h', status: 'executed', executedAt: '2026-10-04T12:00:00.000Z' }),
    ];
    const groups = classMoveGroups(views);
    expect(groups.leaving.map((v) => v.id)).toEqual(['c', 'b', 'a', 'd']);
    expect(groups.leavingHistory.map((v) => v.id)).toEqual(['f', 'e']);
    expect(groups.joining.map((v) => v.id)).toEqual(['g']);
    expect(groups.joiningHistory.map((v) => v.id)).toEqual(['h']);
    expect(groups.movedIn).toBe(true);
    expect(classMoveGroups([destination()]).movedIn).toBe(false);
  });

  it('drops a learner-side view (never drawn on a class page)', () => {
    const family = { id: 'x', role: 'learner_side', status: 'requested' } as unknown as TransferView;
    const groups = classMoveGroups([family]);
    expect([...groups.leaving, ...groups.joining, ...groups.leavingHistory, ...groups.joiningHistory]).toEqual([]);
  });

  it('keeps the order of the last draw while focus is inside a card; new cards go after it', () => {
    const before = [source({ id: 'a', steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }), source({ id: 'b' })];
    expect(classMoveGroups(before).leaving.map((v) => v.id)).toEqual(['b', 'a']);
    const after = [source({ id: 'a' }), source({ id: 'b', steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }), source({ id: 'n' })];
    expect(classMoveGroups(after, ['b', 'a']).leaving.map((v) => v.id)).toEqual(['b', 'a', 'n']);
    expect(classMoveGroups(after).leaving.map((v) => v.id)).toEqual(['a', 'n', 'b']);
  });
});

describe('historyDate', () => {
  it('the move date, else the end date, else the ask date', () => {
    expect(historyDate(source({ executedAt: '2026-10-03T00:00:00.000Z' }))).toBe('2026-10-03T00:00:00.000Z');
    expect(historyDate(source({ endedAt: '2026-10-05T00:00:00.000Z' }))).toBe('2026-10-05T00:00:00.000Z');
    expect(historyDate(source())).toBe(common.createdAt);
  });
});

describe('the answers a card offers', () => {
  it('ownAnswerWaits: only a requested card whose own step waits', () => {
    expect(ownAnswerWaits(source())).toBe(true);
    expect(ownAnswerWaits(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }))).toBe(false);
    expect(ownAnswerWaits(source({ status: 'approved' }))).toBe(false);
    expect(ownAnswerWaits(source({ steps: null }))).toBe(false);
    expect(ownAnswerWaits(destination())).toBe(true);
  });

  it('canAgreeBoth: the family said yes, both class steps wait, and this account owns or teaches the named new class directly', () => {
    const ids = new Set(['space:b']);
    const named = source({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } });
    expect(canAgreeBoth(named, ids)).toBe(true);
    expect(canAgreeBoth(named, new Set())).toBe(false);
    expect(canAgreeBoth(source(), ids)).toBe(false);
    expect(canAgreeBoth(source({ ...named, steps: { learner: 'waiting', source: 'waiting', destination: 'waiting' } }), ids)).toBe(false);
    expect(canAgreeBoth(source({ ...named, steps: { learner: 'yes', source: 'waiting', destination: 'yes' } }), ids)).toBe(false);
    expect(canAgreeBoth(source({ ...named, status: 'approved' }), ids)).toBe(false);
  });

  it('directClassIds: classes this account holds as owner or teacher itself (never through the school)', () => {
    const item = (id: string, kind: 'class' | 'family' | 'school', role: SpaceListItem['role']): SpaceListItem =>
      ({ space: { id, kind }, role, counts: { learners: 0, accounts: 0, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }) as unknown as SpaceListItem;
    const ids = directClassIds([item('a', 'class', 'owner'), item('b', 'class', 'teacher'), item('c', 'class', 'admin'), item('f', 'family', 'owner'), item('s', 'school', 'owner')]);
    expect([...ids].sort()).toEqual(['a', 'b']);
    expect(directClassIds(null).size).toBe(0);
  });

  it('retryShown: the destination of an agreed move blocked by its own class or school cap', () => {
    expect(retryShown(destination({ status: 'approved', blockReason: 'cap_class' }))).toBe(true);
    expect(retryShown(destination({ status: 'approved', blockReason: 'cap_school' }))).toBe(true);
    expect(retryShown(destination({ status: 'approved', blockReason: 'cap_learner' }))).toBe(false);
    expect(retryShown(destination({ status: 'approved' }))).toBe(false);
    expect(retryShown(source({ status: 'approved', blockReason: 'cap_class' }))).toBe(false);
  });
});

describe('actionOutcome (requests-page.md "States")', () => {
  it('maps every answer to a card or page state', () => {
    expect(actionOutcome({ ok: true, data: {} })).toBe('ok');
    expect(actionOutcome(fail(-1, undefined, 'network'))).toBe('failed');
    expect(actionOutcome(fail(401, undefined, 'unauthorized'))).toBe('signIn');
    expect(actionOutcome(fail(422, 'transfers_locked'))).toBe('locked');
    expect(actionOutcome(fail(409, 'not_open'))).toBe('ended');
    expect(actionOutcome(fail(409, 'expired'))).toBe('ended');
    expect(actionOutcome(fail(409, 'request_changed'))).toBe('changed');
    expect(actionOutcome(fail(409, 'awaiting_learner'))).toBe('changed');
    expect(actionOutcome(fail(422, 'awaiting_learner'))).toBe('changed');
    expect(actionOutcome(fail(409, 'consent_outdated'))).toBe('reload');
    expect(actionOutcome(fail(409, 'not_approved'))).toBe('reload');
    expect(actionOutcome(fail(403, 'forbidden', 'forbidden'))).toBe('forbidden');
    expect(actionOutcome(fail(404, 'not_found', 'not_found'))).toBe('forbidden');
    expect(actionOutcome(fail(409, 'one_slot_per_action'))).toBe('failed');
    expect(actionOutcome(fail(500))).toBe('failed');
  });
});

describe('schoolMoveLinks (counts only)', () => {
  it('one link per child class with a waiting move, in the school list order, by id', () => {
    const classes = [
      { id: 'space:a', name: 'Sunday Class A' },
      { id: 'space:b', name: 'Saturday Class B' },
      { id: 'space:c', name: 'Weekday Class C' },
    ];
    const counts = [
      { spaceId: 'space:c', waiting: 1 },
      { spaceId: 'space:a', waiting: 0 },
      { spaceId: 'space:b', waiting: 2 },
      { spaceId: 'space:z', waiting: 4 },
    ];
    expect(schoolMoveLinks(counts, classes)).toEqual([
      { spaceId: 'space:b', name: 'Saturday Class B', waiting: 2 },
      { spaceId: 'space:c', name: 'Weekday Class C', waiting: 1 },
    ]);
  });
});

describe('the new files hold no colour literal and never the danger colour', () => {
  it.each(['lib/console/transfer-requests.ts', 'components/console/ClassTransferParts.tsx', 'components/console/MovesEntry.tsx'])('%s', (file) => {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(text).not.toContain('feedback.danger');
  });
});
