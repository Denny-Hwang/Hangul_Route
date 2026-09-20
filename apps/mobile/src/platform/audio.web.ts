/**
 * Web variant of the audio wrapper: the browser's speechSynthesis with the
 * best available Korean voice. Offline availability depends on the device's
 * installed voices, which is why jamo MP3 assets (T-017) remain the plan of
 * record for guaranteed offline pronunciation.
 */
let muted = false;

export interface SpeakOptions {
  language?: 'ko-KR' | 'en-US';
  rate?: number;
  pitch?: number;
  onDone?: () => void;
}

interface SynthLike {
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

function synth(): SynthLike | null {
  const s = (globalThis as { speechSynthesis?: SynthLike }).speechSynthesis;
  return s ?? null;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (muted) synth()?.cancel();
}

export function isMuted(): boolean {
  return muted;
}

/** Prefer a voice whose lang matches exactly, then by prefix, else none. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | null {
  const exact = voices.find((v) => v.lang === language);
  if (exact) return exact;
  const prefix = language.slice(0, 2);
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  const s = synth();
  if (muted || !s || typeof SpeechSynthesisUtterance === 'undefined') {
    opts.onDone?.();
    return;
  }
  s.cancel();
  const language = opts.language ?? 'ko-KR';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = opts.rate ?? 0.78;
  utterance.pitch = opts.pitch ?? 1.05;
  const voice = pickVoice(s.getVoices(), language);
  if (voice) utterance.voice = voice;
  let finished = false;
  const done = (): void => {
    if (finished) return;
    finished = true;
    opts.onDone?.();
  };
  utterance.onend = done;
  utterance.onerror = done;
  s.speak(utterance);
}

export function stop(): void {
  synth()?.cancel();
}

export function playJamoSound(char: string, _audioRef?: string): Promise<void> {
  return new Promise((resolve) => {
    speak(char, { language: 'ko-KR', onDone: resolve });
  });
}
