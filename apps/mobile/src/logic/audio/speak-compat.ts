import type { SpeechLang } from '@hangul-route/content-schema';
import type { PlayResult, PlaySpec, PromptKind } from './controller';

/**
 * The low-level `speak(text, opts)` surface kept for callers that do not need
 * a result (F-AUDIO-004 §3.5): it is `playPrompt` underneath, so the same
 * muting, voice choice and rate apply. An engine failure still ends in
 * `onDone` unless the caller gave an `onError`, as before.
 */
export interface SpeakOptions {
  language?: SpeechLang;
  kind?: PromptKind;
  onDone?: () => void;
  /** Called instead of `onDone` when the prompt could not be spoken. */
  onError?: () => void;
}

export function speakCompat(play: (spec: PlaySpec) => Promise<PlayResult>, text: string, opts: SpeakOptions): void {
  void play({ text, language: opts.language ?? 'ko-KR', kind: opts.kind ?? 'word' }).then((result) => {
    if (result === 'unavailable' && opts.onError) opts.onError();
    else opts.onDone?.();
  });
}
