import type { StageKey, ThemeKey } from '../schemas/heritage-card';
import type { Catalog, CatalogCell, CatalogQuest, CatalogStory, CatalogTopic } from './schema';

/**
 * The shipped catalogue data (F-PLAN-002 appendix A). Hand-kept and guarded by
 * `apps/mobile/src/content/__tests__/catalog-parity.test.ts`, which fails with the
 * corrected row when the bundle and this file drift apart. Bump `CATALOG_VERSION`
 * on every content change that alters what a generated route can contain.
 *
 * Since F-QUEST-002 Q-8 this file lists the 15 Stage 1 quests the bundle ships: Q-6a
 * filled `teaches` for letters q1-q3, Q-6b for life q1-q3 (adding life q3), Q-7b for
 * rites q1-q3 (adding rites q2-q3) and Q-8 for nature q1 (adding nature and crafts q2-q3).
 * A story is a `draft` until its language and culture review sign it and the bundle
 * holds its `shelf` block; flipping a story to `ready` is that review's change.
 * Version 6 (F-STORY-001 PR 1.9): all 24 stories are `ready`.
 * Version 7 (F-STORY-005 PR 5.6): the Stage 5 rites book ships with three read quests.
 * Version 8 (F-STORY-005 PR 5.6): the letters, life, nature and crafts books ship (eleven more read quests).
 * From version 9 on (F-CURR-001 §3.13), a bump that adds quests lists them under the new version in
 * `CATALOG_QUEST_ADDITIONS` (`versions.ts`), so a placement result stored earlier skips them by its level.
 * Version 9 (F-CURR-001 S4-1): the Stage 4 Read Along cell ships (three lesson quests).
 * Version 10 (F-CURR-001 S3-1): the Stage 3 First Sentences cell ships (three lesson quests).
 * Version 11 (F-CURR-001 S2-3): Playground Words ships (Stage 2 crafts, three lesson quests).
 * Version 12 (F-CURR-001 S3-3): the Stage 3 Festival Sentences cell ships (three lesson quests).
 * Version 13 (F-CURR-001 S3-5): Game Sentences ships (Stage 3 crafts, 3 lesson quests).
 * Version 14 (F-CURR-001 S3-2): Daily Mini-Sentences ships (Stage 3 life, 3 lesson quests).
 * Version 15 (F-CURR-001 T-2): Greeting Dialogues adopts Discover and Check and grows to three quests.
 * Version 16 (F-CURR-001 S2-1): Stage 2 Word Builder ships with six quests that teach the rest of Hangul.
 * Version 17 (F-CURR-001 S2-2): Holiday Words ships (Stage 2 rites, 3 lesson quests).
 * Version 18 (F-CURR-001 S4-2): Kitchen Talk ships (Stage 4 life, 3 lesson quests).
 * Version 19 (F-CURR-001 S4-3): Park Conversations ships (Stage 4 nature, 3 lesson quests).
 * Version 20 (F-CURR-001 S4-4): Playdate Talk ships (Stage 4 crafts, 3 lesson quests).
 * Version 21 (F-CURR-001 S6-1): the Stage 6 Read the Menu cell ships (three lesson quests).
 * Version 22 (F-CURR-001 S6-2): Order Food ships (Stage 6 life, 3 lesson quests).
 * Version 23 (F-CURR-001 S6-3): Travel for Chuseok ships (Stage 6 rites, 3 lesson quests).
 * Version 24 (F-CURR-001 S6-4): Hike & Ask ships (Stage 6 nature, 3 lesson quests).
 * Version 25 (F-CURR-001 S6-5): Buy at Market ships (Stage 6 crafts, 3 lesson quests); Stage 6 opens.
 */
export const CATALOG_VERSION = 25;

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
  cell('stage1', 'nature', 'Tigers, Mountains, Moon', 'shipped', 12, ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']),
  cell('stage1', 'crafts', 'Yut, Kites & Paper', 'shipped', 12, ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3']),
  cell('stage2', 'letters', 'Word Builder', 'shipped', 25, ['quest:stage2-letters-q1', 'quest:stage2-letters-q2', 'quest:stage2-letters-q3', 'quest:stage2-letters-q4', 'quest:stage2-letters-q5', 'quest:stage2-letters-q6']),
  cell('stage2', 'life', 'Lunch Box Words', 'shipped', 6, ['quest:stage2-life-q1']),
  cell('stage2', 'rites', 'Holiday Words', 'shipped', 13, ['quest:stage2-rites-q1', 'quest:stage2-rites-q2', 'quest:stage2-rites-q3']),
  cell('stage2', 'nature', 'Outdoor Words', 'shipped', 6, ['quest:stage2-nature-q1']),
  cell('stage2', 'crafts', 'Playground Words', 'shipped', 12, ['quest:stage2-crafts-q1', 'quest:stage2-crafts-q2', 'quest:stage2-crafts-q3']),
  cell('stage3', 'letters', 'First Sentences', 'shipped', 14, ['quest:stage3-letters-q1', 'quest:stage3-letters-q2', 'quest:stage3-letters-q3']),
  cell('stage3', 'life', 'Daily Mini-Sentences', 'shipped', 14, ['quest:stage3-life-q1', 'quest:stage3-life-q2', 'quest:stage3-life-q3']),
  cell('stage3', 'rites', 'Festival Sentences', 'shipped', 14, ['quest:stage3-rites-q1', 'quest:stage3-rites-q2', 'quest:stage3-rites-q3']),
  soon('stage3', 'nature', 'Animal Sentences'),
  cell('stage3', 'crafts', 'Game Sentences', 'shipped', 14, ['quest:stage3-crafts-q1', 'quest:stage3-crafts-q2', 'quest:stage3-crafts-q3']),
  cell('stage4', 'letters', 'Read Along', 'shipped', 13, ['quest:stage4-letters-q1', 'quest:stage4-letters-q2', 'quest:stage4-letters-q3']),
  cell('stage4', 'life', 'Kitchen Talk', 'shipped', 13, ['quest:stage4-life-q1', 'quest:stage4-life-q2', 'quest:stage4-life-q3']),
  cell('stage4', 'rites', 'Greeting Dialogues', 'shipped', 13, ['quest:stage4-rites-q1', 'quest:stage4-rites-q2', 'quest:stage4-rites-q3']),
  cell('stage4', 'nature', 'Park Conversations', 'shipped', 14, ['quest:stage4-nature-q1', 'quest:stage4-nature-q2', 'quest:stage4-nature-q3']),
  cell('stage4', 'crafts', 'Playdate Talk', 'shipped', 14, ['quest:stage4-crafts-q1', 'quest:stage4-crafts-q2', 'quest:stage4-crafts-q3']),
  cell('stage5', 'letters', 'Stories of Letters', 'shipped', 13, [
    'quest:story-sejong-new-letters-read',
    'quest:story-shapes-of-hangeul-read',
    'quest:story-hangeul-day-read',
  ]),
  cell('stage5', 'life', 'Family Stories', 'shipped', 15, [
    'quest:story-gimjang-arirang-read',
    'quest:story-kim-hongdo-genre-paintings-read',
    'quest:story-donguibogam-read',
  ]),
  cell('stage5', 'rites', 'Festival Tales', 'shipped', 14, [
    'quest:story-seollal-new-year-read',
    'quest:story-dano-ssireum-read',
    'quest:story-chuseok-ganggangsullae-read',
  ]),
  cell('stage5', 'nature', 'Tiger Folktales', 'shipped', 9, ['quest:story-sun-and-moon-read', 'quest:story-angbuilgu-sundial-read']),
  cell('stage5', 'crafts', 'Craft Stories', 'shipped', 15, [
    'quest:story-cheugugi-rain-gauge-read',
    'quest:story-jagyeongnu-water-clock-read',
    'quest:story-pansori-tales-read',
  ]),
  cell('stage6', 'letters', 'Read the Menu', 'shipped', 15, ['quest:stage6-letters-q1', 'quest:stage6-letters-q2', 'quest:stage6-letters-q3']),
  cell('stage6', 'life', 'Order Food', 'shipped', 15, ['quest:stage6-life-q1', 'quest:stage6-life-q2', 'quest:stage6-life-q3']),
  cell('stage6', 'rites', 'Travel for Chuseok', 'shipped', 15, ['quest:stage6-rites-q1', 'quest:stage6-rites-q2', 'quest:stage6-rites-q3']),
  cell('stage6', 'nature', 'Hike & Ask', 'shipped', 15, ['quest:stage6-nature-q1', 'quest:stage6-nature-q2', 'quest:stage6-nature-q3']),
  cell('stage6', 'crafts', 'Buy at Market', 'shipped', 15, ['quest:stage6-crafts-q1', 'quest:stage6-crafts-q2', 'quest:stage6-crafts-q3']),
  soon('stage7', 'letters', 'Write Your Name'),
  soon('stage7', 'life', 'My Day in Korean'),
  soon('stage7', 'rites', 'My Holiday Memory'),
  soon('stage7', 'nature', 'My Favorite Animal'),
  soon('stage7', 'crafts', 'Make & Share'),
];

/**
 * `teaches` is what the bundle's Discover steps teach (`questTeaches`, the parity
 * test compares): letters q1-q3 since F-QUEST-002 Q-6a, life q1-q3 since Q-6b, rites
 * q1-q3 since Q-7b, nature q1 since Q-8. Nature q2-q3 and crafts q1-q3 teach nothing new:
 * they read words built from all 30 symbols (F-QUEST-002 rule R5).
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
  lesson('stage1-nature-q1', 'stage1', 'nature', 'Tiger, Magpie, Moon', 4, ['ㅁ/final', 'ㅂ/final']),
  lesson('stage1-nature-q2', 'stage1', 'nature', 'Mountain, River, Sea', 4),
  lesson('stage1-nature-q3', 'stage1', 'nature', 'Moon, Stars and Night', 4),
  lesson('stage1-crafts-q1', 'stage1', 'crafts', 'Yut, Kite, Top', 4),
  lesson('stage1-crafts-q2', 'stage1', 'crafts', 'Paper and Pottery', 4),
  lesson('stage1-crafts-q3', 'stage1', 'crafts', 'Read Hangul!', 4),
  // F-CURR-001 S2-1: Word Builder teaches the rest of Hangul, so `teaches` names its symbols.
  lesson('stage2-letters-q1', 'stage2', 'letters', 'Vowel Pairs ae and e', 4, ['ㅐ', 'ㅔ', 'ㅒ', 'ㅖ']),
  lesson('stage2-letters-q2', 'stage2', 'letters', 'Double Letters', 4, ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ']),
  lesson('stage2-letters-q3', 'stage2', 'letters', 'Joined Vowels wa, wo, wi, ui', 4, ['ㅘ', 'ㅝ', 'ㅟ', 'ㅢ']),
  lesson('stage2-letters-q4', 'stage2', 'letters', 'Joined Vowels oe, wae, we', 4, ['ㅚ', 'ㅙ', 'ㅞ']),
  lesson('stage2-letters-q5', 'stage2', 'letters', 'One Sound for Six Letters', 4, ['ㅅ/final', 'ㅈ/final', 'ㅊ/final', 'ㅌ/final', 'ㄷ/final', 'ㅆ/final']),
  lesson('stage2-letters-q6', 'stage2', 'letters', 'More Letters for k and p', 4, ['ㅋ/final', 'ㄲ/final', 'ㅍ/final']),
  lesson('stage2-life-q1', 'stage2', 'life', 'Lunch Box Words', 5),
  lesson('stage2-rites-q1', 'stage2', 'rites', 'Seollal Words', 4),
  lesson('stage2-rites-q2', 'stage2', 'rites', 'Chuseok Words', 4),
  lesson('stage2-rites-q3', 'stage2', 'rites', 'Holiday Play and Gifts', 4),
  lesson('stage2-nature-q1', 'stage2', 'nature', 'Outdoor Words', 5),
  lesson('stage2-crafts-q1', 'stage2', 'crafts', 'At the Playground', 4),
  lesson('stage2-crafts-q2', 'stage2', 'crafts', 'Traditional Games', 4),
  lesson('stage2-crafts-q3', 'stage2', 'crafts', 'Playing Together', 4),
  lesson('stage4-rites-q1', 'stage4', 'rites', 'Nice to Meet You', 4),
  lesson('stage4-rites-q2', 'stage4', 'rites', 'Long Time No See', 4),
  lesson('stage4-rites-q3', 'stage4', 'rites', 'Happy New Year', 4),
  // F-CURR-001 upper-stage cells: they teach no symbol, so `teaches` is [].
  lesson('stage3-letters-q1', 'stage3', 'letters', 'It Is a Book', 5),
  lesson('stage3-letters-q2', 'stage3', 'letters', 'There Is a Book', 5),
  lesson('stage3-letters-q3', 'stage3', 'letters', 'This Is Hangul', 5),
  lesson('stage3-rites-q1', 'stage3', 'rites', 'Grandma and Grandpa', 5),
  lesson('stage3-rites-q2', 'stage3', 'rites', 'Pretty and Tasty', 5),
  lesson('stage3-rites-q3', 'stage3', 'rites', 'Festival Days', 5),
  lesson('stage4-letters-q1', 'stage4', 'letters', 'What Is This?', 4),
  lesson('stage4-letters-q2', 'stage4', 'letters', 'Where Is It?', 4),
  lesson('stage4-letters-q3', 'stage4', 'letters', 'Thank You, Teacher', 4),
  lesson('stage3-crafts-q1', 'stage3', 'crafts', 'I Want to Play', 5),
  lesson('stage3-crafts-q2', 'stage3', 'crafts', 'Places to Play', 5),
  lesson('stage3-crafts-q3', 'stage3', 'crafts', 'Kick, Spin, Throw', 5),
  lesson('stage3-life-q1', 'stage3', 'life', 'I Eat, I Drink', 5),
  lesson('stage3-life-q2', 'stage3', 'life', 'Tasty and Hot', 5),
  lesson('stage3-life-q3', 'stage3', 'life', 'Go and Come', 5),
  lesson('stage4-life-q1', 'stage4', 'life', 'Have You Eaten?', 4),
  lesson('stage4-life-q2', 'stage4', 'life', 'How Does It Taste?', 5),
  lesson('stage4-life-q3', 'stage4', 'life', 'Not Spicy', 4),
  lesson('stage4-nature-q1', 'stage4', 'nature', 'Sky Watching', 5),
  lesson('stage4-nature-q2', 'stage4', 'nature', 'Rain Later', 5),
  lesson('stage4-nature-q3', 'stage4', 'nature', 'Where To?', 5),
  lesson('stage4-crafts-q1', 'stage4', 'crafts', 'What Shall We Play?', 5),
  lesson('stage4-crafts-q2', 'stage4', 'crafts', 'My Turn, Your Turn', 5),
  lesson('stage4-crafts-q3', 'stage4', 'crafts', 'Shall We Play Together?', 5),
  lesson('stage6-letters-q1', 'stage6', 'letters', 'Dishes on the Menu', 5),
  lesson('stage6-letters-q2', 'stage6', 'letters', 'How Much Is It?', 5),
  lesson('stage6-letters-q3', 'stage6', 'letters', 'Spicy or Not?', 5),
  lesson('stage6-life-q1', 'stage6', 'life', 'Excuse Me!', 5),
  lesson('stage6-life-q2', 'stage6', 'life', 'How Many?', 5),
  lesson('stage6-life-q3', 'stage6', 'life', 'How Much Is It?', 5),
  lesson('stage6-rites-q1', 'stage6', 'rites', 'The Train Ticket', 5),
  lesson('stage6-rites-q2', 'stage6', 'rites', 'Train Times', 5),
  lesson('stage6-rites-q3', 'stage6', 'rites', "Hoya's Trip", 5),
  lesson('stage6-nature-q1', 'stage6', 'nature', 'Trail Signs', 5),
  lesson('stage6-nature-q2', 'stage6', 'nature', 'Which Way?', 5),
  lesson('stage6-nature-q3', 'stage6', 'nature', 'How Long?', 5),
  lesson('stage6-crafts-q1', 'stage6', 'crafts', 'At the Stall', 5),
  lesson('stage6-crafts-q2', 'stage6', 'crafts', 'How Many, How Much?', 5),
  lesson('stage6-crafts-q3', 'stage6', 'crafts', 'A Little Extra', 5),
  // The Stage 5 books (F-STORY-005 PR 5.6): grid quests that play their stories at the read level.
  lesson('story-sejong-new-letters-read', 'stage5', 'letters', "King Sejong's New Letters", 4),
  lesson('story-shapes-of-hangeul-read', 'stage5', 'letters', 'The Secret in the Shapes', 5),
  lesson('story-hangeul-day-read', 'stage5', 'letters', 'Happy Hangul Day!', 4),
  lesson('story-gimjang-arirang-read', 'stage5', 'life', 'Gimjang Day: Sharing Kimchi, Singing Arirang', 5),
  lesson('story-kim-hongdo-genre-paintings-read', 'stage5', 'life', "Kim Hongdo's Pictures of Everyday Life", 5),
  lesson('story-donguibogam-read', 'stage5', 'life', "Heo Jun's Treasured Mirror of Medicine", 5),
  lesson('story-seollal-new-year-read', 'stage5', 'rites', "Hoya's Seollal Morning", 4),
  lesson('story-dano-ssireum-read', 'stage5', 'rites', 'Dano Day: Swings, Masks and Ssireum', 5),
  lesson('story-chuseok-ganggangsullae-read', 'stage5', 'rites', 'Chuseok: Songpyeon and the Full Moon', 5),
  lesson('story-sun-and-moon-read', 'stage5', 'nature', 'The Sun and the Moon (A Traditional Tale)', 5),
  lesson('story-angbuilgu-sundial-read', 'stage5', 'nature', 'The Sky-Facing Pot That Told the Time', 4),
  lesson('story-cheugugi-rain-gauge-read', 'stage5', 'crafts', 'The Bowl That Measured the Rain', 4),
  lesson('story-jagyeongnu-water-clock-read', 'stage5', 'crafts', 'Jang Yeongsil and the Clock That Rang by Itself', 5),
  lesson('story-pansori-tales-read', 'stage5', 'crafts', "Pansori Tales: Heungbu's Swallow and the Clever Rabbit (Traditional Tales)", 6),
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
  // F-PLAN-002 section 3.2: every story file is ready with its shelf block and both review
  // sign-offs since F-STORY-001 PR 1.9 (catalog-parity.test.ts checks the rule per file).
  status: 'ready',
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
