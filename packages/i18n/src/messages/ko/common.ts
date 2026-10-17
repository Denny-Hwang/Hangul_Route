import type { DeepPartial, Messages } from '../../types';

/**
 * Korean: generic buttons, time words, errors and the notes from grown-ups (F-I18N-001 PR 16). 해요체 on every
 * app surface (§3.10 style guide). The notes strings are the FB-5b review's (F-FEEDBACK-001, section 6.3): a preset
 * speaks to the learner about effort or a thing done, never about speed or talent; a sender name stands before a
 * colon or a middle dot, never before a particle that changes with the final consonant.
 */
export const common = {
  buttons: {
    ok: '확인',
    cancel: '취소',
    back: '뒤로',
    next: '다음',
    done: '완료',
    close: '닫기',
    save: '저장',
    tryAgain: '다시 해 보기',
    continue: '계속',
  },
  time: {
    today: '오늘',
    yesterday: '어제',
    notYet: '아직 없음',
  },
  errors: {
    generic: '문제가 생겼어요. 다시 해 보세요.',
  },
  notes: {
    presets: {
      effort_keep_trying: '계속 도전하고 있네요. 그렇게 배우는 거예요.',
      effort_proud: '열심히 노력한 모습이 정말 자랑스러워요.',
      effort_practice_helps: '연습한 것이 도움이 되고 있어요.',
      progress_new_letters: '새 글자를 배웠네요. 정말 잘했어요!',
      progress_reading: '읽기 실력이 점점 늘고 있어요.',
      progress_writing: '글씨가 반듯하고 알아보기 쉬워요.',
      progress_listening: '정말 귀 기울여 듣네요.',
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
      aunt: '이모/고모',
      uncle: '삼촌',
      guardian: '보호자',
      partner: '파트너',
    },
    teacherLabel: (className: string) => `선생님 · ${className}`,
    teacherOnly: '선생님',
    date: { today: '오늘', yesterday: '어제' },
    new: { pill: '새' },
  },
  /** 화면(Aa) 시트: 이 기기의 하나뿐인 언어와 글자 크기. */
  display: {
    button: '가가',
    a11y: '보기 설정: 언어와 글자 크기',
    title: '보기 설정',
    language: '언어',
    textSize: '글자 크기',
    size: { standard: '보통', large: '크게', larger: '더 크게', largest: '가장 크게' },
    preview: '글자는 이렇게 보여요.',
    note: '이 기기를 쓰는 모두에게 적용돼요. 언제든 바꿀 수 있어요.',
    confirm: {
      question: (endonym: string) => `이 기기의 언어를 바꿀까요? (${endonym})`,
      use: (endonym: string) => `${endonym} 쓰기`,
      back: (endonym: string) => `돌아가기: ${endonym}`,
    },
  },
  /** 읽기 수준 (F-LEARN-001 §3.7): 얼마나 읽는지를 말하고, 나이는 말하지 않아요. */
  levels: {
    pictures: { label: '그림 먼저', description: '큰 타일과 그림으로 배우고, 읽을 글은 아주 적어요.' },
    someReading: { label: '조금 읽어요', description: '짧은 낱말과 짧은 문장을 읽어요.' },
    readsEasily: { label: '술술 읽어요', description: '더 긴 글과 이야기, 대화를 읽어요.' },
  },
} satisfies DeepPartial<Messages['common']>;
