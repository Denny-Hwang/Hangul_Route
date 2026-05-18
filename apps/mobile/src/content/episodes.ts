import type { Episode } from '@hangul-route/content-schema';
import { stages, themes } from './stages';

/**
 * Episodes: 7 stages × 5 themes = 35 cells.
 * Stage 1 episodes are fully populated. Stages 2–7 are `preview` placeholders
 * so the grid is fully navigable and shows what's coming.
 */

const stage1Episodes: Episode[] = [
  {
    id: 'episode:stage1-letters',
    stage: 'stage1',
    theme: 'letters',
    order: 1,
    titleEn: 'Meet the Letters',
    subtitleEn: 'The first 14 consonants come alive.',
    hoyaIntroEn: 'Hi! I am Hoya. Want to meet my favorite Korean letters?',
    questIds: [
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
    ],
    rewardCardIds: ['card:book', 'card:hanji', 'card:brush', 'card:ink', 'card:origami'],
    estimatedMinutes: 12,
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
    questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2'],
    rewardCardIds: ['card:kimchi', 'card:rice', 'card:chopsticks', 'card:hanbok', 'card:kimbap', 'card:family-table'],
    estimatedMinutes: 10,
    status: 'shipped',
  },
  {
    id: 'episode:stage1-rites',
    stage: 'stage1',
    theme: 'rites',
    order: 3,
    titleEn: 'New Year & Festivals',
    subtitleEn: 'Bow, eat tteokguk, grow one year older.',
    hoyaIntroEn: 'It is Seollal! Time to bow and eat tteokguk.',
    questIds: ['quest:stage1-rites-q1'],
    rewardCardIds: ['card:seollal', 'card:chuseok', 'card:tteokguk', 'card:songpyeon', 'card:sebae'],
    estimatedMinutes: 8,
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
    questIds: ['quest:stage1-nature-q1'],
    rewardCardIds: ['card:magpie', 'card:mugunghwa', 'card:mountain', 'card:sea', 'card:moon'],
    estimatedMinutes: 9,
    status: 'shipped',
  },
  {
    id: 'episode:stage1-crafts',
    stage: 'stage1',
    theme: 'crafts',
    order: 5,
    titleEn: 'Yut, Kites & Paper',
    subtitleEn: 'Korean games and crafts to try.',
    hoyaIntroEn: 'Let us play yutnori. Throw the sticks!',
    questIds: ['quest:stage1-crafts-q1'],
    rewardCardIds: ['card:yutnori', 'card:jegi', 'card:kite', 'card:top', 'card:pottery'],
    estimatedMinutes: 10,
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
    letters: 'Reading Aloud',
    life: 'Kitchen Talk',
    rites: 'Greeting Dialogues',
    nature: 'Park Conversations',
    crafts: 'Playdate Talk',
  },
  stage5: {
    letters: 'Short Stories',
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

const previewEpisodes: Episode[] = stages
  .filter((s) => s.key !== 'stage1')
  .flatMap((s) =>
    themes.map((t, i) => makePreviewEpisode(s.key, t.key, i + 1, upperStageTitles[s.key]?.[t.key] ?? 'Coming soon')),
  );

export const episodesAll: Episode[] = [...stage1Episodes, ...previewEpisodes];

export function episodeById(id: string): Episode | undefined {
  return episodesAll.find((e) => e.id === id);
}

export function episodeFor(stage: string, theme: string): Episode | undefined {
  return episodesAll.find((e) => e.stage === stage && e.theme === theme);
}
