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

/**
 * Shipped empty by F-CNT-002 PR 1: every mismatch then was a real error. Entries added later
 * name the converter limit they cover (§3.3); the two below came with the story drafts
 * imported after PR 2b (content/stories/).
 */
export const ROMANIZATION_EXCEPTIONS: readonly RomanizationException[] = [
  {
    ko: '솔잎',
    allowed: ['sollip'],
    reason: 'ㄴ-insertion: 솔잎 is said [솔립], RR sollip; the converter has no compound rule and gives sorip',
  },
  {
    ko: '왜 기록할까요?',
    allowed: ['wae girokalkkayo'],
    reason: 'ㄱ+ㅎ across the noun-verb join of 기록하다: the converter keeps the noun convention (묵호 mukho) and gives girokhalkkayo; the verb ending aspirates',
  },
  {
    ko: '송편은 솔잎을 깔고 쪄요.',
    allowed: ['songpyeoneun sollipeul kkalgo jjyeoyo.'],
    reason: 'ㄴ-insertion in 솔잎 (said [솔립], RR sollip) carries into 솔잎을 [솔리플]; the converter has no compound rule and gives soripeul',
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
