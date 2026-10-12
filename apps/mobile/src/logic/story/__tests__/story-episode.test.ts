import type { HeritageCard } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { foundNotes } from '../culture-notes';
import { shelfCopy } from '../shelf-copy';
import {
  STORY_EPISODE_AUDIO_SOURCE,
  episodeRewardCards,
  episodeTitleKorean,
  episodeWordChip,
  episodeWordSpeech,
  storyEpisodeEntries,
  storyEpisodeView,
  type StoryEpisodeViewInput,
} from '../story-episode';
import type { StoryIndexEntry } from '../story-index';
import {
  bookEpisode,
  bookmarks,
  questId,
  shelfEpisode,
  shelfIndex,
  snapshot,
  story,
  storyQuest,
} from './shelf-fixture';

const COPY = shelfCopy(getMessages('en'));
const KOREAN_ITEM = getMessages('en').a11y.koreanItem;

const tiger = story('tiger', { theme: 'nature', shelf: { category: 'story-time', order: 1, minutes: 4 } });
const seollal = story('seollal', { theme: 'rites', shelf: { category: 'culture', order: 1, minutes: 5 } });
const sun = story('sun', { shelf: null });
const moon = story('moon', { shelf: null });

const BOOK = bookEpisode('episode:stage5-letters', [questId('sun', 'read-along'), questId('moon', 'read-along')]);
const index = shelfIndex([tiger, seollal, sun, moon], {
  episodes: [BOOK],
  quests: [storyQuest('sun', 'read-along'), storyQuest('moon', 'read-along')],
});
const TIGER_EPISODE = shelfEpisode(tiger);
const SEOLLAL_EPISODE = shelfEpisode(seollal);

function entriesOf(episodeId: string): StoryIndexEntry[] {
  return index.filter((e) => e.episodeId === episodeId);
}

function input(patch: Partial<StoryEpisodeViewInput> = {}): StoryEpisodeViewInput {
  return {
    episode: TIGER_EPISODE,
    entries: entriesOf(TIGER_EPISODE.id),
    snapshot: undefined,
    bookmarks: bookmarks({}),
    notes: [],
    copy: COPY,
    stageTitle: 'Story',
    themeTitle: 'Nature & Animals',
    ...patch,
  };
}

const at = '2026-10-10T10:00:00.000Z';

describe('storyEpisodeEntries', () => {
  it('a shelf story episode resolves to its one entry', () => {
    const entries = storyEpisodeEntries(TIGER_EPISODE, index);
    expect(entries?.map((e) => e.questId)).toEqual([questId('tiger')]);
  });

  it('a book episode resolves to one entry per quest, in the episode quest order', () => {
    const reversed = { ...BOOK, questIds: [...BOOK.questIds].reverse() };
    expect(storyEpisodeEntries(reversed, index)?.map((e) => e.questId)).toEqual([
      questId('moon', 'read-along'),
      questId('sun', 'read-along'),
    ]);
  });

  it('a lesson (non-story) episode is not a story page', () => {
    expect(storyEpisodeEntries({ ...TIGER_EPISODE, format: 'lesson' }, index)).toBeNull();
    const { format: _omit, ...noFormat } = TIGER_EPISODE;
    expect(storyEpisodeEntries(noFormat, index)).toBeNull();
  });

  it('a preview episode keeps the coming-soon card (not a story page)', () => {
    expect(storyEpisodeEntries({ ...TIGER_EPISODE, status: 'preview' }, index)).toBeNull();
  });

  it('stories missing from the bundle (or the index): the existing quest list', () => {
    expect(storyEpisodeEntries({ ...TIGER_EPISODE, questIds: ['quest:story-gone-listen'] }, index)).toBeNull();
    expect(storyEpisodeEntries({ ...BOOK, questIds: [...BOOK.questIds, 'quest:story-gone-read'] }, index)).toBeNull();
    expect(storyEpisodeEntries({ ...TIGER_EPISODE, questIds: [] }, index)).toBeNull();
  });

  it('ignores an entry of the same quest that belongs to another episode', () => {
    expect(storyEpisodeEntries({ ...TIGER_EPISODE, id: 'episode:elsewhere' }, index)).toBeNull();
  });
});

describe('storyEpisodeView: header and title', () => {
  it('a shelf episode: category, theme and minutes pills; the story title with Korean and romanization', () => {
    const v = storyEpisodeView(input());
    expect(v.placement).toBe('shelf');
    expect(v.pills).toEqual(['Story Time', 'Nature & Animals', '4 min']);
    expect(v.title).toEqual({ en: tiger.title.en, ko: tiger.title.ko, romanization: tiger.title.romanization });
    expect(v.storyId).toBe('story:tiger');
  });

  it('a Culture shelf episode says "Culture" and never shows a stage pill', () => {
    const v = storyEpisodeView(input({ episode: SEOLLAL_EPISODE, entries: entriesOf(SEOLLAL_EPISODE.id), themeTitle: 'Holidays & Traditions' }));
    expect(v.pills).toEqual(['Culture', 'Holidays & Traditions', '5 min']);
    expect(v.pills).not.toContain('Story');
  });

  it('a book episode: the stage title, the theme and the minutes of all its stories; the episode title, no Korean line', () => {
    const v = storyEpisodeView(input({ episode: BOOK, entries: entriesOf(BOOK.id), stageTitle: 'Story', themeTitle: 'Letters & Books' }));
    expect(v.placement).toBe('book');
    const minutes = entriesOf(BOOK.id).reduce((sum, e) => sum + e.minutes, 0);
    expect(v.pills).toEqual(['Story', 'Letters & Books', `${minutes} min`]);
    expect(v.title).toEqual({ en: BOOK.titleEn, ko: null, romanization: null });
    expect(v.storyId).toBeNull();
    expect(v.rows).toHaveLength(2);
  });

  it('takes the title from the localised story it is given', () => {
    const [entry] = entriesOf(TIGER_EPISODE.id);
    if (!entry) throw new Error('fixture');
    const localised = { ...entry, story: { ...entry.story, title: { ...entry.story.title, en: 'El tigre' } } };
    const v = storyEpisodeView(input({ entries: [localised] }));
    expect(v.title.en).toBe('El tigre');
    expect(v.rows[0]?.titleEn).toBe('El tigre');
    expect(v.title.ko).toBe(tiger.title.ko);
  });
});

describe('storyEpisodeView: tale rows', () => {
  it('a new story: "New" and one large Start (the page primary)', () => {
    const [row] = storyEpisodeView(input()).rows;
    expect(row).toMatchObject({ stateLine: 'New', stars: 0, titleEn: tiger.title.en, ko: tiger.title.ko, theme: 'nature' });
    expect(row?.actions).toEqual([
      { mode: 'start', label: 'Start', tone: 'primary', size: 'hero', accessibilityLabel: `Start: ${tiger.title.en}` },
    ]);
  });

  it('in progress: a large Keep reading and a ghost Start over', () => {
    const [row] = storyEpisodeView(input({ bookmarks: bookmarks({ 'story:tiger': {} }) })).rows;
    expect(row?.stateLine).toBe('Keep reading');
    expect(row?.actions.map((a) => [a.mode, a.label, a.tone, a.size])).toEqual([
      ['continue', 'Keep reading', 'primary', 'hero'],
      ['restart', 'Start over', 'ghost', 'md'],
    ]);
  });

  it('a bookmark for another level does not make it in progress', () => {
    const [row] = storyEpisodeView(input({ bookmarks: bookmarks({ 'story:tiger': { level: 'read' } }) })).rows;
    expect(row?.stateLine).toBe('New');
  });

  it('finished: stars, a secondary Play again and a ghost Read it again; nothing is large', () => {
    const done = snapshot([{ questId: questId('tiger'), completedAt: at, stars: 2 }]);
    const [row] = storyEpisodeView(input({ snapshot: done })).rows;
    expect(row).toMatchObject({ stateLine: 'Finished', stars: 2 });
    expect(row?.actions.map((a) => [a.mode, a.label, a.tone, a.size])).toEqual([
      ['play-again', 'Play again', 'secondary', 'md'],
      ['read-again', 'Read it again', 'ghost', 'md'],
    ]);
  });

  it('a 0-star finish draws no stars (D3)', () => {
    const done = snapshot([{ questId: questId('tiger'), completedAt: at, stars: 0 }]);
    expect(storyEpisodeView(input({ snapshot: done })).rows[0]?.stars).toBe(0);
  });

  it('a quest started but not finished (no completedAt, no bookmark) is still New', () => {
    const started = snapshot([{ questId: questId('tiger'), stars: 0 }]);
    expect(storyEpisodeView(input({ snapshot: started })).rows[0]?.stateLine).toBe('New');
  });

  it('a book: only the first new or in-progress row is large; the others are secondary', () => {
    const done = snapshot([{ questId: questId('sun', 'read-along'), completedAt: at, stars: 3 }]);
    const view = storyEpisodeView(input({ episode: BOOK, entries: entriesOf(BOOK.id), snapshot: done }));
    const sizes = view.rows.map((r) => r.actions.map((a) => `${a.mode}:${a.tone}:${a.size}`));
    expect(sizes).toEqual([
      ['play-again:secondary:md', 'read-again:ghost:md'],
      ['start:primary:hero'],
    ]);
  });

  it('a book with two new stories: the second Start is secondary', () => {
    const view = storyEpisodeView(input({ episode: BOOK, entries: entriesOf(BOOK.id) }));
    expect(view.rows.map((r) => r.actions[0]?.tone)).toEqual(['primary', 'secondary']);
    expect(view.rows.map((r) => r.actions[0]?.size)).toEqual(['hero', 'md']);
  });

  it('a book with an in-progress story after a new one: the new one is the primary; Keep reading is secondary', () => {
    const marks = bookmarks({ 'story:moon': { level: 'read-along' } });
    const view = storyEpisodeView(input({ episode: BOOK, entries: entriesOf(BOOK.id), bookmarks: marks }));
    expect(view.rows[1]?.actions.map((a) => `${a.mode}:${a.tone}:${a.size}`)).toEqual(['continue:secondary:md', 'restart:ghost:md']);
  });

  it('progress unreadable (no snapshot): every row renders as New', () => {
    const view = storyEpisodeView(input({ episode: BOOK, entries: entriesOf(BOOK.id), snapshot: undefined }));
    expect(view.rows.map((r) => r.stateLine)).toEqual(['New', 'New']);
  });

  it('a row carries the cover art of the story cover scene, or null', () => {
    const [entry] = entriesOf(TIGER_EPISODE.id);
    if (!entry) throw new Error('fixture');
    const noArt = {
      ...entry,
      story: { ...entry.story, tiers: entry.story.tiers.map((t) => ({ ...t, scenes: t.scenes.map((s) => ({ ...s, art: undefined })) })) },
    };
    expect(storyEpisodeView(input({ entries: [noArt] })).rows[0]?.cover).toBeNull();
    const view = storyEpisodeView(input());
    const cover = entry.story.tiers.flatMap((t) => t.scenes).find((s) => s.id === entry.story.coverSceneId)?.art ?? null;
    expect(view.rows[0]?.cover).toEqual(cover);
  });
});

describe('storyEpisodeView: words and culture notes', () => {
  it('a single-story page lists the recap words of its level (listen: the new keywords)', () => {
    const v = storyEpisodeView(input());
    expect(v.words.map((w) => w.id)).toEqual(['sejong', 'hangeul', 'hangeullal', 'jamo-g']);
  });

  it('a book lists no words and no notes line', () => {
    const v = storyEpisodeView(input({ episode: BOOK, entries: entriesOf(BOOK.id) }));
    expect(v.words).toEqual([]);
    expect(v.notesLine).toBeNull();
  });

  it('no culture notes found: no line', () => {
    expect(storyEpisodeView(input()).notesLine).toBeNull();
  });

  it('found notes of this story: "Culture notes: N found" (a count, never a fraction)', () => {
    const done = snapshot([{ questId: questId('tiger'), completedAt: at }]);
    const notes = foundNotes(index, [tiger, seollal, sun, moon], done);
    expect(notes.length).toBeGreaterThan(0);
    const v = storyEpisodeView(input({ snapshot: done, notes }));
    expect(v.notesLine).toBe(`Culture notes: ${notes.length} found`);
  });

  it('notes of another story are not counted', () => {
    const done = snapshot([{ questId: questId('seollal'), completedAt: at }]);
    const notes = foundNotes(index, [tiger, seollal, sun, moon], done);
    expect(notes.length).toBeGreaterThan(0);
    expect(storyEpisodeView(input({ notes })).notesLine).toBeNull();
  });
});

describe('episodeWordChip / episodeWordSpeech', () => {
  const [word] = storyEpisodeView(input()).words;
  if (!word) throw new Error('fixture: no word');

  it('shows Korean, romanization and gloss, with a speaker label and the shared Korean item label', () => {
    const chip = episodeWordChip(word, { romanizationMode: 'always', revealed: new Set() }, COPY, KOREAN_ITEM);
    expect(chip).toEqual({
      id: word.id,
      ko: word.ko,
      romanization: word.romanization,
      gloss: word.en,
      hearLabel: `Hear ${word.romanization}`,
      accessibilityLabel: KOREAN_ITEM({ ko: word.ko, romanization: word.romanization, gloss: word.en }),
    });
  });

  it('hide-until-tap (D2) hides the romanization until the word was heard; the label always says it', () => {
    const hidden = episodeWordChip(word, { romanizationMode: 'tap', revealed: new Set() }, COPY, KOREAN_ITEM);
    expect(hidden.romanization).toBe('');
    expect(hidden.accessibilityLabel).toContain(word.romanization);
    const shown = episodeWordChip(word, { romanizationMode: 'tap', revealed: new Set([word.id]) }, COPY, KOREAN_ITEM);
    expect(shown.romanization).toBe(word.romanization);
  });

  it('plays the clip when the word has one, else Korean speech of its spoken form', () => {
    expect(episodeWordSpeech({ ...word, spokenKo: undefined, audioRef: undefined })).toEqual({
      text: word.ko,
      language: 'ko-KR',
      kind: 'word',
      source: STORY_EPISODE_AUDIO_SOURCE,
    });
    expect(episodeWordSpeech({ ...word, spokenKo: '세종대왕', audioRef: 'audio/words/sejong.mp3' })).toEqual({
      text: '세종대왕',
      language: 'ko-KR',
      kind: 'word',
      source: STORY_EPISODE_AUDIO_SOURCE,
      audioRef: 'audio/words/sejong.mp3',
    });
  });
});

describe('episodeTitleKorean', () => {
  it('always mode shows the romanization and adds no tap (the reviewed look)', () => {
    const t = episodeTitleKorean('sun-and-moon', '해와 달', { romanizationMode: 'always', revealed: new Set() });
    expect(t).toEqual({
      key: 'title:sun-and-moon',
      romanizationShown: true,
      tappable: false,
      speech: { text: '해와 달', language: 'ko-KR', kind: 'sentence', source: STORY_EPISODE_AUDIO_SOURCE },
    });
  });

  it('hide-until-tap (D2): hidden until tapped, and the tap stays so the title can be heard again', () => {
    const hidden = episodeTitleKorean('sun-and-moon', '해와 달', { romanizationMode: 'tap', revealed: new Set() });
    expect(hidden.romanizationShown).toBe(false);
    expect(hidden.tappable).toBe(true);
    const shown = episodeTitleKorean('sun-and-moon', '해와 달', { romanizationMode: 'tap', revealed: new Set([hidden.key]) });
    expect(shown.romanizationShown).toBe(true);
    expect(shown.tappable).toBe(true);
  });

  it('a title key never collides with a word id in the shared revealed set', () => {
    const t = episodeTitleKorean('sun', '해', { romanizationMode: 'tap', revealed: new Set(['sun']) });
    expect(t.romanizationShown).toBe(false);
  });
});

describe('episodeRewardCards', () => {
  const card = (id: string, rarity: HeritageCard['rarity']): HeritageCard => ({
    id,
    titleEn: `Card ${id}`,
    subtitleKo: '한지',
    romanization: 'hanji',
    blurbEn: 'A card.',
    theme: 'letters',
    stage: 'stage1',
    rarity,
    unlockedBy: 'quest:x',
  });
  const CARDS = new Map([
    ['card:hanji', card('card:hanji', 'rare')],
    ['card:book', card('card:book', 'common')],
  ]);
  const lookup = (id: string): HeritageCard | undefined => CARDS.get(id);

  it('earned cards carry the card; not earned give only the rarity (no title, no art: no spoilers)', () => {
    const out = episodeRewardCards(['card:hanji', 'card:book'], new Set(['card:book']), lookup);
    expect(out).toEqual([
      { cardId: 'card:hanji', earned: false, rarity: 'rare' },
      { cardId: 'card:book', earned: true, card: CARDS.get('card:book') },
    ]);
  });

  it('skips a card id the bundle does not have', () => {
    expect(episodeRewardCards(['card:gone', 'card:hanji'], new Set(), lookup)).toEqual([
      { cardId: 'card:hanji', earned: false, rarity: 'rare' },
    ]);
  });
});

describe('story episode copy', () => {
  it('has no banned learner words', () => {
    const lines = [
      COPY.episode.minutes.pill(4),
      COPY.episode.wordsTitle,
      COPY.episode.hearWord('hangeul'),
      COPY.episode.cultureNotes(2),
      COPY.episode.sources.cta,
      COPY.episode.rowLabel('Start', 'Hangul Day'),
    ];
    expect(scanLearnerCopy(lines)).toEqual([]);
  });
});
