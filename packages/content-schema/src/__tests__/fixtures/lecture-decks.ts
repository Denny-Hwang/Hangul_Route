import type { LectureBlock } from '../../schemas/lecture';

/**
 * Shared lecture decks for the minutes rule (AMENDMENTS-LECTURE-V2 section 4.4, rule 12 as
 * amended; owner report 2026-10-16: "25 slides · about 0 minutes"). Content ids only, from the
 * shipped catalogue and bundle. Two suites read the same list, so both sides round the same way:
 *
 * - `apps/web/src/lib/console/__tests__/lecture.test.ts`: the console's `aboutMinutes(blocks)`;
 * - `apps/mobile/src/logic/lecture/__tests__/deck-builder.test.ts`: the presenter's estimate
 *   (`expandDeck` then `runDeck` over the shipped bundle).
 *
 * Each must equal `aboutMinutes` here.
 */
export interface LectureMinutesDeck {
  name: string;
  blocks: LectureBlock[];
  /** The about-minutes both the console and the presenter show. */
  aboutMinutes: number;
}

const CONSONANTS = ['giyeok', 'nieun', 'digeut', 'rieul', 'mieum', 'bieup', 'siot', 'ieung', 'jieut', 'chieut', 'kieuk', 'tieut', 'pieup', 'hieut'];
const VOWELS = ['a', 'ya', 'eo', 'yeo', 'o', 'yo', 'u', 'yu', 'eu', 'i'];
const jamo = (ids: readonly string[]): string[] => ids.map((id) => `jamo:${id}`);
const LETTERS = jamo([...CONSONANTS, ...VOWELS]);

export const LECTURE_MINUTES_DECKS: readonly LectureMinutesDeck[] = [
  {
    // The owner's deck: every consonant and vowel, 24 letter slides (two sets of 12): 6 + 6.
    name: 'consonants and vowels',
    blocks: [
      { kind: 'jamo-set', jamoIds: LETTERS.slice(0, 12) },
      { kind: 'jamo-set', jamoIds: LETTERS.slice(12) },
    ],
    aboutMinutes: 12,
  },
  {
    // A story counts its catalogue minutes; its check slides are inside them.
    name: 'a story on its own',
    blocks: [{ kind: 'story', storyId: 'story:sejong-new-letters', checks: true }],
    aboutMinutes: 4,
  },
  {
    // The lesson's catalogue minutes (its own quiz inside), 4 quiz slides, 3 activity minutes.
    name: 'a lesson, its quiz, an activity and the class code',
    blocks: [
      { kind: 'quest', id: 'quest:stage1-letters-q1' },
      { kind: 'quiz', from: 'previous', rounds: 4 },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
      { kind: 'class-code', code: 'HYRA42' },
    ],
    aboutMinutes: 12,
  },
  {
    name: 'the Meet the Letters episode',
    blocks: [{ kind: 'episode', id: 'episode:stage1-letters' }],
    aboutMinutes: 15,
  },
  {
    // 12 word cards (6) and a 5-question meaning quiz (5).
    name: 'a whole word topic',
    blocks: [{ kind: 'vocab', topicId: 'vocab-topic:food' }],
    aboutMinutes: 11,
  },
  {
    // 10 chosen words (5) and a 5-question meaning quiz (5).
    name: 'ten words of a topic',
    blocks: [
      {
        kind: 'vocab',
        topicId: 'vocab-topic:food',
        wordIds: ['vocab:sagwa-apple', 'vocab:banana', 'vocab:uyu', 'vocab:ppang', 'vocab:bap', 'vocab:gimchi', 'vocab:gimbap', 'vocab:ramyeon', 'vocab:mul', 'vocab:dalgyal'],
      },
    ],
    aboutMinutes: 10,
  },
  {
    // Six letters (3) and their 4-question sound quiz (4), then 3 activity minutes.
    name: 'a warm-up of six letters',
    blocks: [
      { kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ', 'ㅓ', 'ㅗ'] },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
    ],
    aboutMinutes: 10,
  },
];
