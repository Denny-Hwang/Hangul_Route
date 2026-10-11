/**
 * Presets, defaults and cadence constants of the curriculum planner
 * (F-PLAN-002 section 3.1, FP-B2, section 9 assumption 3). Product judgment,
 * not user-tested: each is a constant with one test, so it can change without
 * touching the algorithm. Length presets are choices; `generateCurriculum`
 * pre-selects none (the recommendation is `proposeRoute`'s, PR P2-3b).
 */

export type LengthPresetId = '4-week' | '12-week' | '6-month';

/** The three length chips; "Choose weeks" (1 to 52) is the custom fourth. */
export const LENGTH_PRESETS: Readonly<Record<LengthPresetId, { weeks: number; reviewEvery: 0 | 4 }>> = {
  '4-week': { weeks: 4, reviewEvery: 0 },
  '12-week': { weeks: 12, reviewEvery: 4 },
  '6-month': { weeks: 26, reviewEvery: 4 },
};

export type PaceId = 'gentle' | 'steady' | 'brisk';

/** Pace chips, in sessions a week (OD-13). */
export const PACES: Readonly<Record<PaceId, number>> = { gentle: 2, steady: 3, brisk: 4 };

/** `proposeRoute` recommends 4 weeks up to this last lesson week (AMENDMENTS section 1.1). */
export const DEFAULT_SHORT_MAX = 4;
/** ... and 12 weeks up to this one; 6 months after it. */
export const DEFAULT_TERM_MAX = 16;

export type CurriculumAudience = 'class' | 'family' | 'self';

/** The rhythm each audience starts from (section 3.1 table; self is Steady, FP-B2). */
export const AUDIENCE_DEFAULTS: Readonly<Record<CurriculumAudience, { sessionsPerWeek: number; minutesPerSession: 15 }>> = {
  class: { sessionsPerWeek: 2, minutesPerSession: 15 },
  family: { sessionsPerWeek: 3, minutesPerSession: 15 },
  self: { sessionsPerWeek: PACES.steady, minutesPerSession: 15 },
};

/** Minutes a session for "Pictures first" (`levelOrder` 0) learners, or a class of mostly them. */
export const PICTURES_FIRST_MINUTES = 10;

type FocusKey = 'reading' | 'words' | 'culture' | 'balanced';

/** A culture week after this many learn weeks (0 = only anchor weeks). */
export const CULTURE_EVERY: Readonly<Record<FocusKey, number>> = { reading: 0, words: 0, culture: 2, balanced: 3 };

/** A word topic after this many learn weeks (0 = only free-practice weeks get one). */
export const VOCAB_EVERY: Readonly<Record<FocusKey, number>> = { reading: 0, words: 3, culture: 0, balanced: 4 };

/** `reviewEvery` when the params leave it out: every 4th week for plans of 12 weeks or more, else none. */
export const DEFAULT_REVIEW_EVERY = 4;
export const DEFAULT_REVIEW_MIN_WEEKS = 12;

/** A plan never holds more than five coming-soon episodes, so it never reads as mostly placeholders. */
export const COMING_SOON_MAX = 5;

/** A culture week leads with at most two stories (one when there are fewer than four sessions). */
export const STORIES_PER_CULTURE_WEEK_MAX = 2;

/** `session-too-short` counts items longer than this many sessions. */
export const SESSION_TOO_SHORT_FACTOR = 1.5;

/** At most one item per session: 52 weeks of 5 sessions. */
export const CURRICULUM_MAX_ITEMS = 260;

/** How many days ahead a device derives homework from a curriculum. */
export const HORIZON_DAYS = 7;

/**
 * The `note` a coming-soon item carries in a stored plan (section 3.3 step 10):
 * a wire value that apps without the catalogue show as-is; current UIs show the
 * episode title from the catalogue and their own message instead.
 */
export const COMING_SOON_NOTE = 'Coming soon';
