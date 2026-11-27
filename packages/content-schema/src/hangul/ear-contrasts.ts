/**
 * The contrasts a learner cannot be asked to tell apart by ear in a lone clip: one list for the Hangul Check's decode
 * items (AMENDMENTS-STAGE1-DECODING-CHECK section 3.4, OD-DC6, with the stricter rules of row DC-2b) and the level
 * check's heard decode items (AMENDMENTS-PLC-VALIDITY section 3.5, D2, row PV-6). `scripts/placement-rules.mjs` mirrors
 * it for the plain-Node lint, and a content-schema test compares the two.
 *
 * Stage 1 letters only (the 14 basic consonants, the 10 basic vowels, the finals ㄱ ㄴ ㄹ ㅁ ㅂ ㅇ): no decode item
 * holds a tense consonant, ㅐ / ㅔ, ㅢ or another final, so their contrasts are not listed yet; a list that grows past
 * Stage 1 adds them first (tense against plain and aspirated, ㅐ-ㅔ, finals compared by their seven sounds).
 * Letters are compatibility jamo; a pair is a two-letter string. Not in the package barrel (the barrel is in the
 * app's start bundle and no screen reads this list): import it from `@hangul-route/content-schema/ear-contrasts`.
 */
export const EAR_RULED_OUT = Object.freeze({
  /**
   * Initials, plain against aspirated: WO-16's contrasts (AMENDMENTS-MINIMAL-PAIRS). The level check never sets them
   * by ear (they stay in its seen items); the Hangul Check admits one only through an approved contrast set
   * (`contrastApproved`), and none is approved today.
   */
  plainAspirated: Object.freeze(['ㄱㅋ', 'ㄷㅌ', 'ㅂㅍ', 'ㅈㅊ']),
  /** Initials: a weak [h] in a lone clip. */
  weakH: Object.freeze(['ㅇㅎ']),
  /**
   * Initials held back until the owner's listening pass of DC-2c clears them: ㄴ-ㄷ and ㅁ-ㅂ (a word-initial nasal can
   * lose its nasal sound) and, from DC-2b, ㄴ-ㄹ and ㄷ-ㄹ (a lone initial ㄹ is a flap: the AC-5 pilot heard 라 as 나).
   */
  heldForListening: Object.freeze(['ㄴㄷ', 'ㅁㅂ', 'ㄴㄹ', 'ㄷㄹ']),
  /** ㅅ against ㅈ or ㅊ is ruled out when either block's vowel is one of `sibilantVowels` (ㅅ is [ɕ] there). */
  sibilants: Object.freeze(['ㅅㅈ', 'ㅅㅊ']),
  sibilantVowels: 'ㅣㅑㅕㅛㅠ',
  /** A block of one of these initials with one of `yVowels` is never used, as target or option (져 as 저, 셔 as 서). */
  noYVowel: 'ㅅㅈㅊ',
  yVowels: 'ㅑㅕㅛㅠ',
  /** Vowels that sound close. */
  vowels: Object.freeze(['ㅓㅗ', 'ㅡㅜ', 'ㅕㅛ']),
  /** A y-vowel against its plain vowel when either block starts with ㅎ: the glide is only the [ç] of the h (DC-2b). */
  glideAfterH: Object.freeze(['ㅏㅑ', 'ㅓㅕ', 'ㅗㅛ', 'ㅜㅠ']),
  /** Finals of one sound class are never set against each other: stops, nasals, the liquid. */
  finalClasses: Object.freeze(['ㄱㅂ', 'ㄴㅁㅇ', 'ㄹ']),
});

export type EarRuledOut = typeof EAR_RULED_OUT;
