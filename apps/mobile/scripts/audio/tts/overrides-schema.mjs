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

/** A spoken Hangul text: trimmed NFC, at least one syllable, no lone jamo, no Latin letters or digits. */
const spokenHangul = (what) =>
  z
    .string()
    .min(1)
    .refine(isNormal, { message: `${what} must be trimmed NFC` })
    .refine((t) => HANGUL_SYLLABLES.test(t), { message: `${what} must hold Hangul` })
    .refine((t) => !COMPAT_OR_CONJOINING_JAMO.test(t), { message: `${what} must not hold a lone jamo` })
    .refine((t) => !LATIN_OR_DIGIT.test(t), { message: `${what} must not hold Latin letters or digits` });

export const PronunciationOverrideSchema = z
  .object({
    say: spokenHangul('say').refine((t) => SAYABLE.test(t), { message: 'say must be Hangul, spaces and punctuation only (use ipa for anything else)' }),
    ipa: z.string().min(1).optional(),
    reason: z.string().min(1),
    engine: z.string().regex(/^[a-z][a-z0-9-]*$/, 'engine is a lower-case id such as polly, google or azure'),
    voice: z.string().min(1),
    accept: z
      .array(spokenHangul('an accepted variant'))
      .min(1)
      .refine((list) => new Set(list).size === list.length, { message: 'accepted variants must be unique' })
      .optional(),
  })
  .strict();

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
