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
  /**
   * Called instead of `onDone` when synthesis fails. Without it an error still
   * ends in `onDone`, so existing callers are unchanged.
   */
  onError?: () => void;
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
  utterance.onerror = (event) => {
    // A newer prompt cancelling this one is a normal stop, not a failure.
    const stopped = event?.error === 'canceled' || event?.error === 'interrupted';
    if (opts.onError && !stopped) {
      if (finished) return;
      finished = true;
      opts.onError();
      return;
    }
    done();
  };
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
 * Thin shim over `speak` for the prompt-audio contract; F-AUDIO-004 owns the
 * real implementation and keeps this signature. `unavailable` is the cue to
 * show the prompt as text (F-001 §3.3, D6): no speech synthesis, no voice for
 * the language among the loaded voices, or a synthesis error. An empty voice
 * list (browsers load voices late) proves nothing, so the error decides.
 */
export function playPrompt(spec: PromptSpec): Promise<PlayResult> {
  if (muted) return Promise.resolve('muted');
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve('unavailable');
  const language = spec.language ?? 'ko-KR';
  const voices = s.getVoices();
  if (voices.length > 0 && !pickVoice(voices, language)) return Promise.resolve('unavailable');
  return new Promise<PlayResult>((resolve) => {
    speak(spec.text, {
      language,
      onDone: () => resolve('played'),
      onError: () => resolve('unavailable'),
    });
  });
}
