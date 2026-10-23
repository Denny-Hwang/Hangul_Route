import { CURR_TELEMETRY_PAYLOADS, type MemoryItemState } from '@hangul-route/content-schema';
import { MEMORY_PUSH_MAX_BYTES, MemoryPushSchema } from '@hangul-route/content-schema/memory';
import { describe, expect, it } from 'vitest';
import { countAnswer, durableWeek, memoryDailyPayload, openDay, studyMinutes } from '../daily';
import { answeredByShard, emptyMemoryFile, foldStates, holdsStates, laySeed, pushBatches, readMemoryFile, sameState, type MemoryFile } from '../memory-file';

/** F-CURR-002 sections 4.8 and 11.3, row CM-12: the stored shape, the push calls, the merge in, and memory.daily. */

const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 2, d: '2026-10-25', c: 1, r: 1, n: 1, f: '2026-10-20', s: 2, at: '2026-10-22T09:00:00.000Z', ...over });

const withRows = (rows: MemoryFile['rows'], pending = Object.keys(rows)): MemoryFile => ({ ...emptyMemoryFile(), rows, pending });

describe('readMemoryFile', () => {
  it('reads what it wrote, and anything unreadable as empty', () => {
    const file = withRows({ 'lex:a': { sh: 'stage2', st: st(), l: '2026-10-22', w: '2026-10-22' } });
    file.cursor = 7;
    file.seededFrom = '2026-10-01T00:00:00.000Z';
    file.day = { ...openDay('2026-10-22', 3), hist: { 'lex|read|4-7': [2, 1] }, items: ['lex:a'] };
    file.dailySent = '2026-10-21';
    file.vf = { 'vocab:x': { p: '2026-10-20' } };
    expect(readMemoryFile(JSON.parse(JSON.stringify(file)))).toEqual(file);
    for (const raw of [null, 'x', 3, [], undefined]) expect(readMemoryFile(raw)).toEqual(emptyMemoryFile());
  });

  it('drops a row whose state or shard does not read, and a pending id with no row', () => {
    const out = readMemoryFile({
      rows: { good: { sh: 'stage2', st: st() }, badState: { sh: 'stage2', st: { b: 9 } }, badShard: { sh: 'nowhere', st: st() }, notObj: 4 },
      pending: ['good', 'badState', 7, 'good'],
      vf: { a: 'x', b: { l: 'not a day', p: '2026-10-01' } },
      cursor: -3,
      day: { day: 'today' },
      dailySent: 12,
    });
    expect(Object.keys(out.rows)).toEqual(['good']);
    expect(out.pending).toEqual(['good']);
    expect(out.vf).toEqual({ b: { p: '2026-10-01' } });
    expect(out.cursor).toBe(0);
    expect(out.day).toBeNull();
    expect(out.dailySent).toBeNull();
    expect(readMemoryFile({ day: { day: '2026-10-22', hist: { k: [1], j: [1, 2] }, items: [1, 'x'], lapses: 'x' } }).day).toEqual({ day: '2026-10-22', hist: { j: [1, 2] }, items: ['x'], lapses: 0, newHeld: 0, due: 0 });
  });
});

describe('answered states only leave the device', () => {
  it('backup and push carry n >= 1 states, never a seeded one', () => {
    const file = withRows({ 'lex:a': { sh: 'stage2', st: st() }, 'lex:seeded': { sh: 'stage2', st: st({ n: 0 }) }, 'pat:b': { sh: 'stage3', st: st({ n: 3 }) } });
    expect(holdsStates(file)).toBe(true);
    expect(holdsStates(emptyMemoryFile())).toBe(false);
    expect(answeredByShard(file)).toEqual({ stage2: { 'lex:a': st() }, stage3: { 'pat:b': st({ n: 3 }) } });
    const [batch] = pushBatches(file);
    expect(batch?.ids).toEqual(['lex:a', 'pat:b']);
    expect(MemoryPushSchema.safeParse({ shards: batch?.shards }).success).toBe(true);
  });

  it('splits pending states into calls of at most 500 states and 64 KB', () => {
    const rows: MemoryFile['rows'] = {};
    for (let i = 0; i < 1200; i += 1) rows[`lex:w${String(i).padStart(4, '0')}`] = { sh: `stage${(i % 7) + 1}`, st: st() };
    const batches = pushBatches(withRows(rows));
    expect(batches.reduce((n, b) => n + b.ids.length, 0)).toBe(1200);
    for (const b of batches) {
      expect(b.ids.length).toBeLessThanOrEqual(500);
      expect(JSON.stringify({ shards: b.shards }).length).toBeLessThan(MEMORY_PUSH_MAX_BYTES);
    }
    const small = pushBatches(withRows(rows), 500, 2000);
    for (const b of small) expect(JSON.stringify({ shards: b.shards }).length).toBeLessThanOrEqual(2000);
  });

  it('keeps a call within 24 shards', () => {
    const rows: MemoryFile['rows'] = {};
    for (let i = 0; i < 30; i += 1) rows[`lex:p${i}`] = { sh: `pack:p${String(i).padStart(2, '0')}`, st: st() };
    for (const b of pushBatches(withRows(rows))) expect(Object.keys(b.shards).length).toBeLessThanOrEqual(24);
  });
});

describe('folding states in', () => {
  it('merges with the shared rule, keeps this device’s facts, and queues a restored answered state', () => {
    const file = withRows({ 'lex:a': { sh: 'stage2', st: st({ b: 2, at: '2026-10-22T09:00:00.000Z' }), l: '2026-10-22' } }, []);
    const changed = foldStates(file, { stage2: { 'lex:a': st({ b: 4, s: 4, at: '2026-10-22T10:00:00.000Z' }), 'lex:new': st({ n: 2 }) }, nowhere: { 'lex:x': st() } }, true);
    expect(changed.sort()).toEqual(['lex:a', 'lex:new']);
    expect(file.rows['lex:a']).toMatchObject({ l: '2026-10-22', st: { b: 4, s: 4 } });
    expect(file.pending.sort()).toEqual(['lex:a', 'lex:new']);
    expect(foldStates(file, { stage2: { 'lex:a': st({ b: 4, s: 4, at: '2026-10-22T10:00:00.000Z' }) } })).toEqual([]);
  });

  it('a pull does not queue what it brought', () => {
    const file = emptyMemoryFile();
    foldStates(file, { stage2: { 'lex:a': st() } });
    expect(file.pending).toEqual([]);
  });

  it('lays a derivation over seeded and empty items, never over an answered one, and drops seeded states it no longer names', () => {
    const file = withRows({ 'lex:answered': { sh: 'stage2', st: st({ n: 2 }) }, 'lex:oldSeed': { sh: 'stage2', st: st({ n: 0 }) }, 'lex:seed': { sh: 'stage2', st: st({ n: 0, b: 1 }) } }, []);
    const seeded = new Map([
      ['lex:answered', { shard: 'stage2', state: st({ n: 0, b: 1 }) }],
      ['lex:seed', { shard: 'stage2', state: st({ n: 0, b: 2 }) }],
      ['lex:fresh', { shard: 'stage3', state: st({ n: 0 }) }],
    ]);
    expect(laySeed(file, seeded, '2026-10-01T00:00:00.000Z')).toBe(3);
    expect(Object.keys(file.rows).sort()).toEqual(['lex:answered', 'lex:fresh', 'lex:seed']);
    expect(file.rows['lex:answered']?.st.n).toBe(2);
    expect(file.rows['lex:seed']?.st.b).toBe(2);
    expect(file.seededFrom).toBe('2026-10-01T00:00:00.000Z');
    expect(laySeed(file, seeded, '2026-10-01T00:00:00.000Z')).toBe(0);
  });

  it('sameState compares the eight fields', () => {
    expect(sameState(st(), st())).toBe(true);
    for (const k of ['b', 'c', 'r', 'n', 's'] as const) expect(sameState(st(), st({ [k]: 3 }))).toBe(false);
    expect(sameState(st(), st({ d: null }))).toBe(false);
    expect(sameState(st(), st({ f: '2026-01-01' }))).toBe(false);
    expect(sameState(st(), st({ at: '2026-01-01T00:00:00.000Z' }))).toBe(false);
  });
});

describe('memory.daily', () => {
  it('counts spaced answers by kind x rung x lag, lapses, items and newly held', () => {
    const day = openDay('2026-10-22', 12);
    countAnswer(day, { id: 'lex:a', kind: 'lex', rung: 'read', spaced: true, lagDays: 7, right: true, lapse: false, newHeld: true });
    countAnswer(day, { id: 'lex:b', kind: 'lex', rung: 'read', spaced: true, lagDays: 5, right: false, lapse: true, newHeld: false });
    countAnswer(day, { id: 'lex:a', kind: 'lex', rung: 'read', spaced: false, lagDays: null, right: true, lapse: false, newHeld: false });
    countAnswer(day, { id: 'sym:a', kind: 'sym', rung: 'recognize', spaced: true, lagDays: 40, right: true, lapse: false, newHeld: false });
    const payload = memoryDailyPayload(day, 3, 9);
    expect(payload).toEqual({
      hist: [
        { kind: 'sym', rung: 'recognize', lag: '31+', right: 1, wrong: 0 },
        { kind: 'lex', rung: 'read', lag: '4-7', right: 1, wrong: 1 },
      ],
      lapses: 1,
      items: 3,
      newHeld: 1,
      minutes: 9,
      durableWeekBucket: '3-4',
      dueVolumeBucket: '10-19',
    });
    // Every payload this row sends parses against the Worker's schema before it is sent.
    expect(CURR_TELEMETRY_PAYLOADS['memory.daily'].safeParse(payload).success).toBe(true);
  });

  it('an empty day still parses: no hist, every count 0', () => {
    const payload = memoryDailyPayload(openDay('2026-10-22', 0), 0, 0);
    expect(CURR_TELEMETRY_PAYLOADS['memory.daily'].safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ hist: [], durableWeekBucket: '0', dueVolumeBucket: '0' });
  });

  it('caps counts and minutes so the payload always parses', () => {
    const day = { ...openDay('2026-10-22', 10_000_000), lapses: 2_000_000, newHeld: -4 };
    const payload = memoryDailyPayload(day, 999_999, 5000);
    expect(payload).toMatchObject({ lapses: 100_000, newHeld: 0, minutes: 1440, durableWeekBucket: '500+', dueVolumeBucket: '500+' });
  });

  it('a hist cell off the kind x rung x lag table, or one with no answers, is left out', () => {
    const day = openDay('2026-10-22', 0);
    day.hist['lex|read|0-1'] = [Number.NaN, 0];
    day.hist['word|read|0-1'] = [3, 0];
    day.hist['lex|speak|0-1'] = [3, 0];
    expect(memoryDailyPayload(day, 0, 0)?.hist).toEqual([]);
  });

  it('the north star counts durable answers of the 7 local days ending that day, memory items and topic words', () => {
    const file = { rows: { a: { sh: 'stage2', st: st(), w: '2026-10-22' }, b: { sh: 'stage2', st: st(), w: '2026-10-16' }, c: { sh: 'stage2', st: st(), w: '2026-10-15' }, d: { sh: 'stage2', st: st() } }, vf: { 'vocab:x': { w: '2026-10-20' }, 'vocab:y': { w: '2026-10-23' } } };
    expect(durableWeek(file, '2026-10-22')).toBe(3);
  });

  it('study minutes are the sessions logged on that local day', () => {
    expect(studyMinutes([{ localDay: '2026-10-22', durationSeconds: 300 }, { localDay: '2026-10-22', durationSeconds: 200 }, { localDay: '2026-10-21', durationSeconds: 900 }, { localDay: '2026-10-22' }], '2026-10-22')).toBe(8);
    expect(studyMinutes([{ localDay: '2026-10-22', durationSeconds: 200_000 }], '2026-10-22')).toBe(1440);
  });
});

describe('the Words known count last read (row CM-20)', () => {
  it('keeps a whole count, drops anything else, and is absent until the first read', () => {
    expect(readMemoryFile({ wk: 120 }).wk).toBe(120);
    for (const wk of [-1, 1.5, '120', null]) expect(readMemoryFile({ wk }).wk, String(wk)).toBeUndefined();
    expect('wk' in emptyMemoryFile()).toBe(false);
  });
});

describe('the mastery moments waiting for a Results (row CM-20)', () => {
  it('keeps a dated record of levels 1-3 and a whole milestone, drops anything else', () => {
    expect(readMemoryFile({ mc: { day: '2026-10-22', rises: { 'episode:stage3-life': 2, bad: 4, worse: '1' }, words: 100 } }).mc).toEqual({
      day: '2026-10-22',
      rises: { 'episode:stage3-life': 2 },
      words: 100,
    });
    expect(readMemoryFile({ mc: { day: '2026-10-22', rises: {}, words: 0 } }).mc).toEqual({ day: '2026-10-22', rises: {}, words: null });
    for (const mc of [null, 'x', { rises: {} }, { day: 'today', rises: {} }]) expect(readMemoryFile({ mc }).mc, JSON.stringify(mc)).toBeUndefined();
    expect('mc' in emptyMemoryFile()).toBe(false);
  });
});
