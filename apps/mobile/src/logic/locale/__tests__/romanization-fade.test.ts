import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content';
import { placementResult } from '../../placement/__tests__/fixtures';
import { STAGE1_QUESTS, questTeaches, symbolsMetThrough } from '../../stage1/curriculum';
import { snapshotWith } from '../../stage1/__tests__/fixtures';
import {
  FADE_ALL_FROM_EPISODE,
  FADE_READING_FROM_QUEST,
  fadeOfSnapshot,
  fadePhase,
  isDecodable,
  metSymbols,
  isStage1Quest,
  readingNoticeDue,
  type FadeInput,
  type ReadingNoticeInput,
} from '../romanization-fade';

/** The first ten Stage 1 quests teach all 30 symbols; quest 11 (nature-q2) teaches none (F-QUEST-002 section 3.6, R5). */
const FIRST_TEN = STAGE1_QUESTS.slice(0, 10).map((q) => q.id);
const FIRST_NINE = FIRST_TEN.slice(0, 9);
const QUEST_11 = FADE_READING_FROM_QUEST;
const WORD_BUILDER = episodesAll.find((e) => e.id === FADE_ALL_FROM_EPISODE)!;
const WORD_BUILDER_QUESTS = WORD_BUILDER.questIds;

function input(over: { done?: readonly string[]; placedOut?: readonly string[]; testedOut?: Record<string, string> } = {}): FadeInput {
  return { doneQuestIds: new Set(over.done ?? []), placedOutQuestIds: new Set(over.placedOut ?? []), testedOut: over.testedOut ?? {} };
}
const phaseOf = (i: FadeInput) => fadePhase(i, metSymbols(i));

describe('the content the fade is anchored on (drift guard)', () => {
  it('quest 11 is a Stage 1 quest that teaches nothing, and the quests before it teach 30 distinct symbols', () => {
    const q11 = STAGE1_QUESTS.find((q) => q.id === FADE_READING_FROM_QUEST)!;
    expect(q11).toBeDefined();
    expect(questTeaches(q11)).toEqual([]);
    const before = symbolsMetThrough(FADE_READING_FROM_QUEST);
    expect(before).toHaveLength(30);
    expect(new Set(before).size).toBe(30);
    expect(STAGE1_QUESTS.indexOf(q11)).toBe(10);
  });

  it('Word Builder is in the bundle with six required quests', () => {
    expect(WORD_BUILDER).toBeDefined();
    expect(WORD_BUILDER_QUESTS).toHaveLength(6);
  });
});

describe('metSymbols', () => {
  it('is what the finished quests teach, and nothing for no quest', () => {
    expect(metSymbols(input()).size).toBe(0);
    const two = metSymbols(input({ done: FIRST_TEN.slice(0, 2) }));
    expect(two).toEqual(new Set(symbolsMetThrough(FIRST_TEN[1]!)));
  });

  it('counts the level check\'s placed-out quests too', () => {
    expect(metSymbols(input({ placedOut: FIRST_TEN })).size).toBe(30);
    const mixed = metSymbols(input({ done: [FIRST_TEN[0]!], placedOut: [FIRST_TEN[1]!] }));
    expect(mixed).toEqual(new Set(symbolsMetThrough(FIRST_TEN[1]!)));
  });

  it('out-of-order play counts only what was met: quest 11 alone gives nothing, a later quest lights only its own', () => {
    expect(metSymbols(input({ done: [QUEST_11] })).size).toBe(0);
    const only = metSymbols(input({ done: [FIRST_TEN[5]!] }));
    expect(only).toEqual(new Set(questTeaches(STAGE1_QUESTS[5]!)));
  });

  it('takes the quest list it is given', () => {
    const [first] = STAGE1_QUESTS;
    expect(metSymbols(input({ done: [first!.id] }), [first!])).toEqual(new Set(questTeaches(first!)));
    expect(metSymbols(input({ done: [first!.id] }), []).size).toBe(0);
  });
});

describe('fadePhase (section 3.3)', () => {
  it('quests 1 to 10 done is reading; 1 to 9 is letters; quest 11 alone is letters', () => {
    expect(phaseOf(input({ done: FIRST_TEN }))).toBe('reading');
    expect(phaseOf(input({ done: FIRST_NINE }))).toBe('letters');
    expect(phaseOf(input({ done: [QUEST_11] }))).toBe('letters');
    expect(phaseOf(input())).toBe('letters');
  });

  it('quests 1 to 10 placed out is reading, and done plus placed out together is reading', () => {
    expect(phaseOf(input({ placedOut: FIRST_TEN }))).toBe('reading');
    expect(phaseOf(input({ done: FIRST_TEN.slice(0, 4), placedOut: FIRST_TEN.slice(4) }))).toBe('reading');
  });

  it('Word Builder\'s required quests done, or placed out, is all', () => {
    expect(phaseOf(input({ done: WORD_BUILDER_QUESTS }))).toBe('all');
    expect(phaseOf(input({ placedOut: WORD_BUILDER_QUESTS }))).toBe('all');
    expect(phaseOf(input({ done: WORD_BUILDER_QUESTS.slice(0, 3), placedOut: WORD_BUILDER_QUESTS.slice(3) }))).toBe('all');
  });

  it('five of its six quests is not all', () => {
    expect(phaseOf(input({ done: [...FIRST_TEN, ...WORD_BUILDER_QUESTS.slice(0, 5)] }))).toBe('reading');
  });

  it('the Word Builder test-out and the Stage Jump latch are all', () => {
    expect(phaseOf(input({ testedOut: { [FADE_ALL_FROM_EPISODE]: '2026-11-01T00:00:00Z' } }))).toBe('all');
    expect(phaseOf(input({ testedOut: { stage2: '2026-11-01T00:00:00Z' } }))).toBe('all');
    expect(phaseOf(input({ testedOut: { 'episode:other': '2026-11-01T00:00:00Z' } }))).toBe('letters');
  });

  it('Word Builder done but quests 1 to 10 not is still all', () => {
    expect(phaseOf(input({ done: WORD_BUILDER_QUESTS }))).toBe('all');
  });

  it('an unknown reading anchor never gives reading; a missing Word Builder never gives all', () => {
    const done = input({ done: FIRST_TEN });
    expect(fadePhase(done, metSymbols(done), [])).toBe('letters');
    expect(fadePhase(done, metSymbols(done), STAGE1_QUESTS.filter((q) => q.id !== FADE_READING_FROM_QUEST))).toBe('letters');
    const finished = input({ done: [...FIRST_TEN, ...WORD_BUILDER_QUESTS], testedOut: { stage2: 'x' } });
    expect(fadePhase(finished, metSymbols(finished), STAGE1_QUESTS, [])).toBe('reading');
    expect(fadePhase(finished, metSymbols(finished), STAGE1_QUESTS, episodesAll.filter((e) => e.id !== FADE_ALL_FROM_EPISODE))).toBe('reading');
  });

  it('a Word Builder with no required quest is not done by that alone', () => {
    const empty = { ...WORD_BUILDER, questIds: [] };
    expect(fadePhase(input(), new Set(), STAGE1_QUESTS, [empty])).toBe('letters');
  });
});

describe('fadeOfSnapshot', () => {
  const doneOf = (ids: readonly string[]) => snapshotWith(ids.map((questId) => ({ questId, episodeId: 'episode:x' })));

  it('reads the finished quests of a snapshot', () => {
    expect(fadeOfSnapshot(doneOf(FIRST_TEN)).phase).toBe('reading');
    expect(fadeOfSnapshot(doneOf(FIRST_NINE)).phase).toBe('letters');
    expect(fadeOfSnapshot(doneOf([...FIRST_TEN, ...WORD_BUILDER_QUESTS])).phase).toBe('all');
    expect(fadeOfSnapshot(doneOf(FIRST_TEN)).met.size).toBe(30);
  });

  it('a quest started but not finished is not done', () => {
    const snap = snapshotWith([], FIRST_TEN.map((questId) => ({ questId, episodeId: 'episode:x' })));
    expect(fadeOfSnapshot(snap).phase).toBe('letters');
  });

  it('reads the quest latch as done too, with no placements and no test-out (both absent)', () => {
    const latched = { ...doneOf([]), questDoneAt: Object.fromEntries(FIRST_TEN.map((id) => [id, '2026-11-01T00:00:00Z'])) };
    expect(latched.placements).toBeUndefined();
    expect(latched.testedOut).toBeUndefined();
    expect(fadeOfSnapshot(latched).phase).toBe('reading');
  });

  it('reads the level check\'s placed-out quests', () => {
    const snap = { ...doneOf([]), placements: [placementResult({ placedOutQuestIds: FIRST_TEN })] };
    expect(fadeOfSnapshot(snap).phase).toBe('reading');
    expect(fadeOfSnapshot(snap).met.size).toBe(30);
  });

  it('a parent override that puts quests back takes them out of the placed-out set', () => {
    const snap = {
      ...doneOf([]),
      placements: [placementResult({ placedOutQuestIds: FIRST_TEN, override: { by: 'parent', at: '2026-11-03T00:00:00Z', startQuestId: FIRST_TEN[9]! } })],
    };
    expect(fadeOfSnapshot(snap).phase).toBe('letters');
  });

  it('reads a test-out', () => {
    const snap = { ...doneOf([]), testedOut: { [FADE_ALL_FROM_EPISODE]: '2026-11-01T00:00:00Z' } };
    expect(fadeOfSnapshot(snap).phase).toBe('all');
  });

  it('returns the same object for the same snapshot, and a fresh one for another', () => {
    const snap = doneOf(FIRST_TEN);
    expect(fadeOfSnapshot(snap)).toBe(fadeOfSnapshot(snap));
    expect(fadeOfSnapshot({ ...snap })).not.toBe(fadeOfSnapshot(snap));
  });
});

describe('isDecodable (section 3.4)', () => {
  const met = new Set(symbolsMetThrough(FADE_READING_FROM_QUEST));

  it.each(['산', '강', '바다', '하늘', '김치', '김밥', '호랑이', '한글'])('%s is decodable once quests 1 to 10 are met', (word) => {
    expect(isDecodable(word, met)).toBe(true);
  });

  it.each(['까치', '떡국', '젓가락', '팽이', '세뱃돈'])('%s is not: a tense or compound letter, a final or a vowel outside the 30', (word) => {
    expect(isDecodable(word, met)).toBe(false);
  });

  it('allows white space and the marks of section 3.4 around the blocks', () => {
    expect(isDecodable('산!', met)).toBe(true);
    expect(isDecodable('산 강', met)).toBe(true);
    expect(isDecodable('"산", 강?', met)).toBe(true);
    expect(isDecodable('“산” ‘강’ (바다) ~ 하늘… · -', met)).toBe(true);
  });

  it('rejects an empty text, Latin letters, digits, an isolated letter and a text with no block', () => {
    expect(isDecodable('', met)).toBe(false);
    expect(isDecodable('san', met)).toBe(false);
    expect(isDecodable('산1', met)).toBe(false);
    expect(isDecodable('산 san', met)).toBe(false);
    expect(isDecodable('ㄱ', met)).toBe(false);
    expect(isDecodable('산ㄱ', met)).toBe(false);
    expect(isDecodable('!', met)).toBe(false);
    expect(isDecodable('  ', met)).toBe(false);
  });

  it('is decided by the letters the learner has met, not by the word', () => {
    expect(isDecodable('산', new Set())).toBe(false);
    expect(isDecodable('산', new Set(symbolsMetThrough(FIRST_TEN[0]!)))).toBe(false);
    expect(isDecodable('산', met)).toBe(true);
  });
});

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.9 (row RF-2): Hoya's reading line is due once per profile: the choice is `auto`, no
 * screen reader is in use, it has not been shown, and either every fold is on (`all`) or the learner is in `reading` on a
 * Stage 1 quest, where the reading words fold.
 */
describe('isStage1Quest (section 3.9)', () => {
  it('is true for every Stage 1 quest and false for a Word Builder quest or an unknown id', () => {
    for (const q of STAGE1_QUESTS) expect(isStage1Quest(q.id)).toBe(true);
    expect(isStage1Quest(WORD_BUILDER_QUESTS[0]!)).toBe(false);
    expect(isStage1Quest('quest:nope')).toBe(false);
  });
});

describe('readingNoticeDue (section 3.9)', () => {
  const due: ReadingNoticeInput = { choice: 'auto', phase: 'reading', screenReader: false, noticeAt: undefined, stage1Quest: true };

  it('is due in phase reading on a Stage 1 quest, and in phase all on any quest', () => {
    expect(readingNoticeDue(due)).toBe(true);
    expect(readingNoticeDue({ ...due, phase: 'all', stage1Quest: true })).toBe(true);
    expect(readingNoticeDue({ ...due, phase: 'all', stage1Quest: false })).toBe(true);
  });

  it.each([
    ['the choice is Always', { choice: 'always' as const }],
    ['the choice is Only when I tap', { choice: 'tap' as const }],
    ['a screen reader is in use', { screenReader: true }],
    ['it was shown already', { noticeAt: '2026-11-26T08:00:00.000Z' }],
    ['the phase is letters', { phase: 'letters' as const }],
    ['the phase is reading on a quest that is not Stage 1 (nothing folds there)', { stage1Quest: false }],
    ['the phase is letters on a quest that is not Stage 1', { phase: 'letters' as const, stage1Quest: false }],
  ])('is not due when %s', (_, over) => {
    expect(readingNoticeDue({ ...due, ...over })).toBe(false);
  });
});
