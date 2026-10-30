import { localize, type Overlays, type UiLocale } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { cardCitationView, type CardCitationView } from './library/card-citation';
import { koTokenParts, type KoTokenPart } from './ko-tokens';
import type { LessonQuestNote } from './lessons/lesson-store';

/*
 * The Did you know? tip (F-CURR-002 §5.7, row CM-3C): one sourced note of a lesson cell, shown at a quest's reward step
 * and on the back of the cell's cards. Which note a quest shows is settled when the lessons are built
 * (scripts/build-lessons.mjs `questNotes`: the culture notes first, quest k takes note k), so a quest always shows the
 * same one; these helpers only pick a card's quest and shape what the screen draws. Pure.
 */

type CitationMessages = Messages['learner']['cardDetail']['citation'];

export interface CultureTipView {
  noteId: string;
  /** The note in the UI language, around its `{ko:}` tokens (taught Korean, drawn with its romanization). */
  parts: KoTokenPart[];
  /** "Source: <publisher>, <title>" and "and N more sources": the card back's source line, never a URL. */
  citation: CardCitationView | null;
}

/**
 * What the tip draws for a note of the cell `episodeId`: its text in `locale` (the cell's `culture.<id>.text` gloss,
 * else the English) split around its `{ko:}` tokens, and its source line.
 */
export function cultureTipView(
  note: LessonQuestNote,
  episodeId: string,
  locale: UiLocale,
  overlays: Overlays,
  m: CitationMessages,
): CultureTipView {
  const shown = localize({ culture: [{ id: note.id, textEn: note.textEn }] }, episodeId, locale, overlays).culture[0];
  return {
    noteId: note.id,
    parts: koTokenParts(shown?.textEn ?? note.textEn),
    citation: cardCitationView({ citation: note.citation }, m),
  };
}

/** A lesson cell as the card back needs it: its quests in order and the cards it gives. */
export interface TipCell {
  id: string;
  questIds: readonly string[];
  rewardCardIds: readonly string[];
}

/**
 * The quest whose note a card's back shows: in the lesson cell that gives the card, the quest that awards it
 * (`rewardCardId`), else the cell's first quest. Undefined for a card no lesson cell gives (Stage 1, a story's card).
 */
export function cardTipQuest(cardId: string, cells: readonly TipCell[], rewardCardOf: (questId: string) => string | undefined): string | undefined {
  const cell = cells.find((c) => c.rewardCardIds.includes(cardId));
  if (cell === undefined) return undefined;
  return cell.questIds.find((q) => rewardCardOf(q) === cardId) ?? cell.questIds[0];
}
