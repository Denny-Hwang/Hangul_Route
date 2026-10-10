/**
 * Review escape hatches and fixed tables for the romanization checker (F-CNT-002 §3.3, C6, C7).
 */

/**
 * A Korean string whose accepted romanization differs from the converter's output
 * because of a documented converter limit (ㄴ-insertion, 밟-, a proper-noun
 * convention). `reason` must name the limit; an entry without a reason, or one that
 * matches nothing in the scanned sources, fails the build (rule romanization-exception-stale).
 */
export interface RomanizationException {
  ko: string;
  allowed: readonly string[];
  reason: string;
}

/** Ships empty: every current mismatch is a real error (F-CNT-002 §3.3). */
export const ROMANIZATION_EXCEPTIONS: readonly RomanizationException[] = [];

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
