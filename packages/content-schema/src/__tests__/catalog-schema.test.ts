import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_VERSION,
  CatalogCellSchema,
  CatalogQuestSchema,
  CatalogSchema,
  CatalogStorySchema,
  CatalogTopicSchema,
  FESTIVAL_DATES,
  ThemeKeySchema,
  VOCAB_TOPIC_KEYS,
  catalogStatusOfStory,
  cellIsReady,
  routeCatalogOf,
  storyIsReady,
  type Catalog,
  type CatalogCell,
  type CatalogQuest,
  type CatalogStory,
} from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';
import { STAGE1_15_QUESTS } from './fixtures/stage1-15';

const clone = (): Catalog => structuredClone(CATALOG);
const issues = (catalog: unknown): string[] => {
  const result = CatalogSchema.safeParse(catalog);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};
const cellOf = (catalog: Catalog, episodeId: string): CatalogCell => {
  const cell = catalog.cells.find((c) => c.episodeId === episodeId);
  if (cell === undefined) throw new Error(`no cell ${episodeId}`);
  return cell;
};

describe('the shipped catalogue data', () => {
  it('parses with the schema and carries a positive version', () => {
    expect(CatalogSchema.safeParse(CATALOG).success).toBe(true);
    expect(CATALOG_VERSION).toBeGreaterThan(0);
    expect(CATALOG.version).toBe(CATALOG_VERSION);
  });

  it('has exactly 35 cells, one per (stage, theme), in grid order', () => {
    expect(CATALOG.cells).toHaveLength(35);
    const keys = CATALOG.cells.map((c) => `${c.stage}-${c.theme}`);
    expect(new Set(keys).size).toBe(35);
    const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];
    expect(keys).toEqual(stages.flatMap((stage) => ThemeKeySchema.options.map((theme) => `${stage}-${theme}`)));
    for (const cell of CATALOG.cells) expect(cell.episodeId).toBe(`episode:${cell.stage}-${cell.theme}`);
  });

  it('has Stage 1 shipped, three taste cells, Playground Words (F-CURR-001 S2-3), First Sentences (S3-1), Read Along (S4-1), Make & Share (S7-5) and the five Stage 5 books (F-STORY-005 PR 5.6) shipped elsewhere, and the other 18 as previews', () => {
    const shipped = CATALOG.cells.filter((c) => c.status === 'shipped').map((c) => c.episodeId);
    expect(shipped).toEqual([
      'episode:stage1-letters',
      'episode:stage1-life',
      'episode:stage1-rites',
      'episode:stage1-nature',
      'episode:stage1-crafts',
      'episode:stage2-life',
      'episode:stage2-nature',
      'episode:stage2-crafts',
      'episode:stage3-letters',
      'episode:stage4-letters',
      'episode:stage4-rites',
      'episode:stage5-letters',
      'episode:stage5-life',
      'episode:stage5-rites',
      'episode:stage5-nature',
      'episode:stage5-crafts',
      'episode:stage7-crafts',
    ]);
    const previews = CATALOG.cells.filter((c) => c.status === 'preview');
    expect(previews).toHaveLength(18);
    for (const cell of previews) expect(cell.questIds).toEqual([]);
  });

  it('lists the 15 Stage 1 quests of the bundle (F-QUEST-002: Q-6b adds life q3, Q-7b rites q2-q3, Q-8 nature and crafts q2-q3)', () => {
    const stage1 = CATALOG.quests.filter((q) => q.stage === 'stage1' && q.kind === 'lesson');
    expect(stage1.map((q) => q.id)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
      'quest:stage1-life-q1',
      'quest:stage1-life-q2',
      'quest:stage1-life-q3',
      'quest:stage1-rites-q1',
      'quest:stage1-rites-q2',
      'quest:stage1-rites-q3',
      'quest:stage1-nature-q1',
      'quest:stage1-nature-q2',
      'quest:stage1-nature-q3',
      'quest:stage1-crafts-q1',
      'quest:stage1-crafts-q2',
      'quest:stage1-crafts-q3',
    ]);
    expect(CATALOG.quests.filter((q) => q.kind === 'lesson').map((q) => q.id)).toContain('quest:stage4-rites-q1');
    // 15 Stage 1 + 3 taste quests + the 14 read quests of the five Stage 5 books (F-STORY-005 PR 5.6)
    // + the 3 Read Along quests (F-CURR-001 S4-1) + the 3 First Sentences quests (S3-1) + the 3 Playground Words quests (S2-3)
    // + the 3 Make & Share quests (S7-5).
    expect(CATALOG.quests.filter((q) => q.kind === 'lesson')).toHaveLength(44);
  });

  it('has 24 stories adding up to 112 minutes, each with a listen quest on its shelf episode', () => {
    expect(CATALOG.stories).toHaveLength(24);
    expect(CATALOG.stories.reduce((sum, s) => sum + s.minutes, 0)).toBe(112);
    expect(CATALOG.quests.filter((q) => q.kind === 'story')).toHaveLength(24);
    for (const story of CATALOG.stories) {
      const slug = story.id.slice('story:'.length);
      expect(story.questId).toBe(`quest:story-${slug}-listen`);
      const quest = CATALOG.quests.find((q) => q.id === story.questId);
      expect(quest?.episodeId).toBe(`episode:shelf-${slug}`);
      expect(quest?.minutes).toBe(story.minutes);
      expect(quest?.title).toBe(story.title);
      expect(quest?.stage).toBe(`stage${story.recommendedStage}`);
      expect(quest?.theme).toBe(story.theme);
    }
  });

  it('numbers the stories 1 to 24 and marks the six free samplers and the three anchors', () => {
    expect(CATALOG.stories.map((s) => s.order)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(CATALOG.stories.filter((s) => s.sampler).map((s) => s.id)).toEqual([
      'story:sejong-new-letters',
      'story:hangeul-day',
      'story:seollal-new-year',
      'story:chuseok-ganggangsullae',
      'story:sun-and-moon',
      'story:cheugugi-rain-gauge',
    ]);
    const anchored = CATALOG.stories.filter((s) => s.anchor !== null).map((s) => [s.id, s.anchor]);
    expect(anchored).toEqual([
      ['story:hangeul-day', 'hangeul-day'],
      ['story:seollal-new-year', 'seollal'],
      ['story:chuseok-ganggangsullae', 'chuseok'],
    ]);
  });

  it('offers every story since PR 1.9 added the shelf blocks and both review sign-offs (F-STORY-001 PR 1.9)', () => {
    expect(CATALOG.stories).toHaveLength(24);
    expect(CATALOG.stories.every((s) => s.status === 'ready')).toBe(true);
  });

  it('has the 12 launch topics in order, the first four free, none with a quest yet', () => {
    expect(CATALOG.topics.map((t) => t.key)).toEqual([...VOCAB_TOPIC_KEYS].sort((a, b) => order(a) - order(b)));
    expect(CATALOG.topics).toHaveLength(12);
    expect(CATALOG.topics.filter((t) => t.free).map((t) => t.key)).toEqual(['food', 'animals', 'colors', 'numbers']);
    expect(CATALOG.topics.map((t) => t.order)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const topic of CATALOG.topics) {
      expect(topic.id).toBe(`topic:${topic.key}`);
      expect(topic.minutes).toBe(5);
      expect(topic.questId).toBeNull();
    }
  });
});

const TOPIC_ORDER = ['food', 'animals', 'colors', 'numbers', 'family', 'school', 'body', 'nature', 'travel', 'sports', 'k-culture', 'science'];
const order = (key: string): number => TOPIC_ORDER.indexOf(key);

describe('FESTIVAL_DATES', () => {
  it('pins Seollal, Chuseok and Hangeul Day for 2026 to 2030 (section 9, assumption 1)', () => {
    expect(FESTIVAL_DATES.seollal).toEqual({
      '2026': '2026-02-17',
      '2027': '2027-02-07',
      '2028': '2028-01-27',
      '2029': '2029-02-13',
      '2030': '2030-02-03',
    });
    expect(FESTIVAL_DATES.chuseok).toEqual({
      '2026': '2026-09-25',
      '2027': '2027-09-15',
      '2028': '2028-10-03',
      '2029': '2029-09-22',
      '2030': '2030-09-12',
    });
    expect(FESTIVAL_DATES['hangeul-day']).toEqual({
      '2026': '2026-10-09',
      '2027': '2027-10-09',
      '2028': '2028-10-09',
      '2029': '2029-10-09',
      '2030': '2030-10-09',
    });
  });

  it('keys every date by the year it falls in', () => {
    for (const dates of Object.values(FESTIVAL_DATES)) {
      for (const [year, date] of Object.entries(dates)) {
        expect(date.startsWith(`${year}-`)).toBe(true);
        expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
      }
    }
  });
});

describe('field schemas', () => {
  const cell: CatalogCell = { stage: 'stage1', theme: 'life', episodeId: 'episode:stage1-life', title: 'T', status: 'shipped', minutes: 10, questIds: [] };
  const quest: CatalogQuest = { id: 'quest:a', episodeId: 'episode:a', stage: 'stage1', theme: 'life', title: 'T', minutes: 4, teaches: [], kind: 'lesson' };
  const story: CatalogStory = {
    id: 'story:a-b',
    questId: 'quest:story-a-b-listen',
    order: 1,
    title: 'T',
    recommendedStage: 1,
    theme: 'life',
    minutes: 4,
    anchor: null,
    sampler: false,
    status: 'draft',
  };
  const topic = { id: 'topic:food', key: 'food', title: 'Food', order: 1, free: true, minutes: 5, questId: null };

  it('accept well-formed rows', () => {
    expect(CatalogCellSchema.safeParse(cell).success).toBe(true);
    expect(CatalogQuestSchema.safeParse(quest).success).toBe(true);
    expect(CatalogStorySchema.safeParse(story).success).toBe(true);
    expect(CatalogTopicSchema.safeParse(topic).success).toBe(true);
  });

  it('reject malformed ids, stages and minutes', () => {
    expect(CatalogCellSchema.safeParse({ ...cell, minutes: 1.5 }).success).toBe(false);
    expect(CatalogQuestSchema.safeParse({ ...quest, kind: 'game' }).success).toBe(false);
    expect(CatalogStorySchema.safeParse({ ...story, id: 'story:Bad Id' }).success).toBe(false);
    expect(CatalogStorySchema.safeParse({ ...story, recommendedStage: 8 }).success).toBe(false);
    expect(CatalogStorySchema.safeParse({ ...story, recommendedStage: 0 }).success).toBe(false);
    expect(CatalogStorySchema.safeParse({ ...story, anchor: 'diwali' }).success).toBe(false);
    expect(CatalogStorySchema.safeParse({ ...story, status: 'shipped' }).success).toBe(false);
    expect(CatalogTopicSchema.safeParse({ ...topic, id: 'food' }).success).toBe(false);
    expect(CatalogTopicSchema.safeParse({ ...topic, key: 'pets' }).success).toBe(false);
  });
});

describe('CatalogSchema rules', () => {
  it('needs exactly 35 cells', () => {
    const catalog = clone();
    catalog.cells = catalog.cells.slice(0, 34);
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rejects a version of zero', () => {
    expect(CatalogSchema.safeParse({ ...clone(), version: 0 }).success).toBe(false);
  });

  it('rejects two cells in one (stage, theme)', () => {
    const catalog = clone();
    const first = catalog.cells[0] as CatalogCell;
    catalog.cells[1] = { ...first, episodeId: 'episode:dup' };
    expect(issues(catalog)).toContain('Two cells share the cell stage1-letters');
  });

  it('rejects a cell whose episode id is not stage-theme', () => {
    const catalog = clone();
    (catalog.cells[0] as CatalogCell).episodeId = 'episode:other';
    expect(issues(catalog)).toContain('Cell stage1-letters must have the episode id episode:stage1-letters');
  });

  it('rejects a cell that lists a quest which does not exist', () => {
    const catalog = clone();
    cellOf(catalog, 'episode:stage1-life').questIds.push('quest:ghost');
    expect(issues(catalog)).toContain('Cell episode:stage1-life lists the unknown quest quest:ghost');
  });

  it('rejects a cell that lists a story quest or another episode quest', () => {
    const catalog = clone();
    cellOf(catalog, 'episode:stage1-life').questIds.push('quest:stage1-crafts-q1');
    expect(issues(catalog)).toContain('Cell episode:stage1-life lists the quest quest:stage1-crafts-q1 of episode:stage1-crafts');
    const withStory = clone();
    cellOf(withStory, 'episode:stage1-life').questIds.push('quest:story-hangeul-day-listen');
    expect(issues(withStory)).toContain('Cell episode:stage1-life lists the story quest quest:story-hangeul-day-listen');
  });

  it('rejects a lesson quest that no cell lists', () => {
    const catalog = clone();
    cellOf(catalog, 'episode:stage1-life').questIds.pop();
    expect(issues(catalog)).toContain('Lesson quest quest:stage1-life-q3 is not listed by its cell');
  });

  it('rejects a lesson quest whose stage or theme is not its cell', () => {
    const catalog = clone();
    const quest = catalog.quests.find((q) => q.id === 'quest:stage1-life-q1') as CatalogQuest;
    quest.theme = 'rites';
    expect(issues(catalog)).toContain('Quest quest:stage1-life-q1 must carry the stage and theme of its cell');
  });

  it('rejects a lesson quest whose episode is not a cell', () => {
    const catalog = clone();
    (catalog.quests.find((q) => q.id === 'quest:stage1-life-q1') as CatalogQuest).episodeId = 'episode:nowhere';
    expect(issues(catalog)).toContain('Lesson quest quest:stage1-life-q1 names the unknown cell episode:nowhere');
  });

  it('rejects duplicate quest, story, topic and episode ids', () => {
    const quests = clone();
    quests.quests.push(structuredClone(quests.quests[0] as CatalogQuest));
    expect(issues(quests)).toContain('Duplicate quest id quest:stage1-letters-q1');
    const stories = clone();
    stories.stories.push(structuredClone(stories.stories[0] as CatalogStory));
    expect(issues(stories)).toContain('Duplicate story id story:sejong-new-letters');
    const topics = clone();
    topics.topics.push(structuredClone(topics.topics[0] as (typeof topics.topics)[number]));
    expect(issues(topics)).toContain('Duplicate topic id topic:food');
    const episodes = clone();
    (episodes.cells[1] as CatalogCell).episodeId = 'episode:stage1-letters';
    expect(issues(episodes)).toContain('Duplicate episode id episode:stage1-letters');
  });

  it('rejects a story whose quest id is not quest:story-<slug>-listen', () => {
    const catalog = clone();
    (catalog.stories[0] as CatalogStory).questId = 'quest:stage1-letters-q1';
    expect(issues(catalog)).toContain('Story story:sejong-new-letters must use the quest quest:story-sejong-new-letters-listen');
  });

  it('rejects a story whose listen quest is missing or is not a story quest', () => {
    const missing = clone();
    missing.quests = missing.quests.filter((q) => q.id !== 'quest:story-hangeul-day-listen');
    expect(issues(missing)).toContain('Story story:hangeul-day has no story quest quest:story-hangeul-day-listen');
    const wrongKind = clone();
    (wrongKind.quests.find((q) => q.id === 'quest:story-hangeul-day-listen') as CatalogQuest).kind = 'lesson';
    expect(issues(wrongKind)).toContain('Story story:hangeul-day has no story quest quest:story-hangeul-day-listen');
  });

  it('rejects a story quest that no story owns', () => {
    const catalog = clone();
    catalog.quests.push({ id: 'quest:story-orphan-listen', episodeId: 'episode:shelf-orphan', stage: 'stage1', theme: 'letters', title: 'O', minutes: 4, teaches: [], kind: 'story' });
    expect(issues(catalog)).toContain('Story quest quest:story-orphan-listen has no story');
  });

  it('rejects a story whose quest disagrees on minutes, stage or theme', () => {
    const catalog = clone();
    (catalog.quests.find((q) => q.id === 'quest:story-hangeul-day-listen') as CatalogQuest).minutes = 9;
    expect(issues(catalog)).toContain('Story story:hangeul-day and its quest must agree on minutes, stage and theme');
  });

  it('rejects a story anchor claimed by two stories', () => {
    const catalog = clone();
    (catalog.stories[0] as CatalogStory).anchor = 'hangeul-day';
    expect(issues(catalog)).toContain('Two stories claim the anchor hangeul-day');
  });

  it('rejects a topic quest that does not exist and topic orders that repeat', () => {
    const catalog = clone();
    (catalog.topics[0] as (typeof catalog.topics)[number]).questId = 'quest:ghost';
    expect(issues(catalog)).toContain('Topic topic:food names the unknown quest quest:ghost');
    const orders = clone();
    (orders.topics[1] as (typeof orders.topics)[number]).order = 1;
    expect(issues(orders)).toContain('Two topics share the order 1');
  });

  it('accepts a topic that names a real quest', () => {
    const catalog = clone();
    (catalog.topics[0] as (typeof catalog.topics)[number]).questId = 'quest:stage1-letters-q1';
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
  });
});

describe('availability', () => {
  it('treats shipped and ready cells as ready, preview and draft as coming soon', () => {
    const base = CATALOG.cells[0] as CatalogCell;
    expect(cellIsReady({ ...base, status: 'shipped' })).toBe(true);
    expect(cellIsReady({ ...base, status: 'ready' })).toBe(true);
    expect(cellIsReady({ ...base, status: 'preview' })).toBe(false);
    expect(cellIsReady({ ...base, status: 'draft' })).toBe(false);
  });

  it('offers a story only when it is ready', () => {
    const base = CATALOG.stories[0] as CatalogStory;
    expect(storyIsReady({ ...base, status: 'ready' })).toBe(true);
    expect(storyIsReady({ ...base, status: 'draft' })).toBe(false);
  });
});

describe('catalogStatusOfStory (the one rule that flips a catalogue story, section 3.2)', () => {
  const signed = { language: 'native-reviewed', culture: 'culture-reviewed' } as const;
  const shelf = { order: 1 };
  const offered = { state: 'ready', shelf, review: signed } as const;

  it('is ready only for a ready file with a shelf block and both review sign-offs', () => {
    expect(catalogStatusOfStory(offered)).toBe('ready');
  });

  it('keeps a ready file without a shelf block draft (F-STORY-001 PR 1.8: content ready before PR 1.9)', () => {
    expect(catalogStatusOfStory({ state: 'ready', review: signed })).toBe('draft');
    expect(catalogStatusOfStory({ state: 'ready', shelf: undefined, review: signed })).toBe('draft');
  });

  it('keeps a story draft while either review is unsigned (the F-STORY-004 review gate)', () => {
    expect(catalogStatusOfStory({ ...offered, review: { ...signed, language: 'draft' } })).toBe('draft');
    expect(catalogStatusOfStory({ ...offered, review: { ...signed, culture: 'draft' } })).toBe('draft');
    expect(catalogStatusOfStory({ ...offered, review: { language: 'draft', culture: 'draft' } })).toBe('draft');
  });

  it('keeps a draft file draft whatever else it carries (the generator does not bundle it)', () => {
    expect(catalogStatusOfStory({ ...offered, state: 'draft' })).toBe('draft');
  });
});

describe('routeCatalogOf', () => {
  it('maps every quest, grid quests first in canonical order, stories after', () => {
    const route = routeCatalogOf(CATALOG);
    expect(route.quests).toHaveLength(CATALOG.quests.length);
    expect(route.quests.map((q) => q.order)).toEqual(route.quests.map((_, i) => i + 1));
    const lessons = route.quests.filter((q) => q.grid);
    expect(lessons.map((q) => q.id)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
      'quest:stage1-life-q1',
      'quest:stage1-life-q2',
      'quest:stage1-life-q3',
      'quest:stage1-rites-q1',
      'quest:stage1-rites-q2',
      'quest:stage1-rites-q3',
      'quest:stage1-nature-q1',
      'quest:stage1-nature-q2',
      'quest:stage1-nature-q3',
      'quest:stage1-crafts-q1',
      'quest:stage1-crafts-q2',
      'quest:stage1-crafts-q3',
      'quest:stage2-life-q1',
      'quest:stage2-nature-q1',
      'quest:stage2-crafts-q1',
      'quest:stage2-crafts-q2',
      'quest:stage2-crafts-q3',
      'quest:stage3-letters-q1',
      'quest:stage3-letters-q2',
      'quest:stage3-letters-q3',
      'quest:stage4-letters-q1',
      'quest:stage4-letters-q2',
      'quest:stage4-letters-q3',
      'quest:stage4-rites-q1',
      'quest:story-sejong-new-letters-read',
      'quest:story-shapes-of-hangeul-read',
      'quest:story-hangeul-day-read',
      'quest:story-gimjang-arirang-read',
      'quest:story-kim-hongdo-genre-paintings-read',
      'quest:story-donguibogam-read',
      'quest:story-seollal-new-year-read',
      'quest:story-dano-ssireum-read',
      'quest:story-chuseok-ganggangsullae-read',
      'quest:story-sun-and-moon-read',
      'quest:story-angbuilgu-sundial-read',
      'quest:story-cheugugi-rain-gauge-read',
      'quest:story-jagyeongnu-water-clock-read',
      'quest:story-pansori-tales-read',
      'quest:stage7-crafts-q1',
      'quest:stage7-crafts-q2',
      'quest:stage7-crafts-q3',
    ]);
    expect(route.quests.slice(0, lessons.length).every((q) => q.grid)).toBe(true);
    const stories = route.quests.filter((q) => !q.grid);
    expect(stories).toHaveLength(24);
    expect(stories.map((q) => q.id)).toEqual(CATALOG.stories.map((s) => s.questId));
  });

  it('carries episode, stage, theme and teaches through', () => {
    const route = routeCatalogOf(CATALOG);
    const letters = route.quests.find((q) => q.id === 'quest:stage1-letters-q1');
    expect(letters).toMatchObject({ episodeId: 'episode:stage1-letters', stage: 'stage1', theme: 'letters', playable: true, grid: true });
    expect(letters?.teaches).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']); // F-QUEST-002 Q-6a
    expect(route.quests.find((q) => q.id === 'quest:stage1-life-q1')?.teaches).toEqual(['ㅈ', 'ㅊ']); // F-QUEST-002 Q-6b
    expect(route.quests.find((q) => q.id === 'quest:stage1-rites-q1')?.teaches).toEqual(['ㄴ/final', 'ㄹ/final']); // F-QUEST-002 Q-7b
    expect(route.quests.find((q) => q.id === 'quest:stage1-nature-q1')?.teaches).toEqual(['ㅁ/final', 'ㅂ/final']); // F-QUEST-002 Q-8
    expect(route.quests.find((q) => q.id === 'quest:stage1-nature-q2')?.teaches).toEqual([]); // a reading quest (R5)
  });

  it('is playable when the cell is ready and, for a story, when the story is ready', () => {
    const catalog = clone();
    cellOf(catalog, 'episode:stage2-life').status = 'preview';
    (catalog.stories[0] as CatalogStory).status = 'ready';
    (catalog.stories[1] as CatalogStory).status = 'draft';
    const route = routeCatalogOf(catalog);
    expect(route.quests.find((q) => q.id === 'quest:stage2-life-q1')?.playable).toBe(false);
    expect(route.quests.find((q) => q.id === 'quest:stage1-life-q1')?.playable).toBe(true);
    expect(route.quests.find((q) => q.id === 'quest:story-sejong-new-letters-listen')?.playable).toBe(true);
    expect(route.quests.find((q) => q.id === 'quest:story-shapes-of-hangeul-listen')?.playable).toBe(false);
  });

  it('follows the grid order of the cells, not the order of the arrays', () => {
    const catalog = clone();
    catalog.cells.reverse();
    catalog.quests.reverse();
    const route = routeCatalogOf(catalog);
    expect(route.quests.filter((q) => q.grid).map((q) => q.id).slice(0, 3)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
    ]);
  });

  it('sorts a quest that no cell and no story lists last, in array order', () => {
    const catalog = clone();
    const extra = (id: string): CatalogQuest => ({ id, episodeId: 'episode:none', stage: 'stage1', theme: 'letters', title: id, minutes: 4, teaches: [], kind: 'lesson' });
    catalog.quests.unshift(extra('quest:loose-a'));
    catalog.quests.push(extra('quest:loose-b'));
    const ids = routeCatalogOf(catalog).quests.map((q) => q.id);
    expect(ids.slice(-2)).toEqual(['quest:loose-a', 'quest:loose-b']);
    expect(ids[0]).toBe('quest:stage1-letters-q1');
    expect(routeCatalogOf(catalog).quests.find((q) => q.id === 'quest:loose-a')?.playable).toBe(false);
  });

  it('puts stories in story order', () => {
    const catalog = clone();
    catalog.stories.reverse();
    const stories = routeCatalogOf(catalog).quests.filter((q) => !q.grid);
    expect(stories[0]?.id).toBe('quest:story-sejong-new-letters-listen');
  });
});

describe('the frozen fixture catalog-2026-10', () => {
  it('parses, and describes the catalogue as the spec assumes in October 2026', () => {
    expect(CatalogSchema.safeParse(CATALOG_2026_10).success).toBe(true);
    const lessons = CATALOG_2026_10.quests.filter((q) => q.kind === 'lesson');
    expect(lessons.filter((q) => q.stage === 'stage1')).toHaveLength(15);
    expect(lessons).toHaveLength(18);
    expect(CATALOG_2026_10.cells.filter((c) => cellIsReady(c))).toHaveLength(8);
    expect(CATALOG_2026_10.cells.filter((c) => !cellIsReady(c))).toHaveLength(27);
    expect(CATALOG_2026_10.stories).toHaveLength(24);
    expect(CATALOG_2026_10.stories.every((s) => storyIsReady(s))).toBe(true);
    expect(CATALOG_2026_10.stories.reduce((sum, s) => sum + s.minutes, 0)).toBe(112);
    expect(CATALOG_2026_10.topics).toHaveLength(12);
    expect(CATALOG_2026_10.topics.filter((t) => t.free)).toHaveLength(4);
  });

  it('teaches the symbols of F-QUEST-002 section 3.6 and totals 65 Stage 1 minutes', () => {
    const route = routeCatalogOf(CATALOG_2026_10);
    const stage1 = route.quests.filter((q) => q.stage === 'stage1' && q.grid);
    expect(stage1.map((q) => [q.id, q.teaches])).toEqual(STAGE1_15_QUESTS.map((q) => [q.id, q.teaches]));
    const minutes = CATALOG_2026_10.quests.filter((q) => q.stage === 'stage1' && q.kind === 'lesson').reduce((sum, q) => sum + q.minutes, 0);
    expect(minutes).toBe(65);
    const cellMinutes = CATALOG_2026_10.cells.filter((c) => c.stage === 'stage1').map((c) => c.minutes);
    expect(cellMinutes).toEqual([15, 12, 14, 12, 12]);
  });

  it('is independent of the shipped data (it stays frozen while content grows)', () => {
    expect(CATALOG_2026_10).not.toBe(CATALOG);
    expect(CATALOG_2026_10.quests).not.toBe(CATALOG.quests);
    // Since F-QUEST-002 Q-8 the shipped catalogue has the fixture's 15 Stage 1 lessons too; the fixture keeps its own version.
    expect(CATALOG_2026_10.version).not.toBe(CATALOG.version);
  });
});
