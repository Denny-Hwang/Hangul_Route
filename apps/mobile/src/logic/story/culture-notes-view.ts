import { romanizationShown, type Messages, type RomanizationMode } from '@hangul-route/i18n';
import type { PlaySpec } from '../audio/controller';
import { compareInstant } from '../sync/merge';
import { groupNotesByTheme, notesForStory, type FoundNote, type NoteGroup } from './culture-notes';
import type { StoryShelfCopy } from './shelf-copy';

/**
 * What the Culture section's notes card and the Culture notes screen show
 * (F-STORY-004 §3.5; wireframes design/wireframes/library/culture.md C and
 * design/wireframes/story/culture-notes.md D; brief
 * design/brief/screens/24-culture-notes.md). Pure: `CultureSection` and
 * `CultureNotesScreen` paint what these return. Only found notes are ever
 * listed or counted (no locked placeholders, a count and never a fraction).
 */

/** `playPrompt` surface id of the notes' term speakers. */
export const CULTURE_NOTES_AUDIO_SOURCE = 'culture-notes';

/** How many note titles the Library card lists. */
const NEWEST_SHOWN = 2;

export interface CultureNotesCardView {
  count: number;
  /** "N found", or null when nothing is found yet. */
  foundLine: string | null;
  /** Titles of the newest found notes (latest finish first), at most two. */
  newest: string[];
  /** "Finish a story to find your first culture note." when nothing is found yet. */
  emptyLine: string | null;
  /** The whole card is one button. */
  accessibilityLabel: string;
}

/** Newest first by the finish that found the note; a tie keeps the list (story) order. */
function newestFirst(notes: readonly FoundNote[]): FoundNote[] {
  return notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => compareInstant(b.n.foundAt, a.n.foundAt) || a.i - b.i)
    .map(({ n }) => n);
}

export function cultureNotesCard(notes: readonly FoundNote[], copy: StoryShelfCopy): CultureNotesCardView {
  const c = copy.cultureNotes;
  const count = notes.length;
  const newest = newestFirst(notes)
    .slice(0, NEWEST_SHOWN)
    .map((n) => n.note.titleEn);
  return {
    count,
    foundLine: count > 0 ? c.found.pill(count) : null,
    newest,
    emptyLine: count > 0 ? null : c.empty.line,
    accessibilityLabel: c.cardLabel(count, newest[0], newest[1]),
  };
}

export interface CultureNotesScreenView {
  /** Under the five theme headings, in theme order; only themes with found notes. */
  groups: NoteGroup[];
  count: number;
  /** `noteId` when it is among the notes shown: scrolled into view with its sources open. */
  targetNoteId: string | null;
}

export function cultureNotesScreenView(input: { notes: readonly FoundNote[]; storyId?: string; noteId?: string }): CultureNotesScreenView {
  const shown = input.storyId ? notesForStory(input.notes, input.storyId) : [...input.notes];
  const target = input.noteId !== undefined && shown.some((n) => n.note.id === input.noteId) ? input.noteId : null;
  return { groups: groupNotesByTheme(shown), count: shown.length, targetNoteId: target };
}

/** `culture.note.viewed` (§3.11): ids only. */
export function noteViewedPayload(n: Pick<FoundNote, 'note' | 'storyId'>): { noteId: string; storyId: string } {
  return { noteId: n.note.id, storyId: n.storyId };
}

/** The term's speaker: its clip when it has one, else Korean speech of its spoken form. */
export function noteTermSpeech(n: Pick<FoundNote, 'note'>): PlaySpec {
  const { term } = n.note;
  const spec: PlaySpec = { text: term.spokenKo ?? term.ko, language: 'ko-KR', kind: 'word', source: CULTURE_NOTES_AUDIO_SOURCE };
  if (term.audioRef) spec.audioRef = term.audioRef;
  return spec;
}

export interface NoteTermChip {
  ko: string;
  /** '' draws no romanization line (hidden until the term is heard, D2). */
  romanization: string;
  gloss: string;
  hearLabel: string;
  /** Always says the romanization: a screen reader cannot "peek". */
  accessibilityLabel: string;
}

/** The note's term: Korean, romanization (D2, keyed by the note id), gloss and its speaker's name. */
export function noteTermChip(
  n: Pick<FoundNote, 'note'>,
  ctx: { romanizationMode: RomanizationMode; revealed: ReadonlySet<string> },
  copy: StoryShelfCopy,
  koreanItem: Messages['a11y']['koreanItem'],
): NoteTermChip {
  const { term, id } = n.note;
  return {
    ko: term.ko,
    romanization: romanizationShown(ctx.romanizationMode, ctx.revealed.has(id)) ? term.romanization : '',
    gloss: term.en,
    hearLabel: copy.cultureNotes.hearTerm(term.romanization),
    accessibilityLabel: koreanItem({ ko: term.ko, romanization: term.romanization, gloss: term.en }),
  };
}

/** The note's card when it names one the app can draw (`supportedCardIds` and the bundle); else null. */
export function noteCardArtId(n: Pick<FoundNote, 'note'>, drawable: (cardId: string) => boolean): string | null {
  const id = n.note.cardId;
  return id !== undefined && drawable(id) ? id : null;
}
