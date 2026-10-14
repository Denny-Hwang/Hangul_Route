import type { Episode } from '@hangul-route/content-schema';
import { bookEpisodes } from './books';
import { lessonEpisodes } from './lessons';
import { stages, themes } from './stages';
import { storyEpisodes } from './stories';

/**
 * Episodes: 7 stages × 5 themes = 35 cells.
 * Stage 1 episodes are fully populated. Stages 2–7 are `preview` placeholders
 * so the grid is fully navigable and shows what's coming.
 *
 * `pillarTags` (F-STORY-005 §3.2, §3.8) are metadata for the catalogue and
 * analytics, never shown to learners. Each tag names the blueprint 04 sub-theme
 * the lesson's content actually belongs to: A1 Hunminjeongeum (the letters), B5
 * festivals and seasonal customs (the family table and the Seollal/Chuseok
 * lesson), D2 mountains and rivers (the nature lessons), E1 hanji and brush
 * (paper, kites and folk play). Two lessons stay `[]` on purpose: `stage2-life`
 * (everyday food words) and `stage4-rites` (greeting dialogues) fit no
 * sub-theme, and a wrong tag is worse than none.
 */

const stage1Episodes: Episode[] = [
  {
    id: 'episode:stage1-letters',
    stage: 'stage1',
    theme: 'letters',
    order: 1,
    titleEn: 'Meet the Letters',
    subtitleEn: 'Twelve letters, and your first real words.',
    hoyaIntroEn: 'Hi! I am Hoya. Want to meet my favorite Korean letters?',
    questIds: [
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
    ],
    rewardCardIds: ['card:book', 'card:hanji', 'card:brush', 'card:ink', 'card:origami'],
    estimatedMinutes: 15,
    pillarTags: ['A1'],
    status: 'shipped',
  },
  {
    id: 'episode:stage1-life',
    stage: 'stage1',
    theme: 'life',
    order: 2,
    titleEn: 'Around the Korean Table',
    subtitleEn: 'Rice, kimchi, and family — said in Korean.',
    hoyaIntroEn: 'Lunchtime! Let me show you what I eat.',
    questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3'],
    rewardCardIds: ['card:kimchi', 'card:rice', 'card:chopsticks', 'card:hanbok', 'card:kimbap', 'card:family-table'],
    estimatedMinutes: 12,
    pillarTags: ['B5'],
    status: 'shipped',
  },
  {
    id: 'episode:stage1-rites',
    stage: 'stage1',
    theme: 'rites',
    order: 3,
    titleEn: 'New Year & Festivals',
    subtitleEn: 'Seollal and Chuseok: bow, eat, and share rice cakes.',
    hoyaIntroEn: 'It is festival time! Bow for Seollal and share rice cakes at Chuseok.',
    questIds: ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3'],
    rewardCardIds: ['card:seollal', 'card:chuseok', 'card:tteokguk', 'card:songpyeon', 'card:sebae'],
    estimatedMinutes: 14,
    pillarTags: ['B5'],
    status: 'shipped',
  },
  {
    id: 'episode:stage1-nature',
    stage: 'stage1',
    theme: 'nature',
    order: 4,
    titleEn: 'Tigers, Mountains, Moon',
    subtitleEn: 'Korea is wild and beautiful.',
    hoyaIntroEn: 'I am a tiger! Want to see where I live?',
    questIds: ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3'],
    rewardCardIds: ['card:magpie', 'card:mugunghwa', 'card:mountain', 'card:sea', 'card:moon'],
    estimatedMinutes: 12,
    pillarTags: ['D2'],
    status: 'shipped',
  },
  {
    id: 'episode:stage1-crafts',
    stage: 'stage1',
    theme: 'crafts',
    order: 5,
    titleEn: 'Yut, Kites & Paper',
    subtitleEn: 'Korean games and crafts to try.',
    hoyaIntroEn: 'Let us play yunnori. Throw the sticks!',
    questIds: ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3'],
    rewardCardIds: ['card:yutnori', 'card:jegi', 'card:kite', 'card:top', 'card:pottery'],
    estimatedMinutes: 12,
    pillarTags: ['E1'],
    status: 'shipped',
  },
];

const stage2Episodes: Episode[] = [
  {
    id: 'episode:stage2-life',
    stage: 'stage2',
    theme: 'life',
    order: 2,
    titleEn: 'Lunch Box Words',
    subtitleEn: 'Read your first Korean food words.',
    hoyaIntroEn: 'You know the letters now — let us read real words!',
    questIds: ['quest:stage2-life-q1'],
    rewardCardIds: ['card:sagwa', 'card:uyu', 'card:ppang', 'card:dosirak'],
    estimatedMinutes: 6,
    pillarTags: [],
    status: 'shipped',
  },
  {
    id: 'episode:stage2-nature',
    stage: 'stage2',
    theme: 'nature',
    order: 4,
    titleEn: 'Outdoor Words',
    subtitleEn: 'Name the sky, flowers, and trees.',
    hoyaIntroEn: 'Come outside with me — let us name the world!',
    questIds: ['quest:stage2-nature-q1'],
    rewardCardIds: ['card:haneul', 'card:kkot', 'card:namu', 'card:byeol'],
    estimatedMinutes: 6,
    pillarTags: ['D2'],
    status: 'shipped',
  },
];

const stage4Episodes: Episode[] = [
  {
    id: 'episode:stage4-rites',
    stage: 'stage4',
    theme: 'rites',
    order: 3,
    titleEn: 'Greeting Dialogues',
    subtitleEn: 'Say hello and meet a new friend.',
    hoyaIntroEn: 'Let us practice saying hello to new friends!',
    questIds: ['quest:stage4-rites-q1'],
    rewardCardIds: ['card:annyeong', 'card:gamsa', 'card:chingu', 'card:insa'],
    estimatedMinutes: 5,
    pillarTags: [],
    status: 'shipped',
  },
];

function makePreviewEpisode(stage: string, theme: string, order: number, titleEn: string): Episode {
  return {
    id: `episode:${stage}-${theme}` as Episode['id'],
    stage: stage as Episode['stage'],
    theme: theme as Episode['theme'],
    order,
    titleEn,
    subtitleEn: 'Coming soon.',
    hoyaIntroEn: 'I am working on this one with my friends!',
    questIds: [],
    rewardCardIds: [],
    estimatedMinutes: 10,
    status: 'preview',
  };
}

const upperStageTitles: Record<string, Record<string, string>> = {
  stage2: {
    letters: 'Word Builder',
    life: 'Lunch Box Words',
    rites: 'Holiday Words',
    nature: 'Outdoor Words',
    crafts: 'Playground Words',
  },
  stage3: {
    letters: 'First Sentences',
    life: 'Daily Mini-Sentences',
    rites: 'Festival Sentences',
    nature: 'Animal Sentences',
    crafts: 'Game Sentences',
  },
  stage4: {
    letters: 'Read Along',
    life: 'Kitchen Talk',
    rites: 'Greeting Dialogues',
    nature: 'Park Conversations',
    crafts: 'Playdate Talk',
  },
  stage5: {
    letters: 'Stories of Letters',
    life: 'Family Stories',
    rites: 'Festival Tales',
    nature: 'Tiger Folktales',
    crafts: 'Craft Stories',
  },
  stage6: {
    letters: 'Read the Menu',
    life: 'Order Food',
    rites: 'Travel for Chuseok',
    nature: 'Hike & Ask',
    crafts: 'Buy at Market',
  },
  stage7: {
    letters: 'Write Your Name',
    life: 'My Day in Korean',
    rites: 'My Holiday Memory',
    nature: 'My Favorite Animal',
    crafts: 'Make & Share',
  },
};

/**
 * Grid capacity (F-STORY-005 §3.1 rule 1, D9): at launch a cell (stage × theme)
 * holds at most one grid episode. Shelf episodes never count. Raising this to 2
 * is the "volumes later" switch (PR 5.8).
 */
export const MAX_EPISODES_PER_CELL = 1;

/** The key of an episode's grid cell (stage × theme); the one definition every cell count uses. */
export const cellKey = (e: Pick<Episode, 'stage' | 'theme'>): string => `${e.stage}:${e.theme}`;

/**
 * Grid episodes that claim their cell: the hand-written lessons, the generated upper-stage
 * lesson cells (F-CURR-001 §3.10, `lessons.ts`) and the Stage 5 books (`books.ts`). A
 * generated cell replaces its "Coming later" preview through `previewEpisodesFor`.
 */
export const handWrittenEpisodes: readonly Episode[] = [...stage1Episodes, ...stage2Episodes, ...stage4Episodes, ...lessonEpisodes, ...bookEpisodes];

/**
 * The cells of `list` holding more grid episodes than `max` (F-STORY-005 §3.1
 * rule 1). The bundle must return `[]`; shelf episodes never count.
 */
export function cellsOverCapacity(list: readonly Episode[], max: number = MAX_EPISODES_PER_CELL): string[] {
  const counts = new Map<string, number>();
  for (const e of gridEpisodes(list)) counts.set(cellKey(e), (counts.get(cellKey(e)) ?? 0) + 1);
  return [...counts].filter(([, n]) => n > max).map(([key]) => key);
}

/**
 * "Coming soon" previews for every cell beyond Stage 1 that no grid episode of
 * `claimers` claims, so a new hand-written episode replaces its preview with no
 * exclusion list to edit (F-STORY-005 §3.5). Ids stay `episode:<stage>-<theme>`.
 */
export function previewEpisodesFor(claimers: readonly Episode[]): Episode[] {
  const claimed = new Set(gridEpisodes(claimers).map(cellKey));
  return stages
    .filter((s) => s.key !== 'stage1')
    .flatMap((s) =>
      themes.map((t, i) => makePreviewEpisode(s.key, t.key, i + 1, upperStageTitles[s.key]?.[t.key] ?? 'Coming soon')),
    )
    .filter((e) => !claimed.has(cellKey(e)));
}

/** `storyEpisodes`: the generated shelf episodes (F-STORY-001 §3.9). */
export const episodesAll: Episode[] = [
  ...handWrittenEpisodes,
  ...storyEpisodes,
  ...previewEpisodesFor(handWrittenEpisodes),
];

export function episodeById(id: string): Episode | undefined {
  return episodesAll.find((e) => e.id === id);
}

/**
 * The grid/shelf split (F-STORY-004 §3.10). A shelf episode (`placement: 'shelf'`)
 * is a one-story episode outside the 7×5 grid; an episode without the field is a
 * grid cell, so every hand-written episode stays on the grid.
 */
export function isGridEpisode(episode: Pick<Episode, 'placement'>): boolean {
  return episode.placement !== 'shelf';
}

/** The grid episodes of `list`, in content order. */
export function gridEpisodes<E extends Pick<Episode, 'placement'>>(list: readonly E[]): E[] {
  return list.filter(isGridEpisode);
}

/** The shelf episodes of `list`, in content order. */
export function shelfEpisodes<E extends Pick<Episode, 'placement'>>(list: readonly E[]): E[] {
  return list.filter((e) => !isGridEpisode(e));
}

/**
 * The grid episodes of the cell at `stage` × `theme`, sorted by volume, then
 * order (F-STORY-005 §3.5). A shelf episode is never in a cell. A grid
 * episode's `order` equals its theme's order, so within a cell volume is the
 * key that decides; equal volumes keep list order (the sort is stable).
 */
export function episodesFor(stage: string, theme: string, list: readonly Episode[] = episodesAll): Episode[] {
  return list
    .filter((e) => isGridEpisode(e) && e.stage === stage && e.theme === theme)
    .sort((a, b) => (a.volume ?? 1) - (b.volume ?? 1) || a.order - b.order);
}

/** The cell's first grid episode; unchanged for every cell that holds one. */
export function episodeFor(stage: string, theme: string, list: readonly Episode[] = episodesAll): Episode | undefined {
  return episodesFor(stage, theme, list)[0];
}
