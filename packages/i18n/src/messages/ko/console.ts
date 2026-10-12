import type { DeepPartial, Messages } from '../../types';

/**
 * Korean draft of the console keys F-BILL-002 B-6 adds or changes (§6.1), reviewed by the
 * multi-agent ko/es review in the F-I18N-001 translation PR (PR 16) before `ko` ships (§3.10): there is no review-ledger entry yet, so `i18n-status` reports the
 * namespace "not reviewed", and `ko` stays hidden (`LOCALE_STATUS`). Every other console key falls
 * back to English until the translation PR. 해요체; no particle that changes with a final consonant
 * is attached to an argument (names, dates and amounts arrive as arguments). Four existing keys the
 * new lines name (`title`, `manage.cta`, `planTitle`) are drafted too, and the whole
 * `entitlementStatus` object beside the two changed values, so one page or card never names a plan,
 * a status, the page or a button two ways or in two languages.
 */
export const consoleMsgs = {
  entitlementStatus: {
    trial: '체험',
    trialEnds: (date: string) => `체험 · 종료일: ${date}`,
    active: '이용 중',
    activeRenews: (date: string) => `이용 중 · 갱신일: ${date}`,
    pastDueKept: '결제 확인 필요 · 전체 루트 일주일 유지',
    pastDuePaused: '결제 확인 필요 · 전체 루트 일시 중지',
    cancelled: '해지됨',
    cancelledEnds: (date: string) => `해지됨 · 종료일: ${date}`,
    ended: '종료됨',
    endedOn: (date: string) => `종료됨 · ${date}`,
  },
  billing: {
    title: '결제',
    manage: { cta: '구독 관리' },
    planTitle: { free: '무료', family_lifetime: '가족 플랜', group_license: '그룹 라이선스', school_seat: '학교 계약' },
    promo: { disclosure: '코드가 있나요?' },
    contact: { mailSubject: 'Hangul Route 학교 계약 문의' },
    testMode: '테스트 모드: 실제 카드로 결제되지 않아요.',
    notConfigured: '아직 결제가 설정되지 않았어요. 청구된 금액은 없어요.',
    liveOff: '아직 결제를 받지 않아요. 청구된 금액은 없어요.',
    offline: '오프라인 상태예요. 플랜과 영수증을 보려면 인터넷 연결이 필요해요.',
    retry: { cta: '다시 시도' },
    sections: { yours: '내 플랜', add: '플랜 추가', help: '도움말' },
    kind: { family: '가족', class: '반', school: '학교' },
    archived: '(보관됨)',
    coverage: {
      free: '무료 플랜',
      family: '가족 플랜',
      license: '그룹 라이선스',
      contract: '학교 계약',
      school: (school: string) => `${school} 라이선스로 이용 중`,
      schoolUntil: (school: string, date: string) => `${school} 라이선스로 이용 중 (${date}까지)`,
    },
    status: {
      renewsOn: (date: string) => `갱신일: ${date}`,
      endsOn: (date: string) => `종료일: ${date}`,
    },
    readOnly: {
      family: '이 가족을 만든 분이 플랜을 관리해요.',
      class: '반을 만든 선생님이 플랜을 관리해요.',
      school: '학교에서 이 플랜을 관리해요.',
    },
    usage: {
      learners: (n: number, cap: number | null) => (cap === null ? `학습자 ${n}명` : `학습자 ${cap}명 중 ${n}명`),
      students: (n: number, cap: number | null) => (cap === null ? `학생 ${n}명` : `학생 ${cap}명 중 ${n}명`),
      teachers: (n: number, cap: number | null) => (cap === null ? `선생님 ${n}명` : `선생님 ${cap}명 중 ${n}명`),
    },
    connectLearner: { line: '다음 단계: 이 가족에 학습자를 연결해 주세요.', cta: '학습자 연결하기' },
    buy: {
      forSpace: (plan: string, space: string) => `${space}용 ${plan}`,
      family_lifetime: { cta: '가족 플랜 시작하기' },
      group_license: { cta: '그룹 라이선스 시작하기' },
    },
    includesLines: {
      family: {
        everyLesson: '모든 단계의 모든 레슨, 새 레슨 포함',
        learners: (n: number) => `한 가족에 학습자 최대 ${n}명`,
        cloudSave: '모든 기기에 클라우드 저장',
        browse: '학습자가 보는 그대로 모든 레슨 둘러보기',
        reports: '잘한 점과 다음에 연습할 점을 알려 주는 리포트',
        notes: '학습자에게 메모 보내기',
      },
      license: {
        everyStudent: '등록된 동안 모든 학생에게 모든 레슨',
        noCap: (cap: number) => `학생 ${cap}명 제한 없음`,
        school: (teachers: number, students: number) => `학교 하나에 선생님 최대 ${teachers}명, 학생 최대 ${students}명`,
        browse: '학생이 보는 그대로 모든 레슨 둘러보기',
        reports: '학생 리포트와 반 리포트',
        notes: '학생에게 메모 보내기',
      },
    },
    noSpaces: {
      title: '플랜은 가족이나 반에 속해요.',
      family: { cta: '나 또는 우리 가족용으로 시작' },
      class: { cta: '반 만들기' },
    },
    alreadyActive: '이 플랜은 이미 이용 중이에요. 청구된 금액은 없어요.',
    checking: '거의 다 됐어요. 플랜을 확인하고 있어요.',
    done: '감사해요. 플랜이 시작됐어요. 학습자가 다음에 Hangul Route를 열면 적용돼요.',
    stillProcessing: '결제가 완료됐어요. 곧 여기에 플랜이 표시돼요.',
    checkAgain: { cta: '다시 확인' },
    receipts: {
      title: '영수증',
      all: { cta: '영수증 전체 보기' },
      empty: '아직 영수증이 없어요.',
      older: '이전 결제 내역은 Stripe가 보낸 영수증 이메일에 있어요.',
      beyondLimit: '더 오래된 영수증은 Stripe 이메일에서 확인하거나 저희에게 문의해 주세요.',
      kind: { purchase: '결제', renewal: '갱신', refund: '환불', failed: '결제가 처리되지 않음' },
      column: { date: '날짜', what: '내용', plan: '플랜', amount: '금액' },
      test: { pill: '테스트' },
      view: { cta: '영수증 보기' },
      viewA11y: (date: string) => `영수증 보기, ${date} (새 탭에서 Stripe가 열려요)`,
      linkFailed: '지금은 이 영수증을 열 수 없어요.',
      pageTitle: (space: string) => `${space} · 영수증`,
      notYours: '이 페이지는 이 공간의 요금을 내는 분을 위한 페이지예요.',
      cantLoad: '지금은 영수증을 불러올 수 없어요.',
      back: { cta: '결제 화면으로 돌아가기' },
    },
    stepUp: {
      title: '본인 확인',
      body: '결제, 플랜 변경, 영수증 보기 전에 다시 로그인해 주세요.',
      reason: '공유 기기에서도 결제를 안전하게 지키기 위해서예요.',
      cta: '계속',
      cancel: { cta: '나중에' },
      cancelled: '바뀐 내용은 없어요.',
      unavailable: '지금은 확인할 수 없어요. 잠시 후 다시 시도해 주세요.',
    },
    help: {
      refund: (email: string) => `궁금한 점이나 환불은 이메일로 문의해 주세요: ${email}`,
      learners: '학습자에게는 가격이나 영수증이 보이지 않아요.',
      sharedDevice: '공유 기기인가요? 다 쓰면 로그아웃해 주세요.',
    },
    pastDue: '결제가 처리되지 않았어요. 구독 관리에서 카드를 바꿔 주세요. 학습자는 일주일 동안 전체 루트를 계속 이용할 수 있어요.',
  },
} satisfies DeepPartial<Messages['console']>;
