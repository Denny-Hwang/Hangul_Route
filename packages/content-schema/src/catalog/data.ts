import type { StageKey, ThemeKey } from '../schemas/heritage-card';
import type { Catalog, CatalogCell, CatalogQuest, CatalogStory, CatalogTopic } from './schema';

/**
 * The shipped catalogue data (F-PLAN-002 appendix A). Hand-kept and guarded by
 * `apps/mobile/src/content/__tests__/catalog-parity.test.ts`, which fails with the
 * corrected row when the bundle and this file drift apart. Bump `CATALOG_VERSION`
 * on every content change that alters what a generated route can contain.
 *
 * Until F-QUEST-002 lands the 15 Stage 1 quests, this file lists the 11 the bundle
 * ships (8, plus life q3 since Q-6b and rites q2-q3 since Q-7b); Q-6a filled `teaches` for letters q1-q3, Q-6b for life q1-q3 (adding life q3),
 * Q-7b for rites q1-q3 (adding rites q2-q3), and Q-8 grows it to 15 (the parity test shows the rows to add).
 * Every story is a `draft` until a native reviewer signs it and the bundle holds
 * its `shelf` block; flipping a story to `ready` is that reviewer's change.
 */
export const CATALOG_VERSION = 4;

const cell = (
  stage: StageKey,
  theme: ThemeKey,
  title: string,
  status: CatalogCell['status'],
  minutes: number,
  questIds: string[] = [],
): CatalogCell => ({ stage, theme, episodeId: `episode:${stage}-${theme}`, title, status, minutes, questIds });

const lesson = (
  id: string,
  stage: StageKey,
  theme: ThemeKey,
  title: string,
  minutes: number,
  teaches: string[] = [],
): CatalogQuest => ({ id: `quest:${id}`, episodeId: `episode:${stage}-${theme}`, stage, theme, title, minutes, teaches, kind: 'lesson' });

/** A cell that is a placeholder in the bundle (`makePreviewEpisode`: 10 minutes, no quests). */
const soon = (stage: StageKey, theme: ThemeKey, title: string): CatalogCell => cell(stage, theme, title, 'preview', 10);

const cells: CatalogCell[] = [
  cell('stage1', 'letters', 'Meet the Letters', 'shipped', 15, ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']),
  cell('stage1', 'life', 'Around the Korean Table', 'shipped', 12, ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3']),
  cell('stage1', 'rites', 'New Year & Festivals', 'shipped', 14, ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3']),
  cell('stage1', 'nature', 'Tigers, Mountains, Moon', 'shipped', 9, ['quest:stage1-nature-q1']),
  cell('stage1', 'crafts', 'Yut, Kites & Paper', 'shipped', 10, ['quest:stage1-crafts-q1']),
  soon('stage2', 'letters', 'Word Builder'),
  cell('stage2', 'life', 'Lunch Box Words', 'shipped', 6, ['quest:stage2-life-q1']),
  soon('stage2', 'rites', 'Holiday Words'),
  cell('stage2', 'nature', 'Outdoor Words', 'shipped', 6, ['quest:stage2-nature-q1']),
  soon('stage2', 'crafts', 'Playground Words'),
  soon('stage3', 'letters', 'First Sentences'),
  soon('stage3', 'life', 'Daily Mini-Sentences'),
  soon('stage3', 'rites', 'Festival Sentences'),
  soon('stage3', 'nature', 'Animal Sentences'),
  soon('stage3', 'crafts', 'Game Sentences'),
  soon('stage4', 'letters', 'Reading Aloud'),
  soon('stage4', 'life', 'Kitchen Talk'),
  cell('stage4', 'rites', 'Greeting Dialogues', 'shipped', 5, ['quest:stage4-rites-q1']),
  soon('stage4', 'nature', 'Park Conversations'),
  soon('stage4', 'crafts', 'Playdate Talk'),
  soon('stage5', 'letters', 'Short Stories'),
  soon('stage5', 'life', 'Family Stories'),
  soon('stage5', 'rites', 'Festival Tales'),
  soon('stage5', 'nature', 'Tiger Folktales'),
  soon('stage5', 'crafts', 'Craft Stories'),
  soon('stage6', 'letters', 'Read the Menu'),
  soon('stage6', 'life', 'Order Food'),
  soon('stage6', 'rites', 'Travel for Chuseok'),
  soon('stage6', 'nature', 'Hike & Ask'),
  soon('stage6', 'crafts', 'Buy at Market'),
  soon('stage7', 'letters', 'Write Your Name'),
  soon('stage7', 'life', 'My Day in Korean'),
  soon('stage7', 'rites', 'My Holiday Memory'),
  soon('stage7', 'nature', 'My Favorite Animal'),
  soon('stage7', 'crafts', 'Make & Share'),
];

/**
 * `teaches` is what the bundle's Discover steps teach (`questTeaches`, the parity
 * test compares): letters q1-q3 since F-QUEST-002 Q-6a, life q1-q3 since Q-6b, rites
 * q1-q3 since Q-7b; the quests not yet rebuilt teach nothing until Q-8 adds their Discover steps.
 */
const lessonQuests: CatalogQuest[] = [
  lesson('stage1-letters-q1', 'stage1', 'letters', 'Meet a, eo, g, n', 5, ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']),
  lesson('stage1-letters-q2', 'stage1', 'letters', 'Meet o, u, m and the circle', 5, ['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']),
  lesson('stage1-letters-q3', 'stage1', 'letters', 'Meet eu, i, d, r', 5, ['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']),
  lesson('stage1-life-q1', 'stage1', 'life', 'Hello Kimchi & Rice', 4, ['ㅈ', 'ㅊ']),
  lesson('stage1-life-q2', 'stage1', 'life', 'Family at the Table', 4, ['ㅂ', 'ㅅ']),
  lesson('stage1-life-q3', 'stage1', 'life', 'Picnic Snacks', 4, ['ㅋ', 'ㅌ']),
  lesson('stage1-rites-q1', 'stage1', 'rites', 'Bow & Eat Tteokguk', 4, ['ㄴ/final', 'ㄹ/final']),
  lesson('stage1-rites-q2', 'stage1', 'rites', 'Rice Cakes of Chuseok', 5, ['ㅑ', 'ㅕ', 'ㅍ', 'ㅇ/final']),
  lesson('stage1-rites-q3', 'stage1', 'rites', 'Hanbok and the Bow', 5, ['ㅛ', 'ㅠ', 'ㅎ', 'ㄱ/final']),
  lesson('stage1-nature-q1', 'stage1', 'nature', 'Tiger, Magpie, Moon', 5),
  lesson('stage1-crafts-q1', 'stage1', 'crafts', 'Yut, Kite, Top', 5),
  lesson('stage2-life-q1', 'stage2', 'life', 'Lunch Box Words', 5),
  lesson('stage2-nature-q1', 'stage2', 'nature', 'Outdoor Words', 5),
  lesson('stage4-rites-q1', 'stage4', 'rites', 'Greeting Dialogues', 4),
];

type StoryRow = [slug: string, title: string, stage: number, theme: ThemeKey, minutes: number, anchor?: CatalogStory['anchor'], sampler?: true];

/** F-STORY-005 section 3.3, in table order (112 minutes; the six free samplers are flagged). */
const storyRows: StoryRow[] = [
  ['sejong-new-letters', "King Sejong's New Letters", 1, 'letters', 4, null, true],
  ['shapes-of-hangeul', 'The Secret in the Shapes', 1, 'letters', 5],
  ['hangeul-day', 'Happy Hangul Day!', 1, 'letters', 4, 'hangeul-day', true],
  ['tripitaka-koreana', 'Eighty Thousand Woodblocks', 1, 'letters', 5],
  ['sillok-royal-historians', 'Hoya Meets the Royal Historians', 1, 'letters', 4],
  ['kim-hongdo-genre-paintings', "Kim Hongdo's Pictures of Everyday Life", 1, 'life', 5],
  ['seollal-new-year', "Hoya's Seollal Morning", 1, 'rites', 4, 'seollal', true],
  ['chuseok-ganggangsullae', 'Chuseok: Songpyeon and the Full Moon', 1, 'rites', 5, 'chuseok', true],
  ['sun-and-moon', 'The Sun and the Moon (A Traditional Tale)', 1, 'nature', 5, null, true],
  ['cheugugi-rain-gauge', 'The Bowl That Measured the Rain', 1, 'crafts', 4, null, true],
  ['sillok-mountain-archives', 'The Annals Hide in the Mountains', 2, 'letters', 5],
  ['jikji-metal-type', 'Jikji: Printed with Metal Type', 2, 'letters', 5],
  ['gimjang-arirang', 'Gimjang Day: Sharing Kimchi, Singing Arirang', 2, 'life', 5],
  ['dano-ssireum', 'Dano Day: Swings, Masks and Ssireum', 2, 'rites', 5],
  ['angbuilgu-sundial', 'The Sky-Facing Pot That Told the Time', 2, 'nature', 4],
  ['janggyeong-panjeon', 'Guarded by the Wind', 2, 'crafts', 5],
  ['jagyeongnu-water-clock', 'Jang Yeongsil and the Clock That Rang by Itself', 2, 'crafts', 5],
  ['pansori-tales', "Pansori Tales: Heungbu's Swallow and the Clever Rabbit (Traditional Tales)", 2, 'crafts', 6],
  ['seungjeongwon-ilgi-every-day', "The Royal Secretariat's Everyday Diary", 3, 'letters', 5],
  ['nanjung-ilgi', "Admiral Yi's Diary", 3, 'letters', 4],
  ['donguibogam', "Heo Jun's Treasured Mirror of Medicine", 3, 'life', 5],
  ['ilseongnok-daily-reflection', "King Jeongjo's Diary of Daily Reflection", 4, 'letters', 4],
  ['uigwe-royal-birthday', 'A Picture Record of a Royal Birthday', 5, 'rites', 5],
  ['joseon-records-today', 'Old Records, New Discoveries', 6, 'letters', 4],
];

const stories: CatalogStory[] = storyRows.map(([slug, title, stage, theme, minutes, anchor, sampler], index) => ({
  id: `story:${slug}`,
  questId: `quest:story-${slug}-listen`,
  order: index + 1,
  title,
  recommendedStage: stage,
  theme,
  minutes,
  anchor: anchor ?? null,
  sampler: sampler === true,
  status: 'draft',
}));

/** One listen quest per story (F-STORY-004 section 3.1), on the shelf episode of its slug. */
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

/** F-VOC-001 section 3.3: the twelve launch topics, the first four free (D5). */
const topicRows: Array<[key: CatalogTopic['key'], title: string]> = [
  ['food', 'Food'],
  ['animals', 'Animals'],
  ['colors', 'Colors'],
  ['numbers', 'Numbers'],
  ['family', 'Family'],
  ['school', 'School'],
  ['body', 'Body'],
  ['nature', 'Nature'],
  ['travel', 'Travel'],
  ['sports', 'Sports'],
  ['k-culture', 'K-Culture'],
  ['science', 'Science'],
];

const topics: CatalogTopic[] = topicRows.map(([key, title], index) => ({
  id: `topic:${key}`,
  key,
  title,
  order: index + 1,
  free: index < 4,
  minutes: 5,
  questId: null,
}));

export const CATALOG: Catalog = {
  version: CATALOG_VERSION,
  cells,
  quests: [...lessonQuests, ...storyQuests],
  stories,
  topics,
};
