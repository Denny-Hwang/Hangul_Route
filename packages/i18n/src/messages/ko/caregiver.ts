import type { DeepPartial, Messages } from '../../types';

/**
 * Korean draft of the learner Plan screen (F-BILL-002 B-6, §6.2), reviewed by the multi-agent ko/es
 * review in the F-I18N-001 translation PR (PR 16) before `ko` ships (F-I18N-001 §3.10; no review-ledger entry yet, `ko` stays hidden). Status only: no price, no
 * purchase word, and nothing a native build renders mentions the web (§4.8). Names stand before a
 * colon, never before a particle.
 */
export const caregiver = {
  plan: {
    title: '플랜',
    learnerFallback: '학습자',
    covered: {
      title: {
        family: (name: string, source: string) => `${name}: ${source} 플랜이 적용돼요.`,
        self: (source: string) => `${source} 플랜이 적용돼요.`,
      },
      note: { family: '함께하는 동안 모든 레슨이 열려 있어요.', self: '함께하는 동안 모든 레슨이 열려 있어요.' },
      sourceFallback: '반',
    },
    full: {
      title: { family: (name: string) => `${name}: 전체 루트를 이용할 수 있어요.`, self: '전체 루트를 이용할 수 있어요.' },
      fromFamily: { family: '가족이 함께 쓰는 가족 플랜이에요.', self: '내 가족 플랜이에요.' },
      noSource: '모두 열려 있어요.',
    },
    free: {
      title: { family: (name: string) => `${name}: 무료 플랜이에요.`, self: '무료 플랜이에요.' },
      open: '1단계는 언제나 무료예요.',
    },
    openBilling: {
      cta: '결제 화면 열기',
      caption: { family: '플랜과 영수증은 어른용 결제 페이지에 있어요.', self: '내 플랜과 영수증은 결제 페이지에 있어요.' },
      a11yHint: '결제 페이지를 열어요',
    },
    openFailed: (url: string) => `브라우저에서 이 주소를 열어 주세요: ${url}`,
    needsConnection: '결제 화면을 열려면 인터넷 연결이 필요해요.',
    gateDone: 'PIN을 확인했어요. 결제 화면 열기를 한 번 더 눌러 주세요.',
    backToJourney: { cta: '여정으로 돌아가기' },
  },
  /**
   * Notes from grown-ups in the in-app grown-up zone (F-FEEDBACK-001 FB-5b; wireframes parent/notes.md and
   * parent/note-report.md), reviewed by the multi-agent ko review. Behind the gate: it speaks to the grown-up and
   * names the learner before a colon or before "에게" (which never changes with the final consonant).
   */
  notes: {
    row: { title: (learner: string) => `받은 쪽지: ${learner}` },
    title: (learner: string) => `받은 쪽지: ${learner}`,
    empty: (learner: string) => `${learner}: 아직 받은 쪽지가 없어요.`,
    putAway: '이 기기에서 치움',
    status: { opened: '읽음' },
    hide: {
      cta: (learner: string) => `${learner}에게 숨기기`,
      confirm: {
        title: (learner: string) => `이 쪽지를 ${learner}에게 숨길까요?`,
        body: "모든 기기에서 사라져요. 보낸 사람에게는 '표시 안 됨'으로 보여요.",
        cta: '숨기기',
        cancel: { cta: '취소' },
      },
    },
    report: {
      cta: '신고',
      title: '이 쪽지 신고하기',
      why: '신고 이유',
      reasons: {
        unkind: '친절하지 않아요',
        unsafe: '안전하지 않아요',
        not_for_me: (learner: string) => `${learner}에게 맞지 않는 쪽지예요`,
        other: '기타',
      },
      submit: { cta: '신고하고 숨기기' },
      line: (learner: string) => `모든 기기에서 ${learner}에게 이 쪽지가 사라져요. 신고는 저희 팀이 하나하나 확인해요.`,
      justHide: { cta: '숨기기만 하기' },
      close: '닫기',
      reported: '고마워요. 쪽지가 사라졌어요.',
      emergency: '누군가 위험하다면 지역 긴급 구조 기관에 연락해 주세요.',
      hidden: '쪽지를 숨겼어요.',
      done: { cta: '완료' },
      alreadyGone: '이미 사라진 쪽지예요.',
      queued: '신고를 보내지 못했어요. 인터넷에 연결되면 다시 보낼게요.',
      tooMany: '오늘은 신고를 더 보낼 수 없어요. 이 기기에서는 쪽지를 숨겼어요.',
    },
    mode: {
      title: '반에서 오는 쪽지',
      options: { all: '모든 쪽지', presets: '격려 문구만', off: '받지 않기' },
      familyAlways: '가족이 보낸 쪽지는 언제나 받아요.',
      classScoped: '집에서 쓰는 기기에서 바꿔 주세요.',
    },
    oneTimeCard: {
      line: (mode: string) => `반에서 오는 쪽지: ${mode}`,
      keep: { cta: '그대로 두기' },
      change: { cta: '바꾸기' },
    },
    disclosure: (learner: string) => `${learner}: 선생님은 자기가 보낸 쪽지에 고른 답을 볼 수 있어요.`,
    offline: '인터넷에 연결한 뒤에 할 수 있어요.',
    saveFailed: '저장하지 못했어요. 다시 해 보세요.',
    sendNote: { cta: '쪽지 보내기' },
  },
} satisfies DeepPartial<Messages['caregiver']>;
