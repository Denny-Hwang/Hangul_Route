import type { ClassScopeText } from './class-scope';

/**
 * The Korean class-scope update ([TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 3): Korean UI-locale text
 * shown to a guardian, never taught Korean, so the romanization scan skips this file (and only this file).
 * Formal polite style (합니다체), as the class-move consent lines. No Hangul follows a placeholder: a learner's
 * name is always followed by the word 학습자, so the particle after it is right for every name. "OK" is the
 * shared button (`common.buttons.ok`, 확인).
 */
export const CLASS_SCOPE_TEXT_KO: ClassScopeText = {
  lines: {
    intro: '{learner} 학습자가 들어 있는 반에 관한 안내가 있습니다.',
    sees_all: '{learner} 학습자가 들어 있는 각 반의 선생님은 단어를 포함해 {learner} 학습자의 모든 진도를 볼 수 있습니다.',
    list: '선생님이 보는 것:',
    moves: '선생님이 {learner} 학습자를 다른 반으로 옮길 수 있습니다. 옮기면 알려 드립니다.',
    keeps: '카드, 별, 끝낸 레슨은 언제나 {learner} 학습자에게 남습니다.',
    leave: '{learner} 학습자는 언제든지 프로필에서 반을 나갈 수 있습니다.',
    until: '확인을 누르기 전까지 선생님은 지금까지 보던 것만 봅니다.',
  },
};
