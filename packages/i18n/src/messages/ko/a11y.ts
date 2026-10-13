import type { DeepPartial, Messages } from '../../types';

/**
 * Korean accessibility labels (F-I18N-001 PR 16). Read aloud, so whole sentences in 해요체 or short noun phrases;
 * sound values, names and titles arrive as arguments and always stand before a colon, a comma or a middle dot,
 * never before a particle that changes with the final consonant (§3.10 style guide). Korean has no plural, so counts
 * read "n개" / "n명" and need no `plural()` call.
 */
export const a11y = {
  tile: (label: string) => `한글 글자 ${label}, 눌러서 고르기`,
  stars: (earned: number) => `별 3개 중 ${earned}개 받음`,
  hoya: (pose: string) => `호랑이 호야, ${pose}`,
  dismissHoya: '호야 말풍선 닫기',
  goBack: '뒤로 가기',
  tabs: { home: '오늘', journey: '여정', library: '라이브러리', route: '루트' },
  tabPosition: (name: string, position: number, count: number) => `${name}, 탭, ${count}개 중 ${position}번째`,
  cardArt: (title: string) => `카드 그림: ${title}`,
  profileEntry: '프로필과 설정',
  openHomework: '숙제 열기',
  missionCard: (title: string, subtitle: string, collected: boolean) => `${title}. ${subtitle}.${collected ? ' 모았어요.' : ''}`,
  journeyCell: (c: {
    stage: number;
    stageTitle: string;
    themeTitle: string;
    kind: 'lesson' | 'book' | 'stories-only' | 'placeholder';
    complete: boolean;
    stories: number;
    finished: number;
    start: boolean;
    placedOut: boolean;
  }) => {
    const where = `${c.stage}단계 ${c.stageTitle}, ${c.themeTitle}`;
    const count = `문화 이야기 ${c.stories}개`;
    const stories = c.stories === 0 ? '' : c.finished > 0 ? `${count}, ${c.finished}개 다 읽음` : count;
    const holds = c.kind === 'book' ? '이야기책' : '레슨';
    const head =
      c.kind === 'placeholder'
        ? `${where}, 곧 열려요`
        : c.kind === 'stories-only'
          ? `${where}: ${stories}`
          : `${where}: ${holds}${c.complete ? ', 끝냄' : ''}${stories === '' ? '' : `, ${stories}`}`;
    const marks = `${c.start ? ' 여기에서 시작했어요.' : ''}${c.placedOut ? ' 여기는 건너뛰어도 되고, 계속 열려 있어서 해 볼 수 있어요.' : ''}`;
    return marks === '' ? head : `${head}.${marks}`;
  },
  episodeCard: (title: string) => `카드: ${title}`,
  cardWaiting: '이 에피소드를 끝내면 받을 수 있는 카드',
  playAgainQuest: (title: string) => `다시 하기: ${title}`,
  homeworkRow: (title: string, due: string) => `${title}, ${due}`,
  leaveQuest: '퀘스트 나가기',
  hearItLabel: (label: string) => `들어 보기. ${label}`,
  hearExample: (spoken: string) => `들어 보기: ${spoken}`,
  discoverLetter: (romanization: string, soundHint?: string) =>
    soundHint === undefined ? `한글 글자 ${romanization}` : `한글 글자 ${romanization}. ${soundHint}`,
  discoverFinal: (romanization: string) => `한글 받침 ${romanization}`,
  practiceLetter: (romanization: string) => `글자 다시 연습하기: ${romanization}`,
  practiceFinal: (romanization: string) => `받침 다시 연습하기: ${romanization}`,
  lockedCard: '잠긴 카드',
  lockedCardHint: (hint: string) => `잠긴 카드. ${hint}`,
  newCard: (title: string) => `${title}. 새 카드`,
  flipToBack: '눌러서 카드 뒷면 보기',
  flipToFront: '눌러서 카드 앞면 보기',
  shareCard: '이 카드 공유하기',
  soundSwitch: (muted: boolean, voice: string) => `소리, ${muted ? '꺼짐' : '켜짐'}. ${voice}.`,
  minigame: {
    hear: (romanization: string) => `듣기: ${romanization}`,
    finalTile: (romanization: string) => `받침 ${romanization}`,
    blockShape: (hint: string) => `글자 모양. ${hint}`,
    traceLetter: (romanization: string) => `글자 따라 쓰기: ${romanization}`,
    traceFinal: (romanization: string) => `받침 따라 쓰기: ${romanization}`,
    traceCanvas: (romanization: string) => `손가락으로 글자 쓰기: ${romanization}`,
    strokeOrder: {
      guide: '획순 안내',
      summary: (strokes: readonly string[]) =>
        `획순. ${strokes.length}획. ${strokes.map((stroke, i) => `${i + 1}: ${stroke}`).join('. ')}.`,
      dot: '점',
      loop: '동그라미',
      curving: (direction: string) => `휘어서 ${direction}`,
      legs: (directions: readonly string[]) => directions.join(', 그다음 '),
      direction: {
        right: '오른쪽으로',
        downRight: '오른쪽 아래로',
        down: '아래로',
        downLeft: '왼쪽 아래로',
        left: '왼쪽으로',
        upLeft: '왼쪽 위로',
        up: '위로',
        upRight: '오른쪽 위로',
      },
      close: (description: string) => `${description} 눌러서 닫기.`,
    },
    hearAgain: '소리 다시 듣기',
    picture: '그림',
    option: {
      correct: (label: string) => `정답: ${label}`,
      wrong: (label: string) => `이건 아니에요: ${label}`,
      hint: (label: string) => `여기를 봐요: ${label}`,
      selected: (label: string) => `선택함: ${label}`,
      matched: (badge: number, label: string) => `짝 맞춤, ${badge}번: ${label}`,
    },
    koreanWord: (word: string) => `한국어 낱말 ${word}`,
    meaning: (gloss: string) => `뜻: ${gloss}`,
  },
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) =>
    item.gloss === undefined ? `한글: ${item.ko}, ${item.romanization}` : `한글: ${item.ko}, ${item.romanization}, ${item.gloss}`,
  pinDigit: (digit: number) => `숫자 ${digit}`,
  pinDelete: '마지막 숫자 지우기',
  pinDots: (entered: number, total: number) => `${total}자리 중 ${entered}자리 입력함`,
  rescueCode: '복구 코드',
  classCode: '반 코드',
  joinName: '선생님에게 보일 이름',
  leaveSpace: (name: string) => `나가기: ${name}`,
  planStatus: (name: string, state: string) => `${name}: ${state}.`,
  myRoute: {
    tab: '학습 루트',
    stage: (order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number, goal = false) =>
      [
        `${order}단계, ${title}.`,
        `${stateWord}.`,
        here ? '지금 여기에 있어요.' : '',
        goal ? '내 목표예요.' : '',
        start ? '여기에서 시작했어요.' : '',
        played > 0 ? `퀘스트 ${played}개를 했어요.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    stageGrownup: (name: string, order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number, goal = false) =>
      [
        `${order}단계, ${title}.`,
        `${stateWord}.`,
        here ? `${name}: 지금 여기에 있어요.` : '',
        goal ? `${name}: 목표 단계예요.` : '',
        start ? `${name}: 여기에서 시작했어요.` : '',
        played > 0 ? `퀘스트 ${played}개를 했어요.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    later: (label: string, stateWord: string) => `${label}. ${stateWord}.`,
    trail: '단계 목록',
    cell: (theme: string, title: string, word: string) => `${theme}: ${title}. ${word}.`,
    cellInPlan: (cellLabel: string, tag: string) => `${cellLabel} ${tag}.`,
    routeCard: (
      hoyaText: string | null,
      nowText: string | null,
      goalText: string | null,
      fromText: string | null,
      planEndsText: string | null,
      pipsText: string | null,
      nextText: string | null,
    ) =>
      [
        hoyaText,
        ...[nowText, goalText, fromText, planEndsText, pipsText, nextText]
          .filter((part): part is string => part !== null && part !== '')
          .map((part) => `${part.replace(/ · /g, ', ').replace(/[.!]$/, '')}.`),
      ]
        .filter((part): part is string => part !== null && part !== '')
        .join(' '),
    labelled: (label: string, line: string) => `${label}: ${line}`,
    goalPips: {
      none: '준비되면 언제든지',
      some: '끝낸 퀘스트가 있고, 할 수 있는 퀘스트가 더 있어요',
      someDone: '끝낸 퀘스트가 있어요',
      all: '여기 있는 퀘스트를 모두 끝냈어요',
    },
    skill: (label: string, detail: string) => `${label}. ${detail}.`,
    gain: (word: string, n: number) => `${word}: ${n}`,
    homeStrip: (title: string, here: string, progress: readonly string[], goal: string | null, week: string | null) =>
      [`${title}.`, here, ...progress.map((line) => `${line}.`), goal === null ? '' : `${goal}.`, week === null ? '' : `${week}.`]
        .filter((part) => part !== '')
        .join(' '),
    homeStripGoal: (n: number, title: string) => `목표: ${n}단계, ${title}`,
    rowGoal: (n: number, title: string) => `목표: ${n}단계, ${title}.`,
    rowStarted: (n: number, band: string, date: string) => `시작: ${n}단계, ${band}, ${date}.`,
    letter: (letter: string, sound: string, state: string) => `${letter}, ${sound}. ${state}.`,
  },
  vocab: {
    question: {
      speaker: '낱말 다시 듣기',
      right: (gloss: string) => `맞아요. ${gloss}.`,
      reveal: (gloss: string) => `이건 아니에요. 정답: ${gloss}.`,
      tryAnother: '이건 아니에요. 다른 것을 골라 봐요.',
      topic: (title: string) => `주제: ${title}`,
      rightPlain: '맞아요.',
      revealPlain: '이건 아니에요.',
    },
    speed: {
      sparks: (n: number) => `반짝이 ${n}개`,
      sparksFull: '반짝이가 가득해요',
      timeLeft: (seconds: number) => `남은 시간: ${seconds}초`,
      modes: '라운드 종류',
      scales: '시계 길이',
    },
  },
  report: {
    periods: '리포트 기간',
    periodChanged: (window: string) => `보는 기간: ${window}`,
    periodChangedAll: '보는 기간: 전체',
    step: (window: string) => `보기: ${window}`,
    stepNext: (window: string) => `다음: ${window} 보기`,
    calendar: (days: string) => `연습한 날: ${days}.`,
    calendarNone: '이 기간에는 연습 기록이 없어요.',
    notSaved: (days: string) => `아직 저장 안 됨: ${days}.`,
    growthTable: '월별 퀘스트와 카드',
    loading: '리포트를 불러오는 중',
  },
  notes: {
    card: (sender: string, preset: string) => `새 쪽지, 보낸 사람: ${sender}. ${preset} 읽기.`,
    cardMany: (n: number, sender: string) => `새 쪽지 ${n}개. 가장 최근에 보낸 사람: ${sender}. 읽기.`,
    row: (sender: string, preset: string, date: string, isNew: boolean) =>
      `${isNew ? '새 쪽지. ' : ''}보낸 사람: ${sender}, ${date}. ${preset}`,
    answer: (label: string) => `내 답: ${label}`,
    reactionPicked: (label: string) => `고른 답: ${label}`,
    questCard: (title: string) => `이 퀘스트를 해 봐요: ${title}`,
  },
  shell: {
    redirecting: '홈으로 이동하고 있어요…',
    personaSwitch: '가족과 선생님 전환하기',
  },
  access: {
    next: '다음',
    inPlan: '내 계획에 있음',
    notOpen: (title: string) => `${title}: 아직 열리지 않았어요. 레슨 페이지가 열려요.`,
  },
} satisfies DeepPartial<Messages['a11y']>;
