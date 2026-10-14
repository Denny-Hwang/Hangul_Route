import { describe, expect, it } from 'vitest';
import { strokesForJamo } from '../jamo-strokes';
import { placeWordStrokes } from '../../logic/trace-word/block-strokes';
import { ALL_LESSON_SCOPES } from './helpers/lesson-stages';

/**
 * Trace a Word (F-CURR-001 row G-4, wireframe minigame/trace-word.md "no stroke data"): every word a
 * shipped `trace-word` round traces can be drawn from the jamo stroke data, so the round builder never
 * has to drop one. Until the Stage 7 cells ship, the words of the §3.7 table stand in for them.
 */

/** The one- and two-block words of the §3.7 Stage 7 table (q1 words, frames' bank words, the animal words of Stage 2-3). */
const STAGE7_WORDS = [
  '호야', '이름', '한글', '아침', '점심', '저녁', '학교', '회사', '공원', '집', '설날', '추석', '생일', '먼저',
  '동물', '개', '소', '말', '곰', '새', '닭', '뱀', '토끼', '여우', '사자', '돼지', '오리', '쥐', '양',
];

describe('trace-word words against the stroke data', () => {
  it('places every block of the Stage 7 words', () => {
    for (const word of STAGE7_WORDS) expect(placeWordStrokes(word, strokesForJamo), word).not.toBeNull();
  });

  const shipped = Object.entries(ALL_LESSON_SCOPES).flatMap(([ref, scope]) =>
    (scope.traceWord?.rounds ?? []).map((round) => ({ ref, round })),
  );

  // Skipped, not passed empty, until a cell ships trace-word rounds (the S7-1 cell is the first).
  it.skipIf(shipped.length === 0)('places every word a shipped trace-word round traces', () => {
    expect.hasAssertions();
    for (const { ref, round } of shipped) {
      expect(placeWordStrokes(round.word.ko, strokesForJamo), `${ref} ${round.id}`).not.toBeNull();
    }
  });
});
