import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { shelfCopy } from '../shelf-copy';
import type { StoryStatus } from '../story-status';
import { heroAction, shelfViewedPayload, storyTileColumns, storyTileView } from '../story-tile';
import { bookmarks, shelfIndex, story } from './shelf-fixture';

const COPY = shelfCopy(getMessages('en'));
const tiger = story('tiger', { shelf: { category: 'story-time', order: 1, minutes: 4 } });
const [entry] = shelfIndex([tiger]);
if (!entry) throw new Error('fixture: no entry');

const NEW: StoryStatus = { state: 'new', stars: 0 };
const READING: StoryStatus = { state: 'in-progress', stars: 0, bookmark: bookmarks({ 'story:tiger': {} }).byStory['story:tiger'] };
const done = (stars: 0 | 1 | 2 | 3): StoryStatus => ({ state: 'finished', stars });

describe('storyTileView', () => {
  it('a new story: titles, Korean with romanization, minutes, "New", one label', () => {
    const v = storyTileView({ entry, status: NEW, locked: false, copy: COPY });
    expect(v).toMatchObject({
      storyId: 'story:tiger',
      episodeId: 'episode:shelf-tiger',
      titleEn: tiger.title.en,
      ko: tiger.title.ko,
      romanization: tiger.title.romanization,
      theme: tiger.theme,
      state: 'new',
      stateLine: 'New',
      stars: 0,
      minutesLine: 'about 4 min',
      locked: false,
    });
    expect(v.accessibilityLabel).toBe(`${tiger.title.en}. New. About 4 minutes.`);
  });

  it('takes the title from the story it is given (the screen passes the localised story)', () => {
    const localised = { ...entry, story: { ...entry.story, title: { ...entry.story.title, en: 'Día del Hangul' } } };
    const v = storyTileView({ entry: localised, status: NEW, locked: false, copy: COPY });
    expect(v.titleEn).toBe('Día del Hangul');
    expect(v.ko).toBe(tiger.title.ko);
    expect(v.accessibilityLabel.startsWith('Día del Hangul. New.')).toBe(true);
  });

  it('a bookmarked story says "Keep reading"', () => {
    const v = storyTileView({ entry, status: READING, locked: false, copy: COPY });
    expect(v.state).toBe('in-progress');
    expect(v.stateLine).toBe('Keep reading');
    expect(v.stars).toBe(0);
    expect(v.accessibilityLabel).toBe(`${tiger.title.en}. Keep reading. About 4 minutes.`);
  });

  it('a finished story shows its stars and reads them out', () => {
    const v = storyTileView({ entry, status: done(2), locked: false, copy: COPY });
    expect(v.state).toBe('finished');
    expect(v.stateLine).toBe('Finished');
    expect(v.stars).toBe(2);
    expect(v.accessibilityLabel).toBe(`${tiger.title.en}. Finished. About 4 minutes. 2 stars.`);
  });

  it('a 0-star finish draws no stars and says nothing about stars (D3)', () => {
    const v = storyTileView({ entry, status: done(0), locked: false, copy: COPY });
    expect(v.stars).toBe(0);
    expect(v.accessibilityLabel).toBe(`${tiger.title.en}. Finished. About 4 minutes.`);
  });

  it('a locked tile says "Locked" whatever the progress, with no stars', () => {
    for (const status of [NEW, READING, done(3)]) {
      const v = storyTileView({ entry, status, locked: true, copy: COPY });
      expect(v.state).toBe('locked');
      expect(v.stateLine).toBe('Locked');
      expect(v.stars).toBe(0);
      expect(v.locked).toBe(true);
      expect(v.accessibilityLabel).toBe(`${tiger.title.en}. Locked. About 4 minutes.`);
    }
  });

  it('one minute is singular', () => {
    const v = storyTileView({ entry: { ...entry, minutes: 1 }, status: NEW, locked: false, copy: COPY });
    expect(v.accessibilityLabel).toBe(`${tiger.title.en}. New. About 1 minute.`);
    expect(v.minutesLine).toBe('about 1 min');
  });

  it('cover: the art of the cover scene, from whichever tier holds it', () => {
    const v = storyTileView({ entry, status: NEW, locked: false, copy: COPY });
    const scene = tiger.tiers.flatMap((t) => t.scenes).find((s) => s.id === tiger.coverSceneId);
    expect(scene?.art).toBeDefined();
    expect(v.cover).toEqual(scene?.art);
  });

  it('cover: a cover scene only in a later tier still resolves', () => {
    const [first, second] = tiger.tiers;
    if (!first || !second) throw new Error('fixture: two tiers expected');
    const onlyLater = {
      ...tiger,
      coverSceneId: 's9',
      tiers: [first, { ...second, scenes: [...second.scenes, { ...second.scenes[0]!, id: 's9' }] }],
    };
    const v = storyTileView({ entry: { ...entry, story: onlyLater }, status: NEW, locked: false, copy: COPY });
    expect(v.cover).toEqual(second.scenes[0]?.art);
  });

  it('cover: null when the cover scene has no art yet, or no tier holds it (the tile shows the tint)', () => {
    const noArt = {
      ...tiger,
      tiers: tiger.tiers.map((t) => ({
        ...t,
        scenes: t.scenes.map((s) => (s.id === tiger.coverSceneId ? { ...s, art: undefined, artPending: true } : s)),
      })),
    };
    expect(storyTileView({ entry: { ...entry, story: noArt }, status: NEW, locked: false, copy: COPY }).cover).toBeNull();
    const missing = { ...tiger, coverSceneId: 's99' };
    expect(storyTileView({ entry: { ...entry, story: missing }, status: NEW, locked: false, copy: COPY }).cover).toBeNull();
  });

  it('every state line and label passes the banned-word scan and never says Premium', () => {
    const lines = [NEW, READING, done(0), done(3)].flatMap((status) =>
      [false, true].flatMap((locked) => {
        const v = storyTileView({ entry, status, locked, copy: COPY });
        return [v.stateLine, v.accessibilityLabel, v.minutesLine];
      }),
    );
    expect(scanLearnerCopy(lines)).toEqual([]);
    for (const l of lines) expect(l).not.toMatch(/premium/i);
  });
});

describe('heroAction', () => {
  it('Start for a new story, Keep reading with a bookmark, Read it again once finished', () => {
    expect(heroAction(NEW, COPY)).toEqual({ mode: 'start', label: 'Start' });
    expect(heroAction(READING, COPY)).toEqual({ mode: 'continue', label: 'Keep reading' });
    expect(heroAction(done(3), COPY)).toEqual({ mode: 'read-again', label: 'Read it again' });
  });
});

describe('storyTileColumns (§3.4: 1 at 320 dp, 2 at 360-767, 3-4 from 768)', () => {
  it.each([
    [0, 1],
    [320, 1],
    [359, 1],
    [360, 2],
    [375, 2],
    [767, 2],
    [768, 3],
    [1023, 3],
    [1024, 4],
    [1440, 4],
  ])('%i dp -> %i columns', (width, columns) => {
    expect(storyTileColumns(width)).toBe(columns);
  });

  it('an unknown width (NaN, Infinity, negative) is one column', () => {
    expect(storyTileColumns(Number.NaN)).toBe(1);
    expect(storyTileColumns(Number.POSITIVE_INFINITY)).toBe(1);
    expect(storyTileColumns(-5)).toBe(1);
  });
});

describe('shelfViewedPayload (story.shelf.viewed, §3.11)', () => {
  it('counts the stories, the started (bookmarked) and the finished ones', () => {
    expect(shelfViewedPayload('story-time', [NEW, READING, READING, done(0), done(3)])).toEqual({
      section: 'story-time',
      stories: 5,
      started: 2,
      finished: 2,
    });
  });

  it('an empty shelf is all zeros; ids and counts only', () => {
    const p = shelfViewedPayload('culture', []);
    expect(p).toEqual({ section: 'culture', stories: 0, started: 0, finished: 0 });
    expect(Object.keys(p).sort()).toEqual(['finished', 'section', 'started', 'stories']);
  });
});
