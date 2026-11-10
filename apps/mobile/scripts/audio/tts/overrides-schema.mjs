// The schema of content/audio/pronunciation-overrides.json (AMENDMENTS-AUDIO-CLIPS AC-B3, section 9; row AC-2).
//
// Hand-edited. Each entry is keyed by the content text it applies to (the spoken text, `spokenKo ?? ko`, trimmed NFC)
// and says what is sent to the engine instead:
//
//   "국물": { "say": "궁물", "reason": "...", "engine": "polly", "voice": "Seoyeon", "accept": ["궁물"] }
//
// - `say`: the Hangul respelling sent to the engine. It changes what is sent, never what the screen shows.
// - `ipa`: optional, for the rare case a respelling fails (an SSML <phoneme> in the generator, AC-3).
// - `reason`, `engine`, `voice`: why the override exists and the engine and voice it was needed for. They are a
//   record, not a filter: the manifest has one `say` per row, so an override applies to every engine and voice.
//   During the AC-5 pilot, compare the candidates with no overrides (or the same overrides for all of them) so the
//   blind comparison stays fair; once tts-lock.json names the vendor, overrides follow that one voice.
// - `accept`: optional transcripts the two-pass QA (AC-4, section 9) accepts besides the text itself, for example the
//   pronounced form 궁물 for 국물.
// - `kinds`: optional, for a text that is several clips of different kinds (라 is ㄹ's letter sound, a `jamo-sound`
//   row, and a `syllable` row of Placement). Keyed by manifest kind, each entry gives the `say` (and optional `ipa`
//   and `accept`) for the rows of that kind, in place of the top-level ones; rows of any other kind keep the
//   top-level entry. It lets one row take a second take while another row of the same text, already heard as good,
//   keeps the exact text its clip was made from (AC-B3, owner listen of 2026-11-10).
//
// The file starts with no entries: an override is added when a pilot or QA run shows a voice misreading a text.
import { z } from 'zod';

export const OVERRIDES_SCHEMA_VERSION = 1;

const HANGUL_SYLLABLES = /[가-힣]/u;
const COMPAT_OR_CONJOINING_JAMO = /[ㄱ-ㆎᄀ-ᇿ]/u;
const LATIN_OR_DIGIT = /[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/u;
/** What an engine can be sent without SSML: Hangul syllables, spaces and sentence punctuation. */
const SAYABLE = /^[가-힣 .,!?'"…~-]+$/u;

const isNormal = (text) => text === text.normalize('NFC').trim();

/** The manifest row kinds an override's `kinds` may name (manifest-lib.mjs CLIP_KINDS). */
export const OVERRIDE_KINDS = ['jamo-sound', 'jamo-name', 'syllable', 'word', 'sentence', 'narration'];

/** A spoken Hangul text: trimmed NFC, at least one syllable, no lone jamo, no Latin letters or digits. */
const spokenHangul = (what) =>
  z
    .string()
    .min(1)
    .refine(isNormal, { message: `${what} must be trimmed NFC` })
    .refine((t) => HANGUL_SYLLABLES.test(t), { message: `${what} must hold Hangul` })
    .refine((t) => !COMPAT_OR_CONJOINING_JAMO.test(t), { message: `${what} must not hold a lone jamo` })
    .refine((t) => !LATIN_OR_DIGIT.test(t), { message: `${what} must not hold Latin letters or digits` });

const sayField = () => spokenHangul('say').refine((t) => SAYABLE.test(t), { message: 'say must be Hangul, spaces and punctuation only (use ipa for anything else)' });
const acceptField = () =>
  z
    .array(spokenHangul('an accepted variant'))
    .min(1)
    .refine((list) => new Set(list).size === list.length, { message: 'accepted variants must be unique' })
    .optional();

/** What the rows of one kind are sent instead of the entry's top-level say (and ipa, accept). */
export const KindOverrideSchema = z.object({ say: sayField(), ipa: z.string().min(1).optional(), accept: acceptField() }).strict();

export const PronunciationOverrideSchema = z
  .object({
    say: sayField(),
    ipa: z.string().min(1).optional(),
    reason: z.string().min(1),
    engine: z.string().regex(/^[a-z][a-z0-9-]*$/, 'engine is a lower-case id such as polly, google or azure'),
    voice: z.string().min(1),
    accept: acceptField(),
    kinds: z
      .record(z.string(), KindOverrideSchema)
      .superRefine((entries, ctx) => {
        if (Object.keys(entries).length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'kinds must name at least one kind' });
        for (const kind of Object.keys(entries)) {
          if (!OVERRIDE_KINDS.includes(kind)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [kind], message: `unknown kind "${kind}" (one of ${OVERRIDE_KINDS.join(', ')})` });
        }
      })
      .optional(),
  })
  .strict();

/**
 * The part of an override that applies to a row of `kind`: { say, ipa?, accept? } from `kinds[kind]` when the entry
 * names that kind, else from the entry itself; undefined when there is no override.
 *
 * @param {{ say: string, ipa?: string, accept?: string[], kinds?: Record<string, { say: string, ipa?: string, accept?: string[] }> } | undefined} override
 * @param {string} kind
 */
export function overrideForKind(override, kind) {
  if (override === undefined) return undefined;
  const chosen = override.kinds?.[kind] ?? override;
  const out = { say: chosen.say };
  if (chosen.ipa !== undefined) out.ipa = chosen.ipa;
  if (chosen.accept !== undefined) out.accept = chosen.accept;
  return out;
}

export const PronunciationOverridesFileSchema = z
  .object({
    schemaVersion: z.literal(OVERRIDES_SCHEMA_VERSION),
    overrides: z.record(z.string(), PronunciationOverrideSchema).superRefine((entries, ctx) => {
      for (const key of Object.keys(entries)) {
        const issue = spokenHangul('a key').safeParse(key);
        if (!issue.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `key "${key}": ${issue.error.issues[0].message}` });
      }
    }),
  })
  .strict();

/**
 * The overrides of a parsed pronunciation-overrides.json, by spoken text. Throws one readable error naming the
 * first problem (its path and message) when the file does not match the schema.
 */
export function parseOverrides(json, file = 'content/audio/pronunciation-overrides.json') {
  const result = PronunciationOverridesFileSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  return result.data.overrides;
}
