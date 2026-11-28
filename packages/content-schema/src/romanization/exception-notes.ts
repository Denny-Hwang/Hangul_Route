/**
 * What only the lint reads about the reviewed list (AMENDMENTS-START-BUNDLE-2026-11 SB-4a, decision D2): why each entry of
 * `ROMANIZATION_EXCEPTIONS` is there, and the standard names of the letters. `exceptions.ts` holds the values the app
 * needs; this module rides on the `@hangul-route/content-schema/romanization-lint` subpath and is not on the barrel, so
 * its texts are not in the learner app's start bundle. A reviewer who adds an entry adds its note here, keyed by the same
 * `ko`; `romanization-exceptions.test.ts` fails an entry with no note, a note with no entry, and a repeated `ko`.
 */
import type { ReviewedEntry, RomanizationException } from './exceptions';
import type { RomanizationGap } from './gaps';

/** One entry's note: the converter gap it covers and why (the article, or the dictionary entry). */
export interface ExceptionNote {
  /** Which converter gap the entry covers. */
  gap: RomanizationGap | 'proper-noun' | 'other';
  /** Why the converter is wrong, or why this word needs no change: names the article or the 표준국어대사전 pronunciation. */
  reason: string;
}

/** What the checker takes for an entry: a slim one (its note is looked up) or one that carries its own `reason` and `gap`. */
export type ExceptionEntry = ReviewedEntry & Partial<ExceptionNote>;

/** The note of every entry of `ROMANIZATION_EXCEPTIONS`, keyed by the entry's `ko`. */
export const ROMANIZATION_EXCEPTION_NOTES: Readonly<Record<string, ExceptionNote>> = {
  '솔잎': {
    gap: 'n-insertion',
    reason: '표준 발음법 제29항 붙임 1: ㄴ-insertion after ㄹ, 솔잎 is said [솔립], RR sollip; the converter has no compound rule and gives sorip',
  },
  '왜 기록할까요?': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 aspirates in the verb ending (기록할까요 [기로칼까요]); the converter keeps the noun convention (묵호 mukho) and gives girokhalkkayo',
  },
  '송편은 솔잎을 깔고 쪄요.': {
    gap: 'n-insertion',
    reason: '표준 발음법 제29항 붙임 1: ㄴ-insertion in 솔잎 (said [솔립], RR sollip) carries into 솔잎을 [솔리플]; the converter has no compound rule and gives soripeul',
  },
  '호랑이가 엄마인 척해요.': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 척하다 aspirates in the verb ending (척해요 [처캐요]); the converter keeps the noun convention (묵호 mukho) and gives cheokhaeyo',
  },
  '기록했어요': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  '사관이 기록했어요.': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  '사관이 왕의 말을 기록했어요.': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  '화성을 기록했어요.': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates',
  },
  '북한산': {
    gap: 'predicate-h',
    reason: 'a noun (체언), so 로마자 표기법 제3장 제1항 4 다만 keeps the ㅎ (Bukhansan); the converter is right, the entry only confirms it',
  },
  '북한산에': {
    gap: 'predicate-h',
    reason: 'a noun (체언) with a particle, so 로마자 표기법 제3장 제1항 4 다만 keeps the ㅎ (Bukhansane); the converter is right, the entry only confirms it',
  },
  '따뜻해요': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 2: ㅅ+ㅎ in a 하다 predicate is said [따뜨태요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives ttatteuthaeyo',
  },
  '딱딱해요': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 1: ㄱ+ㅎ in a 하다 predicate is said [딱따캐요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives ttakttakhaeyo',
  },
  '축하해요': {
    gap: 'predicate-h',
    reason: '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 1: ㄱ+ㅎ in the 하다 predicate 축하하다 is said [추카해요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives chukhahaeyo',
  },
};

/**
 * An entry with its note: what `checkRomanization` and `checkExceptions` read. An entry that already carries its own
 * `reason` or `gap` (a test's, a fixture's) keeps them; an entry with no note reads as `reason: ''` and `gap: 'other'`,
 * which rule R8 reports.
 */
export function entryWithNote(entry: ExceptionEntry): RomanizationException {
  const note = Object.prototype.hasOwnProperty.call(ROMANIZATION_EXCEPTION_NOTES, entry.ko)
    ? ROMANIZATION_EXCEPTION_NOTES[entry.ko]
    : undefined;
  return {
    ko: entry.ko,
    allowed: entry.allowed,
    reason: entry.reason ?? note?.reason ?? '',
    gap: entry.gap ?? note?.gap ?? 'other',
  };
}

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
