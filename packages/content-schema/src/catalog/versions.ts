import type { PlacementLevel } from '../schemas/placement';
import { questsPlacedOutAtLevel } from '../placement/level-map';
import type { RouteCatalog } from '../placement/route-seed';
import { CATALOG_VERSION } from './data';

/**
 * The catalogue-growth rule (F-CURR-001 §3.13, row C-2). A stored placement
 * result (and a plan made from it) carries the exact placed-out set fixed when
 * it was stored. When a later catalogue ships quests that the stored level would
 * have placed out, the set is widened with them, so a learner placed at `stage3`
 * before Word Builder shipped does not find Word Builder q1 as their next quest.
 * Only quests that were **not in the catalogue** when the set was stored are
 * added: a quest a grown-up override put back existed then, so it stays put back;
 * a completed quest is never added.
 */

/** A result or plan with no `catalogVersion` was stored at this version, the one in force before the rule. */
export const LEGACY_CATALOG_VERSION = 8;

/** Every quest id of the catalogue at version 8 (lessons and stories), frozen. */
export const CATALOG_QUEST_IDS_V8: readonly string[] = Object.freeze([
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
  'quest:story-sejong-new-letters-listen',
  'quest:story-shapes-of-hangeul-listen',
  'quest:story-hangeul-day-listen',
  'quest:story-tripitaka-koreana-listen',
  'quest:story-sillok-royal-historians-listen',
  'quest:story-kim-hongdo-genre-paintings-listen',
  'quest:story-seollal-new-year-listen',
  'quest:story-chuseok-ganggangsullae-listen',
  'quest:story-sun-and-moon-listen',
  'quest:story-cheugugi-rain-gauge-listen',
  'quest:story-sillok-mountain-archives-listen',
  'quest:story-jikji-metal-type-listen',
  'quest:story-gimjang-arirang-listen',
  'quest:story-dano-ssireum-listen',
  'quest:story-angbuilgu-sundial-listen',
  'quest:story-janggyeong-panjeon-listen',
  'quest:story-jagyeongnu-water-clock-listen',
  'quest:story-pansori-tales-listen',
  'quest:story-seungjeongwon-ilgi-every-day-listen',
  'quest:story-nanjung-ilgi-listen',
  'quest:story-donguibogam-listen',
  'quest:story-ilseongnok-daily-reflection-listen',
  'quest:story-uigwe-royal-birthday-listen',
  'quest:story-joseon-records-today-listen',
]);

/**
 * The quest ids each later version added, appended by the row that bumps
 * `CATALOG_VERSION` (a cell row adds its cell's quests under its new version).
 * `catalog-versions.test.ts` fails when the catalogue holds a quest no version lists.
 */
export const CATALOG_QUEST_ADDITIONS: Readonly<Record<number, readonly string[]>> = Object.freeze({
  // F-CURR-001 S4-1: Read Along.
  9: Object.freeze(['quest:stage4-letters-q1', 'quest:stage4-letters-q2', 'quest:stage4-letters-q3']),
  // F-CURR-001 S3-1: First Sentences.
  10: Object.freeze(['quest:stage3-letters-q1', 'quest:stage3-letters-q2', 'quest:stage3-letters-q3']),
  // F-CURR-001 S2-3: Playground Words.
  11: Object.freeze(['quest:stage2-crafts-q1', 'quest:stage2-crafts-q2', 'quest:stage2-crafts-q3']),
  // F-CURR-001 S7-4: My Favorite Animal.
  12: Object.freeze(['quest:stage7-nature-q1', 'quest:stage7-nature-q2', 'quest:stage7-nature-q3']),
});

/** The quest ids the catalogue held at `version` (versions before 8 read as 8). */
export function questIdsAtVersion(
  version: number,
  additions: Readonly<Record<number, readonly string[]>> = CATALOG_QUEST_ADDITIONS,
): ReadonlySet<string> {
  const ids = new Set(CATALOG_QUEST_IDS_V8);
  for (const [v, added] of Object.entries(additions)) {
    if (Number(v) <= version) for (const id of added) ids.add(id);
  }
  return ids;
}

/** Today's version and the quest ids of any earlier one: what the growth rule compares against. */
export interface CatalogHistory {
  version: number;
  idsAt: (version: number) => ReadonlySet<string>;
}

/** The shipped history (tests pass their own to model a later catalogue). */
export const CATALOG_HISTORY: CatalogHistory = Object.freeze({ version: CATALOG_VERSION, idsAt: (v: number) => questIdsAtVersion(v) });

/**
 * The quests to add to a placed-out set stored at `storedAt` (default
 * `LEGACY_CATALOG_VERSION`): those the level places out in today's `catalog`
 * that the catalogue did not hold at `storedAt`, minus `completed`. Empty when
 * the set was stored at today's version or later.
 */
export function placedOutGrowth(
  level: PlacementLevel,
  storedAt: number | undefined,
  catalog: RouteCatalog,
  completed: ReadonlySet<string> = new Set(),
  history: CatalogHistory = CATALOG_HISTORY,
): string[] {
  const at = storedAt ?? LEGACY_CATALOG_VERSION;
  if (at >= history.version) return [];
  const known = history.idsAt(at);
  return questsPlacedOutAtLevel(level, catalog).filter((id) => !known.has(id) && !completed.has(id));
}
