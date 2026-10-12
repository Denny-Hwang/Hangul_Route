import { z } from 'zod';
import { RomanizationModeSchema, UiLocaleSchema } from './locale';
import { JOIN_CODE_RE } from './space';
import { StoryLevelSchema } from './story';
import { VocabIdSchema } from './vocab';

/**
 * Lecture mode — F-TCH-004 §3.2. A deck is what a teacher presents on a
 * tablet, projector or TV: ids, a seed and options, never slides. The
 * presenter expands it against its own content bundle, so a deck can travel
 * in the `#d=` URL fragment (`lecture-codec.ts`).
 *
 * A deck never carries a person: no learner name, initial or id. Picker
 * labels travel separately, console tab -> presenter tab by `postMessage`
 * (the two message schemas below), and live in presenter memory only (D12,
 * TD3). Every object here is `.strict()`, so a hand-built link cannot smuggle
 * a `labels` key into the fragment: an unknown key is an error, not dropped.
 * The remaining string fields are closed grammars (ids, compatibility jamo,
 * an ISO timestamp); only the teacher-typed title is free text (TD8, §8).
 *
 * The deck is a versioned URL contract and the ids are the contract: any new
 * key, block kind or wider grammar means `v: 2`, and the presenter must accept
 * v2 before any console emits it (a cached presenter answers
 * `unsupported_version` for a link it cannot read, never a half-read deck).
 */

export const LECTURE_DECK_VERSION = 1;
/** Same cap as a plan (`PLAN_MAX_ITEMS`). */
export const LECTURE_MAX_BLOCKS = 30;
/** `#d=` value length; checked before anything is decoded. */
export const LECTURE_MAX_FRAGMENT_CHARS = 8192;
/** UTF-8 length of the deck JSON inside the fragment. */
export const LECTURE_MAX_JSON_BYTES = 6144;

/** Teacher-led activity slides; the words live in the message catalogue (TD8: no free slide text). */
export const ACTIVITY_PRESETS = ['air-write', 'say-together', 'pair-share', 'copy-on-paper', 'stretch-break'] as const;
export type ActivityPreset = (typeof ACTIVITY_PRESETS)[number];

/**
 * TD8: the deck title is teacher-typed user data, like a learner name. Latin
 * letters with accents, Hangul syllables, digits, space and
 * `. , ! ? : ' ’ ( ) - /` only: no emoji, no other scripts, no control
 * characters. Explicit ranges, not `\p{…}`, as in `profile-model.ts`.
 */
export const LECTURE_TITLE_RE = /^[A-Za-zÀ-ɏ가-힣0-9 .,!?:'’()/-]+$/;

export const DECK_ID_RE = /^lecture:[a-z0-9]{6,12}$/;

// The grammars the deck's string fields follow (2026-10-11 amendment to §3.2).

/** = `JamoSchema.id` (`jamo.ts`). */
export const LECTURE_JAMO_ID_RE = /^jamo:[a-z0-9-]+$/;
/** = `VocabTopicSchema.id` (`vocab.ts`): `vocab-topic:<key>`. Word ids are `VocabIdSchema` (`vocab:<slug>`). */
export const LECTURE_VOCAB_TOPIC_ID_RE = /^vocab-topic:[a-z0-9]+(-[a-z0-9]+)*$/;
/** One compatibility jamo (U+3131-U+3163), the characters `ProgressSummary.needsPractice` holds. */
export const LECTURE_REVISIT_CHAR_RE = /^[\u3131-\u3163]$/;
/** ISO 8601 date-time with a zone, the `ISO_DATE_TIME` the telemetry route accepts (`new Date().toISOString()`). */
export const LECTURE_CREATED_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

export const LectureBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('episode'), id: z.string().regex(/^episode:[a-z0-9-]+$/) }).strict(),
  z.object({ kind: z.literal('quest'), id: z.string().regex(/^quest:[a-z0-9-]+$/) }).strict(),
  z
    .object({ kind: z.literal('jamo-set'), jamoIds: z.array(z.string().regex(LECTURE_JAMO_ID_RE)).min(1).max(12) })
    .strict(),
  /** Compatibility jamo characters, from `ProgressSummary.needsPractice` via the console roll-up. */
  z.object({ kind: z.literal('revisit'), chars: z.array(z.string().regex(LECTURE_REVISIT_CHAR_RE)).min(1).max(6) }).strict(),
  z
    .object({
      kind: z.literal('vocab'),
      topicId: z.string().regex(LECTURE_VOCAB_TOPIC_ID_RE),
      wordIds: z.array(VocabIdSchema.max(48)).max(24).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('story'),
      storyId: z.string().regex(/^story:[a-z0-9]+(-[a-z0-9]+)*$/),
      level: StoryLevelSchema.optional(),
      checks: z.boolean().default(true),
    })
    .strict(),
  z.object({ kind: z.literal('cards'), cardIds: z.array(z.string().regex(/^card:[a-z0-9-]+$/)).min(1).max(12) }).strict(),
  z.object({ kind: z.literal('quiz'), from: z.enum(['previous', 'all']), rounds: z.number().int().min(1).max(10) }).strict(),
  z
    .object({ kind: z.literal('activity'), preset: z.enum(ACTIVITY_PRESETS), minutes: z.number().int().min(1).max(15) })
    .strict(),
  z.object({ kind: z.literal('class-code'), code: z.string().regex(JOIN_CODE_RE) }).strict(),
]);
export type LectureBlock = z.infer<typeof LectureBlockSchema>;
export type LectureBlockKind = LectureBlock['kind'];

/** What the teacher intends for the helper picker; the labels themselves never ride in the deck. */
export const PickerModeSchema = z.enum(['names', 'initials', 'numbers']);
export type PickerMode = z.infer<typeof PickerModeSchema>;

export const LectureOptionsSchema = z
  .object({
    /** D2: visible by default; `tap` hides romanization until tapped (reading practice). */
    romanization: RomanizationModeSchema.default('always'),
    strokeGuide: z.boolean().default(true),
    quizRounds: z.number().int().min(1).max(10).default(5),
    sound: z.boolean().default(true),
    /** Absent = this device's locale. */
    uiLocale: UiLocaleSchema.optional(),
  })
  .strict();
export type LectureOptions = z.infer<typeof LectureOptionsSchema>;

export const LecturePickerSchema = z
  .object({
    mode: PickerModeSchema,
    /** `numbers`: draws 1..count. `names` / `initials`: the roster size; arriving labels must match it. */
    count: z.number().int().min(1).max(60),
  })
  .strict();
export type LecturePicker = z.infer<typeof LecturePickerSchema>;

export const LectureDeckSchema = z
  .object({
    v: z.literal(LECTURE_DECK_VERSION),
    id: z.string().regex(DECK_ID_RE),
    title: z.string().trim().min(1).max(60).regex(LECTURE_TITLE_RE),
    createdAt: z.string().max(40).regex(LECTURE_CREATED_AT_RE),
    /** Quiz content replays identically for the same seed. */
    seed: z.number().int().min(0).max(2_147_483_647),
    blocks: z.array(LectureBlockSchema).min(1).max(LECTURE_MAX_BLOCKS),
    options: LectureOptionsSchema.default({}),
    picker: LecturePickerSchema.nullable().default(null),
    /** Telemetry only. */
    source: z.enum(['plan', 'catalogue', 'revisit', 'quick']).optional(),
  })
  .strict();
/** A parsed deck (defaults filled). */
export type LectureDeck = z.infer<typeof LectureDeckSchema>;
/** A deck as written by its author (defaults optional). */
export type LectureDeckInput = z.input<typeof LectureDeckSchema>;

// ---------------------------------------------------------------------------
// Console -> presenter hand-off (never a URL; §3.2 roster hand-off protocol)
// ---------------------------------------------------------------------------

export const LECTURE_MESSAGE_NS = 'hangul-route.lecture' as const;

/** The learner-name class of `profile-model.ts` plus "." and "?" for roster aliases ("M. K.", "?"). */
export const PICKER_LABEL_RE = /^[A-Za-zÀ-ɏ가-힣0-9 .'’?-]+$/;

/** Presenter -> console (its `window.opener`); carries no person data. */
export const LectureReadyMessageSchema = z
  .object({
    ns: z.literal(LECTURE_MESSAGE_NS),
    v: z.literal(1),
    type: z.literal('ready'),
    deckId: z.string().regex(DECK_ID_RE),
  })
  .strict();
export type LectureReadyMessage = z.infer<typeof LectureReadyMessageSchema>;

/** Console -> presenter; held in presenter memory only on arrival, never stored, logged or sent on. */
export const LectureRosterMessageSchema = z
  .object({
    ns: z.literal(LECTURE_MESSAGE_NS),
    v: z.literal(1),
    type: z.literal('roster'),
    deckId: z.string().regex(DECK_ID_RE),
    mode: z.enum(['names', 'initials']),
    labels: z.array(z.string().trim().min(1).max(20).regex(PICKER_LABEL_RE)).min(1).max(60),
  })
  .strict();
export type LectureRosterMessage = z.infer<typeof LectureRosterMessageSchema>;

/**
 * Origins the presenter announces `ready` to and accepts a roster from. Lives
 * here so the console and the presenter cannot drift; the presenter adds the
 * build-time `EXPO_PUBLIC_CONSOLE_ORIGINS` list for preview deployments.
 * `http://localhost:3000` is safe in production: only the opener window can
 * deliver a message and the payload is limited to labels.
 * `https://app.hangulroute.com` is the console's home from F-APP-001 (the
 * same origin as the presenter); the site entries stay for consoles still
 * open on hangulroute.com during the move.
 */
export const LECTURE_CONSOLE_ORIGINS = [
  'https://hangulroute.com',
  'https://www.hangulroute.com',
  'http://localhost:3000',
  'https://app.hangulroute.com',
] as const;
