import type { MemoryItemState } from '@hangul-route/content-schema';
import { ReviewEntrySchema } from '@hangul-route/content-schema';
import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import { buildLookup } from '../../memory/resolve';
import { WARMUP_SIZE, type EngineContext, type EngineRow, type ReviewQuestion } from '../engine';
import { stageNumber, tryAgainOffered, warmupOffered } from '../quest-review-gate';
import { ENTRY_KIND, entryDayOf, firstTryAnswer, reviewCompleteEvent, reviewStartEvent, sessionEntry, tryAgainStars } from '../quest-review-session';
import { PICK_OPTIONS, missedItemIds, pickRound, planTryAgain, planWarmup, type GlossOf } from '../quest-reviews';

/**
 * F-CURR-002 section 4.5 (row CM-15): the quest warm-up and Try these again. Who gets them, what they ask (quick
 * pick rounds at recognize or read, from the engine's builders), and what they leave behind (answers for the
 * memory store, one `reviews[]` entry a day, stars only for Try these again, `review.start` / `review.complete`).
 */

const TODAY = '2026-11-10';

const FORMATS: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'],
  syl: ['hear-pick', 'read-pick', 'syllable-build'],
  lex: ['hear-pick', 'read-pick', 'type-see', 'syllable-build'],
  pat: ['hear-pick', 'read-pick', 'cloze-pick', 'sentence-builder'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  rea: ['read-pick', 'cloze-pick'],
};

function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return {
    id,
    kind,
    ko: id.slice(4),
    romanization: `r-${id.slice(4)}`,
    en: `en-${id.slice(4)}`,
    home: 'life',
    stage: 2,
    volume: 1,
    cells: ['episode:stage2-life'],
    asked: [],
    formats: [...FORMATS[kind]],
    soundChange: false,
    homophoneOf: [],
    ...(kind === 'exc' ? { reply: { ko: `re-${id.slice(4)}`, romanization: `rr-${id.slice(4)}` } } : {}),
    ...over,
  };
}

const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 1, d: TODAY, c: 0, r: 0, n: 1, f: '2026-11-01', s: 1, at: '2026-11-09T09:00:00.000Z', ...over });

function ctxOf(items: readonly ReviewItem[], states: Record<string, EngineRow>, over: Partial<EngineContext> = {}): EngineContext {
  return { index: { items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() }, states, today: TODAY, voice: true, seed: 's', ...over };
}

const english: GlossOf = (item) => item.en;
const q = (itemId: string, rung: ReviewQuestion['rung'], over: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  itemId,
  kind: itemId.slice(0, 3) as ReviewItemKind,
  rung,
  format: rung === 'recognize' ? 'hear-pick' : 'read-pick',
  theme: 'life',
  stretch: false,
  voiceFallback: false,
  ...over,
});

describe('who gets them (section 12.2: off hides the surface)', () => {
  it('the warm-up opens a Stage 2+ quest from its first step, with questWarmup on and answers recorded', () => {
    const on = { flagOn: true, records: true, stage: 2, startStep: 0 };
    expect(warmupOffered(on)).toBe(true);
    expect(warmupOffered({ ...on, stage: 7 })).toBe(true);
    expect(warmupOffered({ ...on, stage: 1 })).toBe(false);
    expect(warmupOffered({ ...on, startStep: 2 })).toBe(false);
    expect(warmupOffered({ ...on, flagOn: false })).toBe(false);
    expect(warmupOffered({ ...on, records: false })).toBe(false);
  });

  it('Try these again is offered only with misses, missedPractice on and answers recorded', () => {
    expect(tryAgainOffered({ flagOn: true, records: true, misses: 1 })).toBe(true);
    expect(tryAgainOffered({ flagOn: true, records: true, misses: 0 })).toBe(false);
    expect(tryAgainOffered({ flagOn: false, records: true, misses: 3 })).toBe(false);
    expect(tryAgainOffered({ flagOn: true, records: false, misses: 3 })).toBe(false);
  });

  it('reads the stage number of an episode', () => {
    expect(stageNumber('stage2')).toBe(2);
    expect(stageNumber('stage1')).toBe(1);
    expect(stageNumber(undefined)).toBe(0);
    expect(stageNumber('pack')).toBe(0);
  });
});

describe('the warm-up', () => {
  const quest = { cell: 'episode:stage3-life', stage: 3 };
  const earlier = ['lex:a', 'lex:b', 'lex:c', 'lex:d', 'lex:e'].map((id) => mk(id, { cells: ['episode:stage2-rites'], home: 'rites' }));
  const own = mk('lex:own', { cells: ['episode:stage3-life'] });

  it('asks up to 3 due items from earlier cells, never the quest’s own, at recognize or read', () => {
    const items = [own, ...earlier];
    const states = Object.fromEntries(items.map((i) => [i.id, { st: st({ b: 4, s: 4, c: 2, r: 3 }) }]));
    const warm = planWarmup(ctxOf(items, states), quest, english);
    expect(warm.kind).toBe('warmup');
    expect(warm.rounds).toHaveLength(WARMUP_SIZE);
    expect(warm.rounds.every((r) => r.itemId !== 'lex:own')).toBe(true);
    // The ladder would ask these held items at produce; the quick warm-up asks them at read.
    expect(warm.rounds.every((r) => r.rung === 'read' && r.mode === 'see')).toBe(true);
    expect(warm.ctx.maxRung).toBe('read');
  });

  it('is empty, so skipped, when nothing from an earlier cell is due, and before Stage 2', () => {
    const notDue = Object.fromEntries(earlier.map((i) => [i.id, { st: st({ d: '2026-11-20' }) }]));
    expect(planWarmup(ctxOf([own, ...earlier], { ...notDue, 'lex:own': { st: st() } }), quest, english).rounds).toEqual([]);
    const due = Object.fromEntries(earlier.map((i) => [i.id, { st: st() }]));
    expect(planWarmup(ctxOf(earlier, due), { cell: 'episode:stage1-life', stage: 1 }, english).rounds).toEqual([]);
  });

  it('without a device voice asks everything at read and shows the sound notice', () => {
    const due = Object.fromEntries(earlier.map((i) => [i.id, { st: st() }]));
    const warm = planWarmup(ctxOf(earlier, due, { voice: false }), quest, english);
    expect(warm.rounds.length).toBeGreaterThan(0);
    expect(warm.rounds.every((r) => r.mode === 'see')).toBe(true);
    expect(warm.soundNotice).toBe(true);
  });
});

describe('Try these again', () => {
  it('asks the misses of the play, in the order missed, each once', () => {
    const items = ['lex:a', 'lex:b', 'lex:c', 'lex:d'].map((id) => mk(id));
    const states = Object.fromEntries(items.map((i) => [i.id, { st: st({ d: '2026-11-11' }), l: TODAY }]));
    const again = planTryAgain(ctxOf(items, states), ['lex:c', 'lex:a', 'lex:c'], english);
    expect(again.kind).toBe('again');
    expect(again.rounds.map((r) => r.itemId)).toEqual(['lex:c', 'lex:a']);
    expect(planTryAgain(ctxOf(items, states), [], english).rounds).toEqual([]);
  });

  it('reads the misses of a play from what its rounds asked, as the memory store does', () => {
    const items = [mk('lex:사과', { ko: '사과' }), mk('lex:배', { ko: '배' }), mk('sym:g', { ko: 'ㄱ' })];
    const lookup = buildLookup(items, new Set());
    const missed = missedItemIds(lookup, 'episode:stage2-life', [{ texts: ['배'], rung: 'read' }, { jamoIds: ['jamo:g'], rung: 'recognize' }, { texts: ['배'] }, { texts: ['없음'] }]);
    expect(missed).toEqual(['lex:배', 'sym:g']);
  });

  it('gives stars only, 1 to 3, never 0', () => {
    const a = (correct: boolean) => ({ itemId: 'lex:a', correct, rung: 'read' as const });
    expect(tryAgainStars([a(true), a(true)])).toBe(3);
    expect(tryAgainStars([a(true), a(false)])).toBe(2);
    expect(tryAgainStars([a(false), a(false)])).toBe(1);
    expect(tryAgainStars([])).toBe(1);
  });
});

describe('pick rounds', () => {
  const words = ['lex:mul', 'lex:bap', 'lex:cha', 'lex:kong'].map((id) => mk(id));
  const ctx = ctxOf(words, Object.fromEntries(words.map((w) => [w.id, { st: st() }])));

  it('hear it and pick it: the answer and two other words, three options, the Korean not shown', () => {
    const round = pickRound(q('lex:mul', 'recognize'), 0, 'warmup', ctx, english, 's');
    expect(round).toMatchObject({ key: 'warmup:0:lex:mul', mode: 'hear', instruction: 'hearPick', showRomanization: false, answerId: 'lex:mul' });
    expect(round?.options).toHaveLength(PICK_OPTIONS);
    expect(round?.options.map((o) => o.id)).toContain('lex:mul');
    expect(round?.options.every((o) => o.ko !== undefined && o.romanization !== undefined)).toBe(true);
  });

  it('a heard round never offers a word that sounds the same, and an item with a homophone shows its cue', () => {
    const nat = mk('lex:낫', { ko: '낫', homophoneOf: ['lex:낮'], en: 'sickle' });
    const nat2 = mk('lex:낮', { ko: '낮', homophoneOf: ['lex:낫'], en: 'daytime' });
    const items = [nat, nat2, ...words];
    const round = pickRound(q('lex:낫', 'recognize', { cue: 'gloss' }), 0, 'warmup', ctxOf(items, {}), english, 's');
    expect(round?.options.map((o) => o.id)).not.toContain('lex:낮');
    expect(round?.cue).toEqual({ gloss: 'sickle' });
  });

  it('see a symbol or a block and pick its sound: romanization options, none under the prompt', () => {
    const syms = ['sym:g', 'sym:n', 'sym:d'].map((id) => mk(id, { en: undefined }));
    const round = pickRound(q('sym:g', 'read'), 1, 'again', ctxOf(syms, {}), english, 's');
    expect(round).toMatchObject({ mode: 'see', instruction: 'seeSound', showRomanization: false, key: 'again:1:sym:g' });
    expect(round?.options.map((o) => o.label).sort()).toEqual(['r-d', 'r-g', 'r-n']);
  });

  it('a symbol the ladder would ask by ear is read instead (the voice cannot say a letter sound alone), and recorded at read', () => {
    const syms = ['sym:g', 'sym:n', 'sym:d'].map((id) => mk(id, { en: undefined }));
    const round = pickRound(q('sym:g', 'recognize'), 0, 'warmup', ctxOf(syms, {}), english, 's');
    expect(round).toMatchObject({ mode: 'see', instruction: 'seeSound', rung: 'read' });
    expect(firstTryAnswer(round!, 'sym:g').rung).toBe('read');
  });

  it('see a word with a picture and pick the picture; without pictures, pick its meaning in the UI language', () => {
    const pictured = ['lex:mul', 'lex:bap', 'lex:cha'].map((id) => mk(id, { picture: `word:${id.slice(4)}` }));
    const round = pickRound(q('lex:mul', 'read'), 0, 'warmup', ctxOf(pictured, {}), english, 's');
    expect(round?.instruction).toBe('seePicture');
    expect(round?.options.every((o) => o.pictureRef?.startsWith('word:') && o.label?.startsWith('en-'))).toBe(true);
    const spanish: GlossOf = (item) => (item.id === 'lex:kong' ? undefined : `es-${item.ko}`);
    const meaning = pickRound(q('lex:mul', 'read'), 0, 'warmup', ctx, spanish, 's');
    expect(meaning).toMatchObject({ instruction: 'seeMeaning', showRomanization: true });
    // The others need a meaning in the UI language of their own; lex:kong has none here.
    expect(meaning?.options.map((o) => o.label).sort()).toEqual(['es-bap', 'es-cha', 'es-mul']);
  });

  it('an exchange is heard or read and answered with its reply; a realia card and an item with too few others are left out', () => {
    const lines = ['exc:hi', 'exc:bye', 'exc:thanks'].map((id) => mk(id));
    const heard = pickRound(q('exc:hi', 'recognize'), 0, 'warmup', ctxOf(lines, {}), english, 's');
    expect(heard).toMatchObject({ instruction: 'hearReply', ko: 'hi' });
    expect(heard?.options.map((o) => o.ko).sort()).toEqual(['re-bye', 're-hi', 're-thanks']);
    expect(pickRound(q('exc:hi', 'read'), 0, 'warmup', ctxOf(lines, {}), english, 's')?.instruction).toBe('seeReply');
    expect(pickRound(q('rea:price', 'read'), 0, 'warmup', ctxOf([mk('rea:price'), mk('rea:time'), mk('rea:day')], {}), english, 's')).toBeNull();
    expect(pickRound(q('lex:mul', 'read'), 0, 'warmup', ctxOf(words.slice(0, 2), {}), english, 's')).toBeNull();
    expect(pickRound(q('lex:mul', 'produce'), 0, 'warmup', ctx, english, 's')).toBeNull();
  });

  it('is the same plan for the same seed', () => {
    expect(pickRound(q('lex:mul', 'recognize'), 0, 'warmup', ctx, english, 's')).toEqual(pickRound(q('lex:mul', 'recognize'), 0, 'warmup', ctx, english, 's'));
  });
});

describe('what a session leaves behind', () => {
  const round = { key: 'again:0:lex:a', itemId: 'lex:a', rung: 'read' as const, instruction: 'seeMeaning' as const, mode: 'see' as const, ko: 'a', romanization: 'a', showRomanization: true, options: [], answerId: 'lex:a' };

  it('the first tap is the answer the memory store records, at the rung asked', () => {
    expect(firstTryAnswer(round, 'lex:a')).toEqual({ itemId: 'lex:a', correct: true, rung: 'read' });
    expect(firstTryAnswer(round, 'lex:b')).toEqual({ itemId: 'lex:a', correct: false, rung: 'read' });
  });

  it('one entry a kind and local day: the warm-up without stars, Try these again as `feedback` with stars and its misses', () => {
    const at = new Date('2026-11-10T09:30:00.000Z');
    const answers = [
      { itemId: 'lex:a', correct: true, rung: 'read' as const },
      { itemId: 'lex:b', correct: false, rung: 'recognize' as const },
    ];
    const warm = sessionEntry('warmup', TODAY, answers, at);
    expect(warm).toEqual({ id: 'warmup:2026-11-10', kind: 'warmup', generatedAt: '2026-11-10T09:30:00.000Z', scope: TODAY, itemIds: ['lex:a', 'lex:b'] });
    const again = sessionEntry('again', TODAY, answers, at);
    expect(again).toMatchObject({ id: 'feedback:2026-11-10', kind: 'feedback', resultStars: 2, missedItemIds: ['lex:b'] });
    expect(ReviewEntrySchema.safeParse(warm).success && ReviewEntrySchema.safeParse(again).success).toBe(true);
    expect(sessionEntry('warmup', TODAY, [], at)).toBeNull();
    expect(ENTRY_KIND).toEqual({ warmup: 'warmup', again: 'feedback' });
  });

  it('review.start and review.complete carry the kind and counts, never an item or a text', () => {
    const answers = [{ itemId: 'lex:a', correct: true, rung: 'read' as const }];
    expect(reviewStartEvent('profile:a', 'warmup', 3)).toEqual({ name: 'review.start', profileId: 'profile:a', payload: { kind: 'warmup', items: 3 } });
    expect(reviewCompleteEvent('profile:a', 'warmup', answers, 0)).toEqual({ name: 'review.complete', profileId: 'profile:a', payload: { kind: 'warmup', items: 1, retries: 0 } });
    expect(reviewCompleteEvent('profile:a', 'again', answers, 2)).toEqual({ name: 'review.complete', profileId: 'profile:a', payload: { kind: 'feedback', items: 1, retries: 2, stars: 3 } });
  });
});

describe('the day a session entry is written under (section 13, wrong device clock)', () => {
  it('is today, but never later than the latest local day of the last server time seen or the day after the newest entry of its kind', () => {
    // No server time seen: today as the device says.
    expect(entryDayOf('warmup', '2031-01-01', [], null)).toBe('2031-01-01');
    // A clock set years ahead is held to the day after the last server time (UTC 10-22, so 10-23 somewhere).
    expect(entryDayOf('warmup', '2031-01-01', [], '2026-10-22T09:00:00.000Z')).toBe('2026-10-23');
    // A right clock is never moved.
    expect(entryDayOf('again', '2026-10-22', [], '2026-10-22T09:00:00.000Z')).toBe('2026-10-22');
    // Offline for days: each day's entry may be one day past the newest of its kind, so the days still advance.
    const reviews = [{ kind: 'feedback' as const, scope: '2026-10-25' }, { kind: 'warmup' as const, scope: '2026-10-27' }];
    expect(entryDayOf('again', '2026-10-26', reviews, '2026-10-22T09:00:00.000Z')).toBe('2026-10-26');
    expect(entryDayOf('again', '2026-10-30', reviews, '2026-10-22T09:00:00.000Z')).toBe('2026-10-26');
    // A day of its kind after today (from that clock) never extends the bound.
    expect(entryDayOf('warmup', '2026-10-24', [{ kind: 'warmup', scope: '2031-01-01' }], '2026-10-22T09:00:00.000Z')).toBe('2026-10-23');
  });
});
