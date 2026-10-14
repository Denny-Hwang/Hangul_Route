import { readFileSync } from 'node:fs';
import { LessonCellSchema, discoverItemTexts, scopeRoundCount, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-001 row S7-1, Write Your Name (`content/episodes/stage-7/letters.json`): the content
 * checks of sections 3.1, 3.7 and 3.9 for this cell (the Stage 7 shape, timing, rule 4, U-3 new
 * items, U-6 reuse, the name round and its sound table, the sourced language notes), until the
 * shared checks of upper-stage-curriculum.test.ts cover Stage 7.
 */

const cell = LessonCellSchema.parse(
  JSON.parse(readFileSync(new URL('../../../../../content/episodes/stage-7/letters.json', import.meta.url), 'utf8')),
);

/** The words (어절) a line is made of, without sentence marks and without frame slots. */
const words = (ko: string): string[] =>
  ko
    .replace(/[.?!,]/g, '')
    .split(/\s+/)
    .filter((w) => w !== '' && !w.includes('___'));

/** Taught before this cell: Stage 3 First Sentences (이건, 한글, 책, 가방, 연필, 저는, 호야) and Stage 4 Read Along. */
const KNOWN = new Set(['이건', '한글', '책', '가방', '연필', '저는', '호야', '친구']);
/** Particles and copula endings a taught word may carry (Stage 3 patterns). */
const ENDINGS = ['', '이', '가', '은', '는', '이에요', '예요'];
const taughtIn = (set: ReadonlySet<string>, w: string): boolean =>
  ENDINGS.some((e) => w.endsWith(e) && set.has(w.slice(0, w.length - e.length)));

const discoverWords = (quest: LessonQuest): string[] =>
  quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => discoverItemTexts(i).flatMap((t) => words(t.ko)))) ?? []);

/** Every Korean word a scope shows (a particle choice is a particle, not a word). */
function scopeLines(scope: LessonScope): string[] {
  switch (scope.kind) {
    case 'trace-word':
      return scope.rounds.map((r) => r.word.ko);
    case 'type-hangul':
      return scope.rounds.map((r) => r.target.ko);
    case 'order-it':
      return scope.rounds.flatMap((r) => [r.sentence.ko, ...r.distractors.map((d) => d.ko)]);
    case 'write-frame':
      return scope.rounds.flatMap((r) => [r.frame.ko, ...r.slots.flatMap((s) => s.bank.map((b) => b.ko))]);
    default:
      return [];
  }
}

const q3 = cell.quests[2]!;
const nameScope = q3.scopes.find((s) => s.kind === 'write-frame');

describe('Write Your Name (F-CURR-001 S7-1)', () => {
  it('is the letters cell of Stage 7, three quests, no cards, ready with both MAR review sign-offs', () => {
    expect(cell.id).toBe('episode:stage7-letters');
    expect(cell.titleEn).toBe('Write Your Name');
    expect(cell.status).toBe('ready');
    expect(cell.review).toMatchObject({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage7-letters-q1', 'quest:stage7-letters-q2', 'quest:stage7-letters-q3']);
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
  });

  it('Stage 7 shape: writing games (Trace a Word, Type Hangul, Sentence Builder, Write Frame) and a two-round Sentence Builder Check', () => {
    expect(cell.quests.map((q) => q.scopes.map((s) => s.kind))).toEqual([
      ['trace-word', 'type-hangul', 'order-it'],
      ['order-it', 'type-hangul', 'order-it'],
      ['trace-word', 'write-frame', 'order-it'],
    ]);
    for (const quest of cell.quests) {
      const [practice, apply, check] = quest.scopes;
      expect(scopeRoundCount(practice!), quest.id).toBe(4);
      expect([3, 4], quest.id).toContain(scopeRoundCount(apply!));
      expect(scopeRoundCount(check!), quest.id).toBe(2);
    }
  });

  it('U-5: each quest sums to 240-330 s (the Stage 7 band) and its minutes match', () => {
    for (const quest of cell.quests) {
      const seconds = quest.steps.reduce((n, s) => n + (s.durationSeconds ?? 0), 0);
      expect(seconds, quest.id).toBeGreaterThanOrEqual(240);
      expect(seconds, quest.id).toBeLessThanOrEqual(330);
      expect(Math.abs(quest.estimatedMinutes - Math.round(seconds / 60)), quest.id).toBeLessThanOrEqual(1);
    }
  });

  it('teaches the section 3.7 items: 호야, 이름, 한글; then 저는 호야예요 and 제 이름은 호야예요', () => {
    const traced = cell.quests[0]!.scopes.flatMap((s) => (s.kind === 'trace-word' ? s.rounds.map((r) => r.word.ko) : []));
    const typed1 = cell.quests[0]!.scopes.flatMap((s) => (s.kind === 'type-hangul' ? s.rounds.map((r) => r.target.ko) : []));
    expect(traced).toEqual(expect.arrayContaining(['호야', '이름', '한글']));
    expect(typed1).toEqual(expect.arrayContaining(['호야', '이름', '한글']));
    const typed2 = cell.quests[1]!.scopes.flatMap((s) => (s.kind === 'type-hangul' ? s.rounds.map((r) => r.target.ko) : []));
    expect(typed2).toEqual(expect.arrayContaining(['저는 호야예요', '제 이름은 호야예요']));
  });

  it('rule 4: every word a quest asks was shown in its Discover, an earlier Discover of the cell, or an earlier stage', () => {
    const taught = new Set(KNOWN);
    for (const quest of cell.quests) {
      for (const w of discoverWords(quest)) taught.add(w);
      for (const scope of quest.scopes) for (const ko of scopeLines(scope)) for (const w of words(ko)) expect(taughtIn(taught, w), `${scope.ref}: ${w} in ${ko}`).toBe(true);
    }
  });

  it('U-3: at most 3 new words per quest (Stage 7)', () => {
    const seen = new Set(KNOWN);
    for (const quest of cell.quests) {
      const fresh = [...new Set(discoverWords(quest))].filter((w) => !taughtIn(seen, w));
      expect(fresh.length, `${quest.id}: ${fresh.join(', ')}`).toBeLessThanOrEqual(3);
      for (const w of fresh) seen.add(w);
    }
  });

  it('U-6: at least half the Korean words outside Discover were taught before the quest', () => {
    const before = new Set(KNOWN);
    for (const quest of cell.quests) {
      const shown = new Set(quest.scopes.flatMap((s) => scopeLines(s).flatMap(words)));
      const reused = [...shown].filter((w) => taughtIn(before, w));
      expect(reused.length * 2, `${quest.id}: ${reused.length} of ${shown.size}`).toBeGreaterThanOrEqual(shown.size);
      for (const w of discoverWords(quest)) before.add(w);
    }
  });

  it('no speaking: no voice-echo step, and no learner line asks the learner to say anything aloud', () => {
    for (const quest of cell.quests) {
      expect(quest.steps.some((s) => s.minigameKind === 'voice-echo')).toBe(false);
      const english = [quest.titleEn, quest.blurbEn ?? '', ...quest.steps.flatMap((s) => [s.titleEn, s.hoyaLineEn ?? '', ...(s.discover?.pages.map((p) => p.captionEn ?? '') ?? [])])];
      for (const text of english) expect(text, quest.id).not.toMatch(/\b(say|speak|aloud|record)\b/i);
    }
  });

  it('q3: the one free-entry name round, last in its Write Frame step, unscored, with no word bank', () => {
    expect(nameScope?.kind).toBe('write-frame');
    if (nameScope?.kind !== 'write-frame') return;
    const free = nameScope.rounds.filter((r) => r.freeEntry);
    expect(free).toHaveLength(1);
    expect(nameScope.rounds.at(-1)?.freeEntry).toBe(true);
    expect(free[0]!.slots).toEqual([{ id: 'name', bank: [] }]);
    expect(free[0]!.frame.ko).toBe('제 이름은 ___이에요/예요.');
    // No other scope of the cell is a free-entry round.
    const others = cell.quests.flatMap((q) => q.scopes).filter((s) => s !== nameScope);
    expect(others.some((s) => s.kind === 'write-frame' && s.rounds.some((r) => r.freeEntry))).toBe(false);
    expect(q3.steps.find((s) => s.kind === 'intro')?.hoyaLineEn).toMatch(/no wrong way to write your name/);
  });

  it('the sound table: whole blocks by sound, the cast name 호야 can be built, and the finals are the seven loanword finals', () => {
    if (nameScope?.kind !== 'write-frame') throw new Error('no name round');
    const table = nameScope.rounds.at(-1)!.soundTable!;
    const blocks = table.groups.flat().map((t) => t.ko);
    expect(blocks).toEqual(expect.arrayContaining(['호', '야']));
    // Pass 4: a row for every simple vowel, so names from other languages build on the Blocks tab
    // (스, 트 and 크 for clusters and final consonants, 터 and 퍼, 샘 and 잭 from 새 and 재, 제 and 베).
    expect(blocks).toEqual(expect.arrayContaining(['스', '트', '크', '르', '터', '퍼', '새', '재', '제', '베', '치', '초', '추']));
    expect(new Set(blocks).size).toBe(blocks.length);
    // Loanword spelling rules, chapter 1 article 3: finals are only ㄱ ㄴ ㄹ ㅁ ㅂ ㅅ ㅇ.
    expect(table.finals.map((t) => t.ko).sort()).toEqual(['ㄱ', 'ㄴ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'].sort());
    // Article 4: no tense consonant tiles (ㄲ ㄸ ㅃ ㅆ ㅉ) for the plosives.
    for (const ko of blocks) expect(ko.normalize('NFD'), ko).not.toMatch(/[ᄁᄄᄈᄊᄍ]/);
  });

  it('section 3.9: the loanword notes have two or more sources, one the National Institute of Korean Language, and promise no single right spelling', () => {
    expect(cell.culture.map((n) => [n.id, n.kind])).toEqual([
      ['n1', 'language'],
      ['n2', 'language'],
    ]);
    for (const note of cell.culture) {
      expect(note.sources?.length ?? 0, note.id).toBeGreaterThanOrEqual(2);
      expect(note.sources?.some((s) => new URL(s.url).hostname === 'www.korean.go.kr'), note.id).toBe(true);
      expect(note.verification.scope, note.id).toBe('lesson');
      expect(note.verification.passes, note.id).toBe(3);
      expect(note.textEn, note.id).not.toMatch(/all Koreans|every Korean|(one|the) (right|correct|only) (way|spelling)/i);
    }
    expect(cell.culture[1]!.textEn).toMatch(/more than one Hangul spelling/);
  });
});
