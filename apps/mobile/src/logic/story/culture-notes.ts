import type { CultureNote, ProgressSnapshot, Story, ThemeKey } from '@hangul-route/content-schema';
import { themes } from '../../content/stages';
import { compareInstant } from '../sync/merge';
import { compareShelfOrder, entryForStory, type StoryIndexEntry } from './story-index';

/**
 * Culture notes (F-STORY-004 §3.1, §3.5). Found, not stored: a note is found
 * when any indexed quest of its story has a `completedAt`, so it follows the
 * learner across devices through normal progress sync. Notes not found are
 * neither listed nor counted (no locked placeholders, D3). Only stories in the
 * index count, so an unreviewed story has no notes in production (D14).
 */

export interface NoteSource {
  title: string;
  publisher: string;
}

export interface FoundNote {
  note: CultureNote;
  storyId: string;
  storyTitle: Story['title'];
  /** The episode page the note links back to (the story's shelf entry when it has one). */
  episodeId: string;
  theme: ThemeKey;
  /** The earliest finish of any of the story's quests. */
  foundAt: string;
  /** Every source of the note's facts, de-duplicated; shown as plain text under "Where this comes from". */
  sources: NoteSource[];
}

/** The note's sources, or null when a fact does not resolve or has no source (the note is then skipped). */
function sourcesOf(note: CultureNote, story: Story): NoteSource[] | null {
  const seen = new Set<string>();
  const sources: NoteSource[] = [];
  for (const factId of note.factIds) {
    const fact = story.facts.find((f) => f.id === factId);
    if (!fact || fact.sources.length === 0) return null;
    for (const { title, publisher } of fact.sources) {
      const key = `${title}\u0000${publisher}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ title, publisher });
    }
  }
  return sources;
}

/**
 * Found notes in story order: each story sits where its own entry (`entryForStory`:
 * its shelf entry when it has one) falls in shelf order (Story Time, Culture,
 * then books), whichever of its quests was finished; each story's notes in file order.
 */
export function foundNotes(
  index: readonly StoryIndexEntry[],
  stories: readonly Story[],
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined,
): FoundNote[] {
  const done = new Map<string, string>();
  for (const q of snapshot?.quests ?? []) if (q.completedAt) done.set(q.questId, q.completedAt);
  const storyById = new Map(stories.map((s) => [s.id, s]));

  const foundAt = new Map<string, string>();
  for (const entry of index) {
    const at = done.get(entry.questId);
    if (at === undefined) continue;
    const earlier = foundAt.get(entry.storyId);
    if (earlier === undefined || compareInstant(at, earlier) < 0) foundAt.set(entry.storyId, at);
  }

  // Defined: `foundAt` only holds stories that have an entry.
  const found = [...foundAt.keys()].map((storyId) => entryForStory(index, storyId) as StoryIndexEntry);
  const notes: FoundNote[] = [];
  for (const entry of found.sort(compareShelfOrder)) {
    const { storyId } = entry;
    const at = foundAt.get(storyId) as string;
    const story = storyById.get(storyId);
    if (!story) continue;
    for (const note of story.cultureNotes) {
      const sources = sourcesOf(note, story);
      if (!sources) continue;
      notes.push({ note, storyId, storyTitle: story.title, episodeId: entry.episodeId, theme: story.theme, foundAt: at, sources });
    }
  }
  return notes;
}

/** `CultureNotes { storyId }`: only that story's notes. */
export function notesForStory(notes: readonly FoundNote[], storyId: string): FoundNote[] {
  return notes.filter((n) => n.storyId === storyId);
}

export interface NoteGroup {
  theme: ThemeKey;
  notes: FoundNote[];
}

/** One group per theme that has notes, in the five themes' order (`content/stages.ts`). */
export function groupNotesByTheme(notes: readonly FoundNote[]): NoteGroup[] {
  return [...themes]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ theme: t.key, notes: notes.filter((n) => n.theme === t.key) }))
    .filter((g) => g.notes.length > 0);
}
