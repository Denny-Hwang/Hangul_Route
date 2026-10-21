import { GROWN_UP_FRESH_PIN_MS, OA_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import {
  BATCH_COUNT_MAX,
  batchEvent,
  batchJoined,
  batchOffered,
  batchPickNeedsPin,
  checklistRows,
  classifyJoin,
  initialPicks,
  locksThatCount,
  pickedInOrder,
  resultLine,
  resultLines,
  runBatch,
  togglePick,
  type BatchAnswer,
  type BatchLearner,
  type BatchResult,
} from '../join-batch';

/**
 * [OA] Who is joining? (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, sections 10.2, 10.3, 10.6, CS-11; row OA-7b): the
 * pure batch plan. Section 20, OA-7b: a fresh PIN when a non-active learner is picked; a locked profile unchecked
 * with Takes a family place; class-scoped learners disabled; the per-learner result lines; the stop on the first
 * network error; the idempotent retry.
 */

const caregiver = getMessages('en').caregiver;
const who = caregiver.join.who;

const MINA: BatchLearner = { id: 'p:mina', displayName: 'Mina', avatar: 'hoya-orange' };
const JUN: BatchLearner = { id: 'p:jun', displayName: 'Jun', avatar: 'hoya-orange' };
const SORA: BatchLearner = { id: 'p:sora', displayName: 'Sora', avatar: 'hoya-blue' };
const LEO: BatchLearner = { id: 'p:leo', displayName: 'Leo', avatar: 'hoya-green' };
const ALL = [MINA, JUN, SORA, LEO];

const rows = checklistRows({ learners: ALL, activeId: MINA.id, locks: [SORA.id], classScoped: [LEO.id] });

const ok = (alreadyMember = false): BatchAnswer => ({ ok: true, alreadyMember });
const fail = (error: Extract<BatchAnswer, { ok: false }>['error'], cap?: number): BatchAnswer => (cap === undefined ? { ok: false, error } : { ok: false, error, cap });

describe('batchOffered (OA-D14, section 10.6)', () => {
  const base = { flag: true, kind: 'family' as const, learners: [MINA, JUN], classScoped: [] as string[] };

  it('a family code on a device with 2 or more learners, the flag on', () => {
    expect(batchOffered(base)).toBe(true);
  });

  it('never with the flag off: the one-learner join of today', () => {
    expect(batchOffered({ ...base, flag: false })).toBe(false);
  });

  it('never for a class code: class codes stay one learner at a time (OQ-15)', () => {
    expect(batchOffered({ ...base, kind: 'class' })).toBe(false);
  });

  it('never with a single learner', () => {
    expect(batchOffered({ ...base, learners: [MINA] })).toBe(false);
  });

  it('never on a class device (every learner class-scoped, section 10.6)', () => {
    expect(batchOffered({ ...base, classScoped: [MINA.id, JUN.id] })).toBe(false);
    expect(batchOffered({ ...base, classScoped: [JUN.id] })).toBe(true);
  });
});

describe('checklistRows (sections 10.2, 10.3, 10.6)', () => {
  it('keeps the order it is given, one row per learner with the name and cub', () => {
    expect(rows.map((r) => r.id)).toEqual([MINA.id, JUN.id, SORA.id, LEO.id]);
    expect(rows[0]).toMatchObject({ displayName: 'Mina', avatar: 'hoya-orange', active: true, locked: false, disabled: false, caption: null });
  });

  it('a locked profile carries Takes a family place. and starts unchecked', () => {
    expect(rows[2]).toMatchObject({ locked: true, caption: 'takesPlace', disabled: false });
    expect(initialPicks(rows)).not.toContain(SORA.id);
  });

  it('a class-scoped learner is disabled with Linked for a class on this device.', () => {
    expect(rows[3]).toMatchObject({ disabled: true, caption: 'classOnly' });
  });

  it('class scope wins over a lock for the caption (the row cannot be picked at all)', () => {
    const [row] = checklistRows({ learners: [SORA], activeId: null, locks: [SORA.id], classScoped: [SORA.id] });
    expect(row).toMatchObject({ disabled: true, caption: 'classOnly', locked: true });
  });

  it('only the active learner starts checked', () => {
    expect(initialPicks(rows)).toEqual([MINA.id]);
  });

  it('a locked or class-scoped active learner starts unchecked', () => {
    expect(initialPicks(checklistRows({ learners: ALL, activeId: SORA.id, locks: [SORA.id], classScoped: [LEO.id] }))).toEqual([]);
    expect(initialPicks(checklistRows({ learners: ALL, activeId: LEO.id, locks: [], classScoped: [LEO.id] }))).toEqual([]);
  });
});

describe('togglePick and pickedInOrder', () => {
  it('adds and removes a pick, in the checklist order', () => {
    let picks = initialPicks(rows);
    picks = togglePick(picks, SORA.id, rows);
    picks = togglePick(picks, JUN.id, rows);
    expect(pickedInOrder(picks, rows).map((r) => r.id)).toEqual([MINA.id, JUN.id, SORA.id]);
    picks = togglePick(picks, MINA.id, rows);
    expect(pickedInOrder(picks, rows).map((r) => r.id)).toEqual([JUN.id, SORA.id]);
  });

  it('a disabled row or an unknown id never changes the picks', () => {
    const picks = initialPicks(rows);
    expect(togglePick(picks, LEO.id, rows)).toBe(picks);
    expect(togglePick(picks, 'p:nobody', rows)).toBe(picks);
  });

  it('a stray pick of a disabled row is never sent', () => {
    expect(pickedInOrder([MINA.id, LEO.id], rows).map((r) => r.id)).toEqual([MINA.id]);
  });
});

describe('batchPickNeedsPin (CS-11, OA-D5b (3))', () => {
  const now = 1_000_000;

  it('joining only the active learner needs no PIN, as today', () => {
    expect(batchPickNeedsPin({ picks: [MINA.id], rows, lastPinVerifiedAt: null, now })).toBe(false);
  });

  it('picking anyone other than the active learner needs a fresh PIN', () => {
    expect(batchPickNeedsPin({ picks: [MINA.id, JUN.id], rows, lastPinVerifiedAt: null, now })).toBe(true);
    expect(batchPickNeedsPin({ picks: [JUN.id], rows, lastPinVerifiedAt: null, now })).toBe(true);
  });

  it('a PIN within 2 minutes counts; an open 15-minute session alone does not', () => {
    expect(batchPickNeedsPin({ picks: [JUN.id], rows, lastPinVerifiedAt: now - GROWN_UP_FRESH_PIN_MS + 1, now })).toBe(false);
    expect(batchPickNeedsPin({ picks: [JUN.id], rows, lastPinVerifiedAt: now - GROWN_UP_FRESH_PIN_MS, now })).toBe(true);
  });

  it('a clock that ran backwards is not fresh', () => {
    expect(batchPickNeedsPin({ picks: [JUN.id], rows, lastPinVerifiedAt: now + 5_000, now })).toBe(true);
  });

  it('a locked profile asks the PIN even when it is the active one (it is a grown-up\'s own)', () => {
    const locked = checklistRows({ learners: [MINA, JUN], activeId: MINA.id, locks: [MINA.id], classScoped: [] });
    expect(batchPickNeedsPin({ picks: [MINA.id], rows: locked, lastPinVerifiedAt: null, now })).toBe(true);
  });

  it('nothing picked needs nothing', () => {
    expect(batchPickNeedsPin({ picks: [], rows, lastPinVerifiedAt: null, now })).toBe(false);
  });
});

describe('locksThatCount (OA-D9, section 13.2)', () => {
  const ids = [MINA.id, JUN.id];

  it('a lock without a PIN is void', () => {
    expect(locksThatCount([MINA.id], false, ids)).toEqual([]);
  });

  it('the stored locks with a PIN', () => {
    expect(locksThatCount([JUN.id], true, ids)).toEqual([JUN.id]);
  });

  it('an unreadable record locks every profile (fail closed)', () => {
    expect(locksThatCount('unread', true, ids)).toEqual(ids);
  });
});

describe('classifyJoin', () => {
  it('joined, already a member, a refused seat, or a stop', () => {
    expect(classifyJoin(ok())).toBe('joined');
    expect(classifyJoin(ok(true))).toBe('already');
    for (const code of ['cap_family', 'cap_class', 'cap_school', 'cap_learner'] as const) expect(classifyJoin(fail(code))).toBe('refused');
    for (const code of ['network', 'unknown', 'too_many_attempts', 'code_expired', 'off'] as const) expect(classifyJoin(fail(code))).toBe('stop');
    for (const code of ['forbidden', 'learner_not_found', 'already_bound'] as const) expect(classifyJoin(fail(code))).toBe('skipped');
  });
});

describe('runBatch: the joins in sequence (section 10.3)', () => {
  const picked = [MINA, JUN, SORA].map((l) => ({ id: l.id, name: l.displayName }));

  it('one /join per learner, in order, each with its own result', async () => {
    const join = vi.fn(async (id: string) => (id === SORA.id ? fail('cap_family', 4) : ok(id === JUN.id)));
    const run = await runBatch(picked, join);
    expect(join.mock.calls.map(([id]) => id)).toEqual([MINA.id, JUN.id, SORA.id]);
    expect(run.results).toEqual<BatchResult[]>([
      { id: MINA.id, name: 'Mina', kind: 'joined' },
      { id: JUN.id, name: 'Jun', kind: 'already' },
      { id: SORA.id, name: 'Sora', kind: 'refused', error: 'cap_family', cap: 4 },
    ]);
    expect(run.stop).toBeNull();
  });

  it('a refused seat (409 cap) is a result, not an error: the sequence goes on', async () => {
    const join = vi.fn(async (id: string) => (id === MINA.id ? fail('cap_family', 4) : ok()));
    const run = await runBatch(picked, join);
    expect(join).toHaveBeenCalledTimes(3);
    expect(run.results.map((r) => r.kind)).toEqual(['refused', 'joined', 'joined']);
    expect(run.stop).toBeNull();
  });

  it('a refusal the Worker sent without a cap keeps none (the line reads the family cap)', async () => {
    const run = await runBatch(picked.slice(0, 1), async () => fail('cap_family'));
    expect(run.results).toEqual([{ id: MINA.id, name: 'Mina', kind: 'refused', error: 'cap_family', cap: null }]);
  });

  it('stops at the first network error: the learners done so far, and the rest left to try again', async () => {
    const join = vi.fn(async (id: string) => (id === JUN.id ? fail('network') : ok()));
    const run = await runBatch(picked, join);
    expect(join.mock.calls.map(([id]) => id)).toEqual([MINA.id, JUN.id]);
    expect(run.results).toEqual([{ id: MINA.id, name: 'Mina', kind: 'joined' }]);
    expect(run.stop).toEqual({ error: 'network', retry: true, remaining: [{ id: JUN.id, name: 'Jun' }, { id: SORA.id, name: 'Sora' }], tried: JUN.id });
  });

  it('a 5xx (unknown) or a busy answer stops too and can be tried again; a code error cannot', async () => {
    for (const [error, retry] of [['unknown', true], ['too_many_attempts', true], ['code_expired', false], ['off', false]] as const) {
      const run = await runBatch(picked, async () => fail(error));
      expect(run.stop, error).toMatchObject({ error, retry, remaining: picked });
      expect(run.results).toEqual([]);
    }
  });

  it('Try again is idempotent: the learner whose answer was lost reads joined, the done ones are kept', async () => {
    const first = await runBatch(picked, async (id) => (id === JUN.id ? fail('network') : ok()));
    // The Worker had taken Jun's seat before the answer was lost: the retry answers "already a member".
    const join = vi.fn(async (id: string) => ok(id === JUN.id));
    const again = await runBatch(first.stop!.remaining, join, first);
    expect(join.mock.calls.map(([id]) => id)).toEqual([JUN.id, SORA.id]);
    expect(again.results).toEqual([
      { id: MINA.id, name: 'Mina', kind: 'joined' },
      { id: JUN.id, name: 'Jun', kind: 'joined' },
      { id: SORA.id, name: 'Sora', kind: 'joined' },
    ]);
    expect(again.stop).toBeNull();
  });

  it('a learner who was a member before the batch still reads already, on a retry too', async () => {
    const first = await runBatch(picked, async (id) => (id === MINA.id ? fail('network') : ok()));
    const again = await runBatch(first.stop!.remaining, async () => ok(true), first);
    expect(again.results.map((r) => r.kind)).toEqual(['joined', 'already', 'already']);
  });

  it('a failure about one learner (the device check refused it, or it is gone) is that learner\'s line; the rest go on', async () => {
    for (const error of ['forbidden', 'learner_not_found'] as const) {
      const join = vi.fn(async (id: string) => (id === JUN.id ? fail(error) : ok()));
      const run = await runBatch(picked, join);
      expect(join.mock.calls.map(([id]) => id), error).toEqual([MINA.id, JUN.id, SORA.id]);
      expect(run.results).toEqual<BatchResult[]>([
        { id: MINA.id, name: 'Mina', kind: 'joined' },
        { id: JUN.id, name: 'Jun', kind: 'skipped', error },
        { id: SORA.id, name: 'Sora', kind: 'joined' },
      ]);
      expect(run.stop).toBeNull();
      // One line per learner, the skipped one led by its name; it is not joined and not a refused seat.
      expect(resultLines(run.results, caregiver)).toHaveLength(3);
      expect(resultLine(run.results[1]!, caregiver).startsWith('Jun: ')).toBe(true);
      expect(batchJoined(run.results)).toBe(2);
      expect(batchEvent(3, run.results).payload).toEqual({ picked: 3, joined: 2, refused: 0 });
    }
  });

  it('a join that throws is a network stop, never a crash', async () => {
    const run = await runBatch(picked, async () => {
      throw new Error('offline');
    });
    expect(run.stop).toMatchObject({ error: 'network', retry: true });
  });
});

describe('result lines (section 10.3, 17.4)', () => {
  const results: BatchResult[] = [
    { id: MINA.id, name: 'Mina', kind: 'joined' },
    { id: JUN.id, name: 'Jun', kind: 'already' },
    { id: SORA.id, name: 'Sora', kind: 'refused', error: 'cap_family', cap: 4 },
  ];

  it('one line per learner: joined, already a member, or the cap line in the colon form', () => {
    expect(resultLines(results, caregiver)).toEqual([
      'Mina joined.',
      'Jun is already in this family.',
      'Sora: This family already has 4 learners. Ask a grown-up in your family.',
    ]);
  });

  it('the cap line reads the cap the Worker sent, else the family cap', () => {
    expect(resultLine({ id: SORA.id, name: 'Sora', kind: 'refused', error: 'cap_family', cap: null }, caregiver)).toBe(
      `Sora: ${caregiver.join.errors.familyFull(4)}`,
    );
    expect(resultLine({ id: SORA.id, name: 'Sora', kind: 'refused', error: 'cap_family', cap: 6 }, caregiver)).toContain('6 learners');
  });

  it('a refused line is never an error word', () => {
    expect(resultLine(results[2]!, caregiver)).not.toMatch(/error|fail|wrong/i);
  });

  it('Korean and Spanish lead with the name', () => {
    for (const locale of ['es', 'ko'] as const) {
      const c = getMessages(locale).caregiver;
      for (const line of resultLines(results, c)) expect(line.startsWith(line.includes('Mina') ? 'Mina' : line.includes('Jun') ? 'Jun' : 'Sora'), `${locale}: ${line}`).toBe(true);
    }
  });

  it('the summary counts joined and already as joined, of everyone picked', () => {
    expect(batchJoined(results)).toBe(2);
    expect(who.result(batchJoined(results), 3)).toBe('2 of 3 joined.');
  });
});

describe('space.join.batch (section 15)', () => {
  it('counts picked, joined and refused, codes only', () => {
    const results: BatchResult[] = [
      { id: MINA.id, name: 'Mina', kind: 'joined' },
      { id: JUN.id, name: 'Jun', kind: 'already' },
      { id: SORA.id, name: 'Sora', kind: 'refused', error: 'cap_family', cap: 4 },
    ];
    const event = batchEvent(3, results);
    expect(event).toEqual({ name: 'space.join.batch', payload: { picked: 3, joined: 2, refused: 1 } });
    expect(OA_TELEMETRY_PAYLOADS['space.join.batch'].safeParse(event.payload).success).toBe(true);
    expect(JSON.stringify(event)).not.toMatch(/Mina|Jun|Sora|p:/);
  });

  it('each count is capped at 12', () => {
    const many: BatchResult[] = Array.from({ length: 15 }, (_, i) => ({ id: `p:${i}`, name: `L${i}`, kind: 'refused', error: 'cap_family', cap: 4 }));
    const event = batchEvent(15, many);
    expect(event.payload).toEqual({ picked: BATCH_COUNT_MAX, joined: 0, refused: BATCH_COUNT_MAX });
    expect(OA_TELEMETRY_PAYLOADS['space.join.batch'].safeParse(event.payload).success).toBe(true);
  });
});
