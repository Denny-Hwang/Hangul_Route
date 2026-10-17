import { CATALOG, type Catalog } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { CATALOGUE_TITLES } from '../catalogue-titles.generated';
import { catalogLabel, catalogTitle, catalogTitleEntry, itemCategory, itemTitle, plannableQuest } from '../catalog';

/**
 * Every grid cell has shipped since F-CURR-001, so the coming-soon cases read a copy of the catalogue
 * with the Stage 7 cells taken back to "Coming later" placeholders.
 */
const SOON: Catalog = {
  ...CATALOG,
  cells: CATALOG.cells.map((cell) => (cell.stage === 'stage7' ? { ...cell, status: 'preview' as const, minutes: 10, questIds: [] } : cell)),
  quests: CATALOG.quests.filter((quest) => quest.stage !== 'stage7'),
};

/** F-PLAN-002 section 3.2: the console reads the shared catalogue through this adapter (it retires `stage1-catalog.ts`). */
describe('console catalogue adapter over the shared catalogue', () => {
  it('labels quests by title and episodes with their quest count', () => {
    expect(catalogLabel('quest', 'quest:stage1-letters-q1')).toBe('Meet a, eo, g, n');
    expect(catalogLabel('episode', 'episode:stage1-letters')).toBe('Meet the Letters (3 quests)');
    expect(catalogLabel('episode', 'episode:stage1-rites')).toBe('New Year & Festivals (3 quests)');
    expect(catalogLabel('episode', 'episode:stage1-nature')).toBe('Tigers, Mountains, Moon (3 quests)');
    expect(catalogLabel('episode', 'episode:stage1-crafts')).toBe('Yut, Kites & Paper (3 quests)');
  });

  it('labels an episode that is not released yet as coming soon, never as "0 quests"', () => {
    expect(catalogLabel('episode', 'episode:stage7-crafts', 'en', SOON)).toBe('Make & Share (coming soon)');
  });

  it('falls back to the id for an id this build does not know', () => {
    expect(catalogLabel('quest', 'quest:nope')).toBe('quest:nope');
    expect(catalogLabel('episode', 'episode:nope')).toBe('episode:nope');
    expect(itemTitle('quest', 'quest:nope')).toBe('quest:nope');
    expect(itemTitle('episode', 'episode:nope')).toBe('episode:nope');
  });

  it('takes the words around the title from the locale and the title itself in the locale (owner report 2026-10-16)', () => {
    const title = { en: 'Around the Korean Table', es: 'En la mesa coreana', ko: '한국의 식탁에서' } as const;
    for (const locale of ['en', 'es', 'ko'] as const) {
      expect(catalogLabel('episode', 'episode:stage1-life', locale)).toBe(getMessages(locale).console.plan.catalog.episodeLabel(title[locale], 3));
    }
    expect(catalogLabel('quest', 'quest:stage1-letters-q1', 'ko')).toBe(CATALOGUE_TITLES.ko!['quest:stage1-letters-q1']);
    expect(itemTitle('episode', 'episode:stage1-life', CATALOG, 'es')).toBe('En la mesa coreana');
    expect(catalogLabel('episode', 'episode:stage7-crafts', 'ko', SOON)).toBe(getMessages('ko').console.curriculum.catalog.comingSoon(CATALOGUE_TITLES.ko!['episode:stage7-crafts']!));
  });


  it('sorts an item into lesson, story, coming soon or unknown', () => {
    expect(itemCategory('quest', 'quest:stage1-letters-q1')).toBe('lesson');
    expect(itemCategory('episode', 'episode:stage1-letters')).toBe('lesson');
    expect(itemCategory('quest', 'quest:story-sejong-new-letters-listen')).toBe('story');
    expect(itemCategory('episode', 'episode:stage7-nature', SOON)).toBe('coming-soon');
    // F-CURR-001 S3-2: Daily Mini-Sentences shipped, so its cell is a lesson.
    expect(itemCategory('episode', 'episode:stage3-life')).toBe('lesson');
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

/** F-REPORT-001 RP-10: the quests the builder may pre-add from `&add=` (the report's Add to a plan). */
describe('plannableQuest', () => {
  it('holds a lesson quest of a released episode, on any stage', () => {
    expect(plannableQuest('quest:stage1-life-q2')).toBe(true);
    expect(plannableQuest('quest:stage2-life-q1')).toBe(true);
  });

  it('refuses an id this build does not know and an empty id', () => {
    expect(plannableQuest('quest:nope')).toBe(false);
    expect(plannableQuest('')).toBe(false);
    expect(plannableQuest('episode:stage1-life')).toBe(false);
  });

  it('refuses a closed quest: its episode is not released, or its story is not signed', () => {
    const closed: Catalog = { ...CATALOG, cells: CATALOG.cells.map((c) => (c.episodeId === 'episode:stage1-life' ? { ...c, status: 'preview' } : c)) };
    expect(plannableQuest('quest:stage1-life-q2', closed)).toBe(false);
    const orphan: Catalog = { ...CATALOG, cells: CATALOG.cells.filter((c) => c.episodeId !== 'episode:stage1-life') };
    expect(plannableQuest('quest:stage1-life-q2', orphan)).toBe(false);
    const story = CATALOG.stories[0];
    expect(story).toBeDefined();
    if (!story) return;
    const draft: Catalog = { ...CATALOG, stories: CATALOG.stories.map((s) => (s.id === story.id ? { ...s, status: 'draft' } : s)) };
    expect(plannableQuest(story.questId, draft)).toBe(false);
    const signed: Catalog = { ...CATALOG, stories: CATALOG.stories.map((s) => (s.id === story.id ? { ...s, status: 'ready' } : s)) };
    expect(plannableQuest(story.questId, signed)).toBe(true);
    const unlisted: Catalog = { ...CATALOG, stories: CATALOG.stories.filter((s) => s.id !== story.id) };
    expect(plannableQuest(story.questId, unlisted)).toBe(false);
  });
});

/**
 * The console's content titles in the UI language (owner report 2026-10-16; AMENDMENTS-LECTURE-V2 row LV-3): every
 * catalogue id resolves in Korean and Spanish from the generated `CATALOGUE_TITLES`, else falls back to English with
 * the `fallback` marker set, so a missing overlay title shows here by name.
 */
describe('catalogTitle', () => {
  const ids = [
    ...CATALOG.cells.map((c) => c.episodeId),
    ...CATALOG.quests.map((q) => q.id),
    ...CATALOG.stories.map((s) => s.id),
    ...CATALOG.topics.map((t) => t.id),
    ...CATALOG.topics.map((t) => `vocab-topic:${t.key}`),
  ];

  it.each(['ko', 'es'] as const)('every catalogue id resolves in %s, none falls back', (locale) => {
    const missing = ids.filter((id) => catalogTitleEntry(id, locale).fallback);
    expect(missing).toEqual([]);
    for (const id of ids) {
      const { title } = catalogTitleEntry(id, locale);
      expect(title.trim().length, id).toBeGreaterThan(0);
      expect(title, id).not.toBe(id);
    }
  });

  it('English is the catalogue title, never a fallback', () => {
    for (const id of ids) expect(catalogTitleEntry(id, 'en').fallback, id).toBe(false);
    expect(catalogTitle('episode:stage1-letters', 'en')).toBe('Meet the Letters');
    expect(catalogTitle('topic:food')).toBe(CATALOG.topics.find((t) => t.key === 'food')!.title);
    expect(catalogTitle('vocab-topic:food', 'ko')).toBe(CATALOGUE_TITLES.ko!['vocab-topic:food']);
    expect(catalogTitle('topic:food', 'ko')).toBe(CATALOGUE_TITLES.ko!['vocab-topic:food']);
    expect(catalogTitle('story:hangeul-day', 'ko')).toBe('즐거운 한글날!');
  });

  it('falls back with the marker: English for a locale with no title, the id for an unknown id', () => {
    const only: Catalog = { ...CATALOG, quests: [...CATALOG.quests, { ...CATALOG.quests[0]!, id: 'quest:only-english', title: 'Only English' }] };
    expect(catalogTitleEntry('quest:only-english', 'ko', only)).toEqual({ title: 'Only English', fallback: true });
    expect(catalogTitleEntry('quest:only-english', 'en', only)).toEqual({ title: 'Only English', fallback: false });
    for (const id of ['quest:nope', 'episode:nope', 'story:nope', 'topic:nope', 'vocab-topic:nope', 'card:nope']) {
      expect(catalogTitleEntry(id, 'ko')).toEqual({ title: id, fallback: true });
      expect(catalogTitleEntry(id, 'en')).toEqual({ title: id, fallback: true });
    }
  });
});
