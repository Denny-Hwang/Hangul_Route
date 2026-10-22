import type { DeepPartial, Messages } from '../../types';

/**
 * Korean public site (F-I18N-001 PR 16): metadata, the layered home, the persona pages, About, the launch-news form,
 * the 404 links and the language banner. Public surface (CLAUDE.md section 1): anyone, at any age; never kids-only
 * framing and never an age range (KIDS_ONLY_FRAMING). 해요체, plain and short. The Privacy Policy and Terms stay
 * English-authoritative (decision L10): only their notice and back link are translated here, never a leaf under
 * `legal.privacy` or `legal.terms`. No price anywhere. Taught Korean (the hero letter) arrives as an argument and never
 * takes a particle that changes with the final consonant.
 */
const FAQ_ADULT = {
  q: '어른 초보자예요. 너무 아이용 같지 않을까요?',
  a: '아니요. 1단계는 어떤 초보자에게나 가장 먼저 필요한 것, 바로 글자와 그 소리를 아기 말투 없이 가르쳐요. 호야는 친근하고, 문화 카드는 나이와 상관없이 모을 만해요.',
} as const;
const FAQ_KOREAN = {
  q: '한국어를 조금이라도 알아야 하나요?',
  a: '아니요 — 처음부터 시작하는 분을 위해 만들었어요. 안내는 쉽고 짧은 말로 쓰여 있고, 배우는 한국어에는 언제나 로마자 표기와 뜻이 함께 나와요.',
} as const;
/** The backup sentence, word for word wherever the site says where learning data lives (privacy-statements.test.ts). */
const BACKUP_FIRST = '학습자의 별명과 진도는 기기에 저장되고, 복구 코드로 되찾을 수 있도록 저희 서버에도 백업돼요.';
const BACKUP = `${BACKUP_FIRST} 학습자가 코드로 반이나 가족에 참여하면, 그 공간에서는 참여할 때 쓴 이름과 진도를 볼 수 있어요. 가족의 어른도 진도를 되찾을 수 있어요.`;

export const landing = {
  meta: {
    title: 'Hangul Route — 호야와 함께 한글을 처음부터',
    tagline: '나이와 상관없이, 한글을 처음부터 배워요.',
    description:
      '호랑이 호야와 함께 나이와 상관없이 한글을 처음부터 배워요. 한국계 가족, K-컬처 팬, 호기심 많은 초보자 모두를 위해서요. 5분 퀘스트로 한글 자모를 읽기, 듣기, 쓰기로 익히고, 글자를 하나 배울 때마다 한국 문화 카드를 받아요. 1단계는 무료이고 더 많은 단계가 준비되고 있어요. 광고는 절대 없어요.',
    keywords: ['한글 배우기', '한글 자모', '한국어 배우기', '한국어 초보', '한국계 가족 한국어', 'K-컬처 학습', '호야'],
    ogDescription: '호랑이 호야와 함께 나이와 상관없이 한글 자모를 처음부터 배우고, 한국 문화 카드를 모아요. 1단계는 무료예요.',
    twitterDescription: '호랑이 호야와 함께 나이와 상관없이 한글 자모를 처음부터 배우고, 한국 문화 카드를 모아요.',
    pages: {
      learners: {
        title: '학습자를 위해 — Hangul Route',
        description: '호랑이 호야와 함께 5분 퀘스트로 한글 읽기, 듣기, 쓰기를 처음부터 배우고 한국 문화 카드를 모아요. 광고는 없어요.',
      },
      parents: {
        title: '부모님과 보호자를 위해 — Hangul Route',
        description: '광고 없이 어른 확인 장치가 있는 짧고 다정한 한글 레슨이에요. 무료 가족 공간을 만들고 학습자마다 한 주를 살펴봐요.',
      },
      teachers: {
        title: '선생님을 위해 — Hangul Route',
        description: '학생은 반 코드로 참여해요. 학생 이메일이나 계정은 필요 없어요. 한 주를 계획하고 누가 연습했는지 봐요. 순위는 절대 없어요.',
      },
      about: {
        title: 'Hangul Route 소개',
        description: 'Hangul Route를 누가 만드는지, 그리고 우리가 지키는 약속을 알려 드려요.',
      },
      privacy: {
        title: '개인정보 처리방침 — Hangul Route',
        description: 'Hangul Route가 무엇을 모으는지, 누가 볼 수 있는지, 어떻게 지우는지 알려 드려요.',
      },
      terms: {
        title: '이용약관 — Hangul Route',
        description: 'Hangul Route를 쓸 때 지킬 규칙이에요.',
      },
      licenses: {
        title: '오픈소스 라이선스 — Hangul Route',
        description: 'Hangul Route가 쓰는 오픈소스 소프트웨어예요.',
      },
    },
  },
  brand: {
    name: 'Hangul Route',
    mark: 'HR',
  },
  nav: {
    label: '주 메뉴',
    learners: '학습자',
    parents: '부모님',
    teachers: '선생님',
    signIn: '로그인',
    start: '배우기 시작하기',
    skip: '본문으로 건너뛰기',
  },
  home: {
    hero: {
      title: '나이와 상관없이, 한글을 처음부터 배워요.',
      lead: '짧고 재미있는 퀘스트로 한글을 읽고, 듣고, 쓰는 법을 배워요. 호랑이 호야가 길잡이가 되어 줘요.',
      start: '배우기 시작하기',
      grownUps: '부모님이나 선생님인가요? 내 페이지 찾기',
      facts: '브라우저에서 바로 돼요 · 설치할 것이 없어요 · 처음 방문한 뒤에는 대부분의 기기에서 오프라인으로도 돼요',
      bubble: (letter: string, romanization: string) => `안녕하세요! 오늘 만날 글자: ${letter} (${romanization})`,
    },
    who: {
      title: '누구를 위한 앱인가요?',
      items: {
        learners: {
          title: '학습자',
          body: '5분 퀘스트, 절대 혼내지 않는 길잡이, 그리고 모으는 재미가 있는 한국 문화 카드.',
        },
        parents: {
          title: '부모님과 보호자',
          body: '어른 확인 장치와 광고 없는 환경에서, 학습자가 무엇을 연습하는지 봐요.',
        },
        teachers: {
          title: '선생님',
          body: '학생은 반 코드로 참여해요. 학생 이메일도, 계정도 필요 없어요.',
        },
      },
    },
    how: {
      title: '이렇게 해요',
      steps: {
        start: { title: '앱 열기', body: '누가 배우는지 고르고 시작해요.' },
        quests: { title: '5분 퀘스트로 배우기', body: '글자, 소리, 첫 낱말을 화면마다 소리와 그림으로 배워요.' },
        collect: { title: '모으면서 계속하기', body: '한국 문화 카드를 받아요. 진도는 저장되고 백업돼요.' },
      },
      routeBody: '한국 문화 카드를 받고, 지금 있는 곳과 다음에 할 것을 학습 루트 전체로 한눈에 봐요.',
      levelBody: '누가 배우는지 고르거나, 수준 확인을 해요.',
    },
    promises: {
      label: '우리의 약속',
      items: { ads: '광고는 절대 없어요', safety: '아이의 안전이 먼저예요', noRed: '빨간 표시는 없어요' },
    },
    news: {
      title: '출시 소식 받기',
      body: '이메일을 남겨 주시면 출시 소식을 보내 드려요. 다른 메일은 보내지 않아요.',
    },
  },
  plans: {
    title: '비용은 얼마인가요?',
    free: {
      stage1: '1단계는 무료예요.',
    },
    paid: {
      coming: '가족과 반을 위한 플랜과 함께 더 많은 단계가 준비되고 있어요.',
      inApp: '가족과 반을 위한 플랜은 app.hangulroute.com에 있어요.',
    },
    managedInApp: '플랜과 결제는 로그인한 뒤 app.hangulroute.com에서 관리해요.',
    // [SA] AMENDMENTS-SEATS-ADMINS 9.5: glossary 가족 플랜, 그룹 라이선스, 학습자, 학생; the count takes 명, no particle on it.
    sizes: (family: number, group: number) => `가족 플랜은 학습자 최대 ${family}명이 함께 써요. 그룹 라이선스는 반이나 학교 하나에서 학생 최대 ${group}명이 함께 써요.`,
  },
  persona: {
    learners: {
      title: '학습자를 위해',
      lead: '5분 퀘스트 하나씩, 한글 읽기, 듣기, 쓰기를 배워요.',
      learn: {
        title: '가장 먼저 배우는 것',
        body: '1단계는 한글 자모예요: 글자, 그 소리, 그리고 글자가 모여 글자 덩어리를 이루는 방법을 배워요.',
        bullets: { read: '글자와 글자 덩어리 읽기', listen: '듣고 소리 짝짓기', write: '글자를 따라 쓰기' },
      },
      quest: {
        title: '대부분의 퀘스트는 이렇게 해요',
        bullets: {
          discover: '알아보기: 새 글자를 보고 들어요.',
          play: '놀기: 그 글자를 쓰는 짧은 미니게임을 해요.',
          check: '확인: 부드러운 한 판이에요. 답이 다르면 빨간색이 아니라 주황색으로 살짝 알려 줘요.',
        },
        hoya: '호랑이 호야가 모든 퀘스트를 안내하고, 절대 “틀렸어”라고 하지 않아요.',
        gamesFold: '미니게임 보기',
      },
      cards: {
        title: '한국 문화 모으기',
        body: '글자를 하나 배울 때마다 카드를 받아요: 한국의 음식, 예술, 일상의 한 조각이에요.',
        seeAll: (cards: number) => (cards === 1 ? `1단계 카드 ${cards}장 보기` : `1단계 카드 ${cards}장 모두 보기`),
      },
      route: {
        title: '내 학습 루트',
        body: '지도 하나에 시작한 곳, 지금 있는 곳, 다음에 할 것이 모두 보여요.',
      },
      faq: {
        signIn: {
          q: '학습자도 로그인해야 하나요?',
          a: '이메일이나 비밀번호는 필요 없어요. 앱을 열고 내 프로필을 고르거나, 반 코드나 가족 코드를 입력해요. 새 기기로 옮기나요? 복구 코드를 쓰면 돼요.',
        },
        code: {
          q: '참여 코드가 있어요. 어디에 입력하나요?',
          a: '앱에서 프로필을 누른 뒤, 반과 가족으로 가서 반에 참여하기를 눌러요.',
        },
        offline: {
          q: '오프라인에서도 되나요?',
          a: '대부분의 기기에서는 돼요: 처음 방문한 뒤에는 인터넷 없이도 앱이 열려요. 글자 소리를 들으려면 기기에 한국어 음성이 설치되어 있어야 할 수 있어요.',
        },
        adult: FAQ_ADULT,
        korean: FAQ_KOREAN,
        // The button label is learner.placement.invite.knowSome in Korean, word for word (glossary: 수준 확인).
        level: {
          q: '한글을 조금 알아요. 처음부터 시작해야 하나요?',
          a: '아니요. 시작할 때 ‘한국어를 조금 알아요’를 누르고 짧은 수준 확인을 해요. 호야가 어디서 시작할지 알려 줘요.',
        },
      },
      after: {
        title: '자모를 익힌 다음에는',
        body: '낱말, 짧은 문장, 대화, 문화 이야기도 똑같이 5분 퀘스트로 배워요.',
      },
    },
    parents: {
      title: '부모님과 보호자를 위해',
      lead: '부모님, 조부모님, 그리고 모든 보호자를 위해: 학습자의 데이터를 지키는 짧고 다정한 레슨이에요.',
      signIn: '부모님으로 로그인',
      learn: {
        title: '무엇을 배우나요',
        body: '먼저 한글 자모를 배워요: 5분 퀘스트로 읽기, 듣기, 쓰기를 해요.',
        link: '학습자가 하는 것',
      },
      safe: {
        title: '처음부터 안전하게',
        bullets: {
          ads: '광고가 없고, 데이터를 팔지 않아요.',
          backup: BACKUP,
          gate: '돈이 드는 일이나 데이터를 지우는 일은 어른 확인 장치가 지켜요.',
          siblings: '형제자매가 기기 하나를 함께 써도 돼요. 학습자마다 자기 별과 카드를 따로 가져요.',
        },
      },
      follow: {
        title: '함께 지켜보기',
        body: '무료 가족 공간을 만들고 코드를 공유하면, 학습자마다 한 주를 볼 수 있어요: 연습한 시간, 끝낸 퀘스트, 함께 다시 볼 글자.',
        reports: '오늘, 이번 주, 이번 달, 전체 기간의 리포트로 잘한 점과 다음에 연습할 점을 봐요.',
        route: '학습자마다 학습 루트를 열어 지금 있는 곳과 다음에 할 것을 봐요.',
        notes: '학습자가 앱에서 보는 짧은 격려 쪽지를 보내요.',
        browse: '가족 플랜이 있으면 학습자가 보는 그대로 모든 레슨을 둘러볼 수 있어요.',
        lecture: '강의 모드로 TV에 수업을 띄우고 함께 배워요.',
      },
      faq: {
        account: { q: '학습자에게 계정이 필요한가요?', a: '아니요. 학습자는 이메일이나 비밀번호가 전혀 필요 없어요.' },
        learnAlong: { q: '저도 같이 배울 수 있나요?', a: '네. 직접 한국어를 배우고 있나요? 같은 퀘스트를 해 보세요.' },
        whatSee: {
          q: '무엇을 볼 수 있나요?',
          a: '로그인한 뒤 가족 공간에서 학습자마다 한 주를 볼 수 있어요. 학습자는 가족 코드로 참여해요.',
          reports: '로그인한 뒤 가족 공간에서 학습자마다 한 주와 리포트를 볼 수 있어요. 학습자는 가족 코드로 참여해요.',
        },
      },
    },
    teachers: {
      title: '선생님을 위해',
      lead: '학생은 코드로 참여하고, 선생님은 한 주를 계획하고, 모두 자기 속도로 배워요.',
      signIn: '선생님으로 로그인',
      tryIt: '학습자로 해 보기',
      setup: {
        title: '몇 분이면 준비 끝',
        steps: {
          space: '로그인하고 반 공간을 만들어요.',
          code: '반 코드를 공유해요. 학생은 앱에 코드를 입력하면 되고, 학생 이메일이나 계정은 필요 없어요.',
          devices: '학생은 브라우저가 있는 어떤 기기로든 배워요.',
        },
      },
      plan: {
        title: '계획하고 배정하기',
        bullets: {
          pick: '한 주의 퀘스트를 골라요. 학생마다 숙제 목록에 나타나요.',
          planner: '또는 반의 수준과 수업 리듬에 맞춰 계획 도우미가 학기 루트를 만들어 줘요.',
        },
      },
      class: {
        title: '반이 어떻게 하고 있는지 보기',
        body: '주간 보기로 누가 연습했는지, 어떤 글자를 함께 다시 볼지 알 수 있어요. 순위는 절대 없어요.',
        reports: '학생마다 리포트, 반 전체 통계를 날짜별, 주별, 월별, 전체 기간으로 봐요. 순위는 절대 없어요.',
        route: '학생마다 학습 루트를 열어 지금 있는 곳과 다음에 할 것을 봐요.',
        notes: '학생에게 짧은 격려 쪽지를 보내요.',
        browse: '반 플랜이나 학교 플랜이 있으면 학생이 보는 그대로 모든 레슨을 미리 볼 수 있어요.',
        lecture: '강의 모드: 준비된 수업으로 프로젝터나 TV 앞에서 가르쳐요.',
      },
      privacy: {
        title: '반을 위한 개인정보 보호',
        bullets: { initials: '반 명단에는 이니셜만 보여 줄 수 있어요.', ads: '광고가 없고, 데이터를 팔지 않아요.' },
      },
      faq: {
        students: { q: '학생에게 계정이 필요한가요?', a: '아니요. 앱 안에서 반 코드로 참여해요.' },
        ranking: { q: '순위표가 있나요?', a: '아니요. Hangul Route는 학생끼리 순위를 매기지 않아요.' },
        try: { q: '먼저 해 볼 수 있나요?', a: '네. 앱을 열고 학습자로 첫 퀘스트를 해 보세요.' },
      },
    },
    plansTitle: '플랜',
    faqTitle: '자주 묻는 질문',
    closing: {
      learners: '첫 글자를 만날 준비가 됐나요?',
      parents: '학습자의 한 주를 한곳에서 봐요.',
      teachers: '이번 주, 반에 한글을 가져와요.',
    },
  },
  cards: {
    listLabel: '1단계 문화 카드',
    rarity: { common: '보통', uncommon: '드문', rare: '희귀', legendary: '전설' },
    cardLabel: (romanization: string, meaning: string) => `한국어 낱말 ${romanization}, 뜻: ${meaning}`,
  },
  games: {
    listLabel: '1단계 미니게임',
    family: { recognition: '알아보기', production: '만들기', application: '활용', review: '복습' },
    beta: '베타 — 원하면 켜기',
    // Titles follow the app's game names (learner.myRoute.games) where it has one.
    items: {
      'listen-pick': { title: '듣고 고르기', blurb: '소리를 듣고 글자나 낱말을 눌러요.' },
      'match-sound': { title: '소리 짝짓기', blurb: '글자 소리를 듣고 맞는 칸을 눌러요. 서두르지 않아도 돼요.' },
      'build-letter': { title: '글자 만들기', blurb: '자모를 모아 진짜 한글 글자를 만들어요.' },
      'pic-word-match': { title: '그림과 낱말', blurb: '그림을 누르고, 그다음 그 낱말을 눌러요.' },
      'trace-stroke': { title: '글자 따라 쓰기', blurb: '획 순서를 따라가요. 손가락이 모양을 익혀요.' },
      'odd-one-out': { title: '다른 하나 찾기', blurb: '셋은 같은 종류예요. 다른 하나를 찾을 수 있나요?' },
      'culture-quiz': { title: '문화 퀴즈', blurb: '한국어 낱말 하나와 답 네 개가 나와요. 뜻을 골라요.' },
      'story-sequence': { title: '이야기 순서', blurb: '카드 네 장이 이야기 하나예요. 일어난 순서대로 눌러요.' },
    },
  },
  footer: {
    guide: '안내',
    app: '앱',
    company: '회사',
    about: '소개',
    privacy: '개인정보',
    terms: '이용약관',
    contact: '문의',
    copyright: (year: number) => `© ${year} Hangul Route`,
    language: '언어',
    licenses: '오픈소스 라이선스',
  },
  waitlist: {
    label: '내 이메일',
    placeholder: 'you@somewhere.com',
    submit: '초대 받기',
    sending: '보내는 중',
    retry: '다시 해 보기',
    success: '목록에 올렸어요. Hangul Route가 출시되면 이메일을 보내 드릴게요.',
    invalid: '올바른 이메일 주소를 입력해 주세요.',
    error: '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.',
    rateLimited: '너무 많이 시도했어요. 조금 기다렸다가 다시 해 보세요.',
    unavailable: '지금은 신청이 되지 않아요. 이메일을 보내 주시면 저희가 추가해 드릴게요.',
    consentLead: '이메일은 Hangul Route 출시 소식을 보내는 데에만 써요. 절대 팔거나 공유하지 않아요. 그만 받으려면 아무 메일에나 답장하거나 ',
    contactLink: '저희에게 연락해 주세요',
    privacyLink: '개인정보 처리방침',
    honeypot: '이 칸은 비워 두세요',
  },
  about: {
    backHome: '← 홈으로',
    title: 'Hangul Route 소개',
    lead: '작은 팀(대부분 한 사람과 호랑이 한 마리)이 만들었어요. 나이와 상관없이 한글을 처음부터 배우는 누구나를 위해 — 부모님이나 조부모님이 한국어를 하는 한국계 가족, K-팝, K-푸드, 모든 K-컬처의 팬, 그리고 호기심 많은 초보자까지 — 부끄럽지 않게, 부드럽게 시작하고 싶은 분을 위해서요.',
    promises: {
      title: '우리의 약속',
      plainEnglish: '메뉴와 안내는 쉽고 짧은 말로 써요 (CEFR Pre-A1 수준).',
      koreanTaught: '한국어 학습 내용은 언제나 로마자 표기와 뜻이 함께 나와요.',
      noRed: '답이 달라도 빨간 X 표시는 없어요 — 호야가 주황색으로 살짝 알려 줘요.',
      noAds: '광고는 절대 없어요.',
      localFirst: BACKUP_FIRST,
      gate: '돈이 드는 일이나 데이터를 지우는 일은 어른 확인 장치가 지켜요.',
    },
    feedback: {
      title: '의견이 있나요?',
      body: (email: string) => `이메일을 보내 주세요: ${email} — 모두 읽어요.`,
    },
    privacy: '개인정보',
    terms: '이용약관',
  },
  legal: {
    backHome: '← 홈으로',
    englishAuthoritative: '이 문서는 영어로 표시됩니다. 효력이 있는 것은 영어판입니다.',
  },
  licenses: {
    title: '오픈소스 라이선스',
    lead: 'Hangul Route는 다른 사람들이 만든 오픈소스 소프트웨어와 글꼴을 써요. 각각 자기 라이선스를 따라요. 이 페이지에서 저작권 표시와 라이선스 전문을 볼 수 있어요.',
    notOpen: 'Hangul Route 자체는 오픈소스가 아니에요.',
    copyright: '© 2026 Sungjoo Hwang. 모든 권리 보유.',
    softwareTitle: '소프트웨어',
    fontsTitle: '글꼴',
    noticesTitle: 'NOTICE 파일',
    fullText: '라이선스 전문',
    usedIn: '사용하는 곳',
    where: { app: '앱', web: '웹사이트', server: '서버', ios: 'iOS 앱' },
  },
  notFound: {
    body: '오래된 링크일 수 있어요. 홈으로 가거나 배우기를 시작해 보세요.',
    home: '홈으로 가기',
    start: '배우기 시작하기',
    title: '페이지를 찾을 수 없어요',
  },
  localeBanner: {
    label: '언어 추천',
    viewIn: (endonym: string) => `${endonym} 화면으로 보기`,
    dismiss: '닫기',
    close: { cta: '×' },
  },
} satisfies DeepPartial<Messages['landing']>;
