import type {
  KoText,
  ListenPickRound,
  MinigameKind,
  PicWordRound,
  StoryLevel,
} from '@hangul-route/content-schema';
import { lp } from './scope-builders';
import { storyScopeFor } from './story/story-ref';

/**
 * Maps a quest's minigame ref into a concrete content scope.
 * Each Stage 1 quest declares the jamo / words its minigames should target.
 */

/** Which story, level and (optionally) subset a story minigame plays (F-STORY-003 §3.1). */
export interface StoryScope {
  /** 'story:seollal-new-year' */
  storyId: string;
  level: StoryLevel;
  /** story-check: subset / order override (default: every check of the tier). */
  checkIds?: string[];
  /** story-sequence: override (default: tier.sequenceSceneIds). */
  sceneIds?: string[];
}

export interface MinigameScope {
  kind: MinigameKind;
  jamoIds?: string[];
  /** Match Sound: symbols asked at least once however the prompts fall (the quest's new symbols, F-QUEST-002 §3.4). */
  focusJamoIds?: string[];
  syllables?: Array<{ ko: string; romanization: string; jamoChars: string[]; jamoIds?: string[] }>;
  cardPairs?: Array<{ ko: string; en: string; romanization?: string }>;
  storySteps?: Array<{ id: string; labelEn: string; labelKo?: string; romanization?: string }>;
  dialogue?: Array<{
    npcKo: string;
    npcRomanization?: string;
    npcEn: string;
    options: Array<{ ko: string; romanization?: string; en: string; isCorrect: boolean }>;
  }>;
  rounds?: number;
  /** Story minigames (story-read / story-check / story-sequence), from `storyScopeFor`. */
  story?: StoryScope;
  /** Listen & Pick rounds, built with `lp.*` (F-QUEST-002 §3.10). */
  listenPick?: { rounds: ListenPickRound[] };
  /** Pic-Word Match boards, built with `pw` (F-QUEST-002 §3.11). */
  picWord?: { boards: PicWordRound[] };
}

const J = (id: string): string => `jamo:${id}`;
const Jb = (id: string): string => `jamo:${id}-batchim`;

/** The symbols the Letters quests teach (F-QUEST-002 §3.6): quest 1, 2 and 3. */
const L1 = [J('a'), J('eo'), J('giyeok'), J('nieun')];
const L2 = [J('o'), J('u'), J('mieum'), J('ieung')];
const L3 = [J('eu'), J('i'), J('digeut'), J('rieul')];

const word = (ko: string, romanization: string, en: string, syllables?: string[]): KoText =>
  syllables ? { ko, romanization, en, syllables } : { ko, romanization, en };

/** Reading words of the Letters quests: built only from symbols taught so far (R3). */
const W = {
  na: word('나', 'na', 'I, me'),
  neo: word('너', 'neo', 'you'),
  ga: word('가', 'ga', 'the sound ga'),
  geo: word('거', 'geo', 'the sound geo'),
  namu: word('나무', 'namu', 'tree', ['na', 'mu']),
  neomu: word('너무', 'neomu', 'too much', ['neo', 'mu']),
  gagu: word('가구', 'gagu', 'furniture', ['ga', 'gu']),
  o: word('오', 'o', 'five'),
  dari: word('다리', 'dari', 'leg, bridge', ['da', 'ri']),
  ai: word('아이', 'ai', 'child', ['a', 'i']),
  eomeoni: word('어머니', 'eomeoni', 'mother', ['eo', 'meo', 'ni']),
  deurama: word('드라마', 'deurama', 'drama', ['deu', 'ra', 'ma']),
} as const;

export const minigameScopes: Record<string, MinigameScope> = {
  // Stage 1 / Letters / Q1 — ㅏ ㅓ ㄱ ㄴ (F-QUEST-002 §3.6, quest 1)
  'minigame:s1-letters-q1-play': {
    kind: 'match-sound',
    jamoIds: L1,
    focusJamoIds: L1,
    rounds: 6,
  },
  'minigame:s1-letters-q1-apply': {
    kind: 'build-letter',
    syllables: [
      { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
      { ko: '거', romanization: 'geo', jamoChars: ['ㄱ', 'ㅓ'] },
      { ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] },
      { ko: '너', romanization: 'neo', jamoChars: ['ㄴ', 'ㅓ'] },
    ],
  },
  'minigame:s1-letters-q1-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        // Fewer than four of a kind are taught yet, so the options are the quest's four new symbols (§3.3).
        lp.sym(J('eo'), L1, { optionIds: [J('eo'), J('a'), J('giyeok'), J('nieun')] }),
        lp.word(W.neo, [W.ga, W.geo, W.na]),
      ],
    },
  },

  // Stage 1 / Letters / Q2 — ㅗ ㅜ ㅁ ㅇ, reviewing quest 1 (quest 2)
  'minigame:s1-letters-q2-play': {
    kind: 'match-sound',
    jamoIds: [...L2, ...L1],
    focusJamoIds: L2,
    rounds: 6,
  },
  'minigame:s1-letters-q2-apply': {
    kind: 'trace-stroke',
    jamoIds: [J('mieum'), J('ieung'), J('o'), J('u')],
    rounds: 4,
  },
  'minigame:s1-letters-q2-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [lp.sym(J('u'), [...L1, ...L2]), lp.word(W.namu, [W.neomu, W.gagu, W.o])],
    },
  },

  // Stage 1 / Letters / Q3 — ㅡ ㅣ ㄷ ㄹ, reviewing quest 2 (quest 3)
  'minigame:s1-letters-q3-play': {
    kind: 'match-sound',
    jamoIds: [...L3, ...L2],
    focusJamoIds: L3,
    rounds: 6,
  },
  'minigame:s1-letters-q3-apply': {
    kind: 'odd-one-out',
    jamoIds: [J('digeut'), J('rieul'), J('giyeok'), J('nieun'), J('mieum'), J('eu'), J('i'), J('a')],
    rounds: 4,
  },
  'minigame:s1-letters-q3-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [lp.sym(J('eu'), [...L1, ...L2, ...L3]), lp.word(W.dari, [W.ai, W.eomeoni, W.deurama])],
    },
  },

  // Stage 1 / Food & Life
  'minigame:s1-life-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '김치', en: 'Kimchi', romanization: 'gimchi' },
      { ko: '밥', en: 'Rice', romanization: 'bap' },
      { ko: '김밥', en: 'Kimbap', romanization: 'gimbap' },
      { ko: '젓가락', en: 'Chopsticks', romanization: 'jeotgarak' },
    ],
  },
  'minigame:s1-life-card-2': {
    kind: 'card-match',
    cardPairs: [
      { ko: '엄마', en: 'Mom', romanization: 'eomma' },
      { ko: '아빠', en: 'Dad', romanization: 'appa' },
      { ko: '가족', en: 'Family', romanization: 'gajok' },
      { ko: '집', en: 'Home', romanization: 'jip' },
    ],
  },
  'minigame:s1-life-match-1': {
    kind: 'match-sound',
    jamoIds: [J('giyeok'), J('mieum'), J('bieup'), J('jieut')],
    rounds: 4,
  },
  'minigame:s1-life-story-1': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기', romanization: 'son ssitgi' },
      { id: 'b', labelEn: 'Set the table', labelKo: '상 차리기', romanization: 'sang charigi' },
      { id: 'c', labelEn: 'Eat with family', labelKo: '같이 먹기', romanization: 'gachi meokgi' },
      { id: 'd', labelEn: 'Say thanks', labelKo: '잘 먹었습니다', romanization: 'jal meogeotseumnida' },
    ],
  },

  // Stage 1 / Rites
  'minigame:s1-rites-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '설날', en: 'Lunar New Year', romanization: 'seollal' },
      { ko: '떡국', en: 'Rice cake soup', romanization: 'tteokguk' },
      { ko: '한복', en: 'Hanbok', romanization: 'hanbok' },
      { ko: '세배', en: 'New Year bow', romanization: 'sebae' },
    ],
  },
  'minigame:s1-rites-match-1': {
    kind: 'match-sound',
    jamoIds: [J('siot'), J('digeut'), J('rieul'), J('hieut')],
    rounds: 4,
  },
  'minigame:s1-rites-story-1': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Wear hanbok', labelKo: '한복 입기', romanization: 'hanbok ipgi' },
      { id: 'b', labelEn: 'Bow to elders', labelKo: '세배 드리기', romanization: 'sebae deurigi' },
      { id: 'c', labelEn: 'Eat tteokguk', labelKo: '떡국 먹기', romanization: 'tteokguk meokgi' },
      { id: 'd', labelEn: 'Receive lucky money', labelKo: '세뱃돈 받기', romanization: 'sebaetdon batgi' },
    ],
  },

  // Stage 1 / Nature
  'minigame:s1-nature-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '호랑이', en: 'Tiger', romanization: 'horangi' },
      { ko: '까치', en: 'Magpie', romanization: 'kkachi' },
      { ko: '달', en: 'Moon', romanization: 'dal' },
      { ko: '산', en: 'Mountain', romanization: 'san' },
    ],
  },
  'minigame:s1-nature-match-1': {
    kind: 'match-sound',
    jamoIds: [J('hieut'), J('kieuk'), J('mieum'), J('siot')],
    rounds: 4,
  },

  // Stage 1 / Crafts
  'minigame:s1-crafts-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '윷', en: 'Yut sticks', romanization: 'yut' },
      { ko: '연', en: 'Kite', romanization: 'yeon' },
      { ko: '팽이', en: 'Top', romanization: 'paengi' },
      { ko: '제기', en: 'Foot shuttlecock', romanization: 'jegi' },
    ],
  },
  'minigame:s1-crafts-match-1': {
    kind: 'match-sound',
    jamoIds: [J('ieung'), J('pieup'), J('jieut'), J('kieuk')],
    rounds: 4,
  },
  'minigame:s1-crafts-story-1': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Pick teams', labelKo: '편 가르기', romanization: 'pyeon gareugi' },
      { id: 'b', labelEn: 'Throw the yut', labelKo: '윷 던지기', romanization: 'yut deonjigi' },
      { id: 'c', labelEn: 'Move the piece', labelKo: '말 옮기기', romanization: 'mal omgigi' },
      { id: 'd', labelEn: 'Win!', labelKo: '승리!', romanization: 'seungni' },
    ],
  },

  // Stage 1 / Nature — Culture Quiz (Korean word -> English meaning)
  'minigame:s1-nature-quiz-1': {
    kind: 'culture-quiz',
    cardPairs: [
      { ko: '호랑이', en: 'Tiger', romanization: 'horangi' },
      { ko: '까치', en: 'Magpie', romanization: 'kkachi' },
      { ko: '달', en: 'Moon', romanization: 'dal' },
      { ko: '산', en: 'Mountain', romanization: 'san' },
      { ko: '바다', en: 'Sea', romanization: 'bada' },
    ],
    rounds: 4,
  },

  // Stage 2 / Food & Daily Life — Lunch Box Words (taste)
  'minigame:s2-life-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '사과', en: 'Apple', romanization: 'sagwa' },
      { ko: '우유', en: 'Milk', romanization: 'uyu' },
      { ko: '빵', en: 'Bread', romanization: 'ppang' },
      { ko: '김밥', en: 'Kimbap', romanization: 'gimbap' },
      { ko: '밥', en: 'Rice', romanization: 'bap' },
    ],
  },
  'minigame:s2-life-quiz-1': {
    kind: 'culture-quiz',
    cardPairs: [
      { ko: '사과', en: 'Apple', romanization: 'sagwa' },
      { ko: '우유', en: 'Milk', romanization: 'uyu' },
      { ko: '빵', en: 'Bread', romanization: 'ppang' },
      { ko: '김치', en: 'Kimchi', romanization: 'gimchi' },
      { ko: '물', en: 'Water', romanization: 'mul' },
    ],
    rounds: 4,
  },
  'minigame:s2-life-build-1': {
    kind: 'build-letter',
    syllables: [
      { ko: '물', romanization: 'mul', jamoChars: ['ㅁ', 'ㅜ', 'ㄹ'] },
      { ko: '산', romanization: 'san', jamoChars: ['ㅅ', 'ㅏ', 'ㄴ'] },
      { ko: '달', romanization: 'dal', jamoChars: ['ㄷ', 'ㅏ', 'ㄹ'] },
      { ko: '곰', romanization: 'gom', jamoChars: ['ㄱ', 'ㅗ', 'ㅁ'] },
    ],
  },

  // Stage 2 / Nature & Animals — Outdoor Words (taste)
  'minigame:s2-nature-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '하늘', en: 'Sky', romanization: 'haneul' },
      { ko: '꽃', en: 'Flower', romanization: 'kkot' },
      { ko: '나무', en: 'Tree', romanization: 'namu' },
      { ko: '산', en: 'Mountain', romanization: 'san' },
      { ko: '바다', en: 'Sea', romanization: 'bada' },
    ],
  },
  'minigame:s2-nature-quiz-1': {
    kind: 'culture-quiz',
    cardPairs: [
      { ko: '하늘', en: 'Sky', romanization: 'haneul' },
      { ko: '별', en: 'Star', romanization: 'byeol' },
      { ko: '강', en: 'River', romanization: 'gang' },
      { ko: '봄', en: 'Spring', romanization: 'bom' },
      { ko: '눈', en: 'Snow', romanization: 'nun' },
    ],
    rounds: 4,
  },
  'minigame:s2-nature-build-1': {
    kind: 'build-letter',
    syllables: [
      { ko: '별', romanization: 'byeol', jamoChars: ['ㅂ', 'ㅕ', 'ㄹ'] },
      { ko: '강', romanization: 'gang', jamoChars: ['ㄱ', 'ㅏ', 'ㅇ'] },
      { ko: '봄', romanization: 'bom', jamoChars: ['ㅂ', 'ㅗ', 'ㅁ'] },
      { ko: '돌', romanization: 'dol', jamoChars: ['ㄷ', 'ㅗ', 'ㄹ'] },
    ],
  },

  // Stage 4 / Holidays & Traditions — Greeting Dialogues (taste)
  'minigame:s4-rites-respond-1': {
    kind: 'tap-respond',
    dialogue: [
      {
        npcKo: '안녕하세요!',
        npcRomanization: 'annyeonghaseyo',
        npcEn: 'Hello!',
        options: [
          { ko: '안녕하세요', romanization: 'annyeonghaseyo', en: 'Hello', isCorrect: true },
          { ko: '잘 가요', romanization: 'jal gayo', en: 'Goodbye', isCorrect: false },
          { ko: '고마워요', romanization: 'gomawoyo', en: 'Thank you', isCorrect: false },
        ],
      },
      {
        npcKo: '이름이 뭐예요?',
        npcRomanization: 'ireumi mwoyeyo',
        npcEn: "What's your name?",
        options: [
          { ko: '저는 호야예요', romanization: 'jeoneun hoyayeyo', en: 'I am Hoya', isCorrect: true },
          { ko: '네, 좋아요', romanization: 'ne, joayo', en: 'Yes, good', isCorrect: false },
          { ko: '사과 주세요', romanization: 'sagwa juseyo', en: 'Apple, please', isCorrect: false },
        ],
      },
      {
        npcKo: '만나서 반가워요!',
        npcRomanization: 'mannaseo bangawoyo',
        npcEn: 'Nice to meet you!',
        options: [
          { ko: '저도 반가워요', romanization: 'jeodo bangawoyo', en: 'Nice to meet you too', isCorrect: true },
          { ko: '아니요', romanization: 'aniyo', en: 'No', isCorrect: false },
          { ko: '몰라요', romanization: 'mollayo', en: "I don't know", isCorrect: false },
        ],
      },
    ],
  },
  'minigame:s4-rites-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '안녕', en: 'Hello', romanization: 'annyeong' },
      { ko: '감사', en: 'Thanks', romanization: 'gamsa' },
      { ko: '친구', en: 'Friend', romanization: 'chingu' },
      { ko: '이름', en: 'Name', romanization: 'ireum' },
      { ko: '인사', en: 'Greeting', romanization: 'insa' },
    ],
  },
  'minigame:s4-rites-quiz-1': {
    kind: 'culture-quiz',
    cardPairs: [
      { ko: '안녕', en: 'Hello', romanization: 'annyeong' },
      { ko: '감사', en: 'Thanks', romanization: 'gamsa' },
      { ko: '친구', en: 'Friend', romanization: 'chingu' },
      { ko: '이름', en: 'Name', romanization: 'ireum' },
      { ko: '인사', en: 'Greeting', romanization: 'insa' },
    ],
    rounds: 4,
  },
};

export function scopeFor(ref: string): MinigameScope | undefined {
  return minigameScopes[ref] ?? storyScopeFor(ref);
}

// Suppress unused-import warning for type used in JSDoc
export type { MinigameKind };
export { lp, pw } from './scope-builders';
