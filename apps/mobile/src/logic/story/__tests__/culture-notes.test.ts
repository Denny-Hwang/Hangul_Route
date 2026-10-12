import type { CultureNote, Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { foundNotes, groupNotesByTheme, notesForStory } from '../culture-notes';
import { buildStoryIndex } from '../story-index';
import { bookEpisode, questId, shelfEpisode, shelfIndex, snapshot, story, storyQuest, unreviewed } from './shelf-fixture';

/** The ready fixture's first source of f3, stored with its web address (the card prints it without, F-STORY-006 §3.8). */
const HANGUL_DAY_PUBLISHER = '문화재청 (Cultural Heritage Administration, heritage.go.kr)';

function note(id: string, factIds: string[] = ['f3'], patch: Partial<CultureNote> = {}): CultureNote {
  return {
    id,
    titleEn: `Note ${id}`,
    bodyEn: 'A short sourced fact.',
    term: { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' },
    factIds,
    ...patch,
  };
}

const withNotes = (s: Story, notes: CultureNote[]): Story => ({ ...s, cultureNotes: notes });

// Shelf order: tiger (Story Time 1, nature), sun (Story Time 2, letters), seollal (Culture 1, rites).
const tiger = withNotes(story('tiger', { theme: 'nature', shelf: { category: 'story-time', order: 1 } }), [note('cn-tiger')]);
const sun = withNotes(story('sun', { theme: 'letters', shelf: { category: 'story-time', order: 2 } }), [note('cn-sun-a'), note('cn-sun-b', ['f1'])]);
const seollal = withNotes(story('seollal', { theme: 'rites', shelf: { category: 'culture', order: 1 } }), [note('cn-seollal')]);
const STORIES = [seollal, sun, tiger];
const index = shelfIndex(STORIES);
const at = (day: number): string => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;

describe('foundNotes', () => {
  it('lists nothing before any story is finished (no locked placeholders)', () => {
    expect(foundNotes(index, STORIES, undefined)).toEqual([]);
    expect(foundNotes(index, STORIES, snapshot([{ questId: questId('sun') }]))).toEqual([]);
  });

  it('finds the notes of finished stories only, in story (shelf) order, with their sources', () => {
    const done = snapshot([
      { questId: questId('seollal'), completedAt: at(1) },
      { questId: questId('sun'), completedAt: at(2) },
    ]);
    const notes = foundNotes(index, STORIES, done);
    expect(notes.map((n) => n.note.id)).toEqual(['cn-sun-a', 'cn-sun-b', 'cn-seollal']);
    expect(notes[0]).toMatchObject({
      storyId: 'story:sun',
      storyTitle: sun.title,
      episodeId: 'episode:shelf-sun',
      theme: 'letters',
      foundAt: at(2),
      sources: [
        { title: 'Hangul Day', publisher: HANGUL_DAY_PUBLISHER },
        { title: 'Hangul Day', publisher: 'National Institute of Korean Language' },
      ],
    });
  });

  it('de-duplicates the sources of a note across its facts', () => {
    const base = withNotes(story('twice', { shelf: { order: 5 } }), [note('cn-twice', ['f1', 'f2', 'f3'])]);
    const f1Source = base.facts.find((f) => f.id === 'f1')?.sources[0];
    if (!f1Source) throw new Error('fixture');
    // f2 cites the same work as f1 again (another locator): listed once.
    const twice: Story = {
      ...base,
      facts: base.facts.map((f) => (f.id === 'f2' ? { ...f, sources: [{ ...f1Source, quoteOrLocator: 'p. 2' }, ...f.sources] } : f)),
    };
    const [found] = foundNotes(shelfIndex([twice]), [twice], snapshot([{ questId: questId('twice'), completedAt: at(1) }]));
    expect(found?.sources).toEqual([
      { title: 'Hangul, the Korean alphabet', publisher: 'Cultural Heritage Administration' },
      { title: 'Hunminjeongeum Manuscript', publisher: 'Cultural Heritage Administration' },
      { title: 'Hunminjeongeum Manuscript', publisher: 'UNESCO' },
      { title: 'Hangul Day', publisher: HANGUL_DAY_PUBLISHER },
      { title: 'Hangul Day', publisher: 'National Institute of Korean Language' },
    ]);
  });

  it('any quest of the story counts, and foundAt is the earliest finish', () => {
    const both = shelfIndex(STORIES, {
      episodes: [bookEpisode('episode:stage5-letters', [questId('sun', 'read-along')])],
      quests: [storyQuest('sun', 'read-along')],
    });
    const done = snapshot([
      { questId: questId('sun'), completedAt: at(9) },
      { questId: questId('sun', 'read-along'), completedAt: at(4) },
    ]);
    const notes = foundNotes(both, STORIES, done);
    expect(notes.map((n) => [n.note.id, n.foundAt, n.episodeId])).toEqual([
      ['cn-sun-a', at(4), 'episode:shelf-sun'],
      ['cn-sun-b', at(4), 'episode:shelf-sun'],
    ]);
    const bookOnly = snapshot([{ questId: questId('sun', 'read-along'), completedAt: at(4) }]);
    expect(foundNotes(both, STORIES, bookOnly)).toHaveLength(2);
  });

  it('a story found only through its book quest keeps its own shelf place', () => {
    // tiger is Story Time 1 but finished only in the Stage 5 book; seollal (Culture 1) on the shelf.
    const withBook = shelfIndex(STORIES, {
      episodes: [bookEpisode('episode:stage5-letters', [questId('tiger', 'read-along')])],
      quests: [storyQuest('tiger', 'read-along')],
    });
    const done = snapshot([
      { questId: questId('seollal'), completedAt: at(1) },
      { questId: questId('tiger', 'read-along'), completedAt: at(2) },
    ]);
    const notes = foundNotes(withBook, STORIES, done);
    expect(notes.map((n) => [n.note.id, n.episodeId])).toEqual([
      ['cn-tiger', 'episode:shelf-tiger'],
      ['cn-seollal', 'episode:shelf-seollal'],
    ]);
  });

  it('foundAt compares finishes as instants (an offset time and a Z time)', () => {
    const both = shelfIndex(STORIES, {
      episodes: [bookEpisode('episode:stage5-letters', [questId('sun', 'read-along')])],
      quests: [storyQuest('sun', 'read-along')],
    });
    // 11:00+02:00 is 09:00Z: earlier than the 10:00Z shelf finish, though later as a string.
    const done = snapshot([
      { questId: questId('sun'), completedAt: '2026-10-04T10:00:00.000Z' },
      { questId: questId('sun', 'read-along'), completedAt: '2026-10-04T11:00:00+02:00' },
    ]);
    expect(foundNotes(both, STORIES, done)[0]?.foundAt).toBe('2026-10-04T11:00:00+02:00');
  });

  it('a story outside the index (unreviewed in production) has no found notes (behaviour 8)', () => {
    const draft = unreviewed(seollal);
    const gated = buildStoryIndex({
      stories: [draft],
      episodes: [shelfEpisode(draft)],
      quests: [storyQuest('seollal')],
      showUnreviewed: false,
    });
    expect(foundNotes(gated, [draft], snapshot([{ questId: questId('seollal'), completedAt: at(1) }]))).toEqual([]);
  });

  it('skips a note whose story or fact does not resolve; the rest render', () => {
    const broken = withNotes(sun, [note('cn-ok'), note('cn-bad', ['f1', 'f9'])]);
    const done = snapshot([
      { questId: questId('sun'), completedAt: at(1) },
      { questId: questId('tiger'), completedAt: at(1) },
    ]);
    // tiger is indexed but missing from `stories`.
    expect(foundNotes(shelfIndex([broken, tiger]), [broken], done).map((n) => n.note.id)).toEqual(['cn-ok']);
  });

  it('skips a note whose fact has no source', () => {
    const unsourced: Story = { ...sun, facts: sun.facts.map((f) => (f.id === 'f1' ? { ...f, sources: [] } : f)) };
    const done = snapshot([{ questId: questId('sun'), completedAt: at(1) }]);
    expect(foundNotes(shelfIndex([unsourced]), [unsourced], done).map((n) => n.note.id)).toEqual(['cn-sun-a']);
  });
});

describe('notesForStory / groupNotesByTheme', () => {
  const done = snapshot(STORIES.map((s) => ({ questId: questId(s.id.replace('story:', '')), completedAt: at(1) })));
  const notes = foundNotes(index, STORIES, done);

  it('notesForStory keeps one story', () => {
    expect(notesForStory(notes, 'story:sun').map((n) => n.note.id)).toEqual(['cn-sun-a', 'cn-sun-b']);
    expect(notesForStory(notes, 'story:none')).toEqual([]);
  });

  it('groups follow the five themes order, skipping empty themes, notes in story order', () => {
    expect(groupNotesByTheme(notes).map((g) => [g.theme, g.notes.map((n) => n.note.id)])).toEqual([
      ['letters', ['cn-sun-a', 'cn-sun-b']],
      ['rites', ['cn-seollal']],
      ['nature', ['cn-tiger']],
    ]);
    expect(groupNotesByTheme([])).toEqual([]);
  });
});
