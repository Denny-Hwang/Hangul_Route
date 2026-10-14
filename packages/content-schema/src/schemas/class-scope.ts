import { z } from 'zod';
import { CLASS_SCOPE_TEXT_KO } from './class-scope-ko';
import { JoinCodeFieldSchema } from './space';
import type { ProgressSummary } from './sync';
import { TEACHER_VISIBLE_ITEM_IDS, TRANSFER_CONSENT_TEXT, type TeacherVisibleItemId, type TransferConsentLocale } from './transfer-consent';

/**
 * [TV] Teacher visibility and teacher moves — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 * (owner decisions 2026-10-14). Two parts:
 *
 * 1. The class-scope update: one versioned text a family reads once per
 *    learner. Until it is acknowledged at a version in
 *    FULL_SCOPE_TEXT_VERSIONS, a class or school reads the base scope
 *    (`TEACHER_VISIBLE_SUMMARY_KEYS`); after it, the full scope (the base keys
 *    plus `TEACHER_FULL_SCOPE_EXTRA_KEYS`). A family always reads the full scope.
 * 2. Teacher moves (`class_moves`): direct between two classes the teacher
 *    manages, or accepted by the receiving class. Bodies, ids and the inbox
 *    notice live here.
 *
 * The wording is the owner's decision; no legal review is claimed.
 */

// ---------------------------------------------------------------------------
// Versions and scope

/** Bump when any class-scope line changes (a test pins a hash per locale). */
export const CLASS_SCOPE_TEXT_VERSION = 'class-scope-2026-10';
/** Versions whose acknowledgement opens the full scope (TV-D4). A later text that shows more leaves earlier ones out. */
export const FULL_SCOPE_TEXT_VERSIONS: readonly string[] = ['class-scope-2026-10'];

export const ClassScopeSchema = z.enum(['base', 'full']);
export type ClassScope = z.infer<typeof ClassScopeSchema>;

export const ClassScopeBasisSchema = z.enum(['caregiver', 'device']);
export type ClassScopeBasis = z.infer<typeof ClassScopeBasisSchema>;

/** Whether an acknowledgement recorded at `version` opens the full scope. */
export function isFullScopeVersion(version: string | null | undefined): boolean {
  return typeof version === 'string' && FULL_SCOPE_TEXT_VERSIONS.includes(version);
}

/** The body of both acknowledgement routes (console and device). */
export const ClassScopeAckBodySchema = z.object({ version: z.string().min(1).max(64) }).strict();
export type ClassScopeAckBody = z.infer<typeof ClassScopeAckBodySchema>;

// ---------------------------------------------------------------------------
// What the full scope adds (section 2 of the amendment)

/**
 * Summary keys a class or school reads only at full scope; a family reads them always.
 * Each is on `TEACHER_HIDDEN_SUMMARY_KEYS` too, which keeps meaning "hidden at base scope".
 */
export const TEACHER_FULL_SCOPE_EXTRA_KEYS = ['vocab', 'stage1Anchor', 'selfRoute', 'routeGoal'] as const;
export type TeacherFullScopeKey = Extract<(typeof TEACHER_FULL_SCOPE_EXTRA_KEYS)[number], keyof ProgressSummary>;

/** The consent item that names each full-scope key (generated lists, never typed per sheet). */
export const TEACHER_FULL_SCOPE_ITEMS: Readonly<Record<TeacherFullScopeKey, TeacherVisibleItemId>> = {
  vocab: 'words',
  stage1Anchor: 'letter_check',
  selfRoute: 'own_route',
  routeGoal: 'own_route',
};

/** Learner settings a full-scope teacher reads on the learner report (TV-D12), and the item that names them. */
export const TEACHER_VISIBLE_SETTING_FIELDS: Readonly<Record<'classNotes', TeacherVisibleItemId>> = {
  classNotes: 'learner_settings',
};

// ---------------------------------------------------------------------------
// The class-scope text

export const CLASS_SCOPE_LINE_IDS = ['intro', 'sees_all', 'list', 'moves', 'keeps', 'leave', 'until'] as const;
export type ClassScopeLineId = (typeof CLASS_SCOPE_LINE_IDS)[number];

export interface ClassScopeText {
  readonly lines: Readonly<Record<ClassScopeLineId, string>>;
  /**
   * Items of the `list` line whose class-move wording names one destination class (`{destination}`); the update
   * speaks of every class the learner is in, so these read "that class" instead. Every other item is the
   * class-move text's own (`classScopeItems`).
   */
  readonly items: Readonly<{ plan_progress: string }>;
}

/**
 * Pre-A1 English, at most 16 words per sentence (a placeholder is one word). The `list` line is a heading
 * followed by the items of the class-move consent text (`TRANSFER_CONSENT_TEXT[locale].items`), all of them.
 */
export const CLASS_SCOPE_TEXT: Readonly<Record<TransferConsentLocale, ClassScopeText>> = {
  en: {
    lines: {
      intro: 'There is an update about the classes {learner} is in.',
      sees_all: "The teacher of each class {learner} is in can see all of {learner}'s progress, including words.",
      list: 'What a teacher sees:',
      moves: 'A teacher may move {learner} to another class. We tell you when it happens.',
      keeps: 'Cards, stars and finished lessons always stay with {learner}.',
      leave: '{learner} can leave a class in Profile at any time.',
      until: 'Until you press OK, teachers see what they saw before.',
    },
    items: { plan_progress: 'Progress on homework from that class' },
  },
  ko: CLASS_SCOPE_TEXT_KO,
  es: {
    lines: {
      intro: 'Hay novedades sobre las clases de {learner}.',
      sees_all: 'El docente de cada clase de {learner} puede ver todo el progreso de {learner}, también las palabras.',
      list: 'Lo que ve un docente:',
      moves: 'Un docente puede pasar a {learner} a otra clase. Te avisamos cuando pase.',
      keeps: 'Las tarjetas, las estrellas y las lecciones terminadas siempre se quedan con {learner}.',
      leave: '{learner} puede salir de una clase en Perfil cuando quiera.',
      until: 'Hasta que pulses OK, los docentes ven lo mismo que antes.',
    },
    items: { plan_progress: 'El progreso en las tareas de esa clase' },
  },
};

/** The `list` items of the update, in the class-move text's order, with `{learner}` left to the renderer. */
export function classScopeItems(locale: TransferConsentLocale): Array<{ id: TeacherVisibleItemId; text: string }> {
  const items = TRANSFER_CONSENT_TEXT[locale].items;
  const own = CLASS_SCOPE_TEXT[locale].items;
  return TEACHER_VISIBLE_ITEM_IDS.map((id) => ({ id, text: id === 'plan_progress' ? own.plan_progress : items[id] }));
}

// ---------------------------------------------------------------------------
// Teacher moves (class_moves)

export const CLASS_MOVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/** A family sees an executed move's notice this long. */
export const CLASS_MOVE_NOTICE_MS = 30 * 24 * 60 * 60 * 1000;
/** Ended and executed rows are purged this long after they ended or executed. */
export const CLASS_MOVE_PURGE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
export const CLASS_MOVE_LIST_MAX = 50;

export const ClassMoveIdSchema = z.string().regex(/^move:[a-z0-9-]+$/);
export const ClassMoveKindSchema = z.enum(['direct', 'accept']);
export type ClassMoveKind = z.infer<typeof ClassMoveKindSchema>;
export const ClassMoveStatusSchema = z.enum(['requested', 'executed', 'declined', 'cancelled', 'expired']);
export type ClassMoveStatus = z.infer<typeof ClassMoveStatusSchema>;
export const ClassMoveEndReasonSchema = z.enum(['not_now', 'cancelled', 'expired', 'no_room', 'learner_left', 'destination_archived']);
export type ClassMoveEndReason = z.infer<typeof ClassMoveEndReasonSchema>;
export const ClassMoveViaSchema = z.enum(['owner', 'teacher', 'school_admin']);
export type ClassMoveVia = z.infer<typeof ClassMoveViaSchema>;
/** `space.move.completed` payload code. */
export const ClassMoveCompletedViaSchema = z.enum(['direct', 'accepted']);

const LEARNER_ID = z.string().regex(/^profile:[a-z0-9-]+$/);
const SPACE_ID = z.string().regex(/^space:[a-z0-9-]+$/);
/** Normalised like every join code field (case and spacing forgiven); a malformed code fails the body. */
const CODE = JoinCodeFieldSchema;

export const ClassMoveCreateBodySchema = z
  .object({ learnerId: LEARNER_ID, destinationSpaceId: SPACE_ID, code: CODE.optional() })
  .strict();
export type ClassMoveCreateBody = z.infer<typeof ClassMoveCreateBodySchema>;

export const ClassMovePreviewBodySchema = z.object({ learnerId: LEARNER_ID, code: CODE }).strict();
export type ClassMovePreviewBody = z.infer<typeof ClassMovePreviewBodySchema>;

export const ClassMoveEmptyBodySchema = z.object({}).strict();

// ---------------------------------------------------------------------------
// Inbox fields (lenient: a bad value never costs the app its plans or tier)

export const InboxClassScopeSchema = z.object({ needed: z.boolean(), current: z.string() });
export type InboxClassScope = z.infer<typeof InboxClassScopeSchema>;

export const InboxClassMoveSchema = z.object({
  id: z.string().min(1),
  to: z.object({ spaceId: z.string().min(1), name: z.string() }),
  executedAt: z.string(),
});
export type InboxClassMove = z.infer<typeof InboxClassMoveSchema>;

// ---------------------------------------------------------------------------
// Telemetry (codes only, no profile id; the Worker restricts the payload keys)

export const CLASS_MOVE_TELEMETRY_PREFIX = 'space.move.';
export const CLASS_SCOPE_TELEMETRY_PREFIX = 'space.scope.';
