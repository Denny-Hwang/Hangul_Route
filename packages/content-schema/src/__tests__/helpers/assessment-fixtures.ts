import type { AssessmentOption, AssessmentQuestion } from '../../assessment/question';

/** A valid 3-option question; option `${id}-a` is correct unless `correct` says otherwise. */
export const makeQuestion = (id: string, correct: 'a' | 'b' | 'c' = 'a'): AssessmentQuestion => {
  const option = (key: 'a' | 'b' | 'c', ko: string): AssessmentOption => ({
    id: `${id}-${key}`,
    ko,
    isCorrect: key === correct,
  });
  return {
    id,
    format: 'hear-pick-written',
    spokenKo: '가',
    options: [option('a', '가'), option('b', '나'), option('c', '다')],
    tags: ['sym:ga'],
    requires: { audio: true, picture: null },
    leaks: false,
  };
};
