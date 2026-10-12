import { z } from 'zod';
import { UiLocaleSchema } from './locale';

/**
 * Notes from grown-ups — F-FEEDBACK-001 section 7.1. A one-way, child-safe
 * channel: a linked adult (a teacher of the learner's class, or the family
 * owner or a caregiver the owner allowed) sends a note made of one reviewed
 * preset, an optional short text and an optional suggested quest. The learner
 * answers only with one of four preset reactions. Shared by the Worker
 * (validation), the console and the learner app (typing).
 *
 * Preset, reaction and label ids are frozen once shipped (a stored note points
 * at them); their wording lives in the dictionary (`common.notes`) and is
 * rendered in the viewer's UI language.
 */

/** The fifteen presets of section 6.3, in four groups (effort, progress, next step, warm). */
export const NOTE_PRESET_IDS = [
  'effort_keep_trying',
  'effort_proud',
  'effort_practice_helps',
  'progress_new_letters',
  'progress_reading',
  'progress_writing',
  'progress_listening',
  'progress_new_card',
  'next_try_this',
  'next_look_again',
  'next_take_time',
  'warm_thinking_of_you',
  'warm_cheering',
  'warm_see_you_in_class',
  'warm_learning_together',
] as const;
export type NotePresetId = (typeof NOTE_PRESET_IDS)[number];

/** Who may pick a preset: every sender, class senders only, or family senders only. */
export type NotePresetAudience = 'all' | 'teacher' | 'family';

export const NOTE_PRESET_AUDIENCE: Readonly<Record<NotePresetId, NotePresetAudience>> = {
  effort_keep_trying: 'all',
  effort_proud: 'all',
  effort_practice_helps: 'all',
  progress_new_letters: 'all',
  progress_reading: 'all',
  progress_writing: 'all',
  progress_listening: 'all',
  progress_new_card: 'all',
  next_try_this: 'all',
  next_look_again: 'all',
  next_take_time: 'all',
  warm_thinking_of_you: 'all',
  warm_cheering: 'all',
  warm_see_you_in_class: 'teacher',
  warm_learning_together: 'family',
};

/** Presets that must carry a suggested quest; the Worker answers `422 bad_preset` without one. */
export const NOTE_PRESETS_NEED_SUGGEST: ReadonlySet<NotePresetId> = new Set<NotePresetId>(['next_try_this']);

/** The only answer a learner can give (section 6.6, decision D1). */
export const NOTE_REACTION_IDS = ['thanks', 'will_try', 'did_it', 'happy'] as const;
export type NoteReactionId = (typeof NOTE_REACTION_IDS)[number];

/** How a family sender is named to the learner; never an account's typed name (OD-5). */
export const FAMILY_LABEL_IDS = ['family', 'mom', 'dad', 'grandma', 'grandpa', 'aunt', 'uncle', 'guardian', 'partner'] as const;
export type FamilyLabelId = (typeof FAMILY_LABEL_IDS)[number];

export const NOTE_REPORT_REASONS = ['unkind', 'unsafe', 'not_for_me', 'other'] as const;
export type NoteReportReason = (typeof NOTE_REPORT_REASONS)[number];

/** What class notes deliver for one learner; family notes are always delivered. */
export const NOTES_MODES = ['all', 'presets', 'off'] as const;
export type NotesMode = (typeof NOTES_MODES)[number];

/** Learners in one send (section 7.3); the statement count of a send does not grow with it. */
export const NOTE_SEND_MAX_LEARNERS = 300;

export const NoteIdSchema = z.string().regex(/^note:[a-z0-9-]{8,64}$/);

export const NoteSuggestSchema = z.object({ kind: z.literal('quest'), id: z.string().min(1).max(64) }).strict();
export type NoteSuggest = z.infer<typeof NoteSuggestSchema>;

/**
 * POST /api/spaces/:id/notes body. `.strict()`: an early or stale client fails
 * loudly. The text is bounded loosely here; `checkNoteText`
 * (`@hangul-route/i18n/note-text`) judges its length and content. A preset in
 * NOTE_PRESETS_NEED_SUGGEST without `suggest` is the Worker's `422 bad_preset`,
 * and a label on a class space its `422 label_not_allowed`.
 */
export const NoteSendSchema = z
  .object({
    to: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('learners'),
          ids: z
            .array(z.string().regex(/^profile:[a-z0-9-]+$/))
            .min(1)
            .max(NOTE_SEND_MAX_LEARNERS),
        })
        .strict(),
      z.object({ kind: z.literal('everyone') }).strict(),
    ]),
    presetId: z.enum(NOTE_PRESET_IDS),
    text: z.string().max(400).optional(),
    /** The console locale; required when `text` is present (screen readers pick a voice from it). */
    textLocale: UiLocaleSchema.optional(),
    suggest: NoteSuggestSchema.optional(),
    /** Family spaces only. */
    label: z.enum(FAMILY_LABEL_IDS).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.text !== undefined && body.textLocale === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['textLocale'], message: 'textLocale is required with text' });
    }
  });
export type NoteSend = z.infer<typeof NoteSendSchema>;

/**
 * One delivered note (an inbox row). Lenient on the device: the inbox reads
 * notes through `lenientArray`, so one bad row is dropped, not the inbox. A
 * newer Worker never breaks an older app: an unknown preset id or reaction is a
 * plain string (the app renders the fallback line or ignores it), and an
 * unknown family label, text locale or suggestion reads as null (the app shows
 * "Your family", picks `lang` from the text, or leaves the quest out) instead
 * of costing the note.
 */
export const InboxNoteSchema = z.object({
  id: NoteIdSchema,
  spaceId: z.string(),
  from: z.object({
    role: z.enum(['teacher', 'family']),
    label: z.enum(FAMILY_LABEL_IDS).nullable().catch(null),
  }),
  presetId: z.string().max(64),
  text: z.string().max(400).nullable(),
  textLocale: UiLocaleSchema.nullable().catch(null),
  suggest: NoteSuggestSchema.nullable().catch(null),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  reaction: z.string().max(32).nullable(),
});
export type InboxNote = z.infer<typeof InboxNoteSchema>;

/** The learner's class-notes setting, as the inbox carries it (section 6.10). */
export const NotePrefsSchema = z.object({
  classes: z.enum(NOTES_MODES).default('all'),
  /** Read-only on the wire: the family has answered the one-time class-notes card. */
  acknowledged: z.boolean().default(false),
});
export type NotePrefs = z.infer<typeof NotePrefsSchema>;

/** PUT note-prefs body (device and family routes). */
export const NotePrefsPutSchema = z.object({ classes: z.enum(NOTES_MODES), acknowledge: z.literal(true).optional() }).strict();
export type NotePrefsPut = z.infer<typeof NotePrefsPutSchema>;

/** PUT /api/sync/learners/:id/notes/:noteId/state body: read once, last reaction wins. */
export const NoteStatePutSchema = z
  .object({ read: z.literal(true).optional(), reaction: z.enum(NOTE_REACTION_IDS).optional() })
  .strict()
  .refine((v) => v.read !== undefined || v.reaction !== undefined);
export type NoteStatePut = z.infer<typeof NoteStatePutSchema>;

/** Report body; `attest` comes from a device only (a client claim, recorded, never trusted). */
export const NoteReportSchema = z.object({ reason: z.enum(NOTE_REPORT_REASONS), attest: z.enum(['grown_up_pin', 'self']).optional() }).strict();
export type NoteReport = z.infer<typeof NoteReportSchema>;
