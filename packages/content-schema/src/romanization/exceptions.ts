/**
 * Review escape hatches and fixed tables for the romanization checker (F-CNT-002 §3.3, C6, C7).
 */
import type { RomanizationGap } from './gaps';

/**
 * An entry of the reviewed list: a Korean string or word whose accepted romanization differs from
 * the converter's output because of a converter gap (ㄴ-insertion, 사이시옷 before 이, the juncture
 * before a content morpheme, a predicate's ㅎ; AMENDMENTS-ROMANIZER-GAPS), or a word the detectors
 * flag that the converter already gets right (a confirmation). An entry without a reason, or one that
 * matches nothing in the checked sources, fails the build (rule romanization-exception-stale).
 */
export interface RomanizationException {
  /** A whole Korean string (as before), or one word: a whitespace-free token, sentence marks stripped. */
  ko: string;
  /** The accepted romanizations. A word entry holds exactly one; its value is the reviewed one (romanizeReviewed). */
  allowed: readonly string[];
  /**
   * Why the converter is wrong, or why this word needs no change: names the article (표준 발음법 제N항,
   * 로마자 표기법 제3장 제1항) or the 표준국어대사전 pronunciation.
   */
  reason: string;
  /** Which converter gap the entry covers. */
  gap: RomanizationGap | 'proper-noun' | 'other';
}

/**
 * Entries name the converter gap they cover. A word entry (a `ko` with no space) applies wherever
 * the word stands alone in a text; a whole-string entry only to that sentence. R9 (`detectGaps`)
 * demands an entry for every flagged word; add the line the message prints, after looking the word up
 * in 표준국어대사전. The six sentence entries below came with the story drafts imported after F-CNT-002
 * PR 2b (content/stories/); the rest with AMENDMENTS-ROMANIZER-GAPS row RG-2b.
 */
export const ROMANIZATION_EXCEPTIONS: readonly RomanizationException[] = [
  {
    ko: '솔잎',
    allowed: ['sollip'],
    gap: 'n-insertion',
    reason: '표준 발음법 제29항 붙임 1: ㄴ-insertion after ㄹ, 솔잎 is said [솔립], RR sollip; the converter has no compound rule and gives sorip',
  },
  {
    ko: '왜 기록할까요?',
    allowed: ['wae girokalkkayo'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 aspirates in the verb ending (기록할까요 [기로칼까요]); the converter keeps the noun convention (묵호 mukho) and gives girokhalkkayo',
  },
  {
    ko: '송편은 솔잎을 깔고 쪄요.',
    allowed: ['songpyeoneun sollipeul kkalgo jjyeoyo.'],
    gap: 'n-insertion',
    reason: '표준 발음법 제29항 붙임 1: ㄴ-insertion in 솔잎 (said [솔립], RR sollip) carries into 솔잎을 [솔리플]; the converter has no compound rule and gives soripeul',
  },
  {
    ko: '호랑이가 엄마인 척해요.',
    allowed: ['horangiga eommain cheokaeyo.'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 척하다 aspirates in the verb ending (척해요 [처캐요]); the converter keeps the noun convention (묵호 mukho) and gives cheokhaeyo',
  },
  // F-CURR-002 row CM-46a: the read tiers of sillok-royal-historians and joseon-records-today say 기록했어요.
  {
    ko: '기록했어요',
    allowed: ['girokaesseoyo'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  {
    ko: '사관이 기록했어요.',
    allowed: ['sagwani girokaesseoyo.'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  {
    ko: '사관이 왕의 말을 기록했어요.',
    allowed: ['sagwani wangui mareul girokaesseoyo.'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  {
    ko: '화성을 기록했어요.',
    allowed: ['hwaseongeul girokaesseoyo.'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  // AMENDMENTS-ROMANIZER-GAPS §3.7, OD-RG1 (a): a 하다 predicate aspirates, a noun keeps its ㅎ.
  {
    ko: '북한산',
    allowed: ['bukhansan'],
    gap: 'predicate-h',
    reason: 'a noun (체언), so 로마자 표기법 제3장 제1항 4 다만 keeps the ㅎ (Bukhansan); the converter is right, the entry only confirms it',
  },
  {
    ko: '북한산에',
    allowed: ['bukhansane'],
    gap: 'predicate-h',
    reason: 'a noun (체언) with a particle, so 로마자 표기법 제3장 제1항 4 다만 keeps the ㅎ (Bukhansane); the converter is right, the entry only confirms it',
  },
  {
    ko: '따뜻해요',
    allowed: ['ttatteutaeyo'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 2: ㅅ+ㅎ in a 하다 predicate is said [따뜨태요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives ttatteuthaeyo',
  },
  {
    ko: '딱딱해요',
    allowed: ['ttakttakaeyo'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 1: ㄱ+ㅎ in a 하다 predicate is said [딱따캐요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives ttakttakhaeyo',
  },
  {
    ko: '축하해요',
    allowed: ['chukahaeyo'],
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 1: ㄱ+ㅎ in the 하다 predicate 축하하다 is said [추카해요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives chukhahaeyo',
  },
];

/**
 * What `romanization` may hold for an isolated jamo (C6): teaching sound values, not
 * RR words. The six batchim (final consonants) use k n l m p ng.
 */
export const JAMO_SOUND_VALUES: Readonly<Record<string, readonly string[]>> = {
  'ㄱ': ['g/k', 'k'],
  'ㄴ': ['n'],
  'ㄷ': ['d/t'],
  'ㄹ': ['r/l', 'l'],
  'ㅁ': ['m'],
  'ㅂ': ['b/p', 'p'],
  'ㅅ': ['s'],
  'ㅇ': ['silent/ng', 'ng'],
  'ㅈ': ['j'],
  'ㅊ': ['ch'],
  'ㅋ': ['k'],
  'ㅌ': ['t'],
  'ㅍ': ['p'],
  'ㅎ': ['h'],
  'ㅏ': ['a'],
  'ㅑ': ['ya'],
  'ㅓ': ['eo'],
  'ㅕ': ['yeo'],
  'ㅗ': ['o'],
  'ㅛ': ['yo'],
  'ㅜ': ['u'],
  'ㅠ': ['yu'],
  'ㅡ': ['eu'],
  'ㅣ': ['i'],
  // The nine letters a two-set keyboard key shows that no taught jamo carries yet (F-CURR-001
  // §3.7, design/wireframes/minigame/type-hangul.md open question 1): the tense consonants and
  // the four vowels, at their Revised Romanization values. ㄲ and ㅆ also end a block (밖 bak,
  // 있다 itda), so like ㄱ (g/k) they carry the final value after the slash; ㄸ ㅃ ㅉ never end one.
  'ㄲ': ['kk/k'],
  'ㄸ': ['tt'],
  'ㅃ': ['pp'],
  'ㅆ': ['ss/t'],
  'ㅉ': ['jj'],
  'ㅐ': ['ae'],
  'ㅔ': ['e'],
  'ㅒ': ['yae'],
  'ㅖ': ['ye'],
};

/** Standard RR names of the fourteen consonant letters (§3.1 item 7). */
export const JAMO_NAME_VALUES: Readonly<Record<string, string>> = {
  'ㄱ': 'giyeok',
  'ㄴ': 'nieun',
  'ㄷ': 'digeut',
  'ㄹ': 'rieul',
  'ㅁ': 'mieum',
  'ㅂ': 'bieup',
  'ㅅ': 'siot',
  'ㅇ': 'ieung',
  'ㅈ': 'jieut',
  'ㅊ': 'chieut',
  'ㅋ': 'kieuk',
  'ㅌ': 'tieut',
  'ㅍ': 'pieup',
  'ㅎ': 'hieut',
};
