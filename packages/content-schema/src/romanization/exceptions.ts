/**
 * Review escape hatches and fixed tables for the romanization checker (F-CNT-002 §3.3, C6, C7).
 */
import type { RomanizationGap } from './gaps';

/**
 * An entry of the reviewed list as the app reads it (`romanizeReviewed`, AMENDMENTS-START-BUNDLE-2026-11 SB-4a): a Korean
 * string or word and the romanizations it is accepted with. Why the converter is wrong, and which gap the entry covers, is
 * its note in `exception-notes.ts`, which only the lint reads and the app's bundle does not carry.
 */
export interface ReviewedEntry {
  /** A whole Korean string (as before), or one word: a whitespace-free token, sentence marks stripped. */
  ko: string;
  /** The accepted romanizations. A word entry holds exactly one; its value is the reviewed one (romanizeReviewed). */
  allowed: readonly string[];
}

/**
 * The joined view of an entry and its note (`entryWithNote`): a converter gap (ㄴ-insertion, 사이시옷 before 이, the
 * juncture before a content morpheme, a predicate's ㅎ; AMENDMENTS-ROMANIZER-GAPS), or a word the detectors flag that the
 * converter already gets right (a confirmation). An entry without a reason, or one that matches nothing in the checked
 * sources, fails the build (rule romanization-exception-stale).
 */
export interface RomanizationException extends ReviewedEntry {
  /**
   * Why the converter is wrong, or why this word needs no change: names the article (표준 발음법 제N항,
   * 로마자 표기법 제3장 제1항) or the 표준국어대사전 pronunciation.
   */
  reason: string;
  /** Which converter gap the entry covers. */
  gap: RomanizationGap | 'proper-noun' | 'other';
}

/**
 * A word entry (a `ko` with no space) applies wherever the word stands alone in a text; a whole-string
 * entry only to that sentence. R9 (`detectGaps`) demands an entry for every flagged word; add the two
 * lines the message prints (the entry here, its `{ gap, reason }` note in `exception-notes.ts`), after
 * looking the word up in 표준국어대사전. The six sentence entries below came with the story drafts imported after F-CNT-002
 * PR 2b (content/stories/); the rest with AMENDMENTS-ROMANIZER-GAPS row RG-2b.
 */
export const ROMANIZATION_EXCEPTIONS: readonly ReviewedEntry[] = [
  {
    ko: '솔잎',
    allowed: ['sollip'],
  },
  {
    ko: '왜 기록할까요?',
    allowed: ['wae girokalkkayo'],
  },
  {
    ko: '송편은 솔잎을 깔고 쪄요.',
    allowed: ['songpyeoneun sollipeul kkalgo jjyeoyo.'],
  },
  {
    ko: '호랑이가 엄마인 척해요.',
    allowed: ['horangiga eommain cheokaeyo.'],
  },
  // F-CURR-002 row CM-46a: the read tiers of sillok-royal-historians and joseon-records-today say 기록했어요.
  {
    ko: '기록했어요',
    allowed: ['girokaesseoyo'],
  },
  {
    ko: '사관이 기록했어요.',
    allowed: ['sagwani girokaesseoyo.'],
  },
  {
    ko: '사관이 왕의 말을 기록했어요.',
    allowed: ['sagwani wangui mareul girokaesseoyo.'],
  },
  {
    ko: '화성을 기록했어요.',
    allowed: ['hwaseongeul girokaesseoyo.'],
  },
  // AMENDMENTS-ROMANIZER-GAPS §3.7, OD-RG1 (a): a 하다 predicate aspirates, a noun keeps its ㅎ.
  {
    ko: '북한산',
    allowed: ['bukhansan'],
  },
  {
    ko: '북한산에',
    allowed: ['bukhansane'],
  },
  {
    ko: '따뜻해요',
    allowed: ['ttatteutaeyo'],
  },
  {
    ko: '딱딱해요',
    allowed: ['ttakttakaeyo'],
  },
  {
    ko: '축하해요',
    allowed: ['chukahaeyo'],
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
