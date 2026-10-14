import { readdirSync, readFileSync } from 'node:fs';
import { LessonCellSchema, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { WORD_ART_KEYS } from '@hangul-route/design-system/word-art';
import { describe, expect, it } from 'vitest';
import { stage1Quests } from '../quests';

/**
 * F-CURR-001 row S2-3, Playground Words (`content/episodes/stage-2/crafts.json`): the
 * content checks of section 3.1 and 3.3 for this cell, until the shared U-3 / U-4 / U-6
 * checks of upper-stage-curriculum.test.ts land.
 */

const cell = LessonCellSchema.parse(
  JSON.parse(readFileSync(new URL('../../../../../content/episodes/stage-2/crafts.json', import.meta.url), 'utf8')),
);

/** Stage 1's 30 symbols (F-QUEST-002): 14 consonants, 10 vowels, 6 finals. */
const STAGE1_INITIALS = new Set([...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ']);
const STAGE1_VOWELS = new Set([...'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ']);
const STAGE1_FINALS = new Set([...'ㄱㄴㄹㅁㅂㅇ']);
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** True when every syllable of `ko` is built from Stage 1 symbols only (section 3.1 rule 6). */
export function decodableAtStage1(ko: string): boolean {
  return [...ko.replace(/[\s.?!,]/g, '')].every((ch) => {
    const code = ch.codePointAt(0)! - 0xac00;
    if (code < 0 || code > 11171) return false;
    const final = FINALS[code % 28]!;
    return (
      STAGE1_INITIALS.has(INITIALS[Math.floor(code / 588)]!) &&
      STAGE1_VOWELS.has(VOWELS[Math.floor((code % 588) / 28)]!) &&
      (final === '' || STAGE1_FINALS.has(final))
    );
  });
}

const VOCAB_DIR = new URL('../../../../../content/vocab/', import.meta.url);

/** The words of the level 1-2 vocabulary topics (`content/vocab/*.json`). */
const VOCAB_L2 = readdirSync(VOCAB_DIR)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .flatMap((f) => (JSON.parse(readFileSync(new URL(f, VOCAB_DIR), 'utf8')) as { items: { ko: string; level: number }[] }).items)
  .filter((item) => item.level <= 2)
  .map((item) => item.ko);

/** The words Stage 1's Discover steps teach. */
const STAGE1_DISCOVER = stage1Quests.flatMap((q) =>
  q.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => (i.type === 'word' ? [i.word.ko] : []))) ?? []),
);

/**
 * Words Stage 1 or a level 1-2 vocabulary topic already taught (section 3.1 rule 5), derived
 * from the files, so a word counts as reused only when one of them really teaches it.
 */
const REUSED = new Set([...STAGE1_DISCOVER, ...VOCAB_L2]);

const discoverWords = (quest: LessonQuest): string[] =>
  quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => (i.type === 'word' ? [i.word.ko] : []))) ?? []);

function scopeWords(scope: LessonScope): string[] {
  switch (scope.kind) {
    case 'pic-word-match':
      return scope.boards.flatMap((b) => b.pairs.map((p) => p.word.ko));
    case 'card-match':
      return scope.pairs.map((p) => p.ko);
    case 'listen-pick':
      return scope.rounds.flatMap((r) => [r.prompt.ko, ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]);
    default:
      return [];
  }
}

const drawn = (ref: string): boolean =>
  ref.startsWith('card:') ? supportedCardIds.includes(ref) : ref.startsWith('word:') && WORD_ART_KEYS.includes(ref.slice('word:'.length));

describe('Playground Words (F-CURR-001 S2-3)', () => {
  it('is the crafts cell of Stage 2, three quests, no new cards (section 3.12)', () => {
    expect(cell.id).toBe('episode:stage2-crafts');
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage2-crafts-q1', 'quest:stage2-crafts-q2', 'quest:stage2-crafts-q3']);
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
  });

  it('teaches the section 3.3 words, 2 pages x 2 words per Discover', () => {
    expect(cell.quests.map(discoverWords)).toEqual([
      ['그네', '미끄럼틀', '모래', '공'],
      ['제기', '팽이', '윷', '연'],
      ['줄넘기', '달리기', '숨바꼭질', '친구'],
    ]);
  });

  it('U-3: at most 4 new words per quest', () => {
    for (const quest of cell.quests) expect(discoverWords(quest).filter((w) => !REUSED.has(w)).length, quest.id).toBeLessThanOrEqual(4);
  });

  it('U-4: every scored reading round uses Stage 1 symbols only (Word Builder symbols are heard or pictured)', () => {
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind !== 'listen-pick') continue;
        for (const round of scope.rounds) {
          const reading = round.options.some((o) => o.text !== undefined);
          if (!reading) continue;
          for (const ko of [round.prompt.ko, ...round.options.map((o) => o.text!.ko)]) expect(decodableAtStage1(ko), `${round.id} ${ko}`).toBe(true);
        }
      }
    }
  });

  it('the helper tells taught symbols from Word Builder symbols', () => {
    expect(['공', '친구', '줄넘기', '달리기'].every(decodableAtStage1)).toBe(true);
    expect(['그네', '모래', '미끄럼틀', '팽이', '윷', '숨바꼭질'].some(decodableAtStage1)).toBe(false);
  });

  it('Check: a picture round, then a reading round on a decodable word (section 3.3)', () => {
    for (const quest of cell.quests) {
      const check = quest.scopes.find((s) => s.ref.endsWith('-check'));
      expect(check?.kind, quest.id).toBe('listen-pick');
      if (check?.kind !== 'listen-pick') continue;
      const [picture, reading] = check.rounds;
      expect(picture?.options.every((o) => o.pictureRef !== undefined && o.labelEn !== undefined), quest.id).toBe(true);
      expect(reading?.options.every((o) => o.text !== undefined), quest.id).toBe(true);
      expect(decodableAtStage1(reading!.prompt.ko), quest.id).toBe(true);
    }
  });

  it('every picture is drawn art, never a text tile (F-QUEST-002 section 3.11)', () => {
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        const refs =
          scope.kind === 'pic-word-match'
            ? scope.boards.flatMap((b) => b.pairs.map((p) => p.pictureRef ?? ''))
            : scope.kind === 'listen-pick'
              ? scope.rounds.flatMap((r) => r.options.flatMap((o) => (o.pictureRef ? [o.pictureRef] : [])))
              : [];
        for (const ref of refs) expect(drawn(ref), `${scope.ref} ${ref}`).toBe(true);
      }
    }
  });

  it('U-6: at least half the Korean words outside Discover were taught earlier', () => {
    for (const [qi, quest] of cell.quests.entries()) {
      const known = new Set([...REUSED, ...cell.quests.slice(0, qi + 1).flatMap(discoverWords)]);
      const shown = [...new Set(quest.scopes.flatMap(scopeWords))];
      const reused = shown.filter((w) => REUSED.has(w) || (known.has(w) && !discoverWords(quest).includes(w)));
      expect(reused.length * 2, quest.id).toBeGreaterThanOrEqual(shown.length);
      expect(shown.every((w) => known.has(w)), `${quest.id}: a word is asked before it is shown`).toBe(true);
    }
  });

  it('the reused words this cell leans on are really taught earlier (Stage 1 Discover or level 1-2 vocabulary)', () => {
    for (const ko of ['공', '연', '줄']) expect(STAGE1_DISCOVER, ko).toContain(ko);
    for (const ko of ['공', '친구', '줄넘기', '달리기', '나무', '하늘', '축구', '야구', '농구', '자전거', '곰', '강']) expect(VOCAB_L2, ko).toContain(ko);
    for (const ko of ['그네', '미끄럼틀', '모래', '제기', '팽이', '윷', '숨바꼭질']) expect(REUSED.has(ko), ko).toBe(false);
  });

  it('a word with a Word Builder symbol is exposure only: Discover, Pic-Word Match, Card Match or a picture round (F-QUEST-002 R3)', () => {
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind !== 'listen-pick') {
          expect(['pic-word-match', 'card-match'], scope.ref).toContain(scope.kind);
          continue;
        }
        for (const round of scope.rounds) {
          const picture = round.options.every((o) => o.pictureRef !== undefined);
          if (picture) continue;
          for (const ko of [round.prompt.ko, ...round.options.map((o) => o.text?.ko ?? '')]) expect(decodableAtStage1(ko), `${round.id} ${ko}`).toBe(true);
        }
      }
    }
  });

  it('a generic ball never shares a board with another ball picture (one picture, one right word)', () => {
    const balls = ['word:sport-soccer', 'word:sport-baseball', 'word:sport-basketball', 'word:sport-volleyball'];
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind !== 'pic-word-match') continue;
        for (const board of scope.boards) {
          const refs = board.pairs.map((p) => p.pictureRef);
          if (refs.includes('word:sport-ball')) expect(refs.filter((r) => r !== undefined && balls.includes(r)), scope.ref).toEqual([]);
        }
      }
    }
  });

  it('every culture note has two sources, one a Korean public institution, and is scoped to lessons', () => {
    expect(cell.culture.map((n) => n.id)).toEqual(['n1', 'n2']);
    for (const note of cell.culture) {
      expect(note.sources?.length, note.id).toBeGreaterThanOrEqual(2);
      expect(note.verification.scope, note.id).toBe('lesson');
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
    }
  });
});
