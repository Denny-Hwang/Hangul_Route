import type { StageKey, ThemeKey } from '../schemas/heritage-card';
import { assembleCatalog, expandCellRows, type StoryShelfEntry } from './assemble';
import { GENERATED_CATALOG_VERSION, GENERATED_LESSON_CELL_ROWS, GENERATED_STORIES, GENERATED_TOPICS } from './catalog.generated';
import type { Catalog, CatalogCell, CatalogQuest } from './schema';

/**
 * The shipped catalogue data (F-PLAN-002 appendix A). Since F-CURR-002 row CM-6 the rows that
 * content/ defines are generated (`./catalog.generated.ts`, written by scripts/build-lessons.mjs:
 * the upper-stage cells and their quests, the story rows, the vocabulary topics) and this file adds
 * what content/ cannot say: the hand-written Stage 1 cells and quests, the Stage 5 books, and the
 * shelf order and festival anchors of the first 24 stories. A hand-written quest added after version 32
 * is stamped in `./hand-stamps.json` (quest id -> `addedIn`), which the generator folds into the version
 * and the history and scripts/check-added-in.mjs checks like a content file's stamp. `apps/mobile/src/content/__tests__/catalog-parity.test.ts`
 * keeps the result equal to the shipped bundle.
 *
 * `CATALOG_VERSION` is generated too: the largest `addedIn` stamp (YYYYMMDD) a shipped quest carries in
 * its content file, or 32 when none does. The history below, up to 32, keeps its integers, which are all
 * smaller than any date stamp, so the order holds; a new quest is stamped in its own file instead of
 * bumping a shared line (scripts/check-added-in.mjs fails a stamp lower than main's version).
 *
 * The history (hand-kept until version 32):
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
 * Version 26 (F-CURR-001 S3-4): Animal Sentences ships (Stage 3 nature, 3 lesson quests); Stage 3 opens.
 * Version 27 (F-CURR-001 T-1): Lunch Box Words and Outdoor Words adopt Discover and Check and grow to three quests each.
 * Version 28 (F-CURR-001 S7-1): Write Your Name ships (Stage 7 letters, 3 lesson quests); Stage 7 is a taste.
 * Version 29 (F-CURR-001 S7-2): My Day in Korean ships (Stage 7 life, 3 lesson quests).
 * Version 30 (F-CURR-001 S7-3): My Holiday Memory ships (Stage 7 rites, 3 lesson quests).
 * Version 31 (F-CURR-001 S7-4): My Favorite Animal ships (Stage 7 nature, 3 lesson quests).
 * Version 32 (F-CURR-001 S7-5): Make & Share ships (Stage 7 crafts, 3 lesson quests); Stage 7 opens and every grid cell has shipped.
 * F-STORY-005 row 5.6c renames the Stage 5 nature cell to Nature Tales (was Tiger Folktales) with no version bump:
 * a cell title is display text and does not alter what a generated route can contain (same ids, quests and minutes).
 */
export const CATALOG_VERSION: number = GENERATED_CATALOG_VERSION;

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

/** The hand-written cells: Stage 1 (TypeScript quests) and the Stage 5 books (`books.ts`). */
const handCells: CatalogCell[] = [
  cell('stage1', 'letters', 'Meet the Letters', 'shipped', 15, ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']),
  cell('stage1', 'life', 'Around the Korean Table', 'shipped', 12, ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3']),
  cell('stage1', 'rites', 'New Year & Festivals', 'shipped', 14, ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3']),
  cell('stage1', 'nature', 'Tigers, Mountains, Moon', 'shipped', 12, ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']),
  cell('stage1', 'crafts', 'Yut, Kites & Paper', 'shipped', 12, ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3']),
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
  cell('stage5', 'nature', 'Nature Tales', 'shipped', 9, ['quest:story-sun-and-moon-read', 'quest:story-angbuilgu-sundial-read']),
  cell('stage5', 'crafts', 'Craft Stories', 'shipped', 15, [
    'quest:story-cheugugi-rain-gauge-read',
    'quest:story-jagyeongnu-water-clock-read',
    'quest:story-pansori-tales-read',
  ]),
];

/**
 * `teaches` is what the bundle's Discover steps teach (`questTeaches`, the parity
 * test compares): letters q1-q3 since F-QUEST-002 Q-6a, life q1-q3 since Q-6b, rites
 * q1-q3 since Q-7b, nature q1 since Q-8. Nature q2-q3 and crafts q1-q3 teach nothing new:
 * they read words built from all 30 symbols (F-QUEST-002 rule R5).
 */
const handLessonQuests: CatalogQuest[] = [
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

/**
 * The shelf order and festival anchors of the stories that shipped up to version 32 (F-STORY-005
 * section 3.3, table order). Frozen: a story file added later takes the next order after these, in
 * `addedIn` order (slug breaks a tie), with the festival anchor its own `shelf.anchor` names, if any,
 * so its PR edits only its own file. A story listed here states no `shelf.anchor` in its file.
 */
export const STORY_SHELF: readonly StoryShelfEntry[] = [
  ['sejong-new-letters'],
  ['shapes-of-hangeul'],
  ['hangeul-day', 'hangeul-day'],
  ['tripitaka-koreana'],
  ['sillok-royal-historians'],
  ['kim-hongdo-genre-paintings'],
  ['seollal-new-year', 'seollal'],
  ['chuseok-ganggangsullae', 'chuseok'],
  ['sun-and-moon'],
  ['cheugugi-rain-gauge'],
  ['sillok-mountain-archives'],
  ['jikji-metal-type'],
  ['gimjang-arirang'],
  ['dano-ssireum'],
  ['angbuilgu-sundial'],
  ['janggyeong-panjeon'],
  ['jagyeongnu-water-clock'],
  ['pansori-tales'],
  ['seungjeongwon-ilgi-every-day'],
  ['nanjung-ilgi'],
  ['donguibogam'],
  ['ilseongnok-daily-reflection'],
  ['uigwe-royal-birthday'],
  ['joseon-records-today'],
];

const generated = expandCellRows(GENERATED_LESSON_CELL_ROWS);

export const CATALOG: Catalog = assembleCatalog({
  version: CATALOG_VERSION,
  cells: [...handCells, ...generated.cells],
  lessonQuests: [...handLessonQuests, ...generated.quests],
  stories: GENERATED_STORIES,
  storyShelf: STORY_SHELF,
  topics: GENERATED_TOPICS,
  // F-VOC-001 section 3.3: twelve launch topics, the first four free (D5), five minutes each.
  freeTopics: 4,
  topicMinutes: 5,
});
