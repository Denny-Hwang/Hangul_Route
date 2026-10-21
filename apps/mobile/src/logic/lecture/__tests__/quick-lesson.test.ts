import { CATALOG, LECTURE_TITLE_RE, LectureDeckSchema, chooserGroups, storyIsReady, type ChooserEpisodeRow, type ChooserGroup, type ChooserRow } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  QUICK_MAX_BLOCKS,
  buildQuickDeck,
  choiceMinutes,
  chooserFull,
  chooserTray,
  deckIdFrom,
  lessonLocked,
  pressLesson,
  pressRow,
  quickDeckTitle,
  removeChoice,
  rowCheck,
} from '../quick-lesson';
import { titleIn } from '../quick-source';

/**
 * Customize on the presenter home (AMENDMENTS-LECTURE-V2 sections 4.6 and 18.3, row LV-3): the
 * presenter's presses over content-schema's grouped chooser model, the 30-block room, the tray and
 * its minutes, and the deck Build lesson makes.
 */

const consonants = Array.from({ length: 14 }, (_, i) => `jamo:c${i}`);
const vowels = Array.from({ length: 10 }, (_, i) => `jamo:v${i}`);

const groups: ChooserGroup[] = chooserGroups({
  catalog: CATALOG,
  title: (id) => CATALOG.cells.find((c) => c.episodeId === id)?.title ?? CATALOG.quests.find((q) => q.id === id)?.title ?? CATALOG.stories.find((s) => s.id === id)?.title ?? id,
  letters: { consonants, vowels, titles: { consonants: 'Consonants', vowels: 'Vowels' } },
  stories: CATALOG.stories.filter(storyIsReady).map((s) => s.id),
  topics: CATALOG.topics.map((t) => `vocab-topic:${t.key}`),
});

const rowOf = (key: string): ChooserRow => groups.flatMap((g) => g.rows).find((r) => r.key === key)!;
const episode = (key: string): ChooserEpisodeRow => rowOf(key) as ChooserEpisodeRow;
const letters = episode('episode:stage1-letters');
const wordBuilder = episode('episode:stage2-letters');

describe('the tri-state episode (section 18.3)', () => {
  it('checking an episode chooses it whole as one block and locks its lessons', () => {
    const chosen = pressRow([], letters, groups)!;
    expect(chosen).toEqual(['episode:stage1-letters']);
    expect(rowCheck(chosen, letters)).toBe('true');
    expect(lessonLocked(chosen, letters)).toBe(true);
    for (const lesson of letters.lessons) expect(pressLesson(chosen, letters, lesson.key, groups)).toBeNull();
    expect(buildQuickDeck(chosen, groups, { now: new Date(), rng: () => 0.2, fallbackTitle: 'Your lesson' })!.blocks).toEqual([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    // Unchecking it clears it.
    expect(pressRow(chosen, letters, groups)).toEqual([]);
  });

  it('some lessons make the episode mixed; checking the mixed episode puts the whole episode in the first one\'s place', () => {
    let chosen = pressRow([], rowOf('vocab-topic:food'), groups)!;
    chosen = pressLesson(chosen, wordBuilder, wordBuilder.lessons[2]!.key, groups)!;
    chosen = pressRow(chosen, rowOf('letters:vowels'), groups)!;
    chosen = pressLesson(chosen, wordBuilder, wordBuilder.lessons[0]!.key, groups)!;
    expect(rowCheck(chosen, wordBuilder)).toBe('mixed');
    expect(lessonLocked(chosen, wordBuilder)).toBe(false);
    chosen = pressRow(chosen, wordBuilder, groups)!;
    expect(chosen).toEqual(['vocab-topic:food', 'episode:stage2-letters', 'letters:vowels']);
    expect(rowCheck(chosen, wordBuilder)).toBe('true');
  });

  it('every lesson chosen one by one reads as checked, and the row then clears them all', () => {
    let chosen: string[] = [];
    for (const lesson of letters.lessons) chosen = pressLesson(chosen, letters, lesson.key, groups)!;
    expect(rowCheck(chosen, letters)).toBe('true');
    expect(pressRow(chosen, letters, groups)).toEqual([]);
  });

  it('no quest appears twice in the built deck from any sequence of presses', () => {
    // A seeded walk over the Stage 1 and Stage 2 rows and their lessons.
    const rows = groups.filter((g) => g.id === 'stage1' || g.id === 'stage2').flatMap((g) => g.rows);
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let walk = 0; walk < 60; walk += 1) {
      let chosen: string[] = [];
      for (let step = 0; step < 25; step += 1) {
        const row = rows[Math.floor(next() * rows.length)]!;
        const lesson = row.kind === 'episode' && next() < 0.6 ? row.lessons[Math.floor(next() * row.lessons.length)] : undefined;
        const after = lesson && row.kind === 'episode' ? pressLesson(chosen, row, lesson.key, groups) : pressRow(chosen, row, groups);
        if (after !== null) chosen = after;
        const deck = buildQuickDeck(chosen, groups, { now: new Date('2026-10-17T00:00:00Z'), rng: next, fallbackTitle: 'Your lesson' });
        if (deck === null) {
          expect(chosen).toEqual([]);
          continue;
        }
        const quests = deck.blocks.flatMap((b) => (b.kind === 'quest' ? [b.id] : b.kind === 'episode' ? (CATALOG.cells.find((c) => c.episodeId === b.id)?.questIds ?? []) : []));
        expect(new Set(quests).size, `walk ${walk} step ${step}: ${chosen.join(', ')}`).toBe(quests.length);
        expect(deck.blocks.length).toBeLessThanOrEqual(QUICK_MAX_BLOCKS);
      }
    }
  });
});

describe('the 30-block room', () => {
  const episodes = groups.flatMap((g) => g.rows).filter((r): r is ChooserEpisodeRow => r.kind === 'episode');

  it('a press that would pass 30 blocks does nothing; a press that removes always works', () => {
    expect(episodes.length).toBeGreaterThanOrEqual(30);
    let chosen: string[] = [];
    for (const row of episodes.slice(0, 29)) chosen = pressRow(chosen, row, groups)!;
    expect(chosen).toHaveLength(29);
    // The consonants are two blocks (7 + 7): they no longer fit, though one more episode does.
    expect(pressRow(chosen, rowOf('letters:consonants'), groups)).toBeNull();
    expect(chooserFull(chosen, groups)).toBe(true);
    const thirty = pressRow(chosen, episodes[29]!, groups)!;
    expect(thirty).toHaveLength(30);
    expect(pressRow(thirty, rowOf('story:hangeul-day'), groups)).toBeNull();
    expect(pressRow(thirty, episodes[0]!, groups)).toHaveLength(29);
    expect(removeChoice(thirty, episodes[3]!.key)).toHaveLength(29);
  });

  it('is not full while every box still fits, and full as soon as one that would add does not', () => {
    expect(chooserFull([], groups)).toBe(false);
    let chosen: string[] = [];
    for (const row of episodes.slice(0, 28)) chosen = pressRow(chosen, row, groups)!;
    // 28 blocks: the 2-block consonants still fit.
    expect(chooserFull(chosen, groups)).toBe(false);
    chosen = pressRow(chosen, episodes[28]!, groups)!;
    expect(chooserFull(chosen, groups)).toBe(true);
  });
});

describe('the tray and its minutes', () => {
  it('lists the chosen things in order with their titles and minutes; a letter set counts one minute per two letters per set', () => {
    const chosen = ['episode:stage1-letters', 'letters:consonants', 'quest:stage2-life-q1', 'story:hangeul-day'];
    const tray = chooserTray(chosen, groups);
    expect(tray.map((t) => t.key)).toEqual(chosen);
    expect(tray[0]).toEqual({ key: 'episode:stage1-letters', title: 'Meet the Letters', minutes: 15 });
    // 14 consonants in two sets of 7: 4 + 4.
    expect(tray[1]!.minutes).toBe(8);
    expect(choiceMinutes('letters:vowels', groups)).toBe(5);
    expect(tray[2]!.minutes).toBe(CATALOG.quests.find((q) => q.id === 'quest:stage2-life-q1')!.minutes);
    expect(choiceMinutes('quest:nope', groups)).toBe(0);
    // A key the groups no longer hold drops out of the tray.
    expect(chooserTray(['quest:nope', 'letters:vowels'], groups).map((t) => t.key)).toEqual(['letters:vowels']);
  });
});

describe('the deck title', () => {
  it('joins the chosen titles with a slash', () => {
    expect(quickDeckTitle(['Meet the Letters', 'Consonants'], 'Your lesson')).toBe('Meet the Letters / Consonants');
  });

  it('drops characters outside the title class and stops before 60 characters', () => {
    const title = quickDeckTitle(['Hello Kimchi & Rice', 'A'.repeat(50), 'Vowels'], 'Your lesson');
    expect(title).toBe('Hello Kimchi Rice');
    expect(LECTURE_TITLE_RE.test(title)).toBe(true);
  });

  it('cuts a single long title at a word', () => {
    const title = quickDeckTitle([`${'word '.repeat(15)}end`], 'Your lesson');
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('word')).toBe(true);
  });

  it('leaves out a title that would lose a letter, a bracket or an opening mark, and takes the next one', () => {
    const ko = titleIn('ko');
    // "모음 짝 ㅐ와 ㅔ" and "[ㄱ]과 [ㅂ]으로 ..." hold compatibility jamo and brackets the title class cannot hold.
    expect(quickDeckTitle([ko('quest:stage2-letters-q1'), ko('quest:stage2-letters-q2')], '내 수업')).toBe(ko('quest:stage2-letters-q2'));
    expect(quickDeckTitle([ko('quest:stage2-letters-q6')], '내 수업')).toBe('내 수업');
    const es = titleIn('es');
    expect(quickDeckTitle([es('quest:stage3-nature-q1')], 'Tu lección')).toBe('Tu lección');
    expect(quickDeckTitle([es('quest:stage4-letters-q1'), es('episode:stage1-letters')], 'Tu lección')).toBe(es('episode:stage1-letters'));
    // A dash or quotation mark is dropped as before; the title still says the same.
    expect(quickDeckTitle(['Sun — and “Moon”'], 'Your lesson')).toBe('Sun and Moon');
    for (const t of [quickDeckTitle([ko('quest:stage2-letters-q2')], 'x'), quickDeckTitle([es('episode:stage1-letters')], 'x')]) expect(LECTURE_TITLE_RE.test(t)).toBe(true);
  });

  it('a title losing ㅐ, a conjoining jamo, a bracket or ¿ / ¡ is left out; a dash alone is dropped (no \\p{} classes, Hermes)', () => {
    for (const title of ['모음 ㅐ', '\u1100\u1161 소리', '[ㄱ] 소리', '¿Qué es?', '¡Hola!', 'Ω letter', 'Буква', 'ひらがな', '漢字', 'x²', 'Café 1º']) {
      expect(quickDeckTitle([title], 'Your lesson'), title).toBe('Your lesson');
    }
    expect(quickDeckTitle(['Sun – Moon'], 'Your lesson')).toBe('Sun Moon');
    expect(quickDeckTitle(['Hola · amigos'], 'Your lesson')).toBe('Hola amigos');
  });

  it('falls back when nothing usable is left', () => {
    expect(quickDeckTitle([], 'Your lesson')).toBe('Your lesson');
    expect(quickDeckTitle(['&&&'], 'Tu lección')).toBe('Tu lección');
    expect(quickDeckTitle(['x'.repeat(70)], 'Your lesson')).toBe('Your lesson');
  });
});

describe('buildQuickDeck', () => {
  const now = new Date('2026-10-13T09:30:00.000Z');

  it('builds a valid quick deck from the chosen things in the order chosen', () => {
    const deck = buildQuickDeck(['letters:vowels', 'episode:stage1-letters', 'vocab-topic:food', 'story:hangeul-day'], groups, {
      now,
      rng: () => 0.5,
      fallbackTitle: 'Your lesson',
    })!;
    expect(LectureDeckSchema.safeParse(deck).success).toBe(true);
    expect(deck.v).toBe(1);
    expect(deck.source).toBe('quick');
    expect(deck.title.startsWith('Vowels / Meet the Letters')).toBe(true);
    expect(deck.blocks).toEqual([
      { kind: 'jamo-set', jamoIds: vowels },
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'vocab', topicId: 'vocab-topic:food' },
      { kind: 'story', storyId: 'story:hangeul-day', checks: true },
    ]);
    expect(deck.picker).toBeNull();
    expect(deck.createdAt).toBe('2026-10-13T09:30:00.000Z');
    expect(deck.seed).toBe(now.getTime() % 2 ** 31);
    expect(deck.id).toMatch(/^lecture:[a-z0-9]{10}$/);
  });

  it('carries no name and no language: no helper picker, no label field, no uiLocale (slides follow the presenting device)', () => {
    const deck = buildQuickDeck(['letters:vowels'], groups, { now, rng: () => 0.1, fallbackTitle: 'Your lesson' })!;
    expect(Object.keys(deck).sort()).toEqual(['blocks', 'createdAt', 'id', 'options', 'picker', 'seed', 'source', 'title', 'v']);
    expect(deck.options.uiLocale).toBeUndefined();
  });

  it('returns null with nothing chosen, only unknown keys, or past the cap', () => {
    expect(buildQuickDeck([], groups, { now, rng: () => 0.1, fallbackTitle: 'Your lesson' })).toBeNull();
    expect(buildQuickDeck(['quest:unknown'], groups, { now, rng: () => 0.1, fallbackTitle: 'Your lesson' })).toBeNull();
    const all = groups.flatMap((g) => g.rows).filter((r) => r.kind === 'episode').map((r) => r.key);
    expect(all.length).toBeGreaterThan(30);
    expect(buildQuickDeck(all, groups, { now, rng: () => 0.1, fallbackTitle: 'Your lesson' })).toBeNull();
  });

  it('makes deck ids of lecture: and 10 characters, even at the top of the random range', () => {
    expect(deckIdFrom(() => 0)).toBe('lecture:aaaaaaaaaa');
    expect(deckIdFrom(() => 0.9999999)).toBe('lecture:9999999999');
    expect(deckIdFrom(() => 1)).toBe('lecture:9999999999');
  });
});
