import type { AudioCapability } from './capability';

/**
 * The visible text fallback as a pure reducer (F-AUDIO-004 §3.8, AD4, AD13).
 *
 * One state per prompt slot (a Match Sound round, a Discover item, a
 * Listen & Pick question). Text is shown proactively when sound is off or no
 * Korean voice exists, and reactively after a failed play. Once shown in a
 * round it stays (no flicker) and resets with the next round; the one
 * exception is a "no Korean voice" text when the voices then load (2026-10-17).
 */
export type PlayResult = 'played' | 'muted' | 'unavailable';
export type PromptPhase = 'idle' | 'playing' | 'ok' | 'text';
export type FallbackReason = 'muted' | 'no_voice' | 'error' | 'blocked';

export interface PromptState {
  phase: PromptPhase;
  reason: FallbackReason | null;
  attempts: number;
}

export type PromptEvent =
  | 'play'
  | 'reset'
  | { result: PlayResult; failure?: FallbackReason }
  | { capability: AudioCapability }
  | { muted: boolean };

export const INITIAL_PROMPT_STATE: PromptState = { phase: 'idle', reason: null, attempts: 0 };

export function promptReducer(s: PromptState, e: PromptEvent): PromptState {
  if (e === 'reset') return INITIAL_PROMPT_STATE;
  if (e === 'play') {
    return { phase: s.phase === 'text' ? 'text' : 'playing', reason: s.phase === 'text' ? s.reason : null, attempts: s.attempts + 1 };
  }
  if ('result' in e) {
    if (e.result === 'played') {
      // A successful replay does not hide the text again; it only settles the reason.
      return s.phase === 'text' ? { ...s, reason: null } : { ...s, phase: 'ok', reason: null };
    }
    if (e.result === 'muted') return { ...s, phase: 'text', reason: 'muted' };
    return { ...s, phase: 'text', reason: e.failure ?? 'error' };
  }
  if ('capability' in e) {
    const cap = e.capability;
    if (cap.tts.state === 'ready' || cap.clips) {
      // Voices that load late (Chrome's empty first list) clear a "no Korean voice" text: it was never true.
      // Any other text (muted, blocked, error) stays for the round.
      if (s.phase !== 'text' || s.reason !== 'no_voice') return s;
      return s.attempts === 0 ? { ...s, phase: INITIAL_PROMPT_STATE.phase, reason: null } : { ...s, phase: 'ok', reason: null };
    }
    if (cap.tts.state !== 'none') return s;
    return { ...s, phase: 'text', reason: s.phase === 'text' ? (s.reason ?? 'no_voice') : 'no_voice' };
  }
  if (e.muted) return { ...s, phase: 'text', reason: 'muted' };
  return s.phase === 'text' && s.reason === 'muted' ? { ...s, reason: null } : s;
}

/**
 * Whether the prompt zone shows the text prompt. Proactive: sound is off
 * (F-001 §3.4, "regardless of audio load state") or there is no Korean voice
 * and this item has no bundled clip. Reactive: the reducer reached `text`.
 * While the capability is `unknown` the audio prompt is shown, so no flash.
 */
export function showText(s: PromptState, cap: AudioCapability, muted: boolean, hasClip: boolean): boolean {
  return muted || s.phase === 'text' || (cap.tts.state === 'none' && !hasClip);
}

export type FallbackAction = 'turn_on' | 'try_again' | 'tap_to_hear' | 'none';

/** What the fallback panel offers for a reason (§3.8). The speaker button itself is always present. */
export function fallbackAction(reason: FallbackReason | null): FallbackAction {
  if (reason === 'muted') return 'turn_on';
  if (reason === 'error') return 'try_again';
  if (reason === 'blocked') return 'tap_to_hear';
  return 'none';
}
