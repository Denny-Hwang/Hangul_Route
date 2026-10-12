import type { Overlays } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { vocabCopyOf } from '../copy';
import {
  WALL_ART,
  WALL_MAX_COLUMNS,
  WALL_TILE_MIN,
  cardsTarget,
  createIntroMemory,
  topicPageAccess,
  localizedTopic,
  meterVariant,
  optionCountFor,
  topicActivities,
  topicGridColumns,
  topicOpenedEvent,
  topicTileView,
  wallArtSize,
  wallColumns,
  wallTileViews,
  wordsCollected,
  wordsOfTopic,
  type ActivityInput,
} from '../topic-view';
import { progress, state, topic, word } from './fixtures';

const m = getMessages('en');
const copy = vocabCopyOf(m);
const koreanItem = m.a11y.koreanItem;

const FOOD = topic('food', {
  titleEn: 'Food',
  titleKo: { ko: '음식', romanization: 'eumsik', en: 'food' },
  hoyaIntroEn: 'Hungry? Let us name some tasty things.',
  coverItemId: 'vocab:b',
});
const ITEMS = [
  word('a', { ko: '사과', romanization: 'sagwa', glosses: { en: 'apple', es: 'manzana' }, visual: 'word:food-apple' }),
  word('b', { ko: '우유', romanization: 'uyu', glosses: { en: 'milk' }, visual: 'word:food-milk' }),
  word('c', { ko: '밥', romanization: 'bap', glosses: { en: 'cooked rice' }, visual: 'card:rice', level: 2 }),
];
const OVERLAYS = {
  en: {},
  es: { 'vocab-topic:food': { title: 'Comida', hoyaIntro: 'Hola', blurb: 'Palabras' } },
  ko: {},
} as unknown as Overlays;

describe('localizedTopic (F-I18N-001 section 3.6)', () => {
  it('swaps the title and the Hoya line for the overlay of the UI language; the Korean never changes', () => {
    const es = localizedTopic(FOOD, 'es', OVERLAYS);
    expect(es.titleEn).toBe('Comida');
    expect(es.hoyaIntroEn).toBe('Hola');
    expect(es.titleKo).toEqual(FOOD.titleKo);
  });

  it('keeps English when there is no overlay entry or the locale is English', () => {
    expect(localizedTopic(FOOD, 'en', OVERLAYS)).toBe(FOOD);
    expect(localizedTopic(FOOD, 'ko', OVERLAYS)).toBe(FOOD);
  });
});

describe('topicGridColumns (section 3.3: 1 at 320, 2 at 360-767, 3 from 768)', () => {
  it.each([
    [320, 1],
    [359, 1],
    [360, 2],
    [393, 2],
    [767, 2],
    [768, 3],
    [1280, 3],
  ])('%i dp -> %i', (width, columns) => {
    expect(topicGridColumns(width)).toBe(columns);
  });

  it('an unknown width is one column', () => {
    expect(topicGridColumns(Number.NaN)).toBe(1);
    expect(topicGridColumns(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('topicTileView (section 3.3)', () => {
  const base = {
    topic: FOOD,
    items: ITEMS,
    progress: progress([state('a'), state('c'), state('zz')]),
    locale: 'en' as const,
    romanizationMode: 'always' as const,
    locked: false,
    copy,
  };

  it('names the topic and its count in words, never a fraction or a percent', () => {
    const v = topicTileView(base);
    expect(v).toMatchObject({
      key: 'food',
      title: 'Food',
      ko: '음식',
      romanization: 'eumsik',
      romanizationShown: true,
      tint: 'theme.life',
      total: 3,
      collected: 2,
      countLine: '2 collected',
      accessibilityLabel: 'Food. 2 words collected.',
      locked: false,
    });
    expect(`${v.countLine} ${v.accessibilityLabel}`).not.toMatch(/%|\d+\s*\/\s*\d+|\bof\b/);
  });

  it('says one word in the singular', () => {
    expect(topicTileView({ ...base, progress: progress([state('a')]) }).accessibilityLabel).toBe('Food. 1 word collected.');
  });

  it('the cover is the cover item, its gloss in the UI language', () => {
    expect(topicTileView(base).cover).toEqual({ pictureRef: 'word:food-milk', gloss: 'milk' });
    const apple = topicTileView({ ...base, topic: { ...FOOD, coverItemId: 'vocab:a' }, locale: 'es' }).cover;
    expect(apple).toEqual({ pictureRef: 'word:food-apple', gloss: 'manzana' });
  });

  it('falls back to the first word when the cover item is not in the list', () => {
    expect(topicTileView({ ...base, topic: { ...FOOD, coverItemId: 'vocab:zz' } }).cover.pictureRef).toBe('word:food-apple');
  });

  it('a topic with no words has an empty cover (the picture shows its text tile)', () => {
    expect(topicTileView({ ...base, items: [] }).cover).toEqual({ pictureRef: undefined, gloss: 'Food' });
  });

  it('hides the romanization in reading practice: the tile is one button, so there is no reveal on it', () => {
    expect(topicTileView({ ...base, romanizationMode: 'tap' }).romanizationShown).toBe(false);
  });

  it('carries the lock answer it was given', () => {
    expect(topicTileView({ ...base, locked: true }).locked).toBe(true);
  });

  it('a locked tile (gating on only) says "Not open yet" instead of the count, in its line and its name (F-ENT-003 OD-6)', () => {
    const v = topicTileView({ ...base, locked: true });
    expect(v.countLine).toBe('Not open yet');
    expect(v.accessibilityLabel).toBe('Food. Not open yet.');
    expect(`${v.countLine} ${v.accessibilityLabel}`).not.toMatch(/premium|lock|\$|\d/i);
  });
});

describe('wordsCollected (the Library Words count)', () => {
  const ANIMALS = topic('animals');
  const itemsOf = (key: string) =>
    key === 'food' ? ITEMS : [word('d'), word('a', { topics: ['animals', 'food'] })];

  it('counts each collected word once, also when it is filed under two topics', () => {
    expect(wordsCollected([FOOD, ANIMALS], itemsOf, progress([state('a'), state('d'), state('zz')]))).toBe(2);
  });

  it('is 0 with nothing collected or no topic', () => {
    expect(wordsCollected([FOOD], itemsOf, progress())).toBe(0);
    expect(wordsCollected([], itemsOf, progress([state('a')]))).toBe(0);
  });
});

describe('meterVariant (section 3.4: dots where they fit, else the bar)', () => {
  it('12 dots of 12 with 8 between need 232 dp', () => {
    expect(meterVariant(12, 232, 12, 8)).toBe('dots');
    expect(meterVariant(12, 231, 12, 8)).toBe('bar');
  });

  it('a long topic falls back to the bar; an empty topic draws the bar (no dot row of zero)', () => {
    expect(meterVariant(40, 288, 12, 8)).toBe('bar');
    expect(meterVariant(0, 288, 12, 8)).toBe('bar');
  });
});

describe('optionCountFor (F-VOC-004 section 3.2: 3 for Pictures first, else 4)', () => {
  it('reads only the level order', () => {
    expect(optionCountFor(0)).toBe(3);
    expect(optionCountFor(1)).toBe(4);
    expect(optionCountFor(2)).toBe(4);
    expect(optionCountFor(null)).toBe(4);
  });
});

describe('wallColumns (the word wall: as many 120 dp tiles as fit, 1 to 4)', () => {
  const GAP = 8;

  it('keeps the widest launch word whole: 2 on most phones, 3 from a 376 dp grid, 4 from 504', () => {
    expect(wallColumns(288, GAP)).toBe(2); // 320 dp window
    expect(wallColumns(328, GAP)).toBe(2); // 360
    expect(wallColumns(361, GAP)).toBe(2); // 393
    expect(wallColumns(375, GAP)).toBe(2);
    expect(wallColumns(376, GAP)).toBe(3);
    expect(wallColumns(503, GAP)).toBe(3);
    expect(wallColumns(504, GAP)).toBe(WALL_MAX_COLUMNS);
    expect(wallColumns(720, GAP)).toBe(4); // tablet reading width, capped
  });

  it('a column never goes below the minimum tile', () => {
    for (const width of [200, 288, 376, 400, 504, 700]) {
      const cols = wallColumns(width, GAP);
      if (cols > 1) expect((width - (cols - 1) * GAP) / cols).toBeGreaterThanOrEqual(WALL_TILE_MIN);
    }
  });

  it('drops columns at large text (the minimum grows with the font scale, up to 2x)', () => {
    expect(wallColumns(376, GAP, 1.5)).toBe(2);
    expect(wallColumns(288, GAP, 2)).toBe(1);
    expect(wallColumns(720, GAP, 2)).toBe(2);
    expect(wallColumns(720, GAP, 3)).toBe(2); // capped at 2x
    expect(wallColumns(376, GAP, 0.8)).toBe(3); // never below 1x
  });

  it('an unknown or empty width is one column', () => {
    expect(wallColumns(0, GAP)).toBe(1);
    expect(wallColumns(-5, GAP)).toBe(1);
    expect(wallColumns(Number.NaN, GAP)).toBe(1);
    expect(wallColumns(400, GAP, Number.NaN)).toBe(3);
  });
});

describe('wallArtSize (section 3.4: PictureArt at 64-96)', () => {
  it('fills the tile inside its chrome, between 64 and 96', () => {
    expect(wallArtSize(100, 12)).toBe(88);
    expect(wallArtSize(60, 12)).toBe(WALL_ART.min);
    expect(wallArtSize(200, 12)).toBe(WALL_ART.max);
    expect(wallArtSize(100.7, 12)).toBe(88);
  });
});

describe('wallTileViews (the word wall)', () => {
  const ctx = { locale: 'en' as const, romanizationMode: 'always' as const, copy, koreanItem };

  it('every word in the order given; collected words show their picture and Korean', () => {
    const tiles = wallTileViews(ITEMS, progress([state('b')]), ctx);
    expect(tiles.map((t) => [t.id, t.state])).toEqual([
      ['vocab:a', 'new'],
      ['vocab:b', 'collected'],
      ['vocab:c', 'new'],
    ]);
    expect(tiles[1]).toEqual({
      id: 'vocab:b',
      state: 'collected',
      ko: '우유',
      romanization: 'uyu',
      romanizationShown: true,
      pictureRef: 'word:food-milk',
      gloss: 'milk',
      accessibilityLabel: 'Korean: 우유, uyu, milk',
    });
  });

  it('a new word carries no Korean and no meaning (no spoilers), only its picture for the silhouette', () => {
    const [first] = wallTileViews(ITEMS, progress(), ctx);
    expect(first).toEqual({ id: 'vocab:a', state: 'new', pictureRef: 'word:food-apple', accessibilityLabel: 'Not collected yet' });
    expect(JSON.stringify(first)).not.toMatch(/사과|sagwa|"gloss"|"ko"/);
  });

  it('the gloss follows the UI language; reading practice hides the romanization (no reveal on the wall)', () => {
    const [apple] = wallTileViews(ITEMS, progress([state('a')]), { ...ctx, locale: 'es', romanizationMode: 'tap' });
    expect(apple).toMatchObject({ gloss: 'manzana', romanizationShown: false, accessibilityLabel: 'Korean: 사과, sagwa, manzana' });
  });

  it('in reading practice the page Show sound button reveals the wall romanization too', () => {
    const tap = { ...ctx, romanizationMode: 'tap' as const };
    const [apple] = wallTileViews(ITEMS, progress([state('a')]), { ...tap, revealed: true });
    expect(apple).toMatchObject({ romanizationShown: true });
    const [hidden] = wallTileViews(ITEMS, progress([state('a')]), { ...tap, revealed: false });
    expect(hidden).toMatchObject({ romanizationShown: false });
  });

  it('never re-sorts by progress', () => {
    const ids = (p: ReturnType<typeof progress>) => wallTileViews(ITEMS, p, ctx).map((t) => t.id);
    expect(ids(progress([state('c')]))).toEqual(ids(progress([state('a'), state('b')])));
  });
});

describe('wordsOfTopic (the words of a topic a learner may meet)', () => {
  it('keeps file order and includes a word filed under the topic as its second topic', () => {
    const visible = [word('x', { topics: ['animals'] }), ...ITEMS, word('y', { topics: ['animals', 'food'] })];
    expect(wordsOfTopic(visible, 'food').map((i) => i.id)).toEqual(['vocab:a', 'vocab:b', 'vocab:c', 'vocab:y']);
    expect(wordsOfTopic(visible, 'animals').map((i) => i.id)).toEqual(['vocab:x', 'vocab:y']);
  });

  it('only what it is given: a word left out of the visible list (its own topic a draft) never appears', () => {
    expect(wordsOfTopic(ITEMS.slice(1), 'food').map((i) => i.id)).toEqual(['vocab:b', 'vocab:c']);
    expect(wordsOfTopic([], 'food')).toEqual([]);
  });
});

describe('topicActivities (section 3.4, T7)', () => {
  const ALL_SCREENS = { learn: true, speed: true, match: true } as const;
  const base: ActivityInput = {
    collected: 0,
    suggestion: 'learn',
    optionCount: 4,
    picWordMatch: true,
    screens: ALL_SCREENS,
    copy,
  };
  const shape = (i: ActivityInput) => topicActivities(i).map((b) => [b.kind, b.primary, b.opens, b.line]);

  it('Learn, Speed round, Match in this order; the suggestion is the one primary button', () => {
    expect(shape({ ...base, collected: 5, suggestion: 'speed' })).toEqual([
      ['learn', false, 'learn', 'Meet a few words with pictures.'],
      ['speed', true, 'speed', 'Catch the words you know.'],
      ['match', false, 'match', 'Match each word to its picture.'],
    ]);
    expect(topicActivities({ ...base, collected: 5 }).map((b) => b.label)).toEqual(['Learn', 'Speed round', 'Match']);
  });

  it('below the option count the Speed round stays, says how many words are left to learn and opens Learn', () => {
    expect(shape({ ...base, collected: 1 })).toEqual([
      ['learn', true, 'learn', 'Meet a few words with pictures.'],
      ['speed', false, 'learn', 'Learn 3 words first'],
    ]);
    expect(shape({ ...base, collected: 2, optionCount: 3 })[1]).toEqual(['speed', false, 'learn', 'Learn 1 word first']);
    expect(shape({ ...base, collected: 3, optionCount: 3 })[1]).toEqual(['speed', false, 'speed', 'Catch the words you know.']);
  });

  it('Match appears only with the game in the build and 3 collected words (never as a dead button)', () => {
    expect(shape({ ...base, collected: 2 }).map((r) => r[0])).toEqual(['learn', 'speed']);
    expect(shape({ ...base, collected: 3 }).map((r) => r[0])).toEqual(['learn', 'speed', 'match']);
    expect(shape({ ...base, collected: 9, picWordMatch: false }).map((r) => r[0])).toEqual(['learn', 'speed']);
  });

  it('draws only the activities whose screen is in the build', () => {
    expect(topicActivities({ ...base, collected: 9, screens: { learn: false, speed: false, match: false } })).toEqual([]);
    expect(shape({ ...base, collected: 9, screens: { learn: true, speed: false, match: false } })).toEqual([
      ['learn', true, 'learn', 'Meet a few words with pictures.'],
    ]);
    // Without the flashcards a Speed round that would open Learn is not drawn either.
    expect(shape({ ...base, collected: 1, screens: { learn: false, speed: true, match: true } })).toEqual([]);
    expect(shape({ ...base, collected: 5, screens: { learn: false, speed: true, match: true } })).toEqual([
      ['speed', true, 'speed', 'Catch the words you know.'],
      ['match', false, 'match', 'Match each word to its picture.'],
    ]);
  });

  it('when the suggested activity is not drawn, the first drawn button is the primary one', () => {
    const buttons = topicActivities({ ...base, collected: 9, suggestion: 'speed', screens: { learn: true, speed: false, match: false } });
    expect(buttons.filter((b) => b.primary).map((b) => b.kind)).toEqual(['learn']);
  });

  it('exactly one primary button whenever any is drawn', () => {
    for (const suggestion of ['learn', 'speed', 'match'] as const) {
      for (const collected of [0, 3, 4, 12]) {
        const primaries = topicActivities({ ...base, collected, suggestion }).filter((b) => b.primary);
        expect(primaries).toHaveLength(1);
      }
    }
  });
});

describe('cardsTarget (a collected tile opens its card)', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => word(`w${i}`, { level: i < 6 ? 1 : 2 }));

  it('the chunk that holds the word at the learner chunk size, starting at that word', () => {
    expect(cardsTarget(FOOD, twelve, 1, 'vocab:w5')).toEqual({ topicKey: 'food', chunk: 1, startId: 'vocab:w5' });
    expect(cardsTarget(FOOD, twelve, 2, 'vocab:w5')).toEqual({ topicKey: 'food', chunk: 0, startId: 'vocab:w5' });
    expect(cardsTarget(FOOD, twelve, null, 'vocab:w11')).toEqual({ topicKey: 'food', chunk: 2, startId: 'vocab:w11' });
  });

  it('follows the chunk order of the topic (level order unless fixed)', () => {
    const mixed = [word('l2', { level: 2 }), ...Array.from({ length: 4 }, (_, i) => word(`l1-${i}`, { level: 1 }))];
    expect(cardsTarget(FOOD, mixed, 1, 'vocab:l2')?.chunk).toBe(0); // 5 words: the single tail joins chunk 0
    const fixed = { ...FOOD, fixedOrder: true };
    expect(cardsTarget(fixed, [...twelve].reverse(), 1, 'vocab:w11')?.chunk).toBe(0);
  });

  it('null for a word that is not in the topic', () => {
    expect(cardsTarget(FOOD, twelve, 1, 'vocab:nope')).toBeNull();
  });
});

describe('topicOpenedEvent (section 3.7)', () => {
  it('names the topic and where it was opened from, nothing else', () => {
    expect(topicOpenedEvent('food', 'library')).toEqual({ name: 'vocab.topic_opened', payload: { topicKey: 'food', source: 'library' } });
  });
});

describe('createIntroMemory (Hoya once per topic per learner per session)', () => {
  it('a topic is due until it is marked; other topics stay due', () => {
    const memory = createIntroMemory();
    expect(memory.due('p1', 'food')).toBe(true);
    memory.mark('p1', 'food');
    expect(memory.due('p1', 'food')).toBe(false);
    expect(memory.due('p1', 'animals')).toBe(true);
    memory.mark('p1', 'food');
    expect(memory.due('p1', 'food')).toBe(false);
  });

  it('each learner on a shared device hears the line once: two profiles on the same topic are both due', () => {
    const memory = createIntroMemory();
    memory.mark('p1', 'food');
    expect(memory.due('p1', 'food')).toBe(false);
    expect(memory.due('p2', 'food')).toBe(true);
    // A key that looks like another profile's plus a topic never collides.
    memory.mark('p', '1:food');
    expect(memory.due('p2', 'food')).toBe(true);
  });

  it('each memory is its own session', () => {
    const a = createIntroMemory();
    a.mark('p1', 'food');
    expect(createIntroMemory().due('p1', 'food')).toBe(true);
  });
});

describe('topicPageAccess (every entry point checks the lock, not only the grid)', () => {
  it('a topic the picker does not show is not found, whatever the lock says', () => {
    expect(topicPageAccess({ found: false, locked: false })).toBe('not-found');
    expect(topicPageAccess({ found: false, locked: true })).toBe('not-found');
  });

  it('a shown topic opens, or goes through the grown-up gate when it is locked (gating on only)', () => {
    expect(topicPageAccess({ found: true, locked: false })).toBe('open');
    expect(topicPageAccess({ found: true, locked: true })).toBe('locked');
  });
});

