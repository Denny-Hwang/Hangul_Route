import type { UiLocale } from './locale';
import type { SpaceSettings } from './space';
import type { ProgressSummary } from './sync';
import type { TransferInitiator, TransferPremiumChange } from './transfer';

/**
 * Learner-side consent for a class move — F-SPACE-002 §4.11 (T18). One keyed
 * list of lines, rendered by the console sheet and the app sheets with the
 * same ids in the same order (layout may differ, wording may not). The
 * recorded `l_text_version` is TRANSFER_CONSENT_TEXT_VERSION; a test pins a
 * hash of the text per locale, so editing any wording forces a version bump.
 *
 * Placeholders: {learner}, {source}, {destination} (names read live).
 */

export const TRANSFER_CONSENT_LINE_IDS = [
  'moving',
  'new_teacher',
  'old_teacher',
  'keeps',
  'cooling_off',
  'visible_list',
  'nothing_else',
  'visible_today',
  'typed_names',
  'from_teacher',
  'premium_may_change',
  'school_delete',
  'device_relink',
  'homework_drops',
  'cannot_undo',
  'introduce',
] as const;
export type TransferConsentLineId = (typeof TRANSFER_CONSENT_LINE_IDS)[number];

/** When a line is shown; everything but `always` reads one server flag of the preview / inbox row. */
export type TransferConsentWhen =
  | 'always'
  | 'initiator_source'
  | 'premium_may_change'
  | 'school_consent_mode'
  | 'relink_affected'
  | 'source_plans_affected';

/** `list`: a heading followed by generated items; `option`: a checkbox, off by default. */
export type TransferConsentLineKind = 'statement' | 'list' | 'option';

export interface TransferConsentLine {
  readonly id: TransferConsentLineId;
  readonly when: TransferConsentWhen;
  readonly kind: TransferConsentLineKind;
}

export const TRANSFER_CONSENT_LINES: readonly TransferConsentLine[] = [
  { id: 'moving', when: 'always', kind: 'statement' },
  { id: 'new_teacher', when: 'always', kind: 'statement' },
  { id: 'old_teacher', when: 'always', kind: 'statement' },
  { id: 'keeps', when: 'always', kind: 'statement' },
  { id: 'cooling_off', when: 'always', kind: 'statement' },
  { id: 'visible_list', when: 'always', kind: 'list' },
  { id: 'nothing_else', when: 'always', kind: 'statement' },
  { id: 'visible_today', when: 'always', kind: 'list' },
  { id: 'typed_names', when: 'always', kind: 'statement' },
  { id: 'from_teacher', when: 'initiator_source', kind: 'statement' },
  { id: 'premium_may_change', when: 'premium_may_change', kind: 'statement' },
  { id: 'school_delete', when: 'school_consent_mode', kind: 'statement' },
  { id: 'device_relink', when: 'relink_affected', kind: 'statement' },
  { id: 'homework_drops', when: 'source_plans_affected', kind: 'statement' },
  { id: 'cannot_undo', when: 'always', kind: 'statement' },
  { id: 'introduce', when: 'always', kind: 'option' },
];

/** The server flags a sheet needs to decide its lines (preview answer or inbox row, narrowed). */
export interface TransferConsentContext {
  initiator: TransferInitiator;
  premiumChange: TransferPremiumChange;
  destinationConsentMode: SpaceSettings['consentMode'];
  relinkAffected: boolean;
  sourcePlansAffected: boolean;
}

/** The ids a sheet shows, in canonical order; this is also what `l_shown_json` records. */
export function transferConsentLineIds(ctx: TransferConsentContext): TransferConsentLineId[] {
  const shown: Record<TransferConsentWhen, boolean> = {
    always: true,
    initiator_source: ctx.initiator === 'source',
    premium_may_change: ctx.premiumChange === 'may_change',
    school_consent_mode: ctx.destinationConsentMode === 'school',
    relink_affected: ctx.relinkAffected,
    source_plans_affected: ctx.sourcePlansAffected,
  };
  return TRANSFER_CONSENT_LINES.filter((line) => shown[line.when]).map((line) => line.id);
}

/**
 * Items of the `visible_list` line: what the new teacher sees. Built from the
 * maps below, never typed per sheet, so the list and the roster cannot drift.
 */
export const TEACHER_VISIBLE_ITEM_IDS = [
  'name_picture_level',
  'activity',
  'quests',
  'cards_letters',
  'level_check',
  'plan_progress',
  'sync_time',
] as const;
export type TeacherVisibleItemId = (typeof TEACHER_VISIBLE_ITEM_IDS)[number];

/**
 * The allow-list the class roster projects `summary` to (T-1a). `planProgress`
 * is further filtered to the viewing space's plans. A test fails when
 * `ProgressSummarySchema` gains a key that is on neither list.
 */
export const TEACHER_VISIBLE_SUMMARY_KEYS = [
  'lastActiveAt',
  'streakDays',
  'stage1',
  'cardsUnlocked',
  'minutesLast7d',
  'jamoRecognized',
  'needsPractice',
  'placement',
  'planProgress',
  'journey',
  'activity',
] as const;
export type TeacherVisibleSummaryKey = Extract<(typeof TEACHER_VISIBLE_SUMMARY_KEYS)[number], keyof ProgressSummary>;

/**
 * Summary keys a teacher never receives. `selfRoute` (F-PLAN-002 section 3.10)
 * is read by the learner's family space only, never by a class or school.
 * `vocab` (F-VOC-005 section 3.8) stays hidden until the console PR that shows
 * it (F-VOC-005 P-4) moves it to the allow-list with its consent item, so the
 * consent text never lags what a teacher receives.
 */
export const TEACHER_HIDDEN_SUMMARY_KEYS = ['schemaVersion', 'stage1Anchor', 'selfRoute', 'vocab'] as const;
export type TeacherHiddenSummaryKey = Extract<(typeof TEACHER_HIDDEN_SUMMARY_KEYS)[number], keyof ProgressSummary>;

export const TEACHER_VISIBLE_SUMMARY_ITEMS: Readonly<Record<TeacherVisibleSummaryKey, TeacherVisibleItemId>> = {
  lastActiveAt: 'activity',
  streakDays: 'activity',
  stage1: 'quests',
  cardsUnlocked: 'cards_letters',
  minutesLast7d: 'activity',
  jamoRecognized: 'cards_letters',
  needsPractice: 'cards_letters',
  placement: 'level_check',
  planProgress: 'plan_progress',
  /**
   * Stage-level quest counts of My route, shown like `stage1` (F-ROUTE-001 OD-11).
   * Re-checked in R-7a, which turns known pips on: the mapping stays `quests`.
   * Its `known` count and `known` state come from the level check, and the
   * teacher already sees level check results through `placement`, which is on
   * this same allow-list as the `level_check` item, so the consent text needs
   * no new line and no version bump (a test pins both items).
   */
  journey: 'quests',
  /**
   * Day-by-day practice for progress reports (F-REPORT-001 section 3.8, RP-W2):
   * minutes and practice days per day are what the `activity` sentence names
   * ("When {learner} practiced, minutes each day and days in a row"), and the
   * time-zone offset only sets which local day a count falls on; per-day
   * quests, stage finish dates and the next lesson are covered by `quests`,
   * per-day cards and letters and the lesson to revisit by `cards_letters`
   * (the mapping goes to counsel at gate G2, F-REPORT-001 review log).
   * Words stay zeroed for every viewer until F-VOC-005 P-4 adds their own item,
   * and a class or school sees no day before the learner joined
   * (`activityOf` in packages/backend/src/lib/roster-summary.ts).
   */
  activity: 'activity',
};

/** Roster fields outside `summary` (display name per the class setting, avatar, level label, dates). */
export const TEACHER_VISIBLE_ROSTER_FIELDS: Readonly<Record<string, TeacherVisibleItemId>> = {
  displayName: 'name_picture_level',
  avatar: 'name_picture_level',
  ageGroup: 'name_picture_level',
  joinedAt: 'sync_time',
  lastActiveAt: 'activity',
  lastSyncedAt: 'sync_time',
};

/**
 * Roster fields that address a row and are never shown (T-1a). `id` is the
 * opaque learner id the console needs to key the list, target a plan and
 * issue a Rescue Code; it carries no progress, so it maps to no consent item.
 * A destination class receives it only after a move executes: until then its
 * transfer views are addressed by the transfer id (T8).
 */
export const TEACHER_ROSTER_ADDRESS_FIELDS = ['id'] as const;
export type TeacherRosterAddressField = (typeof TEACHER_ROSTER_ADDRESS_FIELDS)[number];

/**
 * Locales that have a consent text. English only for now; Korean (formal polite style, F-I18N-001)
 * and Spanish are added with the i18n layer, and every locale is
 * counsel-reviewed before the flag is enabled (flip gate G2). The Worker
 * answers `consent_locale_unavailable` for any other locale.
 */
export const TRANSFER_CONSENT_LOCALES = ['en'] as const;
export type TransferConsentLocale = Extract<(typeof TRANSFER_CONSENT_LOCALES)[number], UiLocale>;

const CONSENT_LOCALES: ReadonlySet<string> = new Set(TRANSFER_CONSENT_LOCALES);

export function isTransferConsentLocale(value: unknown): value is TransferConsentLocale {
  return typeof value === 'string' && CONSENT_LOCALES.has(value);
}

export interface TransferConsentText {
  readonly lines: Readonly<Record<TransferConsentLineId, string>>;
  readonly items: Readonly<Record<TeacherVisibleItemId, string>>;
}

/** Pre-A1 English, at most 16 words per sentence (a placeholder is one word); the copy test enforces it. */
export const TRANSFER_CONSENT_TEXT: Readonly<Record<TransferConsentLocale, TransferConsentText>> = {
  en: {
    lines: {
      moving: '{learner} would move from {source} to {destination}.',
      new_teacher: "The teacher of {destination} will see {learner}'s progress.",
      old_teacher: 'The teacher of {source} stops seeing {learner} in that class when the move happens, not before.',
      keeps: 'Cards, stars and finished lessons stay with {learner}.',
      cooling_off: 'The move happens after 2 days. Anyone in the family can cancel before then.',
      visible_list: 'What the new teacher sees:',
      nothing_else: 'Nothing else from the app is shared with the teacher.',
      visible_today: 'Today these people can see {learner}:',
      typed_names: 'Class and teacher names are typed by the teacher. We do not check them. Only continue if you know this teacher.',
      from_teacher: 'This request came from the teacher of {source}, not from you.',
      premium_may_change: "Lessons that were open through {source}'s plan may close after the move. Lessons already finished stay.",
      school_delete: "The teacher of {destination} will be able to delete {learner}'s record.",
      device_relink: 'A tablet that joined through {source} may need to join {destination} again.',
      homework_drops: 'Homework from {source} that is not finished will go away. Finished homework stays.',
      cannot_undo: "A move can't be undone. {learner} can still leave a class in Profile at any time.",
      introduce: 'Tell {destination} where {learner} is coming from.',
    },
    items: {
      name_picture_level: "{learner}'s name, picture and level",
      activity: 'When {learner} practiced, minutes each day and days in a row',
      quests: 'Quests done and how many answers were right',
      cards_letters: 'Cards earned, letters learned and letters that need practice',
      level_check: 'Level check results',
      plan_progress: 'Progress on homework from {destination}',
      sync_time: 'When {learner} joined the class and when progress was last saved',
    },
  },
};
