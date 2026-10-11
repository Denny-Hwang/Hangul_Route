import type { CultureNote, KoText, SceneArt, Story, StoryLevel } from '@hangul-route/content-schema';
import type { ReaderMode } from './reader-effects';
import type { ReaderEffect } from './reader-state';

/**
 * The reader's extras (F-STORY-002 §3.7, PR 2.8): the "Did you know?" culture
 * note card, the one-line advisory row for grown-ups and the end page recap.
 * Pure: `StoryReaderView` and `ReaderParts` only draw what these return.
 */

// ---------------------------------------------------------------------------
// Culture note
// ---------------------------------------------------------------------------

/**
 * The note card shares the reader's one inline-card slot (`ReaderState.openTerm`)
 * with the gloss card, so one card is open at a time and it closes on Close, a
 * second tap of its chip, Escape, a page turn and a checkpoint (§3.5).
 */
export const noteItemId = (cultureNoteId: string): string => `note:${cultureNoteId}`;

export interface CultureNoteView {
  id: string;
  /** Its id in the reader's open slot. */
  itemId: string;
  title: string;
  body: string;
  /** Taught Korean: drawn by `KoreanText` with its romanization and gloss, and a speaker. */
  term: KoText;
  /** The heritage card drawn on the note, only when that card has art; else null. */
  cardId: string | null;
}

function koTextOf(source: KoText): KoText {
  const text: KoText = { ko: source.ko, romanization: source.romanization, en: source.en };
  if (source.spokenKo !== undefined) text.spokenKo = source.spokenKo;
  if (source.audioRef !== undefined) text.audioRef = source.audioRef;
  return text;
}

/**
 * @param drawnCardIds the card ids the design system can draw (`supportedCardIds`)
 * @returns null for a scene without a note
 */
export function cultureNoteView(note: CultureNote | null, drawnCardIds: readonly string[]): CultureNoteView | null {
  if (note === null) return null;
  return {
    id: note.id,
    itemId: noteItemId(note.id),
    title: note.titleEn,
    body: note.bodyEn,
    term: koTextOf(note.term),
    cardId: note.cardId !== undefined && drawnCardIds.includes(note.cardId) ? note.cardId : null,
  };
}

export function noteOpen(view: CultureNoteView | null, openTerm: string | null): boolean {
  return view !== null && openTerm === view.itemId;
}

// ---------------------------------------------------------------------------
// Advisory
// ---------------------------------------------------------------------------

/**
 * The advisory row (`review.advisoryNoteEn`): only on a fresh quest-mode open
 * of scene 1 (not a resume, not a replay). It never blocks; Sources always
 * shows the note. No age wording (D1): the copy addresses grown-ups.
 *
 * @param input.startIndex the scene the reader opened on (already clamped)
 */
export function advisoryNote(story: Pick<Story, 'review'>, input: { mode: ReaderMode; startIndex: number }): string | null {
  if (input.mode !== 'quest' || input.startIndex !== 0) return null;
  if (story.review.advisory.length === 0) return null;
  return story.review.advisoryNoteEn ?? null;
}

/** The row after a reader effect: it lasts through the opening only, and never shows again in that visit. */
export function advisoryAfter(note: string | null, effect: ReaderEffect): string | null {
  if (effect.type === 'answer') return note;
  if (effect.type === 'scene-changed' && effect.via === 'open') return note;
  return null;
}

// ---------------------------------------------------------------------------
// End page recap
// ---------------------------------------------------------------------------

export const RECAP_SCENES = 4;

export interface RecapScene {
  sceneId: string;
  art: SceneArt;
}

/**
 * The end page's row of small pictures: the tier's Story Order scenes
 * (`sequenceSceneIds`) in order, at most four. A scene whose art is missing or
 * pending is left out (a blank tile recaps nothing), so the row may be shorter
 * or absent. Decorative: hidden from screen readers.
 */
export function recapScenes(story: Story, level: StoryLevel): RecapScene[] {
  const tier = story.tiers.find((t) => t.level === level);
  if (!tier) return [];
  const out: RecapScene[] = [];
  for (const id of tier.sequenceSceneIds) {
    const scene = tier.scenes.find((s) => s.id === id);
    if (scene?.art && scene.artPending !== true) out.push({ sceneId: scene.id, art: scene.art });
  }
  return out.slice(0, RECAP_SCENES);
}

export interface RecapLayoutInput {
  /** The end page's content width. */
  width: number;
  /** Window height < `layout.compactHeight`. */
  compact: boolean;
  /** Window wider than tall. */
  landscape: boolean;
  /** Pictures to show. */
  count: number;
  /** Hoya's size on the end page. */
  hoya: number;
  /** The largest thumbnail width. */
  maxThumb: number;
  gap: number;
}

export interface RecapLayout {
  /** True: the pictures sit beside Hoya in one row (a short landscape window), so Continue stays on screen. */
  inline: boolean;
  thumbWidth: number;
}

export function recapLayout(input: RecapLayoutInput): RecapLayout {
  const inline = input.compact && input.landscape;
  const room = inline ? input.width - input.hoya - input.gap : input.width;
  if (input.count <= 0 || room <= 0) return { inline, thumbWidth: 0 };
  const share = (room - input.gap * (input.count - 1)) / input.count;
  return { inline, thumbWidth: Math.max(0, Math.floor(Math.min(input.maxThumb, share))) };
}
