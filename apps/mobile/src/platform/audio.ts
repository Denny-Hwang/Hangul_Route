import * as Speech from 'expo-speech';

/**
 * Audio wrapper — speaks Korean prompts via TTS when no MP3 asset is bound.
 * Real per-jamo MP3 assets land later under apps/mobile/assets/audio/jamo/.
 */

let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
  if (muted) Speech.stop();
}

export function isMuted(): boolean {
  return muted;
}

export interface SpeakOptions {
  language?: 'ko-KR' | 'en-US';
  rate?: number;
  pitch?: number;
  onDone?: () => void;
  /**
   * Called instead of `onDone` when the engine reports an error. Without it an
   * error still ends in `onDone`, so existing callers are unchanged.
   */
  onError?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (muted) {
    opts.onDone?.();
    return;
  }
  Speech.stop();
  Speech.speak(text, {
    language: opts.language ?? 'ko-KR',
    rate: opts.rate ?? 0.78,
    pitch: opts.pitch ?? 1.05,
    onDone: opts.onDone,
    onStopped: opts.onDone,
    onError: opts.onError ?? opts.onDone,
  });
}

export function stop(): void {
  Speech.stop();
}

/**
 * playJamoSound — preferred entry: uses MP3 ref if bundled, else falls back to TTS.
 * For prototype, all jamo go through TTS.
 */
export function playJamoSound(char: string, _audioRef?: string): Promise<void> {
  return new Promise((resolve) => {
    speak(char, { language: 'ko-KR', onDone: resolve });
  });
}

/** What happened to a prompt (F-QUEST-002 §3.12): heard, switched off, or no way to say it. */
export type PlayResult = 'played' | 'muted' | 'unavailable';

export interface PromptSpec {
  /** `item.spokenKo ?? item.ko`; for a symbol its sound, never the letter name. */
  text: string;
  /** MP3 path; wins over TTS once recordings are bundled (D6, F-AUDIO-004). Not played yet. */
  audioRef?: string;
  language?: 'ko-KR' | 'en-US';
}

/**
 * False only when the device lists voices and none speaks `language`. An
 * empty or unreadable list proves nothing, so the engine's error decides.
 */
async function hasVoiceFor(language: string): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (voices.length === 0) return true;
    const prefix = language.slice(0, 2).toLowerCase();
    return voices.some((v) => v.language.toLowerCase().replace('_', '-').startsWith(prefix));
  } catch {
    return true;
  }
}

/**
 * Thin shim over `speak` for the prompt-audio contract; F-AUDIO-004 owns the
 * real implementation and keeps this signature. `unavailable` is the cue to
 * show the prompt as text (F-001 §3.3, D6).
 */
export async function playPrompt(spec: PromptSpec): Promise<PlayResult> {
  if (muted) return 'muted';
  const language = spec.language ?? 'ko-KR';
  if (!(await hasVoiceFor(language))) return 'unavailable';
  if (muted) return 'muted';
  return new Promise<PlayResult>((resolve) => {
    speak(spec.text, {
      language,
      onDone: () => resolve('played'),
      onError: () => resolve('unavailable'),
    });
  });
}
