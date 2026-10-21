/**
 * The copy patterns of the `review-copy` rule (F-CURR-002 §9.3, §4.5 "Never on a review
 * screen"), one implementation for the content lint and for the UI-string tests that
 * import them (row CM-1 checks the stage one-liners with these).
 *
 * - Learner review strings never show a score: no percent sign, no "n of m", no "n/m".
 * - New learner copy never names an age or frames the audience by age (CLAUDE.md section 1),
 *   never asks the learner to speak (reading, listening and writing only), and has no emoji.
 */

export type ReviewCopyProblem = 'percent' | 'n-of-m' | 'age-word' | 'speaking-ui' | 'emoji';

/** A score shown as a share, in any UI locale (the en, es and ko messages). */
const SCORE_PATTERNS: ReadonlyArray<readonly [ReviewCopyProblem, RegExp]> = [
  ['percent', /[%％]|퍼센트|\bpercent\b|\bpor ?ciento\b|\bporcentaje\b/i],
  // 80프로, the spoken form of 80%, but not 프로그램 (a programme).
  ['percent', /\d\s*프로(?![가-힣])/],
  ['n-of-m', /\d+\s*\/\s*\d+/],
  ['n-of-m', /\b\d+\s+(?:out\s+)?of\s+\d+\b/i],
  ['n-of-m', /\b\d+\s+(?:de|sobre)\s+\d+\b/i],
  // 5개 중 3개, 5개 중에 3개, 5문제 중에서 3문제.
  ['n-of-m', /\d+\s*\S{0,3}\s*중(?:에서|에)?\s*\d+/],
];

/**
 * Audience age framing in English copy: "for kids", an age range, nursery wording. A word a
 * story needs ("the children ran") is not here: it describes characters, not the learner.
 */
export const REVIEW_COPY_AGE_PATTERNS: readonly RegExp[] = [
  /\bkids?\b/i,
  /\bkiddos?\b/i,
  /\blittle ones?\b/i,
  /\byoung learners?\b/i,
  /\btoddlers?\b/i,
  /\bpre-?school(?:ers?)?\b/i,
  /\bbaby talk\b/i,
  /\bages?\s+\d/i,
  /\b\d+\s*(?:-|–|to)\s*\d+\s*(?:years?|yrs?)\b/i,
  /\bgrown-?ups? only\b/i,
];

/**
 * Wording that asks the learner to speak or record (no speaking measurement or speaking UI).
 * A note on usage ("Say this to call a server") explains a phrase and is not here.
 */
export const REVIEW_COPY_SPEAKING_PATTERNS: readonly RegExp[] = [
  // The learner is asked to read aloud; "Tap to hear it read aloud" (the device voice reads) is not.
  /(?<!\bhear(?:\s+[a-z]+)?\s+)\b(?:say|speak|repeat|read)(?:\s+(?:it|this|that|them|the word|the line))?\s+(?:out loud|aloud)\b/i,
  /\b(?:say|repeat)(?:\s+(?:it|this|that|them))?\s+(?:with|after)\s+(?:me|hoya|the voice)\b/i,
  /\bspeak (?:now|into|up)\b/i,
  /\bmicrophones?\b/i,
  /\bmic\b/i,
  /\brecord (?:yourself|your voice|your answer)\b/i,
  /\b(?:use|with) your voice\b/i,
];

/** The emoji ranges of `packages/i18n/src/note-text.ts` rule 7 (content-schema cannot import i18n). */
const EMOJI =
  /\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDEFF]|[‍⃣⌚⌛⏩-⏳⏸-⏺◽◾☀-➿⤴⤵⬅-⬇⬛⬜⭐⭕〰〽㊗㊙️]/;

/** Problems of a learner review string (any locale): a share or a score. */
export function reviewScoreProblems(text: string): ReviewCopyProblem[] {
  const found = SCORE_PATTERNS.filter(([, re]) => re.test(text)).map(([problem]) => problem);
  return [...new Set(found)];
}

/**
 * Audience age framing in the Spanish and Korean UI locales, after the per-locale entries of
 * `packages/i18n/src/audience.ts` (F-I18N-001 §3.8), widened to any age range. Words a story
 * needs ("los niños", 아이들) describe characters and are not here.
 */
export const REVIEW_COPY_AGE_PATTERNS_BY_LOCALE: Readonly<Record<'es' | 'ko', readonly RegExp[]>> = {
  es: [/\bpara niñ[oa]s\b/i, /\bpara los más pequeños\b/i, /\bde\s*\d+\s*a\s*\d+\s*años\b/i, /\bedad(?:es)?\s+de\s+\d/i],
  ko: [/어린이용/, /유아용/, /\d+\s*[~～–-]\s*\d+\s*세/, /\d+\s*세\s*(?:이상|이하|미만)/],
};

/** Problems of new English learner copy: age framing, speaking UI, emoji. */
export function newCopyProblems(text: string): ReviewCopyProblem[] {
  const out: ReviewCopyProblem[] = [];
  if (REVIEW_COPY_AGE_PATTERNS.some((re) => re.test(text))) out.push('age-word');
  if (REVIEW_COPY_SPEAKING_PATTERNS.some((re) => re.test(text))) out.push('speaking-ui');
  if (hasEmoji(text)) out.push('emoji');
  return out;
}

/**
 * Problems of new learner copy in a UI locale: English gets every check of newCopyProblems;
 * Spanish and Korean get their age patterns and the emoji check (the speaking patterns are
 * English; a Spanish or Korean string translates an English one that is checked).
 */
export function localeCopyProblems(text: string, locale: string): ReviewCopyProblem[] {
  if (locale === 'en') return newCopyProblems(text);
  const out: ReviewCopyProblem[] = [];
  const age = locale === 'es' || locale === 'ko' ? REVIEW_COPY_AGE_PATTERNS_BY_LOCALE[locale] : [];
  if (age.some((re) => re.test(text))) out.push('age-word');
  if (hasEmoji(text)) out.push('emoji');
  return out;
}

export const hasEmoji = (text: string): boolean => EMOJI.test(text);

const PROBLEM_TEXT: Readonly<Record<ReviewCopyProblem, string>> = {
  percent: 'a review screen never shows a percentage',
  'n-of-m': 'a review screen never shows an "n of m" or "n/m" score',
  'age-word': 'learner copy never names an age or says who it is "for" by age',
  'speaking-ui': 'learner copy never asks the learner to speak or record (reading, listening and writing only)',
  emoji: 'learner copy has no emoji',
};
export const reviewCopyMessage = (problem: ReviewCopyProblem): string => PROBLEM_TEXT[problem];

/**
 * The learner review surfaces of `packages/i18n` whose strings the rule reads: the Hangul
 * Check (shipped) and the F-CURR-002 review screens, by the sub-object of `learner` each
 * row adds (Daily Review and Keep going CM-14, warm-up and Try these again CM-15, Cell
 * Check CM-21, Stage Check CM-22, Pack Check CM-51). A key not present yet is skipped.
 */
export const REVIEW_COPY_NAMESPACES: readonly string[] = [
  'stageReview',
  'dailyReview',
  'keepGoing',
  'warmUp',
  'tryAgain',
  'cellCheck',
  'stageCheck',
  'packCheck',
];

export interface ReviewStringFinding {
  path: string;
  problem: ReviewCopyProblem;
}

/** Sample arguments for a message function: numbers, so a template like `${n} of ${total}` shows. */
const SAMPLE_ARGS = [3, 5, 7, 9];

/**
 * Every problem in the review sub-objects of one locale's `learner` messages: a score, and the
 * new-copy problems of that locale (localeCopyProblems). A message function is called with
 * numbers so its template is read; one that throws on them is read as its source text instead.
 */
export function lintReviewMessages(
  learner: unknown,
  namespaces: readonly string[] = REVIEW_COPY_NAMESPACES,
  locale = 'en',
): ReviewStringFinding[] {
  const out: ReviewStringFinding[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      for (const problem of new Set([...reviewScoreProblems(value), ...localeCopyProblems(value, locale)])) out.push({ path, problem });
    } else if (typeof value === 'function') {
      let text: string;
      try {
        text = String((value as (...args: unknown[]) => unknown)(...SAMPLE_ARGS));
      } catch {
        text = String(value);
      }
      visit(text, path);
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    }
  };
  const root = (typeof learner === 'object' && learner !== null ? learner : {}) as Record<string, unknown>;
  for (const ns of namespaces) {
    if (ns in root) visit(root[ns], `learner.${ns}`);
  }
  return out;
}
