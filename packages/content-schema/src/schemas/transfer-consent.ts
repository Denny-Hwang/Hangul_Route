import type { InboxNote } from './feedback';
import type { UiLocale } from './locale';
import type { SpaceSettings } from './space';
import type { ProgressSummary } from './sync';
import type { TransferInitiator, TransferPremiumChange } from './transfer';
import { TRANSFER_CONSENT_TEXT_KO } from './transfer-consent-ko';

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
  'teacher_moves',
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
  /** [TV] TV-D6: a teacher may move the learner later, at the teacher's discretion (owner decision 2026-10-14). */
  { id: 'teacher_moves', when: 'always', kind: 'statement' },
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
  'note_replies',
  // [TV] the full scope (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 3): TEACHER_FULL_SCOPE_ITEMS and the report's settings
  'words',
  'letter_check',
  'own_route',
  'learner_settings',
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
 * `vocab` (F-VOC-005 section 3.8) stays hidden until the consent row for the
 * console's word lines (F-VOC-005 P-4b; P-4 shipped them dormant) moves it to the allow-list with its consent item, so the
 * consent text never lags what a teacher receives. `routeGoal` (Learning Route
 * section 9) follows the `selfRoute` precedent: family space only.
 */
export const TEACHER_HIDDEN_SUMMARY_KEYS = ['schemaVersion', 'stage1Anchor', 'selfRoute', 'vocab', 'routeGoal'] as const;
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
   * Words stay zeroed for every viewer until F-VOC-005 P-4b adds their own item,
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
 * What a class sender receives about a learner from a note (F-FEEDBACK-001
 * section 7.7): the reaction the learner picks, and only while the learner's
 * notes mode is `all`. Never `readAt` (OD-8 default: no "Opened" for class
 * senders); choosing OD-8's alternative adds it here with new disclosure lines.
 */
export const TEACHER_VISIBLE_NOTE_FIELDS: Readonly<Partial<Record<keyof InboxNote, TeacherVisibleItemId>>> = {
  reaction: 'note_replies',
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
 * Locales that have a consent text: every UI locale (F-SPACE-002 T-6d). Korean is in the formal
 * polite style with no particle attached to a placeholder (F-I18N-001 style guide). Every locale is
 * counsel-reviewed before the flag is enabled (flip gate G2). Any other locale never reaches the
 * consent check: the request body (`TransferConsentSchema`, UI locales only) rejects it as `bad_request`.
 * The Korean text lives in `transfer-consent-ko.ts`, so the romanization scan skips that file only.
 */
export const TRANSFER_CONSENT_LOCALES = ['en', 'ko', 'es'] as const;
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
      teacher_moves: 'A teacher may move {learner} to another class later. We tell you when it happens.',
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
      note_replies: 'The answer {learner} picks on a note from the teacher',
      words: 'Words collected, words known well, first-try answers and words to look at again',
      letter_check: 'The Hangul Check result and letters that were tricky',
      own_route: 'Lessons {learner} picked and the Learning Route goal',
      learner_settings: 'Whether {learner} gets notes from the class',
    },
  },
  ko: TRANSFER_CONSENT_TEXT_KO,
  es: {
    lines: {
      moving: '{learner} pasaría de {source} a {destination}.',
      new_teacher: 'El docente de {destination} verá el progreso de {learner}.',
      old_teacher: 'El docente de {source} deja de ver a {learner} en esa clase al hacerse el cambio, no antes.',
      keeps: 'Las tarjetas, las estrellas y las lecciones terminadas se quedan con {learner}.',
      cooling_off: 'El cambio se hace después de 2 días. Cualquier persona de la familia puede cancelarlo antes.',
      visible_list: 'Lo que ve el nuevo docente:',
      nothing_else: 'No se comparte nada más de la app con el docente.',
      visible_today: 'Hoy estas personas pueden ver a {learner}:',
      typed_names: 'El docente escribe los nombres de la clase y del docente. No los revisamos. Continúa solo si conoces a este docente.',
      from_teacher: 'Esta solicitud vino del docente de {source}, no de ti.',
      premium_may_change: 'Las lecciones abiertas por el plan de {source} pueden cerrarse después del cambio. Las lecciones ya terminadas se quedan.',
      school_delete: 'El docente de {destination} podrá borrar el registro de {learner}.',
      device_relink: 'Una tableta que se unió por {source} quizá tenga que unirse de nuevo a {destination}.',
      homework_drops: 'Las tareas de {source} sin terminar desaparecerán. Las tareas terminadas se quedan.',
      cannot_undo: 'Un cambio no se puede deshacer. {learner} puede salir de una clase en Perfil cuando quiera.',
      teacher_moves: 'Un docente puede pasar a {learner} a otra clase más adelante. Te avisamos cuando pase.',
      introduce: 'Decirle a {destination} de dónde viene {learner}.',
    },
    items: {
      name_picture_level: 'El nombre, la imagen y el nivel de {learner}',
      activity: 'Cuándo practicó {learner}, los minutos de cada día y los días seguidos',
      quests: 'Las misiones terminadas y cuántas respuestas fueron correctas',
      cards_letters: 'Las tarjetas ganadas, las letras aprendidas y las letras que necesitan práctica',
      level_check: 'Los resultados de la prueba de nivel',
      plan_progress: 'El progreso en las tareas de {destination}',
      sync_time: 'Cuándo se unió {learner} a la clase y cuándo se guardó el progreso por última vez',
      note_replies: 'La respuesta que elige {learner} en una nota del docente',
      words: 'Palabras reunidas, palabras que conoce bien, aciertos al primer intento y palabras para repasar',
      letter_check: 'El resultado del Repaso de hangul y las letras que costaron',
      own_route: 'Las lecciones que eligió {learner} y la meta de la Ruta de aprendizaje',
      learner_settings: 'Si {learner} recibe notas de la clase',
    },
  },
};
