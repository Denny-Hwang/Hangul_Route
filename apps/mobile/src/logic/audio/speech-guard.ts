/**
 * The lone-jamo speech guard (AMENDMENTS-AUDIO-CLIPS JV-A2). Pure.
 *
 * A device voice reads a lone compatibility jamo (U+3131-318E) or conjoining jamo
 * (U+1100-11FF) by engine whim: a name on iOS, nothing or "Hangul letter" elsewhere. The
 * only way to get a jamo's spoken text is `jamoVoice` (JV-A2); this guard catches a surface
 * that speaks a jamo through `playPrompt` / `speak()` without it. Every prompt reaches the
 * controller's `playPrompt`, so the guard runs there once for both platforms.
 *
 * It throws in tests, warns in a development build and never throws in a release build.
 */

export type RuntimeMode = 'test' | 'development' | 'production';

/** `test` under the test runner; otherwise Metro's `__DEV__`, else a non-production `NODE_ENV`. */
export function runtimeMode(): RuntimeMode {
  // Read literally so Metro inlines it in an app build (as `config/flags.ts` does).
  const env = process.env.NODE_ENV;
  if (env === 'test') return 'test';
  const dev = (globalThis as { __DEV__?: unknown }).__DEV__;
  if (typeof dev === 'boolean') return dev ? 'development' : 'production';
  return env === 'production' ? 'production' : 'development';
}

/**
 * A rule broken by content or a caller: an error in tests, a warning in development, nothing
 * in a release build (a learner never loses a prompt to a guard).
 */
export function reportVoiceFault(message: string): void {
  const mode = runtimeMode();
  if (mode === 'test') throw new Error(message);
  if (mode === 'development') console.warn(message);
}

const LONE_JAMO = /^[\u3131-\u318E\u1100-\u11FF]$/u;

/** The whole text, trimmed, is one compatibility or conjoining jamo. A jamo inside a longer text passes. */
export function isLoneJamo(text: string): boolean {
  return LONE_JAMO.test(text.trim());
}

export interface KnownLoneJamoSpeaker {
  /** The `PlaySpec.source` of the surface that still speaks lone jamo. */
  source: string;
  /** The mismatch row of AMENDMENTS-AUDIO-CLIPS section 4. */
  spec: `M${number}`;
  /** The Part A PR that fixes it and deletes this entry. */
  fixedBy: `JV-${number}`;
}

/**
 * Surfaces known to speak a lone jamo that the test suite plays through the controller, each
 * with the row that fixes it; an entry passes the guard silently until its PR deletes it.
 * Empty: no test trips the guard at JV-1. Story `shapes-of-hangeul` keywords (M8) still speak
 * bare jamo on `main`, but no test plays them through the controller, so they are not listed:
 * a development build warns on them until JV-3 adds their `spokenKo`.
 */
export const KNOWN_LONE_JAMO_SPEAKERS: readonly KnownLoneJamoSpeaker[] = [];

/** Check a text about to be spoken (`playPrompt`, so `speak()` and `playJamo` too). */
export function guardSpokenText(text: string, source?: string, known: readonly KnownLoneJamoSpeaker[] = KNOWN_LONE_JAMO_SPEAKERS): void {
  if (!isLoneJamo(text)) return;
  if (source !== undefined && known.some((k) => k.source === source)) return;
  reportVoiceFault(
    `Spoken text "${text}" is a lone jamo (source ${source ?? 'unknown'}): speak a jamo through jamoVoice (AMENDMENTS-AUDIO-CLIPS JV-A2).`,
  );
}
