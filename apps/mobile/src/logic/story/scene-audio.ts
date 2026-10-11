import type { KoText, SpeechLang } from '@hangul-route/content-schema';
import type { PlaySpec, PromptKind } from '../audio/controller';
import type { SceneView } from './scene-view';

/**
 * What a reader scene says, as F-AUDIO-004 `PlaySpec`s (F-STORY-002 §3.2, §3.4).
 * Pure: the steps go to `createAudioRunner`, which hands each to `playPrompt`.
 * Rate and pitch are never set here (`speechParams(kind, level)` owns them);
 * the reader only says what kind of thing each step is.
 */

export const STORY_READER_AUDIO_SOURCE = 'story-reader';

export type SceneAudioPart = 'narration' | 'korean';

export interface SceneAudioOptions {
  include: readonly SceneAudioPart[];
}

export type SceneAudioInput = Pick<SceneView, 'narrationParts' | 'narrationLang' | 'narrationAudioRef' | 'korean'>;

/**
 * The voice of the narration actually shown: the overlay's language when its
 * text is on screen, else English. A missing overlay never makes an English
 * sentence speak in the UI locale's voice.
 */
export function narrationSpeechLang(uiSpeechLang: SpeechLang, overlayShown: boolean): SpeechLang {
  return overlayShown ? uiSpeechLang : 'en-US';
}

/** A chunk worth speaking has a letter or a digit (not just ", " or "!" between tokens). */
const SAYABLE = /[\p{L}\p{N}]/u;

function step(text: string, language: SpeechLang, kind: PromptKind, audioRef: string | null | undefined): PlaySpec {
  const spec: PlaySpec = { text, language, kind, source: STORY_READER_AUDIO_SOURCE };
  if (audioRef) spec.audioRef = audioRef;
  return spec;
}

function koreanStep(text: Pick<KoText, 'ko' | 'spokenKo' | 'audioRef'>, kind: PromptKind): PlaySpec {
  return step(text.spokenKo ?? text.ko, 'ko-KR', kind, text.audioRef);
}

function narrationSteps(view: SceneAudioInput): PlaySpec[] {
  if (view.narrationAudioRef) {
    // One recording of the whole narration cannot be split at the terms; its
    // TTS fallback reads the words as shown (a term as its romanization).
    const shown = view.narrationParts.map((p) => ('text' in p ? p.text : p.kw.romanization)).join('');
    return [step(shown, view.narrationLang, 'narration', view.narrationAudioRef)];
  }
  return view.narrationParts.flatMap((part) => {
    if ('kw' in part) return [koreanStep(part.kw, 'word')];
    return SAYABLE.test(part.text) ? [step(part.text, view.narrationLang, 'narration', null)] : [];
  });
}

export function planSceneAudio(view: SceneAudioInput, opts: SceneAudioOptions): PlaySpec[] {
  const steps: PlaySpec[] = [];
  if (opts.include.includes('narration')) steps.push(...narrationSteps(view));
  if (opts.include.includes('korean') && view.korean) {
    steps.push(koreanStep(view.korean.text, view.korean.kind === 'line' ? 'sentence' : 'word'));
  }
  return steps;
}
