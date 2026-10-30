import { z } from 'zod';
import { AUDIO_PACKS } from '../audio/packs';

export { AUDIO_PACKS, type AudioPack } from '../audio/packs';

/**
 * Audio schemas (F-AUDIO-004 §3.2, §3.7).
 * `AudioRefSchema` is the one grammar for a bundled clip path: `audio/<kind>/<slug>.mp3`. The `say` group holds the
 * text-keyed clips, `audio/say/<sayKey>.mp3` (AMENDMENTS-AUDIO-CLIPS AC-B4, `audio/say-key.ts`): exactly 16 lower-case
 * hex characters and no folder, the names `isSayRef` recognizes, so a malformed say file fails here and in the scripts.
 */
export const AUDIO_REF_PATTERN = /^audio\/(?:(?:jamo|vocab|story|card|dialogue)\/[a-z0-9][a-z0-9/-]*|say\/[0-9a-f]{16})\.mp3$/;
export const AudioRefSchema = z.string().regex(AUDIO_REF_PATTERN);
export type AudioRef = z.infer<typeof AudioRefSchema>;

/** Matches `LOCALE_META[locale].speechLang` (F-I18N-001) plus the Korean target language. */
export const SPEECH_LANGS = ['ko-KR', 'en-US', 'es-US'] as const;
export const SpeechLangSchema = z.enum(SPEECH_LANGS);
export type SpeechLang = z.infer<typeof SpeechLangSchema>;

/** Persisted under `device:audio` (device-level, not per profile). */
export const DeviceAudioPrefsSchema = z.object({ muted: z.boolean().default(false) });
export type DeviceAudioPrefs = z.infer<typeof DeviceAudioPrefsSchema>;

/** The clip packs (AMENDMENTS-AUDIO-CLIPS AC-B6): `AUDIO_PACKS`, kept in the leaf module `audio/packs.ts`. */
export const AudioPackSchema = z.enum(AUDIO_PACKS);

/** Where a prompt's audio came from (AC-B7): the record's clip, the text-keyed clip, the device voice, or the text. */
export const AUDIO_SOURCES = ['clip', 'say', 'tts', 'text'] as const;
export type AudioSource = (typeof AUDIO_SOURCES)[number];

/** The largest count one `audio.source_summary` carries per source. */
export const AUDIO_SOURCE_COUNT_MAX = 100_000;
const sourceCount = z.number().int().min(0).max(AUDIO_SOURCE_COUNT_MAX);

/**
 * `audio.source_summary` (AC-B9): at most once per app session, when it ends or the page hides, the counts of the
 * prompts each source played and the app version. Counts only: no text, ref, learner id or URL (strict, so any other
 * key fails). G3 is `(clip + say) / (clip + say + tts + text)`.
 */
export const AudioSourceSummaryPayloadSchema = z
  .object({
    clip: sourceCount,
    say: sourceCount,
    tts: sourceCount,
    text: sourceCount,
    appVersion: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/),
  })
  .strict();
export type AudioSourceSummaryPayload = z.infer<typeof AudioSourceSummaryPayloadSchema>;
