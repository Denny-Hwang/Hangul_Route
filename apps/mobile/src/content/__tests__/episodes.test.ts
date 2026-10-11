import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { bookEpisodes } from '../books';
import {
  MAX_EPISODES_PER_CELL,
  episodeFor,
  episodesAll,
  episodesFor,
  gridEpisodes,
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
const cellKey = (e: Pick<Episode, 'stage' | 'theme'>): string => `${e.stage}:${e.theme}`;

/** Cells of `list` holding more grid episodes than `max` (the invariant the bundle must keep). */
function overfullCells(list: readonly Episode[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const e of gridEpisodes(list)) counts.set(cellKey(e), (counts.get(cellKey(e)) ?? 0) + 1);
  return [...counts].filter(([, n]) => n > max).map(([key]) => key);
}

const ALL_CELLS = stages.flatMap((s) => themes.map((t) => `${s.key}:${t.key}`));

describe('grid capacity (F-STORY-005 §3.5)', () => {
  it('launches with one grid episode per cell', () => {
    expect(MAX_EPISODES_PER_CELL).toBe(1);
  });

  it('fills all 35 cells with exactly one grid episode each', () => {
    expect(ALL_CELLS).toHaveLength(35);
    for (const key of ALL_CELLS) {
      const [stage, theme] = key.split(':') as [string, string];
      expect(episodesFor(stage, theme), key).toHaveLength(1);
    }
    expect(gridEpisodes(episodesAll)).toHaveLength(35);
    expect(overfullCells(episodesAll, MAX_EPISODES_PER_CELL)).toEqual([]);
  });

  it('fails the invariant when a test adds a second grid episode to one cell', () => {
    const extra = episode('episode:stage1-letters-extra', { stage: 'stage1', theme: 'letters' });
    expect(overfullCells([...episodesAll, extra], MAX_EPISODES_PER_CELL)).toEqual(['stage1:letters']);
  });

  it('keeps every episode id unique', () => {
    const ids = episodesAll.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships no book yet: books.ts exports an empty list', () => {
    expect(bookEpisodes).toEqual([]);
  });
});

describe('previewEpisodesFor', () => {
  const handWritten = gridEpisodes(episodesAll).filter((e) => e.status !== 'preview');

  it('generates a preview for every unclaimed cell beyond Stage 1, and only those', () => {
    const previews = previewEpisodesFor(handWritten);
    const claimed = new Set(handWritten.map(cellKey));
    expect(previews).toHaveLength(35 - handWritten.length);
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
  it('returns the grid episodes of a cell sorted by volume, then order', () => {
    const v2 = episode('episode:book-v2', { stage: 'stage5', theme: 'rites', volume: 2, order: 3 });
    const v1 = episode('episode:book', { stage: 'stage5', theme: 'rites', order: 3 });
    const late = episode('episode:book-late', { stage: 'stage5', theme: 'rites', volume: 1, order: 4 });
    const shelfHere = episode('episode:shelf-y', { stage: 'stage5', theme: 'rites', placement: 'shelf' });
    expect(episodesFor('stage5', 'rites', [v2, late, shelfHere, v1]).map((e) => e.id)).toEqual([
      'episode:book',
      'episode:book-late',
      'episode:book-v2',
    ]);
    expect(episodeFor('stage5', 'rites', [v2, late, shelfHere, v1])?.id).toBe('episode:book');
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
 * episodes keep their ids, quest ids and status (appending a quest would
 * un-complete an episode for existing learners), and every cell keeps its id.
 */
describe('grid golden (F-STORY-005 §3.1 rule 2)', () => {
  it('keeps the eight shipped episodes frozen', () => {
    const shipped = gridEpisodes(episodesAll)
      .filter((e) => e.status === 'shipped')
      .map((e) => ({ id: e.id, questIds: e.questIds, status: e.status }));
    expect(shipped).toEqual([
      { id: 'episode:stage1-letters', questIds: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'], status: 'shipped' },
      { id: 'episode:stage1-life', questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2'], status: 'shipped' },
      { id: 'episode:stage1-rites', questIds: ['quest:stage1-rites-q1'], status: 'shipped' },
      { id: 'episode:stage1-nature', questIds: ['quest:stage1-nature-q1'], status: 'shipped' },
      { id: 'episode:stage1-crafts', questIds: ['quest:stage1-crafts-q1'], status: 'shipped' },
      { id: 'episode:stage2-life', questIds: ['quest:stage2-life-q1'], status: 'shipped' },
      { id: 'episode:stage2-nature', questIds: ['quest:stage2-nature-q1'], status: 'shipped' },
      { id: 'episode:stage4-rites', questIds: ['quest:stage4-rites-q1'], status: 'shipped' },
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
  'stage2:crafts': 'episode:stage2-crafts | Playground Words | preview',
  'stage3:letters': 'episode:stage3-letters | First Sentences | preview',
  'stage3:life': 'episode:stage3-life | Daily Mini-Sentences | preview',
  'stage3:rites': 'episode:stage3-rites | Festival Sentences | preview',
  'stage3:nature': 'episode:stage3-nature | Animal Sentences | preview',
  'stage3:crafts': 'episode:stage3-crafts | Game Sentences | preview',
  'stage4:letters': 'episode:stage4-letters | Reading Aloud | preview',
  'stage4:life': 'episode:stage4-life | Kitchen Talk | preview',
  'stage4:rites': 'episode:stage4-rites | Greeting Dialogues | shipped',
  'stage4:nature': 'episode:stage4-nature | Park Conversations | preview',
  'stage4:crafts': 'episode:stage4-crafts | Playdate Talk | preview',
  'stage5:letters': 'episode:stage5-letters | Short Stories | preview',
  'stage5:life': 'episode:stage5-life | Family Stories | preview',
  'stage5:rites': 'episode:stage5-rites | Festival Tales | preview',
  'stage5:nature': 'episode:stage5-nature | Tiger Folktales | preview',
  'stage5:crafts': 'episode:stage5-crafts | Craft Stories | preview',
  'stage6:letters': 'episode:stage6-letters | Read the Menu | preview',
  'stage6:life': 'episode:stage6-life | Order Food | preview',
  'stage6:rites': 'episode:stage6-rites | Travel for Chuseok | preview',
  'stage6:nature': 'episode:stage6-nature | Hike & Ask | preview',
  'stage6:crafts': 'episode:stage6-crafts | Buy at Market | preview',
  'stage7:letters': 'episode:stage7-letters | Write Your Name | preview',
  'stage7:life': 'episode:stage7-life | My Day in Korean | preview',
  'stage7:rites': 'episode:stage7-rites | My Holiday Memory | preview',
  'stage7:nature': 'episode:stage7-nature | My Favorite Animal | preview',
  'stage7:crafts': 'episode:stage7-crafts | Make & Share | preview',
};
