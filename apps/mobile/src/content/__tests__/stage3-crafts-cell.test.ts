import { readdirSync, readFileSync } from 'node:fs';
import { LessonCellSchema, discoverItemTexts, type LessonCell, type LessonQuest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-001 row S3-5, Game Sentences (`content/episodes/stage-3/crafts.json`): the content rules of
 * section 3.1 and 3.4 this cell must keep, beyond the generic U-1 / U-5 / U-7 / U-9 loop of
 * `upper-stage-curriculum.test.ts`: the Stage 3 games, polite sentences with their sentence mark,
 * the new-item cap (U-3), nothing asked before it is taught, and the reuse floor (U-6).
 */

const ROOT = new URL('../../../../../', import.meta.url);
const CELL: LessonCell = LessonCellSchema.parse(JSON.parse(readFileSync(new URL('content/episodes/stage-3/crafts.json', ROOT), 'utf8')));

/** Every word tile (어절) of the cell, without its sentence mark -> its dictionary item. */
const LEXEME: Readonly<Record<string, string>> = {
  윷놀이를: '윷놀이',
  축구를: '축구',
  줄넘기를: '줄넘기',
  야구를: '야구',
  농구를: '농구',
  연을: '연',
  하고: '하다',
  날리고: '날리다',
  싶어요: '싶다',
  놀이터에: '놀이터',
  공원에: '공원',
  바다에: '바다',
  산에: '산',
  학교에: '학교',
  가요: '가다',
  가고: '가다',
  제기를: '제기',
  팽이를: '팽이',
  공을: '공',
  윷을: '윷',
  차요: '차다',
  차고: '차다',
  돌려요: '돌리다',
  던져요: '던지다',
};

/** Items taught before this cell: Stage 1 words and ready vocabulary topics (checked below). */
const TAUGHT_BEFORE = new Set(['윷놀이', '축구', '줄넘기', '야구', '농구', '연', '바다', '산', '학교', '공', '제기', '팽이', '윷']);

/** Stage 1 words (the quest and minigame literals) and every item of a `ready` vocabulary topic. */
function shippedWords(): Set<string> {
  const words = new Set<string>();
  for (const file of ['apps/mobile/src/content/quests.ts', 'apps/mobile/src/logic/minigame-config.ts']) {
    for (const m of readFileSync(new URL(file, ROOT), 'utf8').matchAll(/'([\uAC00-\uD7A3]+)'/g)) words.add(m[1]!);
  }
  const vocabDir = new URL('content/vocab/', ROOT);
  for (const name of readdirSync(vocabDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    const topic = JSON.parse(readFileSync(new URL(name, vocabDir), 'utf8')) as { topic: { status: string }; items: Array<{ ko: string }> };
    if (topic.topic.status === 'ready') for (const item of topic.items) words.add(item.ko);
  }
  return words;
}

/** The new items each quest's Discover introduces (section 3.1 rule 4: at most 4 words, one pattern). */
const NEW_ITEMS: Readonly<Record<string, readonly string[]>> = {
  'quest:stage3-crafts-q1': ['하다', '날리다', '싶다'],
  'quest:stage3-crafts-q2': ['놀이터', '공원', '가다'],
  'quest:stage3-crafts-q3': ['차다', '돌리다', '던지다'],
};

const bare = (tile: string): string => tile.replace(/[.?!]+$/, '');
const lexemes = (ko: string): string[] =>
  ko.split(' ').map((tile) => {
    const lexeme = LEXEME[bare(tile)];
    if (lexeme === undefined) throw new Error(`no lexeme for tile ${tile}`);
    return lexeme;
  });

/** The Korean a quest shows outside Discover: sentence tiles, distractors, picture pairs, prompts and options. */
function playedKorean(quest: LessonQuest): string[] {
  return quest.scopes.flatMap((scope) => {
    switch (scope.kind) {
      case 'order-it':
        return scope.rounds.flatMap((r) => [r.sentence.ko, ...r.distractors.map((d) => d.ko)]);
      case 'pic-word-match':
        return scope.boards.flatMap((b) => b.pairs.map((p) => p.word.ko));
      case 'listen-pick':
        return scope.rounds.flatMap((r) => [r.prompt.ko, ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]);
      default:
        throw new Error(`Game Sentences plays no ${scope.kind}`);
    }
  });
}

const discoverKorean = (quest: LessonQuest): string[] =>
  quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => discoverItemTexts(i).map((t) => t.ko))) ?? []);

describe('Game Sentences (F-CURR-001 S3-5)', () => {
  it('is the stage3 crafts cell with three quests and no card', () => {
    expect(CELL.id).toBe('episode:stage3-crafts');
    expect(CELL.titleEn).toBe('Game Sentences');
    expect(CELL.quests.map((q) => q.id)).toEqual(['quest:stage3-crafts-q1', 'quest:stage3-crafts-q2', 'quest:stage3-crafts-q3']);
    expect(CELL.rewardCardIds).toEqual([]);
    expect(CELL.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
  });

  it('plays Sentence Builder, a sentence picture match and a Listen & Pick Check (section 3.4)', () => {
    for (const quest of CELL.quests) {
      const kindOf = (step: string) => quest.steps.find((s) => s.kind === step)?.minigameKind;
      expect([kindOf('practice'), kindOf('apply'), kindOf('check')], quest.id).toEqual(['order-it', 'pic-word-match', 'listen-pick']);
    }
  });

  it('every sentence is polite and ends with its sentence mark', () => {
    for (const quest of CELL.quests) {
      const sentences = [...discoverKorean(quest), ...playedKorean(quest)].filter((ko) => ko.includes(' '));
      for (const ko of sentences) expect(ko, quest.id).toMatch(/요\.$/);
    }
  });

  it('every pattern page holds one frame and two examples, and its note keeps Korean in single-word tokens', () => {
    for (const quest of CELL.quests) {
      const patterns = quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.filter((i) => i.type === 'pattern')) ?? []);
      expect(patterns, quest.id).toHaveLength(1);
      for (const p of patterns) if (p.type === 'pattern') for (const token of p.noteEn.matchAll(/\{ko:([^}]*)\}/g)) expect(token[1]).not.toContain(' ');
    }
  });

  it('U-3: at most 4 new words per quest, each introduced in that quest Discover', () => {
    CELL.quests.forEach((quest) => {
      const fresh = NEW_ITEMS[quest.id] ?? [];
      expect(fresh.length, quest.id).toBeLessThanOrEqual(4);
      const shown = new Set(discoverKorean(quest).flatMap(lexemes));
      for (const item of fresh) expect(shown.has(item), `${quest.id} Discover shows ${item}`).toBe(true);
    });
  });

  it('every item counted as taught before is a shipped Stage 1 word or a ready vocabulary item', () => {
    const shipped = shippedWords();
    for (const word of TAUGHT_BEFORE) expect(shipped.has(word), word).toBe(true);
  });

  it('nothing is played before it is taught, and nothing untaught is played', () => {
    const known = new Set(TAUGHT_BEFORE);
    for (const quest of CELL.quests) {
      for (const item of NEW_ITEMS[quest.id] ?? []) known.add(item);
      const unknown = [...new Set(playedKorean(quest).flatMap(lexemes))].filter((l) => !known.has(l));
      expect(unknown, quest.id).toEqual([]);
    }
  });

  it('U-6: at least half of the words played outside Discover were taught before the quest', () => {
    const earlier = new Set(TAUGHT_BEFORE);
    for (const quest of CELL.quests) {
      const played = [...new Set(playedKorean(quest).flatMap(lexemes))];
      const reused = played.filter((l) => earlier.has(l));
      expect(reused.length * 2, `${quest.id}: ${reused.length} of ${played.length}`).toBeGreaterThanOrEqual(played.length);
      for (const item of NEW_ITEMS[quest.id] ?? []) earlier.add(item);
    }
  });

  it('a heard Check offers pictures and a read Check offers written sentences, one right answer each', () => {
    for (const quest of CELL.quests) {
      const check = quest.scopes.find((s) => s.kind === 'listen-pick');
      if (check?.kind !== 'listen-pick') throw new Error(`${quest.id} has no Check`);
      const [heard, read] = check.rounds;
      expect(heard?.options.every((o) => o.pictureRef !== undefined && o.text === undefined), quest.id).toBe(true);
      expect(read?.options.every((o) => o.text !== undefined && o.pictureRef === undefined), quest.id).toBe(true);
      expect(read?.options.find((o) => o.id === read.answerId)?.text?.ko).toBe(read?.prompt.ko);
    }
  });

  it('the culture record holds only sourced language notes, each with two sources and three verification passes', () => {
    expect(CELL.culture.map((n) => [n.id, n.kind])).toEqual([
      ['n1', 'language'],
      ['n2', 'language'],
      ['n3', 'language'],
    ]);
    for (const note of CELL.culture) {
      expect(note.sources?.length, note.id).toBeGreaterThanOrEqual(2);
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('is ready with both multi-agent review sign-offs (section 3.8)', () => {
    expect(CELL.status).toBe('ready');
    expect([CELL.review.language, CELL.review.culture, CELL.review.reviewedBy]).toEqual(['native-reviewed', 'culture-reviewed', 'MAR']);
    expect(CELL.review.notes).toHaveLength(2);
  });
});
