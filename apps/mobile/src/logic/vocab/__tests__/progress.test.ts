import { VocabProgressSchema, type VocabItemState, type VocabProgress } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BOX_DAYS,
  VOCAB_MAX_ITEMS,
  VOCAB_MAX_TOPICS,
  addDays,
  applyVocabEvents,
  codePoint,
  emptyVocab,
  localDay,
  vocabOf,
  type VocabEvent,
} from '../progress';

const D10 = new Date('2026-10-10T15:00:00.000Z');
const D11 = new Date('2026-10-11T15:00:00.000Z');
const APPLE = 'vocab:sagwa-apple';
const EYE = 'vocab:nun-eye';

const state = (over: Partial<VocabItemState> = {}): VocabItemState => ({
  id: APPLE,
  first: '2026-10-01',
  seen: 4,
  right: 3,
  bestBox: 3,
  last: '2026-10-05',
  box: 3,
  due: '2026-10-12',
  at: '2026-10-05T10:00:00.000Z',
  ...over,
});
const slice = (items: VocabItemState[] = [], topics: VocabProgress['topics'] = []): VocabProgress => ({ v: 1, items, topics });
const item = (v: VocabProgress, id = APPLE) => v.items.find((s) => s.id === id);

describe('localDay / addDays (P5)', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  it('is the device-local calendar day, not the UTC prefix', () => {
    process.env.TZ = 'America/Los_Angeles';
    // 4 pm on 10 October in Los Angeles is already 11 October in UTC.
    expect(localDay(new Date('2026-10-10T23:00:00.000Z'))).toBe('2026-10-10');
    process.env.TZ = 'Asia/Seoul';
    expect(localDay(new Date('2026-10-10T23:00:00.000Z'))).toBe('2026-10-11');
  });

  it('pads month and day, and holds across a daylight-saving change', () => {
    process.env.TZ = 'America/New_York';
    expect(localDay(new Date('2026-01-05T12:00:00.000Z'))).toBe('2026-01-05');
    // Clocks go back at 2 am on 1 November 2026 in New York.
    expect(localDay(new Date('2026-11-01T04:30:00.000Z'))).toBe('2026-11-01');
    expect(localDay(new Date('2026-11-01T05:30:00.000Z'))).toBe('2026-11-01');
    expect(localDay(new Date('2026-11-02T04:59:00.000Z'))).toBe('2026-11-01');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('re-exports the box intervals', () => {
    expect(BOX_DAYS).toEqual([0, 1, 3, 7, 14, 30]);
  });
});

describe('vocabOf', () => {
  it('is the empty slice when absent', () => {
    expect(vocabOf({})).toEqual({ v: 1, items: [], topics: [] });
    expect(emptyVocab()).toEqual({ v: 1, items: [], topics: [] });
  });

  it('returns a valid slice as it is', () => {
    const v = slice([state()]);
    expect(vocabOf({ vocab: v })).toBe(v);
    expect(vocabOf({ vocab: v })).toBe(v);
  });

  it('treats a corrupt or newer-version slice as none (section 3.10)', () => {
    const bad = { v: 1, items: [state({ box: 9 })], topics: [] } as unknown as VocabProgress;
    expect(vocabOf({ vocab: bad })).toEqual(emptyVocab());
    const newer = { v: 2, items: [], topics: [] } as unknown as VocabProgress;
    expect(vocabOf({ vocab: newer })).toEqual(emptyVocab());
    expect(vocabOf({ vocab: null as unknown as VocabProgress })).toEqual(emptyVocab());
  });
});

describe('applyVocabEvents — the section 3.2 table', () => {
  it('introduced creates box 1, due tomorrow (behaviour 1)', () => {
    const v = applyVocabEvents(emptyVocab(), [{ type: 'introduced', id: APPLE }], D10);
    expect(item(v)).toEqual({
      id: APPLE,
      first: '2026-10-10',
      seen: 0,
      right: 0,
      bestBox: 1,
      last: '2026-10-10',
      box: 1,
      due: '2026-10-11',
      at: D10.toISOString(),
    });
  });

  it('introduced is idempotent: a held word is unchanged and the same slice comes back', () => {
    const v = slice([state()]);
    expect(applyVocabEvents(v, [{ type: 'introduced', id: APPLE }], D11)).toBe(v);
  });

  it('a first-try right answer promotes and counts (behaviour 2)', () => {
    const v1 = applyVocabEvents(emptyVocab(), [{ type: 'introduced', id: APPLE }], D10);
    const v2 = applyVocabEvents(v1, [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], D11);
    expect(item(v2)).toMatchObject({ box: 2, bestBox: 2, due: '2026-10-14', seen: 1, right: 1, last: '2026-10-11', first: '2026-10-10' });
    expect(item(v2)?.at).toBe(D11.toISOString());
  });

  it('a wrong answer in box 3 drops the schedule only (behaviour 3)', () => {
    const v = applyVocabEvents(slice([state()]), [{ type: 'answer', id: APPLE, correct: false, source: 'cards' }], D11);
    expect(item(v)).toMatchObject({ box: 2, due: '2026-10-12', bestBox: 3, seen: 5, right: 3, last: '2026-10-11', first: '2026-10-01' });
  });

  it('a wrong answer never goes below box 1', () => {
    const v = applyVocabEvents(slice([state({ box: 1, bestBox: 1 })]), [{ type: 'answer', id: APPLE, correct: false, source: 'review' }], D11);
    expect(item(v)).toMatchObject({ box: 1, due: '2026-10-12' });
  });

  it('a right answer with a hint: seen +1, right and box unchanged, rescheduled by the box (behaviour 4)', () => {
    const v = applyVocabEvents(slice([state()]), [{ type: 'answer', id: APPLE, correct: true, hinted: true, source: 'speed' }], D11);
    expect(item(v)).toMatchObject({ box: 3, bestBox: 3, seen: 5, right: 3, due: '2026-10-18', last: '2026-10-11' });
  });

  it('box 5 is the ceiling', () => {
    const v = applyVocabEvents(slice([state({ box: 5, bestBox: 5 })]), [{ type: 'answer', id: APPLE, correct: true, source: 'match' }], D11);
    expect(item(v)).toMatchObject({ box: 5, bestBox: 5, due: addDays('2026-10-11', 30) });
  });

  it('an answer for a word with no state creates it first', () => {
    const v = applyVocabEvents(emptyVocab(), [{ type: 'answer', id: APPLE, correct: true, source: 'review' }], D11);
    expect(item(v)).toMatchObject({ first: '2026-10-11', box: 2, bestBox: 2, seen: 1, right: 1, due: '2026-10-14' });
  });

  it('"Got it" on a new word: box 2, due in 3 days (behaviour 5)', () => {
    const v = applyVocabEvents(emptyVocab(), [{ type: 'self', id: APPLE, known: true }], D10);
    expect(item(v)).toMatchObject({ box: 2, bestBox: 2, due: '2026-10-13', seen: 0, right: 0 });
  });

  it('"Got it" on a word in box 4 lowers nothing (behaviour 5)', () => {
    const v0 = slice([state({ box: 4, bestBox: 4, due: '2026-10-20' })]);
    const v = applyVocabEvents(v0, [{ type: 'self', id: APPLE, known: true }], D11);
    expect(item(v)).toEqual(item(v0));
  });

  it('"Show me again": box 1, due tomorrow, bestBox unchanged, no answer counted', () => {
    const v = applyVocabEvents(slice([state({ box: 4, bestBox: 4 })]), [{ type: 'self', id: APPLE, known: false }], D11);
    expect(item(v)).toMatchObject({ box: 1, bestBox: 4, due: '2026-10-12', seen: 4, right: 3, last: '2026-10-05' });
  });

  it('accepts and ignores ms and format (P3)', () => {
    const plain = applyVocabEvents(slice([state()]), [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], D11);
    const timed = applyVocabEvents(slice([state()]), [{ type: 'answer', id: APPLE, correct: true, source: 'speed', ms: 12_000, format: 'image-to-word' }], D11);
    expect(timed).toEqual(plain);
  });
});

describe('applyVocabEvents — sessions', () => {
  it('upserts the topic: sessions +1, last, best stars', () => {
    const v1 = applyVocabEvents(emptyVocab(), [{ type: 'session', topicKey: 'food', kind: 'cards' }], D10);
    expect(v1.topics).toEqual([{ topic: 'food', bestStars: 0, sessions: 1, last: '2026-10-10', bestCaught: 0 }]);
    const v2 = applyVocabEvents(v1, [{ type: 'session', topicKey: 'food', kind: 'speed', stars: 2, endedBy: 'questions' }], D11);
    expect(v2.topics).toEqual([{ topic: 'food', bestStars: 2, sessions: 2, last: '2026-10-11', bestCaught: 0 }]);
    const v3 = applyVocabEvents(v2, [{ type: 'session', topicKey: 'food', kind: 'speed', stars: 1, mode: 'relaxed' }], D11);
    expect(v3.topics[0]?.bestStars).toBe(2);
  });

  it('bestCaught only from Challenge, and only grows (behaviour 12)', () => {
    const events: VocabEvent[] = [
      { type: 'session', topicKey: 'food', kind: 'speed', caught: 12, mode: 'relaxed' },
      { type: 'session', topicKey: 'food', kind: 'speed', caught: 9, mode: 'challenge', endedBy: 'clock' },
      { type: 'session', topicKey: 'food', kind: 'speed', caught: 7, mode: 'challenge', endedBy: 'clock' },
      { type: 'session', topicKey: 'food', kind: 'speed', caught: 3 },
    ];
    expect(applyVocabEvents(emptyVocab(), events, D11).topics[0]).toMatchObject({ bestCaught: 9, sessions: 4 });
  });

  it('a stars or caught value outside its range counts as none', () => {
    const events = [
      { type: 'session', topicKey: 'food', kind: 'speed', stars: 7, caught: -3, mode: 'challenge' },
      { type: 'session', topicKey: 'food', kind: 'speed', caught: 2.5, mode: 'challenge' },
    ] as unknown as VocabEvent[];
    expect(applyVocabEvents(emptyVocab(), events, D11).topics[0]).toMatchObject({ bestStars: 0, bestCaught: 0, sessions: 2 });
  });
});

describe('applyVocabEvents — robustness and shape', () => {
  it('ignores a malformed id or topic key, never throws', () => {
    const v0 = emptyVocab();
    const events = [
      { type: 'introduced', id: 'sagwa' },
      { type: 'answer', id: 'vocab:Bad Id', correct: true, source: 'speed' },
      { type: 'self', id: '', known: true },
      { type: 'session', topicKey: 'Not A Key', kind: 'cards' },
      { type: 'mystery', id: APPLE },
    ] as unknown as VocabEvent[];
    expect(applyVocabEvents(v0, events, D11)).toBe(v0);
  });

  it('returns the same slice for no events or an invalid clock', () => {
    const v0 = slice([state()]);
    expect(applyVocabEvents(v0, [], D11)).toBe(v0);
    expect(applyVocabEvents(v0, [{ type: 'introduced', id: EYE }], new Date(Number.NaN))).toBe(v0);
    expect(applyVocabEvents(v0, [{ type: 'introduced', id: EYE }], new Date('+010000-01-01T00:00:00Z'))).toBe(v0);
  });

  it('sorts items by id and topics by key in code-point order, whatever the event order', () => {
    const ids = ['vocab:nun-eye', 'vocab:nuna-sister', 'vocab:apple', 'vocab:nun-snow'];
    const a = applyVocabEvents(emptyVocab(), ids.map((id) => ({ type: 'introduced', id }) as const), D10);
    const b = applyVocabEvents(emptyVocab(), [...ids].reverse().map((id) => ({ type: 'introduced', id }) as const), D10);
    expect(a).toEqual(b);
    expect(a.items.map((s) => s.id)).toEqual(['vocab:apple', 'vocab:nun-eye', 'vocab:nun-snow', 'vocab:nuna-sister']);
    const t = applyVocabEvents(
      emptyVocab(),
      ['school', 'food', 'body-parts'].map((topicKey) => ({ type: 'session', topicKey, kind: 'cards' }) as const),
      D10,
    );
    expect(t.topics.map((x) => x.topic)).toEqual(['body-parts', 'food', 'school']);
  });

  it('code-point order puts a hyphen before a letter and keeps equal keys equal', () => {
    expect(codePoint('vocab:nun-eye', 'vocab:nuna')).toBe(-1);
    expect(codePoint('vocab:nuna', 'vocab:nun-eye')).toBe(1);
    expect(codePoint('food', 'food')).toBe(0);
  });

  it('does not mutate its input', () => {
    const v0 = slice([state()]);
    const copy = structuredClone(v0);
    applyVocabEvents(v0, [{ type: 'answer', id: APPLE, correct: false, source: 'speed' }, { type: 'session', topicKey: 'food', kind: 'cards' }], D11);
    expect(v0).toEqual(copy);
  });

  it('always yields a slice the Worker accepts', () => {
    const events: VocabEvent[] = [
      { type: 'introduced', id: APPLE },
      { type: 'self', id: EYE, known: true },
      { type: 'answer', id: APPLE, correct: true, source: 'speed' },
      { type: 'answer', id: EYE, correct: false, source: 'cards' },
      { type: 'session', topicKey: 'food', kind: 'speed', stars: 3, caught: 4, mode: 'challenge' },
    ];
    expect(VocabProgressSchema.safeParse(applyVocabEvents(emptyVocab(), events, D11)).success).toBe(true);
  });

  it('never grows past the schema caps, so a full slice can never block a sync', () => {
    const many = Array.from({ length: VOCAB_MAX_ITEMS }, (_, i) => state({ id: `vocab:w${String(i).padStart(4, '0')}` }));
    const full = slice(many);
    const v = applyVocabEvents(full, [{ type: 'introduced', id: 'vocab:zzz-new' }, { type: 'answer', id: 'vocab:zzz-new', correct: true, source: 'speed' }], D11);
    expect(v.items).toHaveLength(VOCAB_MAX_ITEMS);
    expect(item(v, 'vocab:zzz-new')).toBeUndefined();
    // A held word still updates.
    const held = applyVocabEvents(full, [{ type: 'answer', id: 'vocab:w0000', correct: true, source: 'speed' }], D11);
    expect(item(held, 'vocab:w0000')?.box).toBe(4);

    const topics = Array.from({ length: VOCAB_MAX_TOPICS }, (_, i) => ({ topic: `t${i}`, bestStars: 0, sessions: 1, last: '2026-10-01', bestCaught: 0 }));
    const t = applyVocabEvents(slice([], topics), [{ type: 'session', topicKey: 'extra', kind: 'cards' }], D11);
    expect(t.topics).toHaveLength(VOCAB_MAX_TOPICS);
    expect(t.topics.some((x) => x.topic === 'extra')).toBe(false);
  });
});

describe('applyVocabEvents — the 24-hour clamp (section 3.3, clock skew)', () => {
  it('a schedule stamp is never more than 24 hours past the latest one in the slice', () => {
    const v0 = slice([state({ id: EYE, at: '2026-10-06T10:00:00.000Z' }), state({ at: '2026-10-05T10:00:00.000Z' })]);
    const wrongClock = new Date('2031-01-01T00:00:00.000Z');
    const v = applyVocabEvents(v0, [{ type: 'answer', id: APPLE, correct: false, source: 'speed' }], wrongClock);
    expect(item(v)?.at).toBe('2026-10-07T10:00:00.000Z');
  });

  it('an unreadable stamp in a slice handed in unchecked does not count as the latest', () => {
    const v0 = slice([state({ at: 'not a time' }), state({ id: EYE, at: '2026-10-06T10:00:00.000Z' })]);
    const v = applyVocabEvents(v0, [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], D11);
    expect(item(v)?.at).toBe('2026-10-07T10:00:00.000Z');
  });

  it('a clock within 24 hours, or a slice with no stamp yet, is used as it is', () => {
    const v0 = slice([state({ at: '2026-10-11T10:00:00.000Z' })]);
    const v = applyVocabEvents(v0, [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], D11);
    expect(item(v)?.at).toBe(D11.toISOString());
    const fresh = applyVocabEvents(emptyVocab(), [{ type: 'introduced', id: APPLE }], new Date('2031-01-01T00:00:00.000Z'));
    expect(item(fresh)?.at).toBe('2031-01-01T00:00:00.000Z');
  });

  it('days stay on the device calendar: a learner back after a week is scheduled from today', () => {
    // Skipped days are invisible (section 3.4): only the merge stamp is clamped.
    const v0 = slice([state({ at: '2026-10-01T10:00:00.000Z', due: '2026-10-04' })]);
    const v = applyVocabEvents(v0, [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], D11);
    expect(item(v)).toMatchObject({ box: 4, due: '2026-10-25', last: '2026-10-11', at: '2026-10-02T10:00:00.000Z' });
  });
});
