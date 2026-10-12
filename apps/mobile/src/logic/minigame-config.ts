import type {
  KoText,
  ListenPickRound,
  MinigameKind,
  PicWordRound,
  StoryLevel,
} from '@hangul-route/content-schema';
import { lp, pw } from './scope-builders';
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
/** The symbols the Food & Life quests teach: quest 4, 5 and 6. */
const F1 = [J('jieut'), J('chieut')];
const F2 = [J('bieup'), J('siot')];
const F3 = [J('kieuk'), J('tieut')];
/** Everything taught through quest 3, 4, 5 and 6 (the "taught" list of each Check). */
const THRU_L3 = [...L1, ...L2, ...L3];
const THRU_F1 = [...THRU_L3, ...F1];
const THRU_F2 = [...THRU_F1, ...F2];
const THRU_F3 = [...THRU_F2, ...F3];
/** The symbols the Holidays quests teach: quest 7 (the first finals), 8 and 9. */
const R1 = [Jb('nieun'), Jb('rieul')];
const R2 = [J('ya'), J('yeo'), J('pieup'), Jb('ieung')];
const R3 = [J('yo'), J('yu'), J('hieut'), Jb('giyeok')];
/** Everything taught through quest 9 (the "taught" list of its practice and Check). */
const THRU_R1 = [...THRU_F3, ...R1];
const THRU_R2 = [...THRU_R1, ...R2];
const THRU_R3 = [...THRU_R2, ...R3];

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
  // Food & Life (quests 4-6)
  jadu: word('자두', 'jadu', 'plum', ['ja', 'du']),
  chijeu: word('치즈', 'chijeu', 'cheese', ['chi', 'jeu']),
  gochu: word('고추', 'gochu', 'chili pepper', ['go', 'chu']),
  cha: word('차', 'cha', 'tea'),
  abeoji: word('아버지', 'abeoji', 'father', ['a', 'beo', 'ji']),
  agi: word('아기', 'agi', 'baby', ['a', 'gi']),
  banana: word('바나나', 'banana', 'banana', ['ba', 'na', 'na']),
  dubu: word('두부', 'dubu', 'tofu', ['du', 'bu']),
  tomato: word('토마토', 'tomato', 'tomato', ['to', 'ma', 'to']),
  kokoa: word('코코아', 'kokoa', 'cocoa', ['ko', 'ko', 'a']),
  kuki: word('쿠키', 'kuki', 'cookie', ['ku', 'ki']),
  toseuteu: word('토스트', 'toseuteu', 'toast', ['to', 'seu', 'teu']),
  // Holidays (quests 7-9)
  dal: word('달', 'dal', 'moon'),
  mun: word('문', 'mun', 'door'),
  seol: word('설', 'seol', 'New Year (short for seollal)'),
  nal: word('날', 'nal', 'day'),
  seollal: word('설날', 'seollal', 'Lunar New Year', ['seol', 'lal']),
  songpyeon: word('송편', 'songpyeon', 'half-moon rice cake', ['song', 'pyeon']),
  podo: word('포도', 'podo', 'grape', ['po', 'do']),
  yagu: word('야구', 'yagu', 'baseball', ['ya', 'gu']),
  yeou: word('여우', 'yeou', 'fox', ['yeo', 'u']),
  hanbok: word('한복', 'hanbok', 'hanbok, traditional clothes', ['han', 'bok']),
  hanguk: word('한국', 'hanguk', 'Korea', ['han', 'guk']),
  hyodo: word('효도', 'hyodo', 'respect for parents', ['hyo', 'do']),
  uyu: word('우유', 'uyu', 'milk', ['u', 'yu']),
  // Nature (quests 10-12)
  gom: word('곰', 'gom', 'bear'),
  bom: word('봄', 'bom', 'spring (season)'),
  bap: word('밥', 'bap', 'rice'),
  jip: word('집', 'jip', 'house'),
  san: word('산', 'san', 'mountain'),
  gang: word('강', 'gang', 'river'),
  bada: word('바다', 'bada', 'sea', ['ba', 'da']),
  haneul: word('하늘', 'haneul', 'sky', ['ha', 'neul']),
  byeol: word('별', 'byeol', 'star'),
  bam: word('밤', 'bam', 'night'),
  boreumdal: word('보름달', 'boreumdal', 'full moon', ['bo', 'reum', 'dal']),
  // Crafts (quests 13-15)
  yeon: word('연', 'yeon', 'kite'),
  gong: word('공', 'gong', 'ball'),
  jul: word('줄', 'jul', 'rope'),
  nori: word('놀이', 'nori', 'play, game', ['no', 'ri']),
  hanji: word('한지', 'hanji', 'Korean paper', ['han', 'ji']),
  jongi: word('종이', 'jongi', 'paper', ['jong', 'i']),
  cheongja: word('청자', 'cheongja', 'celadon pottery', ['cheong', 'ja']),
  dojagi: word('도자기', 'dojagi', 'pottery', ['do', 'ja', 'gi']),
  hangeul: word('한글', 'hangeul', 'the Korean alphabet', ['han', 'geul']),
  hoya: word('호야', 'hoya', 'Hoya, the tiger', ['ho', 'ya']),
  annyeong: word('안녕', 'annyeong', 'hi, bye (to friends)', ['an', 'nyeong']),
  sarang: word('사랑', 'sarang', 'love', ['sa', 'rang']),
} as const;

/** Theme words (pictured culture words, exposure only, R3): they may hold symbols not taught yet. */
const T = {
  gimchi: word('김치', 'gimchi', 'kimchi', ['gim', 'chi']),
  bap: word('밥', 'bap', 'rice'),
  gimbap: word('김밥', 'gimbap', 'kimbap', ['gim', 'bap']),
  jeotgarak: word('젓가락', 'jeotgarak', 'chopsticks', ['jeot', 'ga', 'rak']),
  // Nature and Crafts Pic-Word boards (quests 10, 13, 14): glosses name what the card picture shows.
  horangi: word('호랑이', 'horangi', 'tiger', ['ho', 'rang', 'i']),
  kkachi: word('까치', 'kkachi', 'magpie', ['kka', 'chi']),
  yut: word('윷', 'yut', 'yut sticks'),
  paengi: word('팽이', 'paengi', 'spinning top', ['paeng', 'i']),
  jegi: word('제기', 'jegi', 'foot shuttlecock', ['je', 'gi']),
  but: word('붓', 'but', 'writing brush'),
  jongijeopgi: word('종이접기', 'jongijeopgi', 'paper folding', ['jong', 'i', 'jeop', 'gi']),
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
      rounds: [lp.sym(J('eu'), THRU_L3), lp.word(W.dari, [W.ai, W.eomeoni, W.deurama])],
    },
  },

  // Stage 1 / Food & Life / Q4 — ㅈ ㅊ, reviewing ㄱ ㄴ ㄷ ㄹ (quest 4)
  'minigame:s1-life-q1-play': {
    kind: 'match-sound',
    jamoIds: [...F1, J('giyeok'), J('nieun'), J('digeut'), J('rieul'), J('mieum'), J('ieung')],
    focusJamoIds: F1,
    rounds: 6,
  },
  // The first Pic-Word board (section 3.11): food theme words on their card pictures.
  'minigame:s1-life-q1-apply': {
    kind: 'pic-word-match',
    picWord: {
      boards: [
        pw([
          { word: T.gimchi, picture: 'card:kimchi' },
          { word: T.bap, picture: 'card:rice' },
          { word: T.gimbap, picture: 'card:kimbap' },
          { word: T.jeotgarak, picture: 'card:chopsticks' },
        ]),
      ],
    },
  },
  'minigame:s1-life-q1-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.sym(J('chieut'), THRU_F1, { optionIds: [J('chieut'), J('jieut'), J('giyeok'), J('digeut')] }),
        lp.word(W.chijeu, [W.jadu, W.gochu, W.cha]),
      ],
    },
  },

  // Stage 1 / Food & Life / Q5 — ㅂ ㅅ, reviewing ㅈ ㅊ ㅁ ㅇ (quest 5)
  'minigame:s1-life-q2-play': {
    kind: 'match-sound',
    jamoIds: [...F2, ...F1, J('mieum'), J('ieung'), J('giyeok'), J('digeut')],
    focusJamoIds: F2,
    rounds: 6,
  },
  'minigame:s1-life-q2-apply': {
    kind: 'build-letter',
    syllables: [
      { ko: '바', romanization: 'ba', jamoChars: ['ㅂ', 'ㅏ'] },
      { ko: '보', romanization: 'bo', jamoChars: ['ㅂ', 'ㅗ'] },
      { ko: '사', romanization: 'sa', jamoChars: ['ㅅ', 'ㅏ'] },
      { ko: '수', romanization: 'su', jamoChars: ['ㅅ', 'ㅜ'] },
    ],
  },
  'minigame:s1-life-q2-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.sym(J('siot'), THRU_F2, { optionIds: [J('siot'), J('jieut'), J('bieup'), J('mieum')] }),
        lp.word(W.abeoji, [W.agi, W.banana, W.dubu]),
      ],
    },
  },

  // Stage 1 / Food & Life / Q6 — ㅋ ㅌ next to their soft twins ㄱ ㄷ, and ㅂ ㅅ ㅈ ㅊ (quest 6)
  'minigame:s1-life-q3-play': {
    kind: 'match-sound',
    jamoIds: [...F3, J('giyeok'), J('digeut'), ...F2, ...F1],
    focusJamoIds: F3,
    rounds: 6,
  },
  'minigame:s1-life-q3-apply': {
    kind: 'culture-quiz',
    cardPairs: [
      { ko: '토마토', en: 'Tomato', romanization: 'tomato' },
      { ko: '코코아', en: 'Cocoa', romanization: 'kokoa' },
      { ko: '쿠키', en: 'Cookie', romanization: 'kuki' },
      { ko: '토스트', en: 'Toast', romanization: 'toseuteu' },
      { ko: '김밥', en: 'Kimbap', romanization: 'gimbap' },
    ],
    rounds: 4,
  },
  'minigame:s1-life-q3-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.sym(J('kieuk'), THRU_F3, { optionIds: [J('kieuk'), J('giyeok'), J('tieut'), J('digeut')] }),
        lp.word(W.tomato, [W.kokoa, W.kuki, W.toseuteu]),
      ],
    },
  },

  // Stage 1 / Holidays / Q7 — final ㄴ and final ㄹ, reviewing ㅁ ㅇ ㄷ ㅅ (quest 7)
  'minigame:s1-rites-q1-play': {
    kind: 'listen-pick',
    listenPick: {
      // Hear a syllable, pick it among the same block with no final, final n and final l.
      rounds: [
        lp.syl('달', ['다', '단'], W.dal.en),
        lp.syl('단', ['다', '달']),
        lp.syl('물', ['무', '문'], 'water'),
        lp.syl('문', ['무', '물'], W.mun.en),
        lp.syl('산', ['사', '살'], 'mountain'),
        lp.syl('살', ['사', '산']),
      ],
    },
  },
  'minigame:s1-rites-q1-apply': {
    kind: 'build-letter',
    syllables: [
      { ko: '달', romanization: 'dal', jamoChars: ['ㄷ', 'ㅏ', 'ㄹ'], jamoIds: [J('digeut'), J('a'), Jb('rieul')] },
      { ko: '물', romanization: 'mul', jamoChars: ['ㅁ', 'ㅜ', 'ㄹ'], jamoIds: [J('mieum'), J('u'), Jb('rieul')] },
      { ko: '문', romanization: 'mun', jamoChars: ['ㅁ', 'ㅜ', 'ㄴ'], jamoIds: [J('mieum'), J('u'), Jb('nieun')] },
      { ko: '산', romanization: 'san', jamoChars: ['ㅅ', 'ㅏ', 'ㄴ'], jamoIds: [J('siot'), J('a'), Jb('nieun')] },
    ],
  },
  'minigame:s1-rites-q1-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [lp.syl('달', ['다', '단'], W.dal.en), lp.word(W.seollal, [W.seol, W.nal, W.dal])],
    },
  },

  // Stage 1 / Holidays / Q8 — ㅑ ㅕ ㅍ and final ㅇ, reviewing ㅂ ㅋ ㅏ ㅓ (quest 8)
  'minigame:s1-rites-q2-play': {
    kind: 'match-sound',
    // ㅍ next to ㅂ ㅋ ㅌ (its confusables), ㅑ ㅕ next to ㅏ ㅓ.
    jamoIds: [J('ya'), J('yeo'), J('pieup'), J('a'), J('eo'), J('bieup'), J('kieuk'), J('tieut')],
    focusJamoIds: [J('ya'), J('yeo'), J('pieup')],
    rounds: 6,
  },
  'minigame:s1-rites-q2-apply': {
    kind: 'build-letter',
    syllables: [
      { ko: '송', romanization: 'song', jamoChars: ['ㅅ', 'ㅗ', 'ㅇ'], jamoIds: [J('siot'), J('o'), Jb('ieung')] },
      { ko: '편', romanization: 'pyeon', jamoChars: ['ㅍ', 'ㅕ', 'ㄴ'], jamoIds: [J('pieup'), J('yeo'), Jb('nieun')] },
      { ko: '야', romanization: 'ya', jamoChars: ['ㅇ', 'ㅑ'], jamoIds: [J('ieung'), J('ya')] },
      { ko: '여', romanization: 'yeo', jamoChars: ['ㅇ', 'ㅕ'], jamoIds: [J('ieung'), J('yeo')] },
    ],
  },
  'minigame:s1-rites-q2-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [lp.syl('송', ['소', '손']), lp.word(W.songpyeon, [W.podo, W.yagu, W.yeou])],
    },
  },

  // Stage 1 / Holidays / Q9 — ㅛ ㅠ ㅎ and final ㄱ, reviewing ㅇ ㅗ ㅜ and final ㄴ (quest 9)
  'minigame:s1-rites-q3-play': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.sym(J('hieut'), THRU_R3),
        lp.sym(J('yo'), THRU_R3),
        lp.sym(J('yu'), THRU_R3),
        // Final ㄱ next to no final and the finals taught before it.
        lp.syl('복', ['보', '봉'], 'luck'),
        lp.syl('한', ['하', '학']),
        lp.syl('학', ['하', '항']),
      ],
    },
  },
  // "New Year Order": the four steps of the old rites story scope, with their romanization (F-CNT-002 PR 2b).
  'minigame:s1-rites-q3-apply': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Wear hanbok', labelKo: '한복 입기', romanization: 'hanbok ipgi' },
      { id: 'b', labelEn: 'Bow to elders', labelKo: '세배 드리기', romanization: 'sebae deurigi' },
      { id: 'c', labelEn: 'Eat tteokguk', labelKo: '떡국 먹기', romanization: 'tteokguk meokgi' },
      { id: 'd', labelEn: 'Receive lucky money', labelKo: '세뱃돈 받기', romanization: 'sebaetdon batgi' },
    ],
  },
  'minigame:s1-rites-q3-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.sym(J('yo'), THRU_R3, { optionIds: [J('yo'), J('o'), J('yu'), J('yeo')] }),
        lp.word(W.hanbok, [W.hanguk, W.hyodo, W.uyu]),
      ],
    },
  },

  // Stage 1 / Nature / Q10 — final ㅁ and final ㅂ, reviewing finals ㄴ ㄹ ㅇ ㄱ (quest 10)
  'minigame:s1-nature-q1-play': {
    kind: 'listen-pick',
    listenPick: {
      // Hear a closed syllable, pick it among four that differ only in the final: m against p, and an earlier final.
      rounds: [
        lp.syl('곰', ['곱', '공', '고'], W.gom.en),
        lp.syl('봄', ['봅', '본', '볼'], W.bom.en),
        lp.syl('밥', ['밤', '반', '박'], W.bap.en),
        lp.syl('집', ['짐', '진', '질'], W.jip.en),
        lp.syl('입', ['임', '인', '일'], 'mouth'),
        lp.syl('감', ['갑', '간', '각'], 'persimmon'),
      ],
    },
  },
  // Animals and sky of Korean stories, on their card pictures.
  'minigame:s1-nature-q1-apply': {
    kind: 'pic-word-match',
    picWord: {
      boards: [
        pw([
          { word: T.horangi, picture: 'card:tiger' },
          { word: T.kkachi, picture: 'card:magpie' },
          { word: W.dal, picture: 'card:moon' },
          { word: W.san, picture: 'card:mountain' },
        ]),
      ],
    },
  },
  'minigame:s1-nature-q1-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [lp.syl('곰', ['고', '공', '골'], W.gom.en), lp.word(W.jip, [W.bap, W.gom, W.bom])],
    },
  },

  // Stage 1 / Nature / Q11 — nothing new: nature words with every final (quest 11)
  'minigame:s1-nature-q2-play': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.word(W.san, [W.gang, W.byeol, W.gom]),
        lp.word(W.gang, [W.san, W.bada, W.haneul]),
        lp.word(W.bada, [W.haneul, W.san, W.byeol]),
        lp.word(W.haneul, [W.bada, W.gang, W.gom]),
        lp.word(W.byeol, [W.gom, W.san, W.gang]),
        lp.word(W.gom, [W.byeol, W.bada, W.haneul]),
      ],
    },
  },
  'minigame:s1-nature-q2-apply': {
    kind: 'build-letter',
    syllables: [
      { ko: '산', romanization: 'san', jamoChars: ['ㅅ', 'ㅏ', 'ㄴ'], jamoIds: [J('siot'), J('a'), Jb('nieun')] },
      { ko: '강', romanization: 'gang', jamoChars: ['ㄱ', 'ㅏ', 'ㅇ'], jamoIds: [J('giyeok'), J('a'), Jb('ieung')] },
      { ko: '별', romanization: 'byeol', jamoChars: ['ㅂ', 'ㅕ', 'ㄹ'], jamoIds: [J('bieup'), J('yeo'), Jb('rieul')] },
      { ko: '곰', romanization: 'gom', jamoChars: ['ㄱ', 'ㅗ', 'ㅁ'], jamoIds: [J('giyeok'), J('o'), Jb('mieum')] },
    ],
  },
  'minigame:s1-nature-q2-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        // Quests that teach nothing new: hear a word, pick its picture (section 3.3).
        lp.pic(W.san, ['card:mountain', 'card:sea', 'card:moon', 'card:tiger']),
        lp.word(W.gang, [W.san, W.bada, W.haneul]),
      ],
    },
  },

  // Stage 1 / Nature / Q12 — nothing new: the night sky (quest 12)
  'minigame:s1-nature-q3-play': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.word(W.dal, [W.byeol, W.bam, W.boreumdal]),
        lp.word(W.byeol, [W.dal, W.bam, W.san]),
        lp.word(W.bam, [W.bom, W.dal, W.byeol]),
        lp.word(W.boreumdal, [W.dal, W.haneul, W.bam]),
        lp.word(W.haneul, [W.boreumdal, W.byeol, W.san]),
        lp.word(W.san, [W.bam, W.dal, W.haneul]),
      ],
    },
  },
  'minigame:s1-nature-q3-apply': {
    kind: 'trace-stroke',
    jamoIds: [Jb('mieum'), Jb('bieup'), Jb('rieul'), Jb('ieung')],
    rounds: 4,
  },
  'minigame:s1-nature-q3-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.pic(W.dal, ['card:moon', 'card:mountain', 'card:sea', 'card:kite']),
        lp.word(W.boreumdal, [W.dal, W.byeol, W.bam]),
      ],
    },
  },

  // Stage 1 / Crafts / Q13 — nothing new: games to play (quest 13)
  'minigame:s1-crafts-q1-play': {
    kind: 'build-letter',
    // Six closed blocks: the four of the section 3.6 table and 북, 밥, so every final but m is built (6 rounds, R4).
    syllables: [
      { ko: '연', romanization: 'yeon', jamoChars: ['ㅇ', 'ㅕ', 'ㄴ'], jamoIds: [J('ieung'), J('yeo'), Jb('nieun')] },
      { ko: '공', romanization: 'gong', jamoChars: ['ㄱ', 'ㅗ', 'ㅇ'], jamoIds: [J('giyeok'), J('o'), Jb('ieung')] },
      { ko: '줄', romanization: 'jul', jamoChars: ['ㅈ', 'ㅜ', 'ㄹ'], jamoIds: [J('jieut'), J('u'), Jb('rieul')] },
      { ko: '놀', romanization: 'nol', jamoChars: ['ㄴ', 'ㅗ', 'ㄹ'], jamoIds: [J('nieun'), J('o'), Jb('rieul')] },
      { ko: '북', romanization: 'buk', jamoChars: ['ㅂ', 'ㅜ', 'ㄱ'], jamoIds: [J('bieup'), J('u'), Jb('giyeok')] },
      { ko: '밥', romanization: 'bap', jamoChars: ['ㅂ', 'ㅏ', 'ㅂ'], jamoIds: [J('bieup'), J('a'), Jb('bieup')] },
    ],
  },
  // Folk games on their card pictures.
  'minigame:s1-crafts-q1-apply': {
    kind: 'pic-word-match',
    picWord: {
      boards: [
        pw([
          { word: T.yut, picture: 'card:yutnori' },
          { word: W.yeon, picture: 'card:kite' },
          { word: T.paengi, picture: 'card:top' },
          { word: T.jegi, picture: 'card:jegi' },
        ]),
      ],
    },
  },
  'minigame:s1-crafts-q1-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.pic(W.yeon, ['card:kite', 'card:top', 'card:jegi', 'card:yutnori']),
        lp.word(W.nori, [W.gong, W.jul, W.yeon]),
      ],
    },
  },

  // Stage 1 / Crafts / Q14 — nothing new: paper and pottery (quest 14)
  'minigame:s1-crafts-q2-play': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.word(W.hanji, [W.jongi, W.cheongja, W.yeon]),
        lp.word(W.jongi, [W.hanji, W.dojagi, W.gong]),
        lp.word(W.cheongja, [W.dojagi, W.hanji, W.jongi]),
        lp.word(W.dojagi, [W.cheongja, W.jongi, W.gong]),
        lp.word(W.yeon, [W.gong, W.hanji, W.cheongja]),
        lp.word(W.gong, [W.yeon, W.dojagi, W.jongi]),
      ],
    },
  },
  // Crafts of paper, clay and the brush, on their card pictures.
  'minigame:s1-crafts-q2-apply': {
    kind: 'pic-word-match',
    picWord: {
      boards: [
        pw([
          { word: W.hanji, picture: 'card:hanji' },
          { word: W.cheongja, picture: 'card:pottery' },
          { word: T.but, picture: 'card:brush' },
          { word: T.jongijeopgi, picture: 'card:origami' },
        ]),
      ],
    },
  },
  'minigame:s1-crafts-q2-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.pic(W.cheongja, ['card:pottery', 'card:hanji', 'card:brush', 'card:origami']),
        lp.word(W.hanji, [W.jongi, W.cheongja, W.dojagi]),
      ],
    },
  },

  // Stage 1 / Crafts / Q15 — nothing new: read Hangul! (quest 15)
  'minigame:s1-crafts-q3-play': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.word(W.hangeul, [W.hanguk, W.hanbok, W.hoya]),
        lp.word(W.hoya, [W.hangeul, W.annyeong, W.sarang]),
        lp.word(W.annyeong, [W.sarang, W.hoya, W.hanguk]),
        lp.word(W.sarang, [W.annyeong, W.hangeul, W.hanbok]),
        lp.word(W.hanguk, [W.hanbok, W.hangeul, W.sarang]),
        lp.word(W.hanbok, [W.hanguk, W.hoya, W.annyeong]),
      ],
    },
  },
  'minigame:s1-crafts-q3-apply': {
    kind: 'build-letter',
    syllables: [
      { ko: '한', romanization: 'han', jamoChars: ['ㅎ', 'ㅏ', 'ㄴ'], jamoIds: [J('hieut'), J('a'), Jb('nieun')] },
      { ko: '글', romanization: 'geul', jamoChars: ['ㄱ', 'ㅡ', 'ㄹ'], jamoIds: [J('giyeok'), J('eu'), Jb('rieul')] },
      { ko: '호', romanization: 'ho', jamoChars: ['ㅎ', 'ㅗ'], jamoIds: [J('hieut'), J('o')] },
      { ko: '야', romanization: 'ya', jamoChars: ['ㅇ', 'ㅑ'], jamoIds: [J('ieung'), J('ya')] },
    ],
  },
  'minigame:s1-crafts-q3-check': {
    kind: 'listen-pick',
    listenPick: {
      rounds: [
        lp.pic(W.hangeul, ['card:hangul-day', 'card:hanbok', 'card:tiger', 'card:book']),
        lp.word(W.annyeong, [W.sarang, W.hoya, W.hangeul]),
      ],
    },
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
