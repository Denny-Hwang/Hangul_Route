import { EpisodeSchema, isPillarTag, type Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { bookEpisodes } from '../books';
import {
  MAX_EPISODES_PER_CELL,
  cellKey,
  cellsOverCapacity,
  episodeFor,
  episodesAll,
  episodesFor,
  gridEpisodes,
  handWrittenEpisodes,
  isGridEpisode,
  previewEpisodesFor,
  shelfEpisodes,
} from '../episodes';
import { questsAll } from '../quests';
import { stages, themes } from '../stages';
import { storyEpisodes, storyQuests } from '../stories';

/**
 * F-STORY-004 §3.10: the grid/shelf split. A shelf episode (`placement: 'shelf'`)
 * lives outside the 7×5 grid; an episode without the field is a grid cell.
 */
const episode = (id: string, overrides: Partial<Episode> = {}): Episode => ({
  id,
  stage: 'stage1',
  theme: 'letters',
  order: 1,
  titleEn: id,
  hoyaIntroEn: 'Hi!',
  questIds: [`quest:${id.slice('episode:'.length)}`],
  rewardCardIds: [],
  estimatedMinutes: 10,
  status: 'shipped',
  ...overrides,
});

const cell = episode('episode:cell');
const explicitGrid = episode('episode:grid', { placement: 'grid', theme: 'life' });
const shelf = episode('episode:shelf-sun-and-moon', { placement: 'shelf', format: 'story', order: 101 });
const MIXED = [shelf, cell, explicitGrid];

describe('isGridEpisode', () => {
  it('is true for an episode without a placement (every hand-written episode)', () => {
    expect(isGridEpisode(cell)).toBe(true);
  });

  it('is true for placement "grid" and false for placement "shelf"', () => {
    expect(isGridEpisode(explicitGrid)).toBe(true);
    expect(isGridEpisode(shelf)).toBe(false);
  });
});

describe('gridEpisodes / shelfEpisodes', () => {
  it('split a list in two, keeping content order', () => {
    expect(gridEpisodes(MIXED).map((e) => e.id)).toEqual(['episode:cell', 'episode:grid']);
    expect(shelfEpisodes(MIXED).map((e) => e.id)).toEqual(['episode:shelf-sun-and-moon']);
  });

  it('return empty lists for an empty input', () => {
    expect(gridEpisodes([])).toEqual([]);
    expect(shelfEpisodes([])).toEqual([]);
  });

  it('keep every hand-written episode on the grid: only the story bundle can add shelf episodes', () => {
    const handWritten = episodesAll.filter((e) => !storyEpisodes.includes(e));
    expect(gridEpisodes(handWritten)).toEqual(handWritten);
    for (const e of shelfEpisodes(episodesAll)) expect(storyEpisodes).toContain(e);
  });

  it('keep Home\'s quest total (quests of grid episodes) counting every hand-written quest', () => {
    const gridQuestIds = new Set(gridEpisodes(episodesAll).flatMap((e) => e.questIds));
    const handWritten = questsAll.filter((q) => !storyQuests.includes(q));
    expect(handWritten.length).toBeGreaterThan(0);
    for (const q of handWritten) expect(gridQuestIds.has(q.id)).toBe(true);
  });
});

describe('episodeFor', () => {
  it('ignores a shelf episode that shares the stage and theme of a cell', () => {
    expect(episodeFor('stage1', 'letters', MIXED)?.id).toBe('episode:cell');
  });

  it('is undefined when only a shelf episode sits at that stage and theme', () => {
    expect(episodeFor('stage1', 'letters', [shelf])).toBeUndefined();
  });

  it('reads the bundle by default', () => {
    expect(episodeFor('stage1', 'letters')?.id).toBe('episode:stage1-letters');
  });
});

/**
 * F-STORY-005 §3.5 / PR 5.2: grid capacity. Previews come from the cells no
 * hand-written grid episode claims, every cell holds at most
 * `MAX_EPISODES_PER_CELL` grid episodes, and the grid is unchanged (golden).
 */
const ALL_CELLS = stages.flatMap((s) => themes.map((t) => `${s.key}:${t.key}`));

describe('grid capacity (F-STORY-005 §3.5)', () => {
  it('launches with one grid episode per cell', () => {
    expect(MAX_EPISODES_PER_CELL).toBe(1);
  });

  it('fills all 35 cells with at least one and at most MAX_EPISODES_PER_CELL grid episodes', () => {
    expect(ALL_CELLS).toHaveLength(35);
    for (const key of ALL_CELLS) {
      const [stage, theme] = key.split(':') as [string, string];
      const inCell = episodesFor(stage, theme).length;
      expect(inCell, key).toBeGreaterThanOrEqual(1);
      expect(inCell, key).toBeLessThanOrEqual(MAX_EPISODES_PER_CELL);
    }
    expect(new Set(gridEpisodes(episodesAll).map(cellKey))).toEqual(new Set(ALL_CELLS));
    expect(cellsOverCapacity(episodesAll)).toEqual([]);
  });

  it('fails the invariant when a test adds a second grid episode to one cell', () => {
    const extra = episode('episode:stage1-letters-extra', { stage: 'stage1', theme: 'letters' });
    expect(cellsOverCapacity([...episodesAll, extra])).toEqual(['stage1:letters']);
  });

  it('never counts shelf episodes toward a cell, and honours an explicit max', () => {
    const shelfHere = episode('episode:shelf-z', { stage: 'stage1', theme: 'letters', placement: 'shelf' });
    expect(cellsOverCapacity([...episodesAll, shelfHere])).toEqual([]);
    const extra = episode('episode:stage1-letters-extra', { stage: 'stage1', theme: 'letters' });
    expect(cellsOverCapacity([...episodesAll, extra], 2)).toEqual([]);
  });

  it('builds the bundle as hand-written, then shelf stories, then previews of unclaimed cells', () => {
    expect(episodesAll).toEqual([...handWrittenEpisodes, ...storyEpisodes, ...previewEpisodesFor(handWrittenEpisodes)]);
    for (const b of bookEpisodes) expect(handWrittenEpisodes).toContain(b);
  });

  it('keeps every episode id unique', () => {
    const ids = episodesAll.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships the five Stage 5 books (PR 5.6), each claiming its placeholder cell', () => {
    expect(bookEpisodes.map((e) => e.id)).toEqual([
      'episode:stage5-letters',
      'episode:stage5-life',
      'episode:stage5-rites',
      'episode:stage5-nature',
      'episode:stage5-crafts',
    ]);
    expect(cellsOverCapacity(episodesAll)).toEqual([]);
  });
});

describe('previewEpisodesFor', () => {
  const handWritten = handWrittenEpisodes;

  it('generates a preview for every unclaimed cell beyond Stage 1, and only those', () => {
    const previews = previewEpisodesFor(handWritten);
    const claimed = new Set(gridEpisodes(handWritten).map(cellKey));
    expect(previews).toHaveLength(ALL_CELLS.length - claimed.size);
    for (const p of previews) {
      expect(p.status).toBe('preview');
      expect(p.stage).not.toBe('stage1');
      expect(claimed.has(cellKey(p))).toBe(false);
      expect(p.id).toBe(`episode:${p.stage}-${p.theme}`);
    }
  });

  it('drops the preview of a cell once a hand-written episode claims it, with no exclusion list to edit', () => {
    const stage3Crafts = episode('episode:stage3-crafts-new', { stage: 'stage3', theme: 'crafts', order: 5 });
    const before = previewEpisodesFor(handWritten).map((e) => e.id);
    const after = previewEpisodesFor([...handWritten, stage3Crafts]).map((e) => e.id);
    expect(before).toContain('episode:stage3-crafts');
    expect(after).not.toContain('episode:stage3-crafts');
    expect(after).toEqual(before.filter((id) => id !== 'episode:stage3-crafts'));
  });

  it('ignores shelf episodes when deciding which cells are claimed', () => {
    const shelfAtStage3 = episode('episode:shelf-x', { stage: 'stage3', theme: 'crafts', placement: 'shelf' });
    expect(previewEpisodesFor([...handWritten, shelfAtStage3]).map((e) => e.id)).toContain('episode:stage3-crafts');
  });
});

describe('episodesFor', () => {
  // Schema-valid fixtures: a grid episode's order is its theme's order (rites = 3),
  // so within a cell volume decides and equal volumes keep list order.
  const v1 = episode('episode:book', { stage: 'stage5', theme: 'rites', order: 3 });
  const v2 = episode('episode:book-v2', { stage: 'stage5', theme: 'rites', volume: 2, order: 3 });
  const v3 = episode('episode:book-v3', { stage: 'stage5', theme: 'rites', volume: 3, order: 3 });
  const twinA = episode('episode:twin-a', { stage: 'stage5', theme: 'rites', volume: 1, order: 3 });
  const shelfHere = episode('episode:shelf-y', { stage: 'stage5', theme: 'rites', placement: 'shelf', format: 'story', order: 101 });

  it('uses fixtures the episode schema accepts', () => {
    for (const e of [v1, v2, v3, twinA]) expect(EpisodeSchema.safeParse(e).success, e.id).toBe(true);
  });

  it('returns the grid episodes of a cell sorted by volume (absent = 1)', () => {
    expect(episodesFor('stage5', 'rites', [v3, shelfHere, v2, v1]).map((e) => e.id)).toEqual([
      'episode:book',
      'episode:book-v2',
      'episode:book-v3',
    ]);
    expect(episodeFor('stage5', 'rites', [v3, shelfHere, v2, v1])?.id).toBe('episode:book');
  });

  it('keeps list order for two episodes of the same volume (stable sort)', () => {
    expect(episodesFor('stage5', 'rites', [twinA, v2, v1]).map((e) => e.id)).toEqual([
      'episode:twin-a',
      'episode:book',
      'episode:book-v2',
    ]);
    expect(episodesFor('stage5', 'rites', [v1, v2, twinA]).map((e) => e.id)).toEqual([
      'episode:book',
      'episode:twin-a',
      'episode:book-v2',
    ]);
  });

  it('never returns a shelf episode and is empty for a cell with none', () => {
    expect(episodesFor('stage1', 'letters', [shelf])).toEqual([]);
    expect(episodesFor('stage7', 'crafts', MIXED)).toEqual([]);
  });

  it('agrees with episodeFor on every cell of the bundle', () => {
    for (const key of ALL_CELLS) {
      const [stage, theme] = key.split(':') as [string, string];
      expect(episodeFor(stage, theme)).toBe(episodesFor(stage, theme)[0]);
    }
  });
});

/**
 * Golden: the grid the learner sees is unchanged by PR 5.2. The eight shipped
 * episodes keep their ids, order, quest ids and status (appending a quest would
 * un-complete an episode for existing learners), and every cell keeps its id.
 */
describe('grid golden (F-STORY-005 §3.1 rule 2)', () => {
  it('keeps the eight shipped lessons frozen, then the shipped Stage 5 books', () => {
    const shipped = gridEpisodes(episodesAll)
      .filter((e) => e.status === 'shipped')
      .map((e) => ({ id: e.id, order: e.order, questIds: e.questIds, status: e.status }));
    expect(shipped).toEqual([
      { id: 'episode:stage1-letters', order: 1, questIds: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'], status: 'shipped' },
      // F-QUEST-002 Q-6b appends life q3 on purpose (section 3.6 "Re-scope migration": the episode card is the point).
      { id: 'episode:stage1-life', order: 2, questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3'], status: 'shipped' },
      // F-QUEST-002 Q-7b appends rites q2-q3 on purpose (the same re-scope migration).
      { id: 'episode:stage1-rites', order: 3, questIds: ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3'], status: 'shipped' },
      // F-QUEST-002 Q-8 appends nature q2-q3 and crafts q2-q3 on purpose (the same re-scope migration).
      { id: 'episode:stage1-nature', order: 4, questIds: ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3'], status: 'shipped' },
      { id: 'episode:stage1-crafts', order: 5, questIds: ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3'], status: 'shipped' },
      { id: 'episode:stage2-life', order: 2, questIds: ['quest:stage2-life-q1'], status: 'shipped' },
      { id: 'episode:stage2-nature', order: 4, questIds: ['quest:stage2-nature-q1'], status: 'shipped' },
      { id: 'episode:stage4-rites', order: 3, questIds: ['quest:stage4-rites-q1'], status: 'shipped' },
      // F-CURR-001 S2-3: Playground Words (generated, after the hand-written lessons, in stage order).
      { id: 'episode:stage2-crafts', order: 5, questIds: ['quest:stage2-crafts-q1', 'quest:stage2-crafts-q2', 'quest:stage2-crafts-q3'], status: 'shipped' },
      // F-CURR-001 S3-1: First Sentences (generated, after the hand-written lessons, in stage order).
      {
        id: 'episode:stage3-letters',
        order: 1,
        questIds: ['quest:stage3-letters-q1', 'quest:stage3-letters-q2', 'quest:stage3-letters-q3'],
        status: 'shipped',
      },
      // F-CURR-001 S4-1: the first upper-stage lesson cell (generated, after the hand-written lessons).
      {
        id: 'episode:stage4-letters',
        order: 1,
        questIds: ['quest:stage4-letters-q1', 'quest:stage4-letters-q2', 'quest:stage4-letters-q3'],
        status: 'shipped',
      },
      // F-CURR-001 S6-2: Order Food (generated, after Read Along).
      {
        id: 'episode:stage6-life',
        order: 2,
        questIds: ['quest:stage6-life-q1', 'quest:stage6-life-q2', 'quest:stage6-life-q3'],
        status: 'shipped',
      },
      // F-STORY-005 PR 5.6: the five Stage 5 books (books.ts), each cell's placeholder id kept.
      {
        id: 'episode:stage5-letters',
        order: 1,
        questIds: ['quest:story-sejong-new-letters-read', 'quest:story-shapes-of-hangeul-read', 'quest:story-hangeul-day-read'],
        status: 'shipped',
      },
      {
        id: 'episode:stage5-life',
        order: 2,
        questIds: ['quest:story-gimjang-arirang-read', 'quest:story-kim-hongdo-genre-paintings-read', 'quest:story-donguibogam-read'],
        status: 'shipped',
      },
      {
        id: 'episode:stage5-rites',
        order: 3,
        questIds: ['quest:story-seollal-new-year-read', 'quest:story-dano-ssireum-read', 'quest:story-chuseok-ganggangsullae-read'],
        status: 'shipped',
      },
      {
        id: 'episode:stage5-nature',
        order: 4,
        questIds: ['quest:story-sun-and-moon-read', 'quest:story-angbuilgu-sundial-read'],
        status: 'shipped',
      },
      {
        id: 'episode:stage5-crafts',
        order: 5,
        questIds: ['quest:story-cheugugi-rain-gauge-read', 'quest:story-jagyeongnu-water-clock-read', 'quest:story-pansori-tales-read'],
        status: 'shipped',
      },
    ]);
  });

  it('keeps the id, title and status of every cell', () => {
    const grid = Object.fromEntries(
      ALL_CELLS.map((key) => {
        const [stage, theme] = key.split(':') as [string, string];
        const e = episodeFor(stage, theme);
        return [key, `${e?.id} | ${e?.titleEn} | ${e?.status}`];
      }),
    );
    expect(grid).toEqual(GRID_GOLDEN);
  });
});

/**
 * F-STORY-005 §3.2: the shipped lessons carry blueprint 04 pillar tags (metadata,
 * never shown to learners). Every tag exists in `PILLAR_TAGS`; the two lessons
 * no sub-theme fits stay `[]` on purpose (see `episodes.ts`).
 */
describe('pillar tags of the shipped lessons (F-STORY-005 §3.2)', () => {
  it('freezes the tag of each hand-written lesson', () => {
    expect(Object.fromEntries(handWrittenEpisodes.map((e) => [e.id, e.pillarTags]))).toEqual({
      'episode:stage1-letters': ['A1'],
      'episode:stage1-life': ['B5'],
      'episode:stage1-rites': ['B5'],
      'episode:stage1-nature': ['D2'],
      'episode:stage1-crafts': ['E1'],
      'episode:stage2-life': [],
      'episode:stage2-nature': ['D2'],
      'episode:stage4-rites': [],
      // F-CURR-001 S2-3 (generated from content/episodes/stage-2/crafts.json).
      'episode:stage2-crafts': ['B5'],
      // F-CURR-001 S3-1 (generated from content/episodes/stage-3/letters.json).
      'episode:stage3-letters': ['A1'],
      // F-CURR-001 S4-1 (generated from content/episodes/stage-4/letters.json).
      'episode:stage4-letters': ['A1'],
      // F-CURR-001 S6-2 (generated from content/episodes/stage-6/life.json).
      'episode:stage6-life': ['B2'],
      'episode:stage5-letters': ['A1'],
      'episode:stage5-life': ['B1', 'B5', 'E4'],
      'episode:stage5-rites': ['B5'],
      'episode:stage5-nature': ['D5', 'E5'],
      'episode:stage5-crafts': ['E3', 'C3'],
    });
  });

  it('uses only registered tags, and every hand-written episode passes the episode schema', () => {
    for (const e of handWrittenEpisodes) {
      for (const tag of e.pillarTags ?? []) expect(isPillarTag(tag), `${e.id} ${tag}`).toBe(true);
      expect(EpisodeSchema.safeParse(e).success, e.id).toBe(true);
    }
  });
});

const GRID_GOLDEN: Record<string, string> = {
  'stage1:letters': 'episode:stage1-letters | Meet the Letters | shipped',
  'stage1:life': 'episode:stage1-life | Around the Korean Table | shipped',
  'stage1:rites': 'episode:stage1-rites | New Year & Festivals | shipped',
  'stage1:nature': 'episode:stage1-nature | Tigers, Mountains, Moon | shipped',
  'stage1:crafts': 'episode:stage1-crafts | Yut, Kites & Paper | shipped',
  'stage2:letters': 'episode:stage2-letters | Word Builder | preview',
  'stage2:life': 'episode:stage2-life | Lunch Box Words | shipped',
  'stage2:rites': 'episode:stage2-rites | Holiday Words | preview',
  'stage2:nature': 'episode:stage2-nature | Outdoor Words | shipped',
  'stage2:crafts': 'episode:stage2-crafts | Playground Words | shipped',
  'stage3:letters': 'episode:stage3-letters | First Sentences | shipped',
  'stage3:life': 'episode:stage3-life | Daily Mini-Sentences | preview',
  'stage3:rites': 'episode:stage3-rites | Festival Sentences | preview',
  'stage3:nature': 'episode:stage3-nature | Animal Sentences | preview',
  'stage3:crafts': 'episode:stage3-crafts | Game Sentences | preview',
  'stage4:letters': 'episode:stage4-letters | Read Along | shipped',
  'stage4:life': 'episode:stage4-life | Kitchen Talk | preview',
  'stage4:rites': 'episode:stage4-rites | Greeting Dialogues | shipped',
  'stage4:nature': 'episode:stage4-nature | Park Conversations | preview',
  'stage4:crafts': 'episode:stage4-crafts | Playdate Talk | preview',
  'stage5:letters': 'episode:stage5-letters | Stories of Letters | shipped',
  'stage5:life': 'episode:stage5-life | Family Stories | shipped',
  'stage5:rites': 'episode:stage5-rites | Festival Tales | shipped',
  'stage5:nature': 'episode:stage5-nature | Tiger Folktales | shipped',
  'stage5:crafts': 'episode:stage5-crafts | Craft Stories | shipped',
  'stage6:letters': 'episode:stage6-letters | Read the Menu | preview',
  'stage6:life': 'episode:stage6-life | Order Food | shipped',
  'stage6:rites': 'episode:stage6-rites | Travel for Chuseok | preview',
  'stage6:nature': 'episode:stage6-nature | Hike & Ask | preview',
  'stage6:crafts': 'episode:stage6-crafts | Buy at Market | preview',
  'stage7:letters': 'episode:stage7-letters | Write Your Name | preview',
  'stage7:life': 'episode:stage7-life | My Day in Korean | preview',
  'stage7:rites': 'episode:stage7-rites | My Holiday Memory | preview',
  'stage7:nature': 'episode:stage7-nature | My Favorite Animal | preview',
  'stage7:crafts': 'episode:stage7-crafts | Make & Share | preview',
};
