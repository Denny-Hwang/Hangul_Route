import type { Catalog, CatalogCell, CatalogQuest, CatalogStory, CatalogTopic } from '../../catalog/schema';
import type { StageKey, ThemeKey } from '../../schemas/heritage-card';

/**
 * FROZEN. The catalogue as F-PLAN-002 section 3.4 specifies it in October 2026:
 * Stage 1 = 15 quests (F-QUEST-002 section 3.6), `stage2-life`, `stage2-nature`
 * and `stage4-rites` shipped, the 27 other cells coming soon, the 24 stories
 * `ready` (assumes the native reviews have passed), 12 topics. The golden tests
 * of the generator run against this file, so they stay true while the real
 * catalogue (`catalog/data.ts`) grows. Never edit it to follow the content;
 * add a new dated fixture instead. It imports types only, never the data.
 * One display rename only (F-STORY-005 row 5.6c, owner decision 2026-10-14): the
 * Stage 5 nature cell reads Nature Tales (was Tiger Folktales); no id or count changed.
 * Such an owner-decided display-only rename is the only edit this contract allows:
 * any id, count, status or minutes change still needs a new dated fixture.
 */

const THEMES: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];

const cell = (
  stage: StageKey,
  theme: ThemeKey,
  title: string,
  status: CatalogCell['status'],
  minutes: number,
  questIds: string[],
): CatalogCell => ({ stage, theme, episodeId: `episode:${stage}-${theme}`, title, status, minutes, questIds });

const lesson = (
  id: string,
  stage: StageKey,
  theme: ThemeKey,
  title: string,
  minutes: number,
  teaches: string[] = [],
): CatalogQuest => ({ id: `quest:${id}`, episodeId: `episode:${stage}-${theme}`, stage, theme, title, minutes, teaches, kind: 'lesson' });

const preview = (stage: StageKey, titles: readonly string[]): CatalogCell[] =>
  THEMES.map((theme, i) => cell(stage, theme, titles[i] as string, 'preview', 10, []));

const stage1Cells: CatalogCell[] = [
  cell('stage1', 'letters', 'Meet the Letters', 'shipped', 15, ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']),
  cell('stage1', 'life', 'Around the Korean Table', 'shipped', 12, ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3']),
  cell('stage1', 'rites', 'New Year & Festivals', 'shipped', 14, ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3']),
  cell('stage1', 'nature', 'Tigers, Mountains, Moon', 'shipped', 12, ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']),
  cell('stage1', 'crafts', 'Yut, Kites & Paper', 'shipped', 12, ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3']),
];

const cells: CatalogCell[] = [
  ...stage1Cells,
  cell('stage2', 'letters', 'Word Builder', 'preview', 10, []),
  cell('stage2', 'life', 'Lunch Box Words', 'shipped', 6, ['quest:stage2-life-q1']),
  cell('stage2', 'rites', 'Holiday Words', 'preview', 10, []),
  cell('stage2', 'nature', 'Outdoor Words', 'shipped', 6, ['quest:stage2-nature-q1']),
  cell('stage2', 'crafts', 'Playground Words', 'preview', 10, []),
  ...preview('stage3', ['First Sentences', 'Daily Mini-Sentences', 'Festival Sentences', 'Animal Sentences', 'Game Sentences']),
  cell('stage4', 'letters', 'Reading Aloud', 'preview', 10, []),
  cell('stage4', 'life', 'Kitchen Talk', 'preview', 10, []),
  cell('stage4', 'rites', 'Greeting Dialogues', 'shipped', 5, ['quest:stage4-rites-q1']),
  cell('stage4', 'nature', 'Park Conversations', 'preview', 10, []),
  cell('stage4', 'crafts', 'Playdate Talk', 'preview', 10, []),
  ...preview('stage5', ['Short Stories', 'Family Stories', 'Festival Tales', 'Nature Tales', 'Craft Stories']),
  ...preview('stage6', ['Read the Menu', 'Order Food', 'Travel for Chuseok', 'Hike & Ask', 'Buy at Market']),
  ...preview('stage7', ['Write Your Name', 'My Day in Korean', 'My Holiday Memory', 'My Favorite Animal', 'Make & Share']),
];

/** F-QUEST-002 section 3.6: titles, minutes and the symbols each quest teaches. */
const lessonQuests: CatalogQuest[] = [
  lesson('stage1-letters-q1', 'stage1', 'letters', 'Meet a, eo, g, n', 5, ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']),
  lesson('stage1-letters-q2', 'stage1', 'letters', 'Meet o, u, m and the circle', 5, ['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']),
  lesson('stage1-letters-q3', 'stage1', 'letters', 'Meet eu, i, d, r', 5, ['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']),
  lesson('stage1-life-q1', 'stage1', 'life', 'Hello Kimchi & Rice', 4, ['ㅈ', 'ㅊ']),
  lesson('stage1-life-q2', 'stage1', 'life', 'Family at the Table', 4, ['ㅂ', 'ㅅ']),
  lesson('stage1-life-q3', 'stage1', 'life', 'Picnic Snacks', 4, ['ㅋ', 'ㅌ']),
  lesson('stage1-rites-q1', 'stage1', 'rites', 'Bow & Eat Tteokguk', 4, ['ㄴ/final', 'ㄹ/final']),
  lesson('stage1-rites-q2', 'stage1', 'rites', 'Rice Cakes of Chuseok', 5, ['ㅍ', 'ㅑ', 'ㅕ', 'ㅇ/final']),
  lesson('stage1-rites-q3', 'stage1', 'rites', 'Hanbok and the Bow', 5, ['ㅎ', 'ㅛ', 'ㅠ', 'ㄱ/final']),
  lesson('stage1-nature-q1', 'stage1', 'nature', 'Tiger, Magpie, Moon', 4, ['ㅁ/final', 'ㅂ/final']),
  lesson('stage1-nature-q2', 'stage1', 'nature', 'Mountain, River, Sea', 4),
  lesson('stage1-nature-q3', 'stage1', 'nature', 'Moon, Stars and Night', 4),
  lesson('stage1-crafts-q1', 'stage1', 'crafts', 'Yut, Kite, Top', 4),
  lesson('stage1-crafts-q2', 'stage1', 'crafts', 'Paper and Pottery', 4),
  lesson('stage1-crafts-q3', 'stage1', 'crafts', 'Read Hangul!', 4),
  lesson('stage2-life-q1', 'stage2', 'life', 'Lunch Box Words', 5),
  lesson('stage2-nature-q1', 'stage2', 'nature', 'Outdoor Words', 5),
  lesson('stage4-rites-q1', 'stage4', 'rites', 'Greeting Dialogues', 4),
];

type StoryRow = [slug: string, title: string, stage: number, theme: ThemeKey, minutes: number, anchor?: CatalogStory['anchor'], sampler?: true];

/** F-STORY-005 section 3.3, in table order. */
const storyRows: StoryRow[] = [
  ['sejong-new-letters', "King Sejong's New Letters", 1, 'letters', 4, null, true],
  ['shapes-of-hangeul', 'The Secret in the Shapes', 1, 'letters', 5],
  ['hangeul-day', 'Happy Hangeul Day!', 1, 'letters', 4, 'hangeul-day', true],
  ['tripitaka-koreana', 'Eighty Thousand Woodblocks', 1, 'letters', 5],
  ['sillok-royal-historians', 'Hoya Meets the Royal Historians', 1, 'letters', 4],
  ['kim-hongdo-genre-paintings', "Kim Hong-do's Pictures of Everyday Life", 1, 'life', 5],
  ['seollal-new-year', "Hoya's Seollal Morning", 1, 'rites', 4, 'seollal', true],
  ['chuseok-ganggangsullae', 'Chuseok: Songpyeon Under the Full Moon', 1, 'rites', 5, 'chuseok', true],
  ['sun-and-moon', 'The Sun and the Moon (A Traditional Tale)', 1, 'nature', 5, null, true],
  ['cheugugi-rain-gauge', 'The Bowl That Measured the Rain', 1, 'crafts', 4, null, true],
  ['sillok-mountain-archives', 'The Annals Hide in the Mountains', 2, 'letters', 5],
  ['jikji-metal-type', 'Jikji: Letters Made of Metal', 2, 'letters', 5],
  ['gimjang-arirang', 'Gimjang Day: Sharing Kimchi, Singing Arirang', 2, 'life', 5],
  ['dano-ssireum', 'Dano Day: Swings, Masks and Ssireum', 2, 'rites', 5],
  ['angbuilgu-sundial', 'The Sky-Facing Pot That Told the Time', 2, 'nature', 4],
  ['janggyeong-panjeon', 'Guarded by the Wind', 2, 'crafts', 5],
  ['jagyeongnu-water-clock', 'Jang Yeong-sil and the Clock That Rang by Itself', 2, 'crafts', 5],
  ['pansori-tales', "Pansori Tales: Heungbu's Swallow and the Clever Rabbit (Traditional Tales)", 2, 'crafts', 6],
  ['seungjeongwon-ilgi-every-day', "The Royal Secretaries' Everyday Diary", 3, 'letters', 5],
  ['nanjung-ilgi', "Admiral Yi's Diary", 3, 'letters', 4],
  ['donguibogam', "Heo Jun's Treasured Mirror of Medicine", 3, 'life', 5],
  ['ilseongnok-daily-reflection', "King Jeongjo's Diary of Daily Reflection", 4, 'letters', 4],
  ['uigwe-royal-birthday', 'A Picture Record of a Royal Birthday', 5, 'rites', 5],
  ['joseon-records-today', 'Old Records, New Discoveries', 6, 'letters', 4],
];

const stories: CatalogStory[] = storyRows.map(([slug, title, stage, theme, minutes, anchor, sampler], i) => ({
  id: `story:${slug}`,
  questId: `quest:story-${slug}-listen`,
  order: i + 1,
  title,
  recommendedStage: stage,
  theme,
  minutes,
  anchor: anchor ?? null,
  sampler: sampler === true,
  status: 'ready',
}));

const storyQuests: CatalogQuest[] = storyRows.map(([slug, title, stage, theme, minutes]) => ({
  id: `quest:story-${slug}-listen`,
  episodeId: `episode:shelf-${slug}`,
  stage: `stage${stage}` as StageKey,
  theme,
  title,
  minutes,
  teaches: [],
  kind: 'story',
}));

const topicRows: Array<[key: CatalogTopic['key'], title: string, free: boolean]> = [
  ['food', 'Food', true],
  ['animals', 'Animals', true],
  ['colors', 'Colors', true],
  ['numbers', 'Numbers', true],
  ['family', 'Family', false],
  ['school', 'School', false],
  ['body', 'Body', false],
  ['nature', 'Nature', false],
  ['travel', 'Travel', false],
  ['sports', 'Sports', false],
  ['k-culture', 'K-Culture', false],
  ['science', 'Science', false],
];

const topics: CatalogTopic[] = topicRows.map(([key, title, free], i) => ({
  id: `topic:${key}`,
  key,
  title,
  order: i + 1,
  free,
  minutes: 5,
  questId: null,
}));

export const CATALOG_2026_10: Catalog = {
  version: 1,
  cells,
  quests: [...lessonQuests, ...storyQuests],
  stories,
  topics,
};
