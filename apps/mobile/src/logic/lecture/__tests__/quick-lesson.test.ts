import { LECTURE_TITLE_RE, LectureDeckSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  QUICK_MAX_BLOCKS,
  buildQuickDeck,
  canChoose,
  chosenBlockCount,
  quickDeckTitle,
  quickGroups,
  toggleChoice,
  type QuickItem,
  type QuickSource,
} from '../quick-lesson';

const source: QuickSource = {
  episodes: [
    { id: 'episode:stage1-letters', title: 'Meet the Letters', minutes: 15, questIds: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2'] },
    { id: 'episode:stage1-life', title: 'Around the Korean Table', minutes: 12, questIds: ['quest:stage1-life-q1'] },
  ],
  quests: [
    { id: 'quest:stage1-letters-q1', title: 'Meet a, eo, g, n', minutes: 5 },
    { id: 'quest:stage1-letters-q2', title: 'Meet d, r, m', minutes: 5 },
    { id: 'quest:stage1-life-q1', title: 'Hello Kimchi & Rice', minutes: 6 },
  ],
  consonants: Array.from({ length: 14 }, (_, i) => `jamo:c${i}`),
  vowels: Array.from({ length: 10 }, (_, i) => `jamo:v${i}`),
};

const labels = { consonants: 'Consonants', vowels: 'Vowels' };

const itemsOf = (src: QuickSource = source): QuickItem[] => quickGroups(src, labels).flatMap((g) => g.items);

describe('Quick lesson groups (F-TCH-004 §3.12)', () => {
  it('lists episodes, single lessons and letter sets in content order', () => {
    const groups = quickGroups(source, labels);
    expect(groups.map((g) => g.id)).toEqual(['episodes', 'lessons', 'letterSets']);
    expect(groups[0]!.items.map((i) => i.title)).toEqual(['Meet the Letters', 'Around the Korean Table']);
    expect(groups[1]!.items.map((i) => i.key)).toEqual(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-life-q1']);
    expect(groups[2]!.items.map((i) => i.title)).toEqual(['Consonants', 'Vowels']);
  });

  it('describes episodes and lessons by minutes and letter sets by letters', () => {
    const [episode] = quickGroups(source, labels)[0]!.items;
    expect(episode!.detail).toEqual({ kind: 'minutes', n: 15 });
    const [consonants, vowels] = quickGroups(source, labels)[2]!.items;
    expect(consonants!.detail).toEqual({ kind: 'letters', n: 14 });
    expect(vowels!.detail).toEqual({ kind: 'letters', n: 10 });
  });

  it('maps each item to deck blocks; a letter set over 12 letters splits into even blocks', () => {
    const byKey = new Map(itemsOf().map((i) => [i.key, i]));
    expect(byKey.get('episode:stage1-letters')!.blocks).toEqual([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    expect(byKey.get('quest:stage1-life-q1')!.blocks).toEqual([{ kind: 'quest', id: 'quest:stage1-life-q1' }]);
    const consonants = byKey.get('letters:consonants')!.blocks;
    expect(consonants).toHaveLength(2);
    expect(consonants.map((b) => (b.kind === 'jamo-set' ? b.jamoIds.length : 0))).toEqual([7, 7]);
    expect(consonants.flatMap((b) => (b.kind === 'jamo-set' ? b.jamoIds : []))).toEqual(source.consonants);
    expect(byKey.get('letters:vowels')!.blocks).toHaveLength(1);
  });

  it('leaves out a group with nothing in it and a lesson no episode lists', () => {
    const groups = quickGroups({ episodes: [], quests: [{ id: 'quest:x', title: 'X', minutes: 1 }], consonants: [], vowels: [] }, labels);
    expect(groups).toEqual([]);
  });

  it('adds stories and word topics only when the bundle has them', () => {
    const groups = quickGroups(
      {
        ...source,
        topics: [{ id: 'vocab-topic:food', title: 'Food', minutes: 4 }],
        stories: [{ id: 'story:king-sejong', title: "King Sejong's New Letters", minutes: 4 }],
      },
      labels,
    );
    expect(groups.map((g) => g.id)).toEqual(['episodes', 'lessons', 'letterSets', 'topics', 'stories']);
    expect(groups[3]!.items[0]!.blocks).toEqual([{ kind: 'vocab', topicId: 'vocab-topic:food' }]);
    expect(groups[4]!.items[0]!.blocks).toEqual([{ kind: 'story', storyId: 'story:king-sejong', checks: true }]);
  });
});

describe('choosing (multi-select up to 30 blocks)', () => {
  const items = itemsOf();

  it('toggles an item on and off, keeping the order chosen', () => {
    let chosen = toggleChoice([], 'letters:vowels', items);
    chosen = toggleChoice(chosen, 'episode:stage1-letters', items);
    expect(chosen).toEqual(['letters:vowels', 'episode:stage1-letters']);
    expect(toggleChoice(chosen, 'letters:vowels', items)).toEqual(['episode:stage1-letters']);
  });

  it('ignores an unknown key', () => {
    expect(toggleChoice(['letters:vowels'], 'quest:nope', items)).toEqual(['letters:vowels']);
    expect(canChoose([], 'quest:nope', items)).toBe(false);
  });

  it('counts blocks, not rows', () => {
    expect(chosenBlockCount(['letters:consonants', 'letters:vowels'], items)).toBe(3);
  });

  it('refuses an item that would take the deck past 30 blocks, and always allows unticking', () => {
    const many: QuickItem[] = Array.from({ length: 31 }, (_, i) => ({
      key: `quest:q${i}`,
      group: 'lessons',
      title: `Q${i}`,
      detail: { kind: 'minutes', n: 1 },
      blocks: [{ kind: 'quest', id: `quest:q${i}` }],
    }));
    const pair: QuickItem = { ...many[0]!, key: 'letters:big', blocks: [many[0]!.blocks[0]!, many[1]!.blocks[0]!] };
    const all = [...many, pair];
    let chosen: readonly string[] = [];
    for (let i = 0; i < 31; i += 1) chosen = toggleChoice(chosen, `quest:q${i}`, all);
    expect(chosen).toHaveLength(QUICK_MAX_BLOCKS);
    expect(canChoose(chosen, 'quest:q30', all)).toBe(false);
    expect(canChoose(chosen, 'quest:q0', all)).toBe(true);
    const twentyNine = chosen.slice(0, 29);
    expect(canChoose(twentyNine, 'letters:big', all)).toBe(false);
    expect(canChoose(twentyNine, 'quest:q29', all)).toBe(true);
  });
});

describe('the deck title', () => {
  it('joins the chosen titles with a slash', () => {
    expect(quickDeckTitle(['Meet the Letters', 'Consonants'], 'Quick lesson')).toBe('Meet the Letters / Consonants');
  });

  it('drops characters outside the title class and stops before 60 characters', () => {
    const title = quickDeckTitle(['Hello Kimchi & Rice', 'A'.repeat(50), 'Vowels'], 'Quick lesson');
    expect(title).toBe('Hello Kimchi Rice');
    expect(LECTURE_TITLE_RE.test(title)).toBe(true);
  });

  it('cuts a single long title at a word', () => {
    const title = quickDeckTitle([`${'word '.repeat(15)}end`], 'Quick lesson');
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('word')).toBe(true);
  });

  it('falls back when nothing usable is left', () => {
    expect(quickDeckTitle([], 'Quick lesson')).toBe('Quick lesson');
    expect(quickDeckTitle(['&&&'], 'Lección rápida')).toBe('Lección rápida');
    expect(quickDeckTitle(['x'.repeat(70)], 'Quick lesson')).toBe('Quick lesson');
  });
});

describe('buildQuickDeck', () => {
  const items = itemsOf();
  const now = new Date('2026-10-13T09:30:00.000Z');

  it('builds a valid quick deck from the chosen items in the order chosen', () => {
    const deck = buildQuickDeck(['letters:vowels', 'episode:stage1-letters'], items, {
      now,
      rng: () => 0.5,
      fallbackTitle: 'Quick lesson',
    })!;
    expect(LectureDeckSchema.safeParse(deck).success).toBe(true);
    expect(deck.source).toBe('quick');
    expect(deck.title).toBe('Vowels / Meet the Letters');
    expect(deck.blocks[0]!.kind).toBe('jamo-set');
    expect(deck.blocks[1]).toEqual({ kind: 'episode', id: 'episode:stage1-letters' });
    expect(deck.picker).toEqual({ mode: 'numbers', count: 12 });
    expect(deck.createdAt).toBe('2026-10-13T09:30:00.000Z');
    expect(deck.seed).toBe(now.getTime() % 2 ** 31);
    expect(deck.id).toMatch(/^lecture:[a-z0-9]{10}$/);
  });

  it('carries no name: the picker is numbers and the deck has no label field', () => {
    const deck = buildQuickDeck(['letters:vowels'], items, { now, rng: () => 0.1, fallbackTitle: 'Quick lesson' })!;
    expect(Object.keys(deck).sort()).toEqual(['blocks', 'createdAt', 'id', 'options', 'picker', 'seed', 'source', 'title', 'v']);
  });

  it('passes the session language to the deck when given', () => {
    const deck = buildQuickDeck(['letters:vowels'], items, { now, rng: () => 0.1, fallbackTitle: 'Quick lesson', uiLocale: 'es' })!;
    expect(deck.options.uiLocale).toBe('es');
  });

  it('returns null with nothing chosen or past the cap', () => {
    expect(buildQuickDeck([], items, { now, rng: () => 0.1, fallbackTitle: 'Quick lesson' })).toBeNull();
    expect(buildQuickDeck(['quest:unknown'], items, { now, rng: () => 0.1, fallbackTitle: 'Quick lesson' })).toBeNull();
  });
});
