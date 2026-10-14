import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PILLAR_HOME_THEME,
  StageKeySchema,
  ThemeKeySchema,
  isPillarTag,
  parseStory,
  type Pillar,
  type StageKey,
  type Story,
  type StoryShelf,
  type ThemeKey,
} from '@hangul-route/content-schema';
import { homeCellOf } from '../../logic/story/home-cell';
import { buildStoryIndex, entriesForCell } from '../../logic/story/story-index';
import { shelfEpisode, storyQuest } from '../../logic/story/__tests__/shelf-fixture';
import { cellKey, episodesAll, episodesFor, gridEpisodes } from '../episodes';
import { questsAll } from '../quests';
import { stages, themes } from '../stages';
import { storiesAll } from '../stories';

/**
 * Catalogue placement (F-STORY-005 §3.3, behaviour 9): the placement table of the
 * spec, reproduced from the story files in `content/stories/` and the four final
 * research files, so the table and the data cannot drift. The story files are read
 * from disk (all of them, whatever their `state`), so a story held back as `draft`
 * by a correction still has its row checked here while the bundle drops it.
 *
 * Category, order, sampler and pillar tags are the table's plan: a story file states
 * them in its `shelf` block and `pillarTags` (written at the review step, F-STORY-001
 * PR 1.9). Until a file carries them, the plan is checked for its own totals; once it
 * does, the file must equal its row.
 */

const ROOT = join(__dirname, '../../../../..');
const STORY_DIR = join(ROOT, 'content/stories');
const RESEARCH_DIR = join(STORY_DIR, 'research');

type Cluster = 'hangul-printing' | 'records-joseon' | 'science-art-life' | 'seasons-tales';
const CLUSTERS: readonly Cluster[] = ['hangul-printing', 'records-joseon', 'science-art-life', 'seasons-tales'];

interface PlacementRow {
  slug: string;
  titleEn: string;
  theme: ThemeKey;
  recommendedStage: number;
  minutes: number;
  /** "cell holds": L (a shipped lesson) or – (no lesson). */
  cellHoldsLesson: boolean;
  category: StoryShelf['category'];
  order: number;
  sampler: boolean;
  tags: readonly string[];
  cluster: Cluster;
}

const row = (
  slug: string,
  titleEn: string,
  theme: ThemeKey,
  recommendedStage: number,
  minutes: number,
  holds: 'L' | '-',
  category: StoryShelf['category'],
  order: number,
  sampler: 'S' | '',
  tags: readonly string[],
  cluster: Cluster,
): PlacementRow => ({ slug, titleEn, theme, recommendedStage, minutes, cellHoldsLesson: holds === 'L', category, order, sampler: sampler === 'S', tags, cluster });

/** The table of F-STORY-005 §3.3, row for row. */
const PLACEMENT: readonly PlacementRow[] = [
  row('sejong-new-letters', "King Sejong's New Letters", 'letters', 1, 4, 'L', 'culture', 1, 'S', ['A1'], 'hangul-printing'),
  row('shapes-of-hangeul', 'The Secret in the Shapes', 'letters', 1, 5, 'L', 'culture', 2, '', ['A1'], 'hangul-printing'),
  row('hangeul-day', 'Happy Hangul Day!', 'letters', 1, 4, 'L', 'culture', 3, 'S', ['A1'], 'hangul-printing'),
  row('tripitaka-koreana', 'Eighty Thousand Woodblocks', 'letters', 1, 5, 'L', 'culture', 4, '', ['A2'], 'hangul-printing'),
  row('sillok-royal-historians', 'Hoya Meets the Royal Historians', 'letters', 1, 4, 'L', 'culture', 5, '', ['A3'], 'records-joseon'),
  row('kim-hongdo-genre-paintings', "Kim Hongdo's Pictures of Everyday Life", 'life', 1, 5, 'L', 'culture', 7, '', ['B1'], 'science-art-life'),
  row('seollal-new-year', "Hoya's Seollal Morning", 'rites', 1, 4, 'L', 'story-time', 1, 'S', ['B5'], 'seasons-tales'),
  row('chuseok-ganggangsullae', 'Chuseok: Songpyeon and the Full Moon', 'rites', 1, 5, 'L', 'story-time', 2, 'S', ['B5', 'C4'], 'seasons-tales'),
  row('sun-and-moon', 'The Sun and the Moon (A Traditional Tale)', 'nature', 1, 5, 'L', 'story-time', 3, 'S', ['D5', 'D2'], 'seasons-tales'),
  row('cheugugi-rain-gauge', 'The Bowl That Measured the Rain', 'crafts', 1, 4, 'L', 'culture', 6, 'S', ['E3'], 'science-art-life'),
  // F-CURR-001 S2-1: Word Builder ships into these two stories' home cell.
  row('sillok-mountain-archives', 'The Annals Hide in the Mountains', 'letters', 2, 5, 'L', 'culture', 8, '', ['A3'], 'records-joseon'),
  row('jikji-metal-type', 'Jikji: Printed with Metal Type', 'letters', 2, 5, 'L', 'culture', 9, '', ['A5'], 'hangul-printing'),
  row('gimjang-arirang', 'Gimjang Day: Sharing Kimchi, Singing Arirang', 'life', 2, 5, 'L', 'story-time', 5, '', ['B5', 'C4'], 'seasons-tales'),
  // F-CURR-001 S2-2: Holiday Words ships into this story's home cell.
  row('dano-ssireum', 'Dano Day: Swings, Masks and Ssireum', 'rites', 2, 5, 'L', 'story-time', 4, '', ['B5', 'C4'], 'seasons-tales'),
  row('angbuilgu-sundial', 'The Sky-Facing Pot That Told the Time', 'nature', 2, 4, 'L', 'culture', 11, '', ['E3', 'E5'], 'science-art-life'),
  row('janggyeong-panjeon', 'Guarded by the Wind', 'crafts', 2, 5, 'L', 'culture', 10, '', ['A2', 'D3'], 'hangul-printing'),
  row('jagyeongnu-water-clock', 'Jang Yeongsil and the Clock That Rang by Itself', 'crafts', 2, 5, 'L', 'culture', 12, '', ['E3'], 'science-art-life'),
  row(
    'pansori-tales',
    "Pansori Tales: Heungbu's Swallow and the Clever Rabbit (Traditional Tales)",
    'crafts',
    2,
    6,
    'L',
    'story-time',
    6,
    '',
    ['C3', 'D5'],
    'seasons-tales',
  ),
  // F-CURR-001 S3-1: First Sentences ships into these two stories' home cell.
  row('seungjeongwon-ilgi-every-day', "The Royal Secretariat's Everyday Diary", 'letters', 3, 5, 'L', 'culture', 13, '', ['A4'], 'records-joseon'),
  row('nanjung-ilgi', "Admiral Yi's Diary", 'letters', 3, 4, 'L', 'culture', 14, '', ['A4'], 'science-art-life'),
  // F-CURR-001 S3-2: Daily Mini-Sentences ships into this story's home cell.
  row('donguibogam', "Heo Jun's Treasured Mirror of Medicine", 'life', 3, 5, 'L', 'culture', 15, '', ['E4'], 'science-art-life'),
  // F-CURR-001 S4-1: Read Along ships into this story's home cell.
  row('ilseongnok-daily-reflection', "King Jeongjo's Diary of Daily Reflection", 'letters', 4, 4, 'L', 'culture', 16, '', ['A4'], 'records-joseon'),
  row('uigwe-royal-birthday', 'A Picture Record of a Royal Birthday', 'rites', 5, 5, '-', 'culture', 17, '', ['C2', 'A3'], 'records-joseon'),
  row('joseon-records-today', 'Old Records, New Discoveries', 'letters', 6, 4, '-', 'culture', 18, '', ['A3'], 'records-joseon'),
];

/** The derived matrix of §3.3: L = lesson, a number = stories whose home cell this is. */
const MATRIX: Record<StageKey, Record<ThemeKey, string>> = {
  stage1: { letters: 'L+5', life: 'L+1', rites: 'L+2', nature: 'L+1', crafts: 'L+1' },
  stage2: { letters: 'L+2', life: 'L+1', rites: 'L+1', nature: 'L+1', crafts: 'L+3' },
  stage3: { letters: 'L+2', life: 'L+1', rites: 'L+0', nature: '-', crafts: 'L+0' },
  stage4: { letters: 'L+1', life: '-', rites: 'L+0', nature: '-', crafts: '-' },
  stage5: { letters: '-', life: '-', rites: 'S1', nature: '-', crafts: '-' },
  stage6: { letters: 'S1', life: '-', rites: '-', nature: '-', crafts: '-' },
  stage7: { letters: '-', life: '-', rites: '-', nature: '-', crafts: '-' },
};

/** F-STORY-004 §3.9: the intended free sampler. */
const SAMPLER = ['seollal-new-year', 'hangeul-day', 'chuseok-ganggangsullae', 'sun-and-moon', 'sejong-new-letters', 'cheugugi-rain-gauge'];

const storyFiles: Story[] = readdirSync(STORY_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => parseStory(JSON.parse(readFileSync(join(STORY_DIR, name), 'utf8')) as unknown));

interface ResearchEpisode {
  id: string;
  theme: string;
  recommended_stage: number;
  minutes: number;
}

const researchBySlug = new Map<string, ResearchEpisode & { cluster: Cluster }>();
for (const cluster of CLUSTERS) {
  const file = JSON.parse(readFileSync(join(RESEARCH_DIR, `${cluster}.final.json`), 'utf8')) as {
    episodes: ResearchEpisode[];
  };
  for (const episode of file.episodes) researchBySlug.set(episode.id.replace(/^story-/, ''), { ...episode, cluster });
}

const slugOf = (story: Pick<Story, 'id'>): string => story.id.replace(/^story:/, '');
const fileBySlug = new Map(storyFiles.map((story) => [slugOf(story), story]));
const fileOf = (r: PlacementRow): Story => {
  const story = fileBySlug.get(r.slug);
  if (!story) throw new Error(`no story file for ${r.slug}`);
  return story;
};

/** A cell holds a lesson when a shipped, hand-written grid episode sits there (the shipped rule of logic/journey.ts). */
const lessonCells = new Set(
  gridEpisodes(episodesAll)
    .filter((e) => e.status === 'shipped' && e.format !== 'story')
    .map(cellKey),
);
/** Points a failing grid assertion at the place to update when a lesson ships into a stories-only cell. */
const GRID_HINT = 'when a lesson ships, update the F-STORY-005 §3.3 table, PLACEMENT and MATRIX';
/** Pillar tags a story counts with: the file's own once written (F-STORY-001 PR 1.9), else its plan row. */
const effectiveTags = (r: PlacementRow): readonly string[] => {
  const { pillarTags } = fileOf(r);
  return pillarTags.length > 0 ? pillarTags : r.tags;
};
/** Stories in a cell according to the derived matrix: L+n, Sn or -. */
const matrixCount = (look: string): number => (look === '-' ? 0 : Number(look.replace(/^(L\+|S)/, '')));
const homeKey = (story: Pick<Story, 'recommendedStage' | 'theme'>): string => cellKey(homeCellOf(story));
const pillarOf = (tag: string): Pillar => tag.charAt(0) as Pillar;

describe('placement table (F-STORY-005 §3.3) against the story files', () => {
  it('has a row for every story file and a file for every row, each id once', () => {
    expect(PLACEMENT).toHaveLength(24);
    expect(new Set(PLACEMENT.map((r) => r.slug)).size).toBe(24);
    expect(storyFiles.map(slugOf).sort()).toEqual(PLACEMENT.map((r) => r.slug).sort());
  });

  it('matches every file on title, theme, recommended stage and minutes', () => {
    for (const r of PLACEMENT) {
      const story = fileOf(r);
      expect(
        { titleEn: story.title.en, theme: story.theme, recommendedStage: story.recommendedStage, minutes: story.minutes },
        r.slug,
      ).toEqual({ titleEn: r.titleEn, theme: r.theme, recommendedStage: r.recommendedStage, minutes: r.minutes });
    }
  });

  // Titles are checked against the story files above: the import may edit a research title for the
  // app ("Happy Hangeul Day!" became "Happy Hangul Day!"), and the story file is what learners read.
  it('matches the four final research files on cluster, theme, recommended stage and minutes', () => {
    expect(researchBySlug.size).toBe(24);
    for (const r of PLACEMENT) {
      const research = researchBySlug.get(r.slug);
      expect(research, `${r.slug} is in no research file`).toBeDefined();
      expect(
        {
          cluster: research?.cluster,
          theme: research?.theme,
          recommendedStage: research?.recommended_stage,
          minutes: research?.minutes,
        },
        r.slug,
      ).toEqual({ cluster: r.cluster, theme: r.theme, recommendedStage: r.recommendedStage, minutes: r.minutes });
    }
  });

  it('totals 112 minutes, 22 stories in lesson cells and 2 in cells without a lesson (Read Along S4-1, First Sentences S3-1, Playground Words S2-3, Daily Mini-Sentences S3-2, Word Builder S2-1, Holiday Words S2-2)', () => {
    expect(storyFiles.reduce((sum, story) => sum + story.minutes, 0)).toBe(112);
    const inLessonCells = storyFiles.filter((story) => lessonCells.has(homeKey(story)));
    expect(inLessonCells, GRID_HINT).toHaveLength(22);
    expect(storyFiles.length - inLessonCells.length, GRID_HINT).toBe(2);
  });

  it('gives every row the "cell holds" of the shipped grid', () => {
    for (const r of PLACEMENT) expect(lessonCells.has(homeKey(fileOf(r))), `${r.slug}: ${GRID_HINT}`).toBe(r.cellHoldsLesson);
  });

  it('puts every home cell inside the 7 x 5 grid', () => {
    const grid = new Set(stages.flatMap((s) => themes.map((t) => `${s.key}:${t.key}`)));
    expect(grid.size).toBe(35);
    for (const story of storyFiles) expect(grid.has(homeKey(story)), story.id).toBe(true);
  });

  it('reproduces the derived matrix: 15 of 35 cells show stories, the other 20 stay as they are', () => {
    const storiesIn = new Map<string, number>();
    for (const story of storyFiles) storiesIn.set(homeKey(story), (storiesIn.get(homeKey(story)) ?? 0) + 1);
    expect(storiesIn.size).toBe(15);
    for (const stage of StageKeySchema.options) {
      for (const theme of ThemeKeySchema.options) {
        const key = `${stage}:${theme}`;
        const count = storiesIn.get(key) ?? 0;
        const look = lessonCells.has(key) ? `L+${count}` : count > 0 ? `S${count}` : '-';
        expect(look, `${key}: ${GRID_HINT}`).toBe(MATRIX[stage][theme]);
      }
    }
  });

  it('keeps every shipped lesson the single grid episode of its cell (stories never take a cell)', () => {
    for (const key of lessonCells) {
      const [stage = '', theme = ''] = key.split(':');
      expect(episodesFor(stage, theme).map((e) => e.format ?? 'lesson'), key).toEqual(['lesson']);
    }
  });
});

describe('the shelf plan of §3.3 (category, order, sampler)', () => {
  it('splits 6 Story Time and 18 Culture with unique orders inside each category', () => {
    const storyTime = PLACEMENT.filter((r) => r.category === 'story-time');
    const culture = PLACEMENT.filter((r) => r.category === 'culture');
    expect(storyTime).toHaveLength(6);
    expect(culture).toHaveLength(18);
    expect(storyTime.map((r) => r.order).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(culture.map((r) => r.order).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('flags the 6 sampler stories of F-STORY-004 §3.9, all recommended stage 1 and 4-5 minutes', () => {
    const sampler = PLACEMENT.filter((r) => r.sampler);
    expect(sampler.map((r) => r.slug).sort()).toEqual([...SAMPLER].sort());
    for (const r of sampler) {
      expect(r.recommendedStage, r.slug).toBe(1);
      expect(r.minutes, r.slug).toBeGreaterThanOrEqual(4);
      expect(r.minutes, r.slug).toBeLessThanOrEqual(5);
    }
  });

  it('a story file with a shelf block states the category, order, sampler and minutes of its row', () => {
    for (const r of PLACEMENT) {
      const { shelf } = fileOf(r);
      if (!shelf) continue; // written at the review step (F-STORY-001 PR 1.9)
      expect({ category: shelf.category, order: shelf.order, sampler: shelf.sampler, minutes: shelf.minutes }, r.slug).toEqual({
        category: r.category,
        order: r.order,
        sampler: r.sampler,
        minutes: r.minutes,
      });
    }
  });
});

describe('pillar tags (F-STORY-005 §3.8)', () => {
  it('uses only registered tags, at most 3 per story, no duplicates', () => {
    for (const r of PLACEMENT) {
      expect(r.tags.length, r.slug).toBeGreaterThanOrEqual(1);
      expect(r.tags.length, r.slug).toBeLessThanOrEqual(3);
      expect(new Set(r.tags).size, r.slug).toBe(r.tags.length);
      for (const tag of r.tags) expect(isPillarTag(tag), `${r.slug} ${tag}`).toBe(true);
    }
  });

  it('gives every pillar A-E at least one story (blueprint 04 §2.2 balance)', () => {
    const pillars = new Set(PLACEMENT.flatMap((r) => r.tags.map(pillarOf)));
    expect([...pillars].sort()).toEqual(Object.keys(PILLAR_HOME_THEME).sort());
  });

  it('gives every pillar A-E at least one story over the data: file tags where written, plan tags elsewhere', () => {
    const pillars = new Set(PLACEMENT.flatMap((r) => effectiveTags(r).map(pillarOf)));
    expect([...pillars].sort()).toEqual(Object.keys(PILLAR_HOME_THEME).sort());
  });

  it('a story file with pillar tags states the tags of its row', () => {
    for (const r of PLACEMENT) {
      const { pillarTags } = fileOf(r);
      if (pillarTags.length > 0) expect(pillarTags, r.slug).toEqual(r.tags);
    }
  });

  it('every episode of the bundle carries registered tags only', () => {
    for (const episode of episodesAll) {
      for (const tag of episode.pillarTags ?? []) expect(isPillarTag(tag), `${episode.id} ${tag}`).toBe(true);
    }
  });
});

describe('home cells over the bundle', () => {
  it('bundles every non-draft story file, each equal to its file on the fields placement reads', () => {
    const published = storyFiles.filter((story) => story.state !== 'draft');
    expect(published.length).toBeGreaterThan(0);
    expect(storiesAll.map((story) => story.id).sort()).toEqual(published.map((story) => story.id).sort());
    const placementFields = (story: Story) => ({
      theme: story.theme,
      recommendedStage: story.recommendedStage,
      minutes: story.minutes,
      shelf: story.shelf,
      pillarTags: story.pillarTags,
    });
    for (const story of storiesAll) {
      const file = fileBySlug.get(slugOf(story));
      expect(file, story.id).toBeDefined();
      if (file) expect(placementFields(story), story.id).toEqual(placementFields(file));
    }
  });

  it('entriesForCell over the plan (every story file with its §3.3 shelf row) reproduces the derived matrix in shelf order', () => {
    const planStories = PLACEMENT.map((r): Story => {
      const file = fileOf(r);
      return { ...file, shelf: file.shelf ?? { category: r.category, order: r.order, sampler: r.sampler, minutes: r.minutes } };
    });
    const index = buildStoryIndex({
      stories: planStories,
      episodes: planStories.map((story) => shelfEpisode(story)),
      quests: planStories.map((story) => storyQuest(slugOf(story))),
      showUnreviewed: true,
    });
    expect(index).toHaveLength(24);
    const rank = (r: PlacementRow): number => (r.category === 'story-time' ? 0 : 1);
    for (const stage of StageKeySchema.options) {
      for (const theme of ThemeKeySchema.options) {
        const key = `${stage}:${theme}`;
        const ids = entriesForCell(index, stage, theme).map((e) => e.storyId);
        expect(ids.length, key).toBe(matrixCount(MATRIX[stage][theme]));
        const expected = PLACEMENT.filter((r) => `stage${r.recommendedStage}:${r.theme}` === key)
          .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
          .map((r) => `story:${r.slug}`);
        expect(ids, key).toEqual(expected);
      }
    }
  });

  // Today no bundled story has a shelf block yet (written at F-STORY-001 PR 1.9), so this index is empty
  // and the plan case above carries the matrix. Once a story has one, the bundle must list it too.
  it('entriesForCell over the bundle (gate widened) lists exactly the shelf stories of each home cell', () => {
    const index = buildStoryIndex({ stories: storiesAll, episodes: episodesAll, quests: questsAll, showUnreviewed: true });
    if (storiesAll.some((story) => story.shelf)) expect(index.length).toBeGreaterThan(0);
    for (const stage of StageKeySchema.options) {
      for (const theme of ThemeKeySchema.options) {
        const expected = storiesAll
          .filter((story) => story.shelf && homeKey(story) === `${stage}:${theme}`)
          .map((story) => story.id)
          .sort();
        expect(
          entriesForCell(index, stage, theme)
            .map((e) => e.storyId)
            .sort(),
          `${stage}:${theme}`,
        ).toEqual(expected);
      }
    }
  });
});
