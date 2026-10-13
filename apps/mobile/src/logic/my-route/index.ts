/**
 * My route view-model (F-ROUTE-001 section 3.2). Pure; shared by the My route
 * screen, the Home strip, the parent dashboard and the sync summary.
 */
export * from './types';
export { buildMyRoute } from './model';
export { gridEpisodesOf, isGridEpisode, routeOrder, type RouteEntry } from './order';
export { cellRowsOf, pipStateOf, splitStagePips, type PipContext, type PipFacts } from './pips';
export { routeCursor, type CursorInput } from './cursor';
export { STAGE_BUILDS, hereStageOf, isDerivedComplete, stageStateOf, type StageFacts } from './stage-rows';
export { SKILLS, SKILL_OF_KIND, SKILL_THRESHOLDS, TILE_KINDS, marksFor, questSkills, skillRows, tilesCount } from './skills';
export { gainsOf } from './gains';
export {
  journeySummaryOf,
  routeGoalSummaryOf,
  summarizeJourney,
  type JourneyContent,
  type JourneyStageSummary,
  type JourneySummary,
  type RouteGoalSummaryInput,
} from './summary';
export { stagesToLatch, withStageLatches } from './latch';
export { startMarkerOf, startRouteOf } from './start-marker';
export {
  jamoIdToSymbolKey,
  letterWallOf,
  letterWallView,
  symbolKeyOf,
  type LetterState,
  type LetterTile,
  type LetterTileView,
  type LetterWallInput,
  type LetterWallView,
  type WallJamo,
} from './letter-wall';
export { hoyaPoseFor, newQuestsLine, newlyDoneKeys, parseSeen, readSeen, seenFrom, seenKey, writeSeen, type JsonStorage } from './seen';
export {
  canDoCopy,
  cellWord,
  heroCopy,
  newQuestsCopy,
  skillCopy,
  skillsNoteCopy,
  skillsTitle,
  stageA11yLabel,
  stageCaptions,
  stageStateWord,
  stageTags,
  tilesCopy,
  trailEntries,
  viewingCopy,
  type CopyContext,
  type GrownupJourneyMessages,
  type HeroCopy,
  type LearnerRouteMessages,
  type MyRouteA11yMessages,
  type MyRouteMessages,
  type TrailEntry,
  type Viewer,
} from './copy';
