import type { KoVoiceStatus } from './capability';

/**
 * Whether a screen plays its prompt by itself when a round opens (a Trace letter, a Trace a Word block):
 * not while sound is off, and not when nothing could sound (no Korean voice and no bundled recording),
 * so the screen is not told why it is silent before the learner asked to hear anything. A tap on the
 * speaker or Show me still tries, and the status panel then says why (F-AUDIO-004 §3.9, revised
 * 2026-10-17). While the voice list is still `unknown` the prompt plays. Pure.
 */
export function playsOnOpen(muted: boolean, tts: KoVoiceStatus, hasClip: boolean): boolean {
  if (muted) return false;
  return tts.state !== 'none' || hasClip;
}
