import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStory, StoryObjectSchema, type Overlays, type Story, type StoryLevel, type StoryOrderRound } from '@hangul-route/content-schema';
import { localizeScope } from '../../content-locale';
import { parseStoryMinigameRef, storyMinigameRef, storyScopeFor } from '../story-ref';
import { splitStory, storyTierHasOrder } from '../story-chunk-store';
import { storyById } from '../../../content/stories';
import { storyQuestSkeleton } from '../../../content/story-skeleton';

/** F-CURR-002 §5.5 S5 (row CM-46): a book 2 tale's read tier carries a Story Order, which its book quest plays. */

const ROUND: StoryOrderRound = {
  id: 'lava',
  captionsOnly: true,
  captionsSettleOrder: true,
  panels: [
    { id: 'p1', caption: { ko: '먼저 화산에서 용암이 나왔어요.', romanization: 'Meonjeo hwasaneseo yongami nawasseoyo.', en: 'First, lava came out of a volcano.' } },
    { id: 'p2', caption: { ko: '그다음에 용암이 흘렀어요.', romanization: 'Geudaeume yongami heulleosseoyo.', en: 'Next, the lava flowed.' } },
    { id: 'p3', caption: { ko: '마지막에 동굴이 생겼어요.', romanization: 'Majimage dongguri saenggyeosseoyo.', en: 'Last, caves formed.' } },
  ],
};
type Lookup = { tiers: Array<{ level: StoryLevel; storyOrder?: { rounds: StoryOrderRound[] } }> };
const STORIES: Record<string, Lookup> = {
  'story:with-order': { tiers: [{ level: 'listen' }, { level: 'read', storyOrder: { rounds: [ROUND] } }] },
  'story:without-order': { tiers: [{ level: 'listen' }, { level: 'read' }] },
};
const find = (id: string): Lookup | undefined => STORIES[id];

describe('the Story Order step of a story ref', () => {
  it('parses and builds the order step at every level', () => {
    expect(parseStoryMinigameRef('minigame:story-order-read-with-order')).toEqual({ step: 'order', level: 'read', storyId: 'story:with-order' });
    expect(storyMinigameRef('order', 'read', 'story:with-order')).toBe('minigame:story-order-read-with-order');
  });

  it('resolves to a story-order scope with the tier rounds, copied', () => {
    const scope = storyScopeFor('minigame:story-order-read-with-order', find);
    expect(scope).toEqual({ kind: 'story-order', story: { storyId: 'story:with-order', level: 'read' }, storyOrder: { rounds: [ROUND] } });
    expect(scope?.storyOrder?.rounds[0]).not.toBe(ROUND);
  });

  it('has no order step on a tier without rounds, while the other steps of that tier resolve as before', () => {
    expect(storyScopeFor('minigame:story-order-read-without-order', find)).toBeUndefined();
    expect(storyScopeFor('minigame:story-order-listen-with-order', find)).toBeUndefined();
    expect(storyScopeFor('minigame:story-seq-read-without-order', find)).toEqual({ kind: 'story-sequence', story: { storyId: 'story:without-order', level: 'read' } });
  });
});

describe('the caption meanings of a story Story Order come from the story overlay', () => {
  const scope = storyScopeFor('minigame:story-order-read-with-order', find)!;
  const overlays: Overlays = {
    es: { 'story:with-order': { 'tiers.read.storyOrder.rounds.lava.panels.p1.caption.gloss': 'Primero, salió lava de un volcán.' } },
    ko: {},
  };

  it('replaces a panel gloss in es and keeps English where the overlay has none', () => {
    const es = localizeScope(scope, 'minigame:story-order-read-with-order', 'es', overlays);
    expect(es.storyOrder?.rounds[0]?.panels.map((p) => p.caption.en)).toEqual(['Primero, salió lava de un volcán.', 'Next, the lava flowed.', 'Last, caves formed.']);
    // The Korean and its romanization never change.
    expect(es.storyOrder?.rounds[0]?.panels[0]?.caption.ko).toBe(ROUND.panels[0]?.caption.ko);
  });

  it('leaves English and a locale without an entry as authored', () => {
    expect(localizeScope(scope, 'minigame:story-order-read-with-order', 'en', overlays)).toBe(scope);
    expect(localizeScope(scope, 'minigame:story-order-read-with-order', 'ko', overlays)).toBe(scope);
  });
});

/** The tale as its file holds it (the bundle's `storyById` is the shelf entry until the story chunk loads). */
const jeju: Story = parseStory(JSON.parse(readFileSync(join(__dirname, '../../../../../../content/stories/jeju-volcanic-island.json'), 'utf8')) as unknown);

describe('the shelf knows a tier with a Story Order before its chunk loads', () => {

  it('marks the read tier of a book 2 tale in its shelf entry, and no other tier', () => {
    const { entry } = splitStory(jeju, 'h-jeju');
    expect(entry.levels).toEqual([
      { level: 'listen', scenes: 7 },
      { level: 'read', scenes: 6, storyOrder: true },
    ]);
    // The bundled story answers from its shelf entry, the file's from its tiers.
    expect(storyTierHasOrder(storyById('story:jeju-volcanic-island') as Story, 'read')).toBe(true);
    expect(storyTierHasOrder(storyById('story:jeju-volcanic-island') as Story, 'listen')).toBe(false);
    expect(storyTierHasOrder(jeju, 'read')).toBe(true);
    expect(storyTierHasOrder(jeju, 'listen')).toBe(false);
    expect(storyTierHasOrder(storyById('story:angbuilgu-sundial') as Story, 'read')).toBe(false);
  });

  it('builds the book quest of a tale with a Story Order step, and of any other story with the picture sequence', () => {
    const tale = storyQuestSkeleton(jeju, 'read');
    expect(tale.steps[3]).toMatchObject({ minigameKind: 'story-order', minigameRef: 'minigame:story-order-read-jeju-volcanic-island' });
    const book1 = storyQuestSkeleton(storyById('story:angbuilgu-sundial') as Story, 'read');
    expect(book1.steps[3]).toMatchObject({ minigameKind: 'story-sequence', minigameRef: 'minigame:story-seq-read-angbuilgu-sundial' });
  });
});

describe('the story schema holds a Story Order to the read tier', () => {
  const base = JSON.parse(JSON.stringify(jeju)) as Story;
  it('refuses rounds on the listen tier and two rounds with one id', () => {
    const onListen = { ...base, tiers: base.tiers.map((t) => (t.level === 'listen' ? { ...t, storyOrder: { kind: 'story-order', rounds: [ROUND] } } : t)) };
    expect(() => parseStory(onListen)).toThrow(/belongs to the read tier/);
    const twice = { ...base, tiers: base.tiers.map((t) => (t.level === 'read' ? { ...t, storyOrder: { kind: 'story-order', rounds: [ROUND, ROUND] } } : t)) };
    expect(() => parseStory(twice)).toThrow(/round ids must be unique/);
    expect(StoryObjectSchema.safeParse(base).success).toBe(true);
  });
});
