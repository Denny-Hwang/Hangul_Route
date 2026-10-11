import type { LectureDeck } from '@hangul-route/content-schema';
import { acceptRoster, type MessageEventLike, type RosterContext } from './roster-message';

/**
 * Where accepted picker labels live: one module-level variable, and nowhere
 * else (F-TCH-004 §3.2 step 4, §3.9, D12). Never a persisted store, never
 * `lecture:recent`, never telemetry, never logged. Closing the tab clears it
 * by itself; the presenter calls `clearPickerLabels()` on Exit and on any
 * navigation away from the deck.
 */

interface Held {
  deckId: string;
  mode: 'names' | 'initials';
  labels: readonly string[];
}

let held: Held | null = null;

/** Validates a `message` event and, if it is a roster for the open deck, holds its labels. */
export function receiveRoster(event: MessageEventLike, ctx: RosterContext): boolean {
  const accepted = acceptRoster(event, ctx);
  if (accepted === null) return false;
  held = { deckId: ctx.deck.id, mode: accepted.mode, labels: Object.freeze([...accepted.labels]) };
  return true;
}

/** The labels held for this deck, its picker mode and count; null when there are none (numbers mode). */
export function heldLabels(deck: Pick<LectureDeck, 'id' | 'picker'>): readonly string[] | null {
  if (held === null || deck.picker === null) return null;
  if (held.deckId !== deck.id || held.mode !== deck.picker.mode || held.labels.length !== deck.picker.count) return null;
  return held.labels;
}

export function clearPickerLabels(): void {
  held = null;
}
