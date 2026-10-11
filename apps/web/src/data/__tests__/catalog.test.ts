import { CATALOG, type Catalog } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { builderEpisodes, catalogLabel, itemCategory, itemTitle, questsOf } from '../catalog';

/** F-PLAN-002 section 3.2: the console reads the shared catalogue through this adapter (it retires `stage1-catalog.ts`). */
describe('console catalogue adapter over the shared catalogue', () => {
  it('labels quests by title and episodes with their quest count', () => {
    expect(catalogLabel('quest', 'quest:stage1-letters-q1')).toBe('Meet a, eo, g, n');
    expect(catalogLabel('episode', 'episode:stage1-letters')).toBe('Meet the Letters (3 quests)');
    expect(catalogLabel('episode', 'episode:stage1-rites')).toBe('New Year & Festivals (1 quest)');
  });

  it('labels an episode that is not released yet as coming soon, never as "0 quests"', () => {
    expect(catalogLabel('episode', 'episode:stage2-letters')).toBe('Word Builder (coming soon)');
  });

  it('falls back to the id for an id this build does not know', () => {
    expect(catalogLabel('quest', 'quest:nope')).toBe('quest:nope');
    expect(catalogLabel('episode', 'episode:nope')).toBe('episode:nope');
    expect(itemTitle('quest', 'quest:nope')).toBe('quest:nope');
    expect(itemTitle('episode', 'episode:nope')).toBe('episode:nope');
  });

  it('takes the words around the title from the locale (titles are content)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      expect(catalogLabel('episode', 'episode:stage1-life', locale)).toBe(getMessages(locale).console.plan.catalog.episodeLabel('Around the Korean Table', 2));
    }
  });

  it('lists the quests of an episode in catalogue order', () => {
    expect(questsOf('episode:stage1-life').map((q) => q.id)).toEqual(['quest:stage1-life-q1', 'quest:stage1-life-q2']);
    expect(questsOf('episode:stage1-letters').map((q) => q.minutes)).toEqual([5, 5, 5]);
    expect(questsOf('episode:stage2-letters')).toEqual([]);
    expect(questsOf('episode:nope')).toEqual([]);
  });

  it('offers the builder the ready Stage 1 episodes in grid order', () => {
    expect(builderEpisodes().map((cell) => cell.episodeId)).toEqual([
      'episode:stage1-letters',
      'episode:stage1-life',
      'episode:stage1-rites',
      'episode:stage1-nature',
      'episode:stage1-crafts',
    ]);
    expect(builderEpisodes('stage2').map((cell) => cell.episodeId)).toEqual(['episode:stage2-life', 'episode:stage2-nature']);
  });

  it('sorts an item into lesson, story, coming soon or unknown', () => {
    expect(itemCategory('quest', 'quest:stage1-letters-q1')).toBe('lesson');
    expect(itemCategory('episode', 'episode:stage1-letters')).toBe('lesson');
    expect(itemCategory('quest', 'quest:story-sejong-new-letters-listen')).toBe('story');
    expect(itemCategory('episode', 'episode:stage3-life')).toBe('coming-soon');
    expect(itemCategory('quest', 'quest:nope')).toBe('unknown');
    expect(itemCategory('episode', 'episode:nope')).toBe('unknown');
    expect(itemTitle('quest', 'quest:story-sejong-new-letters-listen')).toBe("King Sejong's New Letters");
    expect(itemTitle('episode', 'episode:stage3-life')).toBe('Daily Mini-Sentences');
  });

  it('reads another catalogue when one is passed (a newer bundle)', () => {
    const grown: Catalog = { ...CATALOG, quests: CATALOG.quests.map((q) => (q.id === 'quest:stage1-letters-q1' ? { ...q, title: 'Meet the first letters' } : q)) };
    expect(itemTitle('quest', 'quest:stage1-letters-q1', grown)).toBe('Meet the first letters');
    expect(itemCategory('quest', 'quest:stage1-letters-q1', grown)).toBe('lesson');
  });
});
