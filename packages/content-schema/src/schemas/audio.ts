import { z } from 'zod';

/**
 * Audio schemas (F-AUDIO-004 §3.2, §3.7).
 * `AudioRefSchema` is the one grammar for a bundled clip path: `audio/<kind>/<slug>.mp3`.
 */
export const AUDIO_REF_PATTERN = /^audio\/(jamo|vocab|story|card|dialogue)\/[a-z0-9][a-z0-9/-]*\.mp3$/;
export const AudioRefSchema = z.string().regex(AUDIO_REF_PATTERN);
export type AudioRef = z.infer<typeof AudioRefSchema>;

/** Matches `LOCALE_META[locale].speechLang` (F-I18N-001) plus the Korean target language. */
export const SPEECH_LANGS = ['ko-KR', 'en-US', 'es-US'] as const;
export const SpeechLangSchema = z.enum(SPEECH_LANGS);
export type SpeechLang = z.infer<typeof SpeechLangSchema>;

/** Persisted under `device:audio` (device-level, not per profile). */
export const DeviceAudioPrefsSchema = z.object({ muted: z.boolean().default(false) });
export type DeviceAudioPrefs = z.infer<typeof DeviceAudioPrefsSchema>;
