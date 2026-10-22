import type { MemoryItemState, ReviewEntry } from '@hangul-route/content-schema';
import { CURR_TELEMETRY_PAYLOADS, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { lintReviewMessages, localeCopyProblems, reviewScoreProblems } from '@hangul-route/content-schema/lint';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { DAILY_REVIEW_SIZE, KEEP_GOING_SIZE, type EngineContext, type EngineRow } from '../engine';
import {
  MIN_PLAYABLE_ROUNDS,
  afterSession,
  answersToRecord,
  dailyDoneOn,
  dailyEntriesOn,
  dailyEntry,
  dailyReviewCompleteEvent,
  dailyReviewStartEvent,
  dailyReviewSummary,
  dayReviewLog,
  headlineKey,
  memoryAnswerOf,
  nextSessionKind,
  planSession,
  sessionResult,
  strongerCount,
  type RoundAnswer,
} from '../daily-review';
import { surfaceIndex, type ReviewRound } from '../review-rounds';

/**
 * F-CURR-002 sections 4.3, 4.5, 4.8 and 11.3 (row CM-14): the Daily Review and Keep going. Which session comes
 * next, the day's log from `reviews[]` (no new field), the 20-due cap before Keep going (section 4.8 step 3),
 * the unplayable-item skip, stars and "N got stronger" only, the offer after a session, the entry and telemetry.
 */

const TODAY = '2026-11-10';
const KINDS: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['read-pick'],
  syl: ['hear-pick', 'read-pick'],
  lex: ['hear-pick', 'read-pick', 'type-see'],
  pat: ['hear-pick', 'read-pick', 'sentence-builder'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  rea: ['read-pick'],
};
function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return { id, kind, ko: id.slice(4), romanization: id.slice(4), en: `${id.slice(4)} meaning`, home: 'life', stage: 2, volume: 1, cells: ['episode:stage2-life'], asked: [], formats: [...KINDS[kind]], soundChange: false, homophoneOf: [], ...over };
}
const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 1, d: TODAY, c: 0, r: 0, n: 1, f: '2026-11-01', s: 1, at: '2026-11-09T09:00:00.000Z', ...over });

function ctxWith(dueWords: number, over: Partial<EngineContext> = {}, extra: readonly ReviewItem[] = []): EngineContext {
  const items = [...Array.from({ length: 40 }, (_, i) => mk(`lex:w${String(i).padStart(2, '0')}`)), ...extra];
  const states: Record<string, EngineRow> = {};
  items.slice(0, dueWords).forEach((it) => (states[it.id] = { st: st() }));
  // Held, not due: the rest are box 4 due later.
  items.slice(dueWords, 40).forEach((it) => (states[it.id] = { st: st({ b: 4, s: 4, d: '2026-12-01', c: 3 }) }));
  const raw = { items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set<string>() };
  return { index: surfaceIndex(raw), states, today: TODAY, voice: true, seed: 's', ...over };
}

const entry = (day: string, n: number, items = 10): ReviewEntry => ({
  id: `daily:${day}:${n}`,
  kind: 'daily',
  generatedAt: `${day}T0${n}:00:00.000Z`,
  scope: day,
  itemIds: Array.from({ length: items }, (_, i) => `lex:w${i}`),
  resultStars: 3,
});
const ROUND_INPUT = { gloss: (_k: string | undefined, en: string | undefined) => en, seed: 's' };

describe('which session, and the day log from reviews[] (keep-going.md data needs)', () => {
  it('the Daily Review first; once it is finished, Keep going', () => {
    expect(nextSessionKind([], TODAY)).toBe('daily');
    expect(nextSessionKind([entry('2026-11-09', 1)], TODAY)).toBe('daily');
    expect(nextSessionKind([entry(TODAY, 1)], TODAY)).toBe('keep-going');
    expect(dailyDoneOn([entry(TODAY, 1)], TODAY)).toBe(true);
    expect(dailyDoneOn([{ ...entry(TODAY, 1), kind: 'feedback' }], TODAY)).toBe(false);
  });

  it("today's Keep goings are today's daily entries minus the Daily Review, never below 0", () => {
    expect(dayReviewLog([], TODAY)).toEqual({ dailyDueDrawn: 0, keepGoingRounds: 0 });
    expect(dayReviewLog([entry(TODAY, 1)], TODAY)).toEqual({ dailyDueDrawn: 10, keepGoingRounds: 0 });
    expect(dayReviewLog([entry(TODAY, 3), entry(TODAY, 1), entry(TODAY, 2), entry('2026-11-09', 1)], TODAY).keepGoingRounds).toBe(2);
    expect(dailyEntriesOn([entry(TODAY, 3), entry(TODAY, 1)], TODAY).map((e) => e.id)).toEqual([`daily:${TODAY}:1`, `daily:${TODAY}:3`]);
  });

  it('the due items a stopped Daily Review drew count toward the 20 (section 4.8 step 3), capped at 20', () => {
    expect(dayReviewLog([], TODAY, 8).dailyDueDrawn).toBe(8);
    expect(dayReviewLog([entry(TODAY, 1)], TODAY, 8).dailyDueDrawn).toBe(18);
    expect(dayReviewLog([entry(TODAY, 1)], TODAY, 30).dailyDueDrawn).toBe(20);
  });
});

describe('planSession', () => {
  it('a Daily Review of 10 rounds when 10 or more are due', () => {
    const plan = planSession(ctxWith(25), dayReviewLog([], TODAY), 'daily', ROUND_INPUT);
    expect(plan?.kind).toBe('daily');
    expect(plan?.rounds).toHaveLength(DAILY_REVIEW_SIZE);
    expect(plan?.soundNotice).toBe(false);
  });

  it('the 20-due cap: after 20 drawn, a Daily Review asks no due item and fills nothing (Keep going is offered)', () => {
    expect(planSession(ctxWith(25), { dailyDueDrawn: 20, keepGoingRounds: 0 }, 'daily', ROUND_INPUT)).toBeNull();
    const capped = planSession(ctxWith(25), { dailyDueDrawn: 15, keepGoingRounds: 0 }, 'daily', ROUND_INPUT);
    expect(capped?.rounds).toHaveLength(5);
  });

  it('ends early: with 4 due and nothing held to stretch, 4 rounds', () => {
    const ctx = ctxWith(4);
    const states = Object.fromEntries(Object.entries(ctx.states).filter(([, r]) => r?.st.d === TODAY));
    expect(planSession({ ...ctx, states }, dayReviewLog([], TODAY), 'daily', ROUND_INPUT)?.rounds).toHaveLength(4);
  });

  it('nothing due and nothing to stretch: null ("All refreshed today")', () => {
    const ctx = ctxWith(0);
    expect(planSession({ ...ctx, states: {} }, dayReviewLog([], TODAY), 'daily', ROUND_INPUT)).toBeNull();
  });

  it('Keep going: 10 more due items, null past the third of the day or with nothing due', () => {
    const ctx = ctxWith(25);
    expect(planSession(ctx, { dailyDueDrawn: 10, keepGoingRounds: 0 }, 'keep-going', ROUND_INPUT)?.rounds).toHaveLength(KEEP_GOING_SIZE);
    expect(planSession(ctx, { dailyDueDrawn: 10, keepGoingRounds: 3 }, 'keep-going', ROUND_INPUT)).toBeNull();
    expect(planSession(ctxWith(0), { dailyDueDrawn: 10, keepGoingRounds: 0 }, 'keep-going', ROUND_INPUT)).toBeNull();
  });

  it('an item that cannot be played is skipped and its slot goes to the next due item', () => {
    // A lone syllable block has nothing to be picked against: unplayable.
    const block = mk('syl:ga', { formats: ['read-pick'] });
    const ctx = ctxWith(12, {}, [block]);
    ctx.states = { ...ctx.states, 'syl:ga': { st: st({ d: '2026-10-01' }) } };
    const plan = planSession(ctx, dayReviewLog([], TODAY), 'daily', ROUND_INPUT);
    expect(plan?.rounds).toHaveLength(DAILY_REVIEW_SIZE);
    expect(plan?.rounds.map((r) => r.question.itemId)).not.toContain('syl:ga');
  });

  it('fewer than 3 playable rounds where the engine offered more is the "nothing is waiting" page', () => {
    expect(MIN_PLAYABLE_ROUNDS).toBe(3);
    const blocks = ['syl:ga', 'syl:na', 'syl:da'].map((id) => mk(id, { formats: ['read-pick'], ko: id, romanization: 'same', en: undefined }));
    const words = [mk('lex:solo', { formats: ['read-pick'] }), mk('lex:solo2', { formats: ['read-pick'] })];
    const items = [...blocks, ...words];
    const index = surfaceIndex({ items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() });
    const states = Object.fromEntries(items.map((i) => [i.id, { st: st() }]));
    // The three blocks share one sound: no option can stand beside them; the two words can be played.
    expect(planSession({ index, states, today: TODAY, voice: true, seed: 's' }, dayReviewLog([], TODAY), 'daily', ROUND_INPUT)).toBeNull();
  });

  it('no device voice: recognize is asked at read and the sound notice shows', () => {
    const ctx = ctxWith(12, { voice: false });
    const plan = planSession(ctx, dayReviewLog([], TODAY), 'daily', ROUND_INPUT);
    expect(plan?.rounds.some((r) => r.type === 'pick' && r.heard)).toBe(false);
    expect(plan?.soundNotice).toBe(true);
  });
});

describe('Home summary and the review-first suggestion (section 4.3)', () => {
  it('counts the due pool, says whether it was done today, and suggests review first above 30', () => {
    expect(dailyReviewSummary(ctxWith(5), [])).toEqual({ due: 5, done: false, reviewFirst: false });
    expect(dailyReviewSummary(ctxWith(31), [entry(TODAY, 1)])).toEqual({ due: 31, done: true, reviewFirst: true });
    expect(dailyReviewSummary(ctxWith(30), []).reviewFirst).toBe(false);
  });
});

describe('answers, credits and the result', () => {
  const plan = planSession(ctxWith(12), dayReviewLog([], TODAY), 'daily', ROUND_INPUT);
  const rounds = plan?.rounds as ReviewRound[];

  it('records each first answer at its round rung, hinted only when it was', () => {
    const r = rounds[0] as ReviewRound;
    expect(memoryAnswerOf(r, { correct: true })).toEqual({ itemId: r.question.itemId, rung: r.question.rung, correct: true });
    expect(memoryAnswerOf(r, { correct: true, hinted: true })).toMatchObject({ hinted: true });
  });

  it('credits the due words inside a right sentence once, never one the session asks itself', () => {
    const word = mk('lex:sagwa', { ko: '사과' });
    const other = mk('lex:bap', { ko: '밥' });
    const sentence = mk('pat:sagwa-juseyo', { ko: '사과 주세요.' });
    const both = mk('pat:bap-sagwa', { ko: '밥 사과 주세요.' });
    const items = [word, other, sentence, both];
    const index = surfaceIndex({ items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() });
    const ctx: EngineContext = { index, states: Object.fromEntries(items.map((i) => [i.id, { st: st() }])), today: TODAY, voice: true, seed: 's' };
    const round = (itemId: string): ReviewRound => ({ type: 'type', question: { itemId, kind: 'pat', rung: 'read', format: 'read-pick', theme: 'life', stretch: false, voiceFallback: false }, mode: 'see', target: '', answer: { ko: { ko: '', romanization: '' } } });
    const credited = new Set<string>();
    expect(answersToRecord(ctx, round('pat:sagwa-juseyo'), { correct: true }, new Set(['pat:sagwa-juseyo']), credited).map((a) => a.itemId)).toEqual(['pat:sagwa-juseyo', 'lex:sagwa']);
    // 사과 was credited: not again; 밥 is asked by the session itself: not credited.
    expect(answersToRecord(ctx, round('pat:bap-sagwa'), { correct: true }, new Set(['pat:bap-sagwa', 'lex:bap']), credited).map((a) => a.itemId)).toEqual(['pat:bap-sagwa']);
    expect(answersToRecord(ctx, round('pat:sagwa-juseyo'), { correct: false }, new Set(), new Set()).map((a) => a.itemId)).toEqual(['pat:sagwa-juseyo']);
  });

  it('stars by F-RVW-001 section 3.1 over the rounds answered; a hinted answer is not right; never 0', () => {
    const answers = (pattern: readonly (RoundAnswer | undefined)[]): Map<number, RoundAnswer> => new Map(pattern.flatMap((a, i) => (a ? [[i, a] as const] : [])));
    const right = { correct: true };
    const miss = { correct: false };
    expect(sessionResult(rounds, answers(Array(10).fill(right))).stars).toBe(3);
    expect(sessionResult(rounds, answers([...Array(5).fill(right), ...Array(5).fill(miss)])).stars).toBe(2);
    expect(sessionResult(rounds, answers(Array(10).fill(miss))).stars).toBe(1);
    expect(sessionResult(rounds, new Map()).stars).toBe(1);
    const hinted = sessionResult(rounds, answers([{ correct: true, hinted: true }, right, miss]));
    expect(hinted.itemIds).toHaveLength(3);
    expect(hinted.missedItemIds).toEqual([rounds[0]?.question.itemId, rounds[2]?.question.itemId]);
    expect(hinted.stars).toBe(1);
  });

  it('"N got stronger" counts the items whose best box rose, each once', () => {
    const before = { a: { st: st({ s: 1 }) }, b: { st: st({ s: 3 }) }, c: { st: st({ s: 2 }) } };
    const after = { a: { st: st({ s: 2 }) }, b: { st: st({ s: 3, b: 4 }) }, c: { st: st({ s: 3 }) }, d: { st: st({ s: 1 }) } };
    expect(strongerCount(before, after, ['a', 'a', 'b', 'c', 'd', 'zz'])).toBe(3);
    expect(strongerCount(before, before, ['a', 'b'])).toBe(0);
  });

  it('the entry is a plain daily entry on the local day, readable by the snapshot schema', () => {
    const e = dailyEntry({ result: { stars: 2, itemIds: ['lex:a', 'lex:b'], missedItemIds: ['lex:b'] }, day: TODAY, now: new Date('2026-11-10T20:00:00.000Z'), nonce: 'k7f3' });
    expect(e).toEqual({ id: `daily:${TODAY}:k7f3`, kind: 'daily', generatedAt: '2026-11-10T20:00:00.000Z', scope: TODAY, itemIds: ['lex:a', 'lex:b'], resultStars: 2, missedItemIds: ['lex:b'] });
  });

  it('one headline word per star tier', () => {
    expect([headlineKey(3), headlineKey(2), headlineKey(1)]).toEqual(['three', 'two', 'one']);
  });
});

describe('after a session (keep-going.md A, D1, D2, E)', () => {
  it('offer while items are due and fewer than 3 Keep goings were played; empty wins; enough after the third', () => {
    expect(afterSession(ctxWith(5), { dailyDueDrawn: 10, keepGoingRounds: 0 })).toBe('offer');
    expect(afterSession(ctxWith(5), { dailyDueDrawn: 10, keepGoingRounds: 2 })).toBe('offer');
    expect(afterSession(ctxWith(5), { dailyDueDrawn: 10, keepGoingRounds: 3 })).toBe('enough');
    expect(afterSession(ctxWith(0), { dailyDueDrawn: 10, keepGoingRounds: 3 })).toBe('empty');
  });
});

describe('telemetry (section 11.3) and copy rules (section 4.5, 7.7)', () => {
  it('review.start and review.complete with kind daily, stars only', () => {
    expect(TELEMETRY_EVENT_NAMES).toEqual(expect.arrayContaining(['review.start', 'review.complete']));
    expect(dailyReviewStartEvent('profile:a')).toEqual({ name: 'review.start', profileId: 'profile:a', payload: { kind: 'daily' } });
    expect(dailyReviewCompleteEvent('profile:a', 2)).toEqual({ name: 'review.complete', profileId: 'profile:a', payload: { kind: 'daily', stars: 2 } });
    expect(Object.keys(CURR_TELEMETRY_PAYLOADS)).not.toContain('review.start');
  });

  it('the Daily Review and Keep going strings pass review-copy in en, es and ko (section 9.3)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale);
      expect(lintReviewMessages(m.learner, ['dailyReview', 'keepGoing'], locale), locale).toEqual([]);
      const others = [m.learner.home.mission.dailyReview.title, m.learner.home.mission.subtitle.dailyReview, m.a11y.dailyReview.close, m.a11y.dailyReview.round(4), m.a11y.dailyReview.stars(3)];
      for (const text of others) expect([...reviewScoreProblems(text), ...localeCopyProblems(text, locale)], `${locale}: ${text}`).toEqual([]);
    }
  });
});
