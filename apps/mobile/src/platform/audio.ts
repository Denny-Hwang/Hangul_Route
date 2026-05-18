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
    onError: opts.onDone,
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
