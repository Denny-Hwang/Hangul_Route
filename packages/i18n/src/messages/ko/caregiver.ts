import type { DeepPartial, Messages } from '../../types';

/**
 * Korean grown-up surfaces (F-I18N-001 PR 16): the PIN screens, the Family Dashboard, the Plan screen, Classes &
 * family, Progress backup, Restore, Save my progress, Join a class, the install sheet, the level-check report, the
 * Learning Route about a learner, the notes and All lessons. 해요체 throughout (§3.10 style guide); a learner's
 * name stands before a colon, before "에게" or "의" (which never change with the final consonant), never before
 * 은/는, 이/가, 을/를. No price; the products are named, never sold. Status words stay calm (anti-shame).
 */
export const caregiver = {
  gating: {
    'unknown-quest': (_learnerName: string) => '이 퀘스트는 아직 할 수 없어요.',
    'episode-not-shipped': (_learnerName: string) => '이 에피소드는 아직 만들고 있어요.',
    'stage-locked': (learnerName: string) => `${learnerName}: 아직 이 퀘스트까지 오지 않았어요.`,
    'quest-closed': (learnerName: string) => `${learnerName}: 가족 플랜이나 그룹 라이선스가 있으면 이 레슨을 할 수 있어요.`,
  },
  audience: {
    shared: {
      installGuideLine: '홈 화면에 추가해 주세요.',
      journeyLockedA11y: (stageTitle: string) => `${stageTitle}: 잠겨 있어요. 여는 방법 페이지가 열려요.`,
      homeReviewsIdle: '나를 위해 고른 복습',
      homeworkIntro: '호야, 선생님, 가족이 골라 준 거예요.',
      restorePrompt: '복구 코드, 계정, 저장한 파일이 있나요?',
      restoreSignInLabel: '로그인',
      restoreCardsBack: '복구 코드가 있으면 카드가 돌아와요.',
      spacesNoClass: '아직 들어간 반이 없어요. 선생님이나 가족에게 받은 코드가 있나요?',
      joinCodeFull: '이미 반 세 곳에 들어가 있어요. 먼저 프로필의 반과 가족에서 한 곳을 나가 주세요.',
      joinCodeNotForLearners: '이 코드는 학습자로 참여하는 코드가 아니에요. 반 코드를 받아 주세요.',
      profileSwitchHint: '프로필을 누르면 바뀌어요.',
    },
    family: {
      installGuideHelp: '어른이 도와줄 수 있어요.',
      zoneLabel: '어른 공간',
      pinVerifyTitle: '어른 공간',
      pinCreateTitle: '어른용 PIN 만들기',
      pinCreateSubtitle: '어른만 아는 숫자 4개를 골라 주세요. 설정과 어른용 페이지를 지켜 줘요.',
    },
    self: {
      zoneLabel: '계정과 백업',
      pinVerifyTitle: '설정 PIN',
      pinCreateTitle: 'PIN 만들기',
      pinCreateSubtitle: '설정을 지킬 숫자 4개를 골라 주세요.',
    },
    gated: (base: string, pinRequired: boolean, detail?: string) => {
      const parts = [detail, pinRequired ? 'PIN 필요' : undefined].filter((p): p is string => p !== undefined);
      return parts.length === 0 ? base : `${base} (${parts.join(', ')})`;
    },
  },

  pin: {
    mismatch: '서로 달라요. 처음부터 다시 해 봐요.',
    cooldown: (seconds: number) => `잠깐 쉬어요. ${seconds}초 뒤에 다시 해 보세요.`,
    entry: {
      createAgain: '한 번 더 입력하기',
      verifySubtitle: '계속하려면 숫자 4자리 PIN을 입력해 주세요.',
      createAgainSubtitle: '같은 숫자 4개를 한 번 더 입력해 주세요.',
      triesLeft: (left: number) => `조금 달라요. ${left}번 더 해 볼 수 있어요.`,
      unlock: { cta: '열기' },
      forgot: { cta: 'PIN을 잊었나요?' },
    },
    setup: { again: '한 번 더 입력하기', set: 'PIN 설정 완료', change: '바꾸기' },
    reset: {
      title: 'PIN 다시 만들기',
      subtitle: '학습자, 카드, 진도는 그대로 있어요.',
      code: {
        heading: '복구 코드 쓰기',
        placeholder: 'TIGER-MOON-RIVER-APPLE-482139',
        formats: '영어 낱말 네 개와 숫자 여섯 자리예요. 예전 코드는 낱말 두 개와 숫자 네 자리예요.',
      },
      noCode: { cta: '코드가 없어요' },
      wait: {
        heading: '24시간 기다리기',
        idle: {
          caption: '기다리는 동안에도 지금 PIN은 계속 쓸 수 있어요. 24시간이 지나면 새 PIN을 만들 수 있어요.',
          button: '기다리기 시작',
        },
        waiting: { caption: (readyAt: string) => `새 PIN은 이때부터 만들 수 있어요: ${readyAt}`, button: '기다리는 중' },
        ready: { caption: '24시간이 지났어요.', button: '새 PIN 만들기' },
      },
      failure: {
        wrongCode: '이 기기에 저장된 코드와 달라요. 확인하고 다시 해 보세요.',
        noCode: '이 기기에는 저장된 복구 코드가 없어요. 대신 24시간 기다리기를 써 주세요.',
        badFormat: '낱말과 숫자를 모두 입력해 주세요. 예: TIGER-MOON-RIVER-APPLE-482139 (예전 코드: TIGER-MOON-4821)',
      },
    },
  },

  dashboard: {
    title: '가족 대시보드',
    readOnly: '보기 전용 — 이 기기의 학습자예요.',
    noProfiles: '아직 프로필이 없어요.',
    stats: { quests: '퀘스트', cards: '카드', sessions: '학습 횟수', minutes: '분' },
    recent: '최근 기록',
    privacy: {
      title: '개인정보',
      body: '학습자의 별명과 진도는 기기에 저장되고, 복구 코드로 되찾을 수 있도록 저희 서버에도 백업돼요. 학습자가 코드로 반이나 가족에 참여하면, 그 공간에서는 참여할 때 쓴 이름과 진도를 볼 수 있어요. 가족의 어른도 진도를 되찾을 수 있어요. 제삼자와는 공유하지 않아요.',
      bodyDeviceOnly:
        '학습자의 별명과 진도는 이 기기에 저장돼요. 이 버전에는 클라우드 저장이 설정되어 있지 않으니, "파일로 백업하기"로 사본을 만들어 두세요. 제삼자와는 공유하지 않아요.',
    },
  },

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
    freePlan: {
      line: (lessons: number, letters: number, minutes: number) =>
        `1단계는 무료예요: 레슨 ${lessons}개, 글자 ${letters}개, 약 ${minutes}분. 끝낸 것은 사라지지 않아요.`,
      lineNoLetters: (lessons: number, minutes: number) => `1단계는 무료예요: 레슨 ${lessons}개, 약 ${minutes}분. 끝낸 것은 사라지지 않아요.`,
      stories: (n: number) => `짧은 이야기 ${n}개`,
      topics: (n: number) => `낱말 주제 ${n}개`,
      classLine: {
        family: (name: string) => `${name}: 선생님이 반 전체에 모든 레슨을 열어 줄 수 있어요.`,
        self: '선생님이 반 전체에 모든 레슨을 열어 줄 수 있어요.',
      },
      freeEnd: {
        family: (name: string) => `${name}: 무료 레슨을 모두 끝냈어요.`,
        self: '무료 레슨을 모두 끝냈어요.',
      },
      setPlan: '계획을 세우면 다음에 할 것을 안내해 줘요.',
      setPlanWeb: '계획은 어른 공간에서 세워요: 학기 계획하기.',
    },
  },

  spaces: {
    title: '반과 가족',
    kind: { family: '가족', class: '반', school: '학교' },
    leave: {
      cta: '나가기',
      stay: '그대로 있기',
      confirmTitle: (name: string) => `${name}에서 나갈까요?`,
      confirmMessage: '카드와 별은 그대로 남아요. 코드가 있으면 다시 들어올 수 있어요.',
    },
    join: { cta: '반에 참여하기' },
  },

  backup: {
    title: '진도 백업',
    save: { cta: '내 진도 저장하기', detail: '복구 코드' },
    file: { cta: '파일로 백업하기' },
    restore: { cta: '파일에서 되찾기' },
    note: {
      ready: '백업 파일이 준비됐어요.',
      unavailable: '여기서는 파일을 저장할 수 없어요.',
      failed: '파일을 만들지 못했어요. 다시 해 볼까요?',
    },
  },

  retry: {
    tooManyAttempts: '몇 분 기다렸다가 다시 해 봐요.',
    offline: '인터넷이 필요해요. 연결되면 다시 해 보세요.',
    unknown: '문제가 생겼어요. 잠시 뒤에 다시 해 보세요.',
  },

  sync: {
    status: {
      deviceOnly: '이 기기에만 저장돼 있어요.',
      needsRescueCode: '이 기기에 저장돼 있어요. 복구 코드를 입력하면 여기서도 클라우드 저장이 켜져요.',
      retrying: '클라우드에 연결하지 못했어요 — 다시 시도할게요.',
      saving: '클라우드에 저장하는 중…',
      waiting: '첫 클라우드 저장을 기다리고 있어요.',
      justNow: '클라우드에 저장됨 · 방금',
      minutesAgo: (minutes: number) => `클라우드에 저장됨 · ${minutes}분 전`,
    },
    saveNow: {
      saved: '클라우드에 저장했어요.',
      off: '이 버전에는 클라우드 저장이 설정되어 있지 않아요.',
      needsRescueCode: '이 기기는 아직 클라우드에 저장할 수 없어요. 복구 코드를 입력하면 켜져요.',
      unreachable: '클라우드에 연결하지 못했어요 — 나중에 다시 해 보세요.',
    },
  },

  restore: {
    title: '진도 되찾기',
    code: {
      cta: '복구 코드가 있어요',
      placeholder: '낱말, 그다음 숫자',
      example: '예: TIGER-MOON-RIVER-APPLE-482139. 예전 코드는 TIGER-MOON-4821처럼 생겼어요.',
      find: { cta: '내 카드 찾기' },
      looking: { cta: '찾는 중…' },
      notFound: '코드를 확인하고 다시 해 보세요.',
    },
    cloudOff: '이 버전에는 클라우드에서 되찾기가 설정되어 있지 않아요.',
    cloudOffUseFile: '이 버전에는 클라우드에서 되찾기가 설정되어 있지 않아요. 대신 저장한 파일을 써 주세요.',
    signIn: { comingSoon: '곧 열려요' },
    file: {
      cta: '저장한 파일 열기',
      openFailed: '그 파일을 열지 못했어요.',
      newerVersion: '더 새로운 버전에서 만든 백업이에요. 먼저 앱을 업데이트해 주세요.',
      unreadable: '이 파일은 읽을 수 없어요. .hangulroute.json 백업 파일을 골라 주세요.',
    },
    startFresh: { cta: '처음부터 시작하기' },
    great: { cta: '좋아요' },
    notice: {
      created: (name: string) => `다시 만나서 반가워요! ${name}의 여정이 여기 있어요.`,
      nothingNew: (name: string) => `${name}: 이 파일의 내용은 이미 모두 있어요.`,
      added: (name: string, cards: number, quests: number) => {
        const what =
          cards > 0 && quests > 0
            ? `카드 ${cards}장과 퀘스트 ${quests}개를`
            : cards > 0
              ? `카드 ${cards}장을`
              : `퀘스트 ${quests}개를`;
        return `${name}의 진도를 찾았어요! ${what} 더했어요.`;
      },
      relinked: (name: string) => `다시 만나서 반가워요! ${name}: 다시 반에 들어왔어요.`,
    },
  },

  saveProgress: {
    title: '내 진도 저장하기',
    bubble: {
      code: (name: string | null) =>
        name === null
          ? '이 코드를 적어 두세요. 어느 기기에서든 카드를 되찾을 수 있어요.'
          : `이 코드를 적어 두세요. 어느 기기에서든 ${name}의 카드를 되찾을 수 있어요.`,
      noCode: '진도가 클라우드에 저장되면 여기에 복구 코드가 보여요.',
    },
    codeShape: (words: number, digits: number) => `낱말 ${words === 4 ? '네' : '두'} 개 + 숫자 ${digits}자리`,
    copy: { cta: '복사', done: '복사했어요.', unavailable: '여기서는 복사할 수 없어요 — 적어 두세요.' },
    share: {
      cta: '공유',
      title: '복구 코드',
      text: (name: string | null, code: string) => `Hangul Route 복구 코드 (${name ?? '내 학습자'}): ${code}`,
      unavailable: '여기서는 공유할 수 없어요 — 대신 복사해 주세요.',
    },
    saveNow: { cta: '지금 저장', saving: { cta: '저장하는 중…' } },
    rotate: {
      cta: '새 코드 받기',
      caption: '예전 코드는 더 이상 쓸 수 없어요.',
      confirmTitle: '새 코드를 받을까요?',
      confirmMessage: '예전 코드는 더 이상 쓸 수 없게 돼요. 새 코드를 적어 두세요.',
      keep: { cta: '지금 코드 그대로 두기' },
      ready: '새 코드가 준비됐어요. 예전 코드는 이제 쓸 수 없어요.',
      unavailable: '지금은 새 코드를 받을 수 없어요.',
    },
  },

  join: {
    title: '반에 참여하기',
    bubble: {
      idle: '선생님이 알려 준 코드를 입력해요.',
      found: (space: string) => `찾았어요! ${space}`,
      done: (space: string) => `들어왔어요! ${space}`,
    },
    code: {
      placeholder: 'ABC123',
      rules: '글자나 숫자 6개 — O, I, 0, 1은 없어요',
      join: { cta: '참여하기' },
      looking: { cta: '찾는 중…' },
    },
    confirm: {
      seeYouAs: { family: '가족에게 보일 이름:', teacher: '선생님에게 보일 이름:' },
      me: { cta: '나예요' },
      joining: { cta: '참여하는 중…' },
      alreadyIn: { cta: '원래 이 반에 있었어요' },
      notThis: { cta: '이 반이 아니에요' },
    },
    pick: {
      prompt: '어느 이름이 나인가요? 선생님이 확인해 줄 거예요.',
      newHere: { cta: '처음 왔어요' },
    },
    waiting: {
      line: (name: string) => `선생님이 허락해 주기를 기다리고 있어요: ${name}`,
      caption: '선생님에게 화면에서 반을 열어 달라고 해 주세요. 이 요청은 10분쯤 유지돼요.',
      neverMind: { cta: '그만두기' },
    },
    relink: {
      denied: '선생님이 지금은 안 된다고 했어요. 수업 시간에 물어봐요.',
      expired: '시간이 너무 오래 지났어요. 선생님에게 물어보고 다시 해 봐요.',
    },
    done: {
      joined: (space: string) => `들어왔어요: ${space}. 오늘 화면에 새 미션이 나타날 수 있어요.`,
      already: (space: string) => `이미 들어와 있어요: ${space}`,
      backToToday: { cta: '오늘로 돌아가기' },
    },
    errors: {
      codeNotFound: '이 코드로는 들어갈 수 없어요. 선생님과 같이 확인해 봐요.',
      codeExpired: '오래된 코드예요. 새 코드를 받아 주세요.',
      classFull: '이 반은 자리가 다 찼어요. 선생님에게 물어봐요.',
      learnerGone: '그 이름은 이제 이 반에 없어요. 선생님에게 물어봐요.',
      alreadyOnDevice: '이 기기에 이미 그 학습자가 있어요 — 대신 프로필을 바꿔 주세요.',
      badFormat: '코드는 글자나 숫자 6개예요.',
      off: '이 버전에는 반 참여가 설정되어 있지 않아요.',
    },
  },

  install: {
    offline: '그러면 Hangul Route가 앱처럼 열리고, 와이파이가 없어도 카드가 안전하게 남아 있어요.',
    steps: {
      share: '공유 누르기',
      addToHome: '홈 화면에 추가',
      browserMenu: '브라우저 메뉴',
      installApp: '앱 설치 / 홈 화면에 추가',
    },
    install: { cta: '설치' },
    inAppBrowser: '먼저 이 페이지를 Safari나 Chrome에서 열어 주세요.',
    copyLink: { cta: '링크 복사' },
    linkCopied: { cta: '링크 복사됨' },
    notNow: { cta: '나중에' },
  },

  placementReport: {
    title: '시작 위치',
    whatWeSaw: '살펴본 것',
    strand: {
      'hangul-recognition': '글자 (모양)',
      'sound-letter': '글자의 소리',
      'syllable-reading': '글자 읽기',
      vocabulary: '낱말',
      sentences: '문장',
    },
    status: { secure: '탄탄함', gettingThere: '거의 다 옴', notYet: '아직', notTested: '확인 안 함' },
    rung: {
      recog: '글자 모양',
      'sound-basic': '첫 글자 소리',
      'syl-cv': '간단한 글자',
      'sound-rest': '더 많은 글자 소리',
      'syl-cvc': '받침 있는 글자',
      vocab: '낱말',
      sentence: '문장',
    },
    form: { decode: '읽기', read: '읽기', oral: '듣기' },
    count: (correct: number, asked: number) => `${asked}개 중 ${correct}개`,
    notTestedReason: {
      noSound: '듣기는 확인하지 않았어요: 이 기기에서 소리가 나지 않아요.',
      soundGuide: '읽기는 확인하지 않았어요: 소리 안내가 항상 보이게 설정되어 있었어요.',
      screenReader: '글자 모양은 확인하지 않았어요: 화면 읽기 기능이 켜져 있었어요.',
      screenReaderPictures: '낱말과 문장은 확인하지 않았어요: 한글 그림 보기는 화면 읽기 기능으로 읽을 수 없어요.',
      endedEarly: '확인을 일찍 마쳐서 일부는 보지 못했어요.',
    },
    shortNotTested: '글자 모양과 문장은 짧은 확인에 들어 있지 않아요.',
    notTestedShort: '확인 안 함 (짧은 확인)',
    shortHint: '짧은 확인은 처음 글자만 봐요. 기본 확인을 하면 더 뒤의 시작 위치를 찾을 수 있어요.',
    tryStandard: '기본 확인 해 보기',
    checkedTwice: '두 번 확인함',
    notFinished: '일부만 확인함',
    spellingTiles: '타일로 글자 만들기',
    onlyForward: '새로 확인해도 루트는 앞으로만 움직여요.',
    takenOn: (date: string, language: string) => `확인한 날: ${date} · 언어: ${language}`,
    whereStarts: '루트가 시작되는 곳',
    changedByGrownUp: '어른이 바꿈',
    takeAgain: '다시 확인하기',
    takeFirst: '수준 확인하기',
    noCheck: '아직 확인한 적이 없어요.',
    retryHidden: '소리 안내를 숨기고 해 보기',
    needsStage: (name: string, stage: number) => `${name}: ${stage}단계를 시작할 준비가 됐어요. ${stage}단계 레슨은 아직 이 계정에 들어 있지 않아요.`,
    noStart: (name: string) => `${name}: 지금 열린 것을 모두 알고 있어요. 더 많은 내용이 곧 와요.`,
    examples: { known: '아는 글자', fresh: '이번에 새로 배울 글자' },
    chooseStart: '다른 시작 위치 고르기',
    sheet: {
      title: '다른 시작 위치 고르기',
      help: '고른 퀘스트 앞의 퀘스트는 건너뛰어요. 고른 퀘스트와 그 뒤의 퀘스트는 모두 루트에 그대로 있어요.',
      state: { start: '여기서 시작', done: '완료', placedOut: '건너뜀' },
    },
    saved: '시작 위치를 바꿨어요.',
    row: { label: '시작 위치', seeCheck: '확인 결과 보기' },
  },

  journey: {
    here: (name: string, n: number, title: string) => `${name}: 지금 ${n}단계, ${title}에 있어요.`,
    next: (title: string) => `다음: ${title}`,
    canDoLead: (name: string) => `${name}: 이 단계를 마치면 할 수 있는 것`,
    started: (name: string) => `${name}: 여기서 시작했어요`,
    known: (name: string) => `${name}: 이미 알고 있었어요.`,
    quests: (name: string, n: number) => `${name}: 끝낸 퀘스트 ${n}개에서 연습했어요`,
    viewing: (name: string) => `학습 루트 보기: ${name}`,
    tiles: (n: number) => `타일로 글자 만들기: 퀘스트 ${n}개`,
    start: (name: string) => `${name}: 학습 루트가 여기서 시작돼요.`,
    goal: '첫 목표: 한글 글자를 모두 읽기.',
    rest: (name: string) => `${name}: 지금 열린 것을 모두 했어요. 더 많은 내용이 곧 와요.`,
    beyond: (name: string) => `${name}: 정말 많이 알아요! 더 많은 모험이 곧 와요.`,
    hereTag: (name: string) => `${name}: 지금 여기`,
    ready: (name: string) => `${name}: 준비되면 언제든지`,
    explored: (name: string) => `${name}: 지금 열린 것을 모두 둘러봤어요`,
    skillsTitle: (name: string) => `${name}의 퀘스트로 연습하는 것`,
    row: {
      title: '학습 루트',
      now: (n: number, title: string) => `지금: ${n}단계 · ${title}`,
      goal: (n: number, title: string) => `목표: ${n}단계 · ${title}`,
      started: (n: number, band: string, date: string) => `시작: ${n}단계 · ${band} · ${date}`,
      cta: '학습 루트 보기',
    },
  },
  skillsNote:
    '수준 확인은 읽기와 듣기를 봐요. 쓰기는 따라 쓰기 게임으로 연습하고, 채점하지 않아요. 각 줄은 이 게임이 들어 있는 퀘스트 가운데 끝낸 것의 수예요. 퀘스트 안에서 게임을 건너뛰어도 수에 들어가요.',
  grownUpHome: {
    noPin: '이 기기에는 어른용 PIN이 없어요. 대신 어른용 페이지에서 로그인해 주세요.',
    continue: { cta: '계속' },
    title: '어른용 홈',
    line: '가족, 반, 결제를 한곳에서 봐요.',
    cta: '열기',
  },
  access: {
    freeEnd: (name: string, product: string) => `${name}: 무료 레슨을 모두 끝냈어요. 2단계부터는 다음으로 열려요: ${product}.`,
    product: {
      family: '가족 플랜',
      class: '그룹 라이선스',
      either: '가족 플랜 또는 그룹 라이선스',
    },
  },
  notes: {
    row: { title: (learner: string) => `받은 쪽지: ${learner}` },
    title: (learner: string) => `받은 쪽지: ${learner}`,
    empty: (learner: string) => `아직 ${learner}에게 온 쪽지가 없어요.`,
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
        not_for_me: (learner: string) => `${learner}에게 보낸 쪽지가 아니에요`,
        other: '기타',
      },
      submit: { cta: '신고하고 숨기기' },
      line: (learner: string) => `이 쪽지가 모든 기기에서 ${learner}에게 더 이상 보이지 않아요. 신고는 저희 팀이 하나하나 확인해요.`,
      justHide: { cta: '숨기기만 하기' },
      close: '닫기',
      reported: '고마워요. 쪽지가 사라졌어요.',
      emergency: '누군가 위험하다면 현지 긴급 신고 번호로 연락해 주세요.',
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
    disclosure: (learner: string) => `선생님은 자기가 보낸 쪽지에서 ${learner}의 답을 볼 수 있어요.`,
    offline: '인터넷에 연결한 뒤에 할 수 있어요.',
    saveFailed: '저장하지 못했어요. 다시 해 보세요.',
    sendNote: { cta: '쪽지 보내기' },
  },
  browse: {
    documentTitle: 'Hangul Route 레슨',
    home: {
      title: '모든 레슨',
      close: { cta: '닫기' },
      howTo: '레슨을 누르면 무엇을 배우는지 보고 직접 해 볼 수 있어요. 아무것도 저장되지 않아요.',
    },
    preview: {
      strip: '미리 보기. 아무것도 저장되지 않아요.',
      leave: { cta: '미리 보기 나가기' },
    },
    access: {
      title: '부모님과 선생님을 위한 페이지예요.',
      line: {
        gate: '어른 공간에서 쓸 수 있는 시간이 끝났어요.',
        gateUntilIntent: '어른 공간에서 쓸 수 있는 시간이 끝났어요. 앱으로 돌아가서 어른 공간을 다시 열어 주세요.',
        account: '내 계정에서 레슨을 다시 열어 주세요.',
        unknown: '가족 기기에서는 어른 공간에서 열어 주세요. 부모님과 선생님은 자기 계정에서도 열 수 있어요.',
      },
      backToGrownUp: { cta: '어른 공간으로 돌아가기' },
      backToApp: { cta: '앱으로 돌아가기' },
      openFromAccount: { cta: '내 계정에서 레슨 열기' },
      signIn: { cta: '로그인' },
      offline: '어른용 페이지는 인터넷이 필요해요.',
    },
  },
} satisfies DeepPartial<Messages['caregiver']>;
