import type { RomanizationMode } from '@hangul-route/i18n';
import { STORY_CHECK_COPY } from './copy';
import type { SequenceCard } from './sequence-cards';
import { hashSeed } from './seeded-order';
import { romanizationShown } from './romanization';
import type { SequenceState } from './sequence-player';

/**
 * View-models and small rules for the Story Order screen (F-STORY-003 §3.5).
 * `StorySequenceGame` only paints what these return; everything with a branch
 * lives here so it is unit-tested without a renderer.
 */

/** The story replay moves to the next card about this often (ms). */
export const SEQUENCE_REPLAY_MS = 2500;
/** A wrong card keeps its amber look for about this long (ms). */
export const SEQUENCE_WRONG_FLASH_MS = 600;

/** Widest Korean text (glyphs without spaces) that a card holds on one line, below / at tablet width. */
const FITS_PHONE = 3;
const FITS_TABLET = 5;

/**
 * Card columns by window width: 1 at 320 dp, 2 from 360 dp, 3-4 at tablet
 * width. `longestKorean` (glyphs of the longest Korean text of the cards) drops
 * a layout that would break a Korean word across lines (a 28 sp chip holds
 * about three glyphs in a half-width phone card): one column on a phone, two on
 * a tablet.
 */
export function sequenceColumns(width: number, longestKorean = 0): 1 | 2 | 3 | 4 {
  const tablet = width >= 768;
  if (longestKorean > (tablet ? FITS_TABLET : FITS_PHONE)) return tablet ? 2 : 1;
  if (width >= 1024) return 4;
  if (tablet) return 3;
  if (width >= 360) return 2;
  return 1;
}

/** Glyphs of the longest Korean text among the cards (spaces do not count). */
export function longestKoreanGlyphs(cards: ReadonlyArray<SequenceCard>): number {
  return Math.max(0, ...cards.map((c) => [...(c.ko?.ko ?? '')].filter((g) => g.trim() !== '').length));
}

/** Seed of the start derangement: the scope ref plus a per-mount nonce (injectable in tests). */
export function sequenceSeed(sequenceId: string, nonce: number): number {
  return hashSeed(`${sequenceId}|${nonce}`);
}

export interface SlotView {
  /** 1-based number drawn in the slot. */
  number: number;
  /** The card placed here, or null while the slot is empty. */
  cardId: string | null;
}

/** One slot per card, filled left to right. */
export function slotViews(state: SequenceState): SlotView[] {
  return state.solution.map((_, i) => ({ number: i + 1, cardId: state.placed[i] ?? null }));
}

/** The romanization to draw on a card ('' draws no line): D2, hidden until revealed only in `tap` mode. */
export function sequenceCardRomanization(card: SequenceCard, mode: RomanizationMode, revealed: boolean): string {
  if (!card.ko) return '';
  return romanizationShown(mode, revealed) ? card.ko.romanization : '';
}

/** What a screen reader says for a card; the outcome of a miss or a highlight is in words, not only colour. */
export function sequenceCardLabel(
  card: SequenceCard,
  romanization: string,
  outcome: 'wrong' | 'hint' | null,
): string {
  const copy = STORY_CHECK_COPY.sequence;
  let base = card.caption;
  if (card.ko) {
    const korean = romanization === '' ? card.ko.ko : `${card.ko.ko}, ${romanization}`;
    base = `${korean}. ${card.caption}`;
  }
  if (outcome === 'wrong') return `${base}. ${copy.tryAnother}`;
  if (outcome === 'hint') return `${base}. ${copy.lookHere}`;
  return base;
}

/** Whether the replay should move on by itself: playing, motion allowed, cards left. */
export function autoAdvanceDue(state: SequenceState, reducedMotion: boolean): boolean {
  return (
    state.phase === 'replay' && !state.paused && !reducedMotion && state.replayIndex < state.solution.length - 1
  );
}

export interface SequenceSummary {
  slots: number;
  /** Placed slots that took no wrong tap. */
  firstTryCorrect: number;
  /** Wrong taps, across all slots. */
  retries: number;
  replayed: boolean;
}

export function sequenceSummary(state: SequenceState): SequenceSummary {
  return {
    slots: state.solution.length,
    firstTryCorrect: state.wrongBySlot.filter((wrong, i) => i < state.placed.length && wrong === 0).length,
    retries: state.wrongBySlot.reduce((sum, n) => sum + n, 0),
    replayed: state.replayed,
  };
}

/** The `story.sequence.finished` payload (F-STORY-003 §3.9): ids and counts only. */
export function sequenceFinishedPayload(
  ids: { storyId: string | null; sequenceId: string },
  summary: SequenceSummary,
  skipped: boolean,
): Record<string, unknown> {
  return { storyId: ids.storyId, sequenceId: ids.sequenceId, ...summary, skipped };
}
