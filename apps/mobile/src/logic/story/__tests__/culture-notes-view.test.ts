import type { CultureNote, Story } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { foundNotes, type FoundNote } from '../culture-notes';
import {
  CULTURE_NOTES_AUDIO_SOURCE,
  cultureNotesCard,
  cultureNotesScreenView,
  noteCardArtId,
  noteTermChip,
  noteTermSpeech,
  noteViewedPayload,
} from '../culture-notes-view';
import { shelfCopy } from '../shelf-copy';
import { questId, shelfIndex, snapshot, story } from './shelf-fixture';

const COPY = shelfCopy(getMessages('en'));
const KOREAN_ITEM = getMessages('en').a11y.koreanItem;

function note(id: string, patch: Partial<CultureNote> = {}): CultureNote {
  return {
    id,
    titleEn: `Note ${id}`,
    bodyEn: 'A short sourced fact.',
    term: { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' },
    factIds: ['f3'],
    ...patch,
  };
}

const withNotes = (s: Story, notes: CultureNote[]): Story => ({ ...s, cultureNotes: notes });
const tiger = withNotes(story('tiger', { theme: 'nature', shelf: { category: 'story-time', order: 1 } }), [note('cn-tiger')]);
const sun = withNotes(story('sun', { theme: 'letters', shelf: { category: 'story-time', order: 2 } }), [
  note('cn-sun-a'),
  note('cn-sun-b', { cardId: 'card:hanji' }),
]);
const seollal = withNotes(story('seollal', { theme: 'rites', shelf: { category: 'culture', order: 1 } }), [note('cn-seollal')]);
const STORIES = [tiger, sun, seollal];
const index = shelfIndex(STORIES);
const at = (day: number): string => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;

// tiger finished on day 3, sun on day 1, seollal on day 2.
const ALL = foundNotes(
  index,
  STORIES,
  snapshot([
    { questId: questId('tiger'), completedAt: at(3) },
    { questId: questId('sun'), completedAt: at(1) },
    { questId: questId('seollal'), completedAt: at(2) },
  ]),
);

function only(id: string): FoundNote {
  const n = ALL.find((x) => x.note.id === id);
  if (!n) throw new Error(`fixture: ${id}`);
  return n;
}

describe('cultureNotesCard (the Library Culture section card)', () => {
  it('no note found: no count, the empty line, and a label that says both', () => {
    const card = cultureNotesCard([], COPY);
    expect(card).toEqual({
      count: 0,
      foundLine: null,
      newest: [],
      emptyLine: 'Finish a story to find your first culture note.',
      accessibilityLabel: 'Culture notes. Finish a story to find your first culture note.',
    });
  });

  it('"N found" (a count, never a fraction) and the titles of the two newest notes', () => {
    const card = cultureNotesCard(ALL, COPY);
    expect(card.count).toBe(4);
    expect(card.foundLine).toBe('4 found');
    expect(card.emptyLine).toBeNull();
    // tiger (day 3) is newest, then seollal (day 2); sun (day 1) is older.
    expect(card.newest).toEqual(['Note cn-tiger', 'Note cn-seollal']);
    expect(card.accessibilityLabel).toBe('Culture notes. 4 found. Note cn-tiger, Note cn-seollal.');
  });

  it('notes found on the same day keep their list (story) order', () => {
    const sameDay = ALL.map((n) => ({ ...n, foundAt: at(5) }));
    expect(cultureNotesCard(sameDay, COPY).newest).toEqual(['Note cn-tiger', 'Note cn-sun-a']);
  });

  it('one note: one title', () => {
    const card = cultureNotesCard([only('cn-seollal')], COPY);
    expect(card.newest).toEqual(['Note cn-seollal']);
    expect(card.foundLine).toBe('1 found');
  });
});

describe('cultureNotesScreenView', () => {
  it('groups every found note under the five theme headings, in theme order', () => {
    const v = cultureNotesScreenView({ notes: ALL });
    expect(v.groups.map((g) => g.theme)).toEqual(['letters', 'rites', 'nature']);
    expect(v.groups[0]?.notes.map((n) => n.note.id)).toEqual(['cn-sun-a', 'cn-sun-b']);
    expect(v.count).toBe(4);
    expect(v.targetNoteId).toBeNull();
  });

  it('with storyId: only that story’s notes', () => {
    const v = cultureNotesScreenView({ notes: ALL, storyId: 'story:sun' });
    expect(v.groups.flatMap((g) => g.notes.map((n) => n.note.id))).toEqual(['cn-sun-a', 'cn-sun-b']);
    expect(v.count).toBe(2);
  });

  it('with noteId: that note is the target (scrolled to, sources open)', () => {
    expect(cultureNotesScreenView({ notes: ALL, noteId: 'cn-seollal' }).targetNoteId).toBe('cn-seollal');
  });

  it('an unknown noteId, or one outside the story filter, opens the list at the top', () => {
    expect(cultureNotesScreenView({ notes: ALL, noteId: 'cn-gone' }).targetNoteId).toBeNull();
    expect(cultureNotesScreenView({ notes: ALL, storyId: 'story:sun', noteId: 'cn-tiger' }).targetNoteId).toBeNull();
  });

  it('nothing found: no groups (the empty card shows)', () => {
    expect(cultureNotesScreenView({ notes: [] })).toEqual({ groups: [], count: 0, targetNoteId: null });
  });
});

describe('note helpers', () => {
  it('culture.note.viewed carries ids only', () => {
    expect(noteViewedPayload(only('cn-tiger'))).toEqual({ noteId: 'cn-tiger', storyId: 'story:tiger' });
  });

  it('the term speaker plays the clip when there is one, else Korean speech of its spoken form', () => {
    expect(noteTermSpeech(only('cn-tiger'))).toEqual({
      text: '한글날',
      language: 'ko-KR',
      kind: 'word',
      source: CULTURE_NOTES_AUDIO_SOURCE,
    });
    const withClip = { ...only('cn-tiger'), note: note('x', { term: { ko: '설날', romanization: 'seollal', en: 'New Year', spokenKo: '설랄', audioRef: 'audio/words/seollal.mp3' } }) };
    expect(noteTermSpeech(withClip)).toEqual({
      text: '설랄',
      language: 'ko-KR',
      kind: 'word',
      source: CULTURE_NOTES_AUDIO_SOURCE,
      audioRef: 'audio/words/seollal.mp3',
    });
  });

  it('the term chip: Korean, romanization (D2: hidden until heard), gloss, speaker label', () => {
    const n = only('cn-tiger');
    expect(noteTermChip(n, { romanizationMode: 'always', revealed: new Set() }, COPY, KOREAN_ITEM)).toEqual({
      ko: '한글날',
      romanization: 'hangeullal',
      gloss: 'Hangul Day',
      hearLabel: 'Hear hangeullal',
      accessibilityLabel: KOREAN_ITEM({ ko: '한글날', romanization: 'hangeullal', gloss: 'Hangul Day' }),
    });
    expect(noteTermChip(n, { romanizationMode: 'tap', revealed: new Set() }, COPY, KOREAN_ITEM).romanization).toBe('');
    expect(noteTermChip(n, { romanizationMode: 'tap', revealed: new Set(['cn-tiger']) }, COPY, KOREAN_ITEM).romanization).toBe('hangeullal');
  });

  it('card art only for a card the bundle has and can draw', () => {
    const drawn = (id: string): boolean => id === 'card:hanji';
    expect(noteCardArtId(only('cn-sun-b'), drawn)).toBe('card:hanji');
    expect(noteCardArtId(only('cn-sun-a'), drawn)).toBeNull();
    expect(noteCardArtId(only('cn-sun-b'), () => false)).toBeNull();
  });
});

describe('culture notes copy', () => {
  it('has no banned learner words', () => {
    const c = COPY.cultureNotes;
    expect(
      scanLearnerCopy([
        c.title,
        c.found.pill(3),
        c.fromStory('Hangul Day'),
        c.whereFrom,
        c.source('Hangul Day', 'NIKL'),
        c.hearTerm('hangeullal'),
        c.empty.line,
        c.empty.toStoryTime.cta,
        c.cardLabel(3, 'A', 'B'),
        c.cardLabel(1, 'A'),
        c.cardLabel(2),
        c.cardLabel(0),
      ]),
    ).toEqual([]);
  });
});
