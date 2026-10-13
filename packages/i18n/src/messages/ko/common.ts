import type { DeepPartial, Messages } from '../../types';

/**
 * Korean notes from grown-ups (F-FEEDBACK-001 FB-5b, sections 6.3, 6.6 and 6.11), reviewed by the multi-agent
 * ko review against section 6.3 (owner decision 2026-10-11). The other `common` keys fall back to English until
 * the F-I18N-001 translation PR (PR 16); `ko` stays hidden (`LOCALE_STATUS`) and the notes flags stay off until
 * FB-14. 해요체; a preset speaks to the learner about effort or a thing done, never about speed or talent; a sender
 * name stands before a colon or a middle dot, never before a particle that changes with the final consonant.
 */
export const common = {
  notes: {
    presets: {
      effort_keep_trying: '계속 도전하고 있네요. 그렇게 배우는 거예요.',
      effort_proud: '열심히 노력한 모습이 정말 자랑스러워요.',
      effort_practice_helps: '연습한 것이 도움이 되고 있어요.',
      progress_new_letters: '새 글자를 배웠네요. 정말 잘했어요!',
      progress_reading: '읽기 실력이 점점 늘고 있어요.',
      progress_writing: '글씨가 반듯하고 알아보기 쉬워요.',
      progress_listening: '정말 귀 기울여 잘 듣네요.',
      progress_new_card: '새 카드를 받았네요. 잘했어요!',
      next_try_this: '다음에는 이 퀘스트를 해 봐요. 마음에 들 것 같아요.',
      next_look_again: '배운 글자를 같이 다시 봐요.',
      next_take_time: '천천히 해도 괜찮아요. 서두르지 않아도 돼요.',
      warm_thinking_of_you: '생각나서 보내요. 오늘도 즐겁게 배워요.',
      warm_cheering: '호야와 함께 응원하고 있어요.',
      warm_see_you_in_class: '곧 수업에서 만나요.',
      warm_learning_together: '함께 한국어를 배워서 정말 좋아요.',
    },
    presetFallback: '쪽지가 왔어요.',
    reactions: {
      thanks: '고마워요',
      will_try: '해 볼게요',
      did_it: '해냈어요',
      happy: '덕분에 기분이 좋아요',
    },
    familyLabels: {
      family: '가족',
      mom: '엄마',
      dad: '아빠',
      grandma: '할머니',
      grandpa: '할아버지',
      aunt: '이모·고모',
      uncle: '삼촌',
      guardian: '보호자',
      partner: '파트너',
    },
    teacherLabel: (className: string) => `선생님 · ${className}`,
    teacherOnly: '선생님',
    date: { today: '오늘', yesterday: '어제' },
    new: { pill: '새 쪽지' },
  },
} satisfies DeepPartial<Messages['common']>;
