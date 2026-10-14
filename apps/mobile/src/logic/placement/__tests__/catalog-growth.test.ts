import {
  CATALOG_QUEST_IDS_V8,
  effectiveRoute,
  questsPlacedOutAtLevel,
  type CatalogHistory,
  type Episode,
  type PlacementLevel,
  type Quest,
  type RouteSeed,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { bookQuests } from '../../../content/books';
import { episodesAll, previewEpisodesFor, handWrittenEpisodes } from '../../../content/episodes';
import { questsAll, stage1Quests, stage2Quests, stage4Quests } from '../../../content/quests';
import { storyEpisodes, storyQuests } from '../../../content/stories';
import { questsInCursorOrder } from '../../lessons/lesson-lookup';
import { nextQuestAfter, offerableQuests } from '../../next-quest';
import { snapshotWith, episodeOf, plainQuest } from '../../stage1/__tests__/fixtures';
import { startPutBack, startRaised } from '../plan-offer';
import { appRouteCatalog, placedOutSkipSet } from '../route-skip';
import { placementResult } from './fixtures';

/**
 * F-CURR-001 §3.13 regression (row C-2): a learner placed at `stage3` before any
 * Stage 2 cell shipped (result and plan stored at catalogue version 8). Then a
 * bundle ships Word Builder (Stage 2) and First Sentences (Stage 3): the next
 * quest is still the first Stage 3 quest, every Stage 2 quest stays playable,
 * and no plan-update prompt appears.
 */

const WB = [1, 2, 3, 4, 5, 6].map((k) => `quest:stage2-letters-q${k}`);
const FS = [1, 2, 3].map((k) => `quest:stage3-letters-q${k}`);
const STAGE3: PlacementLevel = { stage: 'stage3', band: 0 };

const lessonEpisodes: Episode[] = [
  episodeOf('episode:stage2-letters', WB, { stage: 'stage2', theme: 'letters', order: 1, status: 'shipped' }),
  episodeOf('episode:stage3-letters', FS, { stage: 'stage3', theme: 'letters', order: 1, status: 'shipped' }),
];
/** The version 9 bundle, put together the way content/episodes.ts and content/quests.ts do. */
const claimers = [...handWrittenEpisodes, ...lessonEpisodes];
const EPISODES_9: Episode[] = [...claimers, ...storyEpisodes, ...previewEpisodesFor(claimers)];
const QUESTS_9: Quest[] = questsInCursorOrder({
  early: [...stage1Quests, ...stage2Quests, ...stage4Quests],
  lessons: [...WB, ...FS].map(plainQuest),
  middle: [...storyQuests, ...bookQuests],
  episodes: claimers,
});
const HISTORY_9: CatalogHistory = { version: 9, idsAt: (v) => new Set([...CATALOG_QUEST_IDS_V8, ...(v >= 9 ? [...WB, ...FS] : [])]) };
const HISTORY_WITHOUT_RULE: CatalogHistory = { version: 8, idsAt: HISTORY_9.idsAt };

/** Stored at version 8: no `catalogVersion`, the set fixed against the version 8 bundle. */
const stored = placementResult({
  level: STAGE3,
  beyondContent: true,
  placedOutQuestIds: questsPlacedOutAtLevel(STAGE3, appRouteCatalog(questsAll, episodesAll)),
});
const next = (skip: ReadonlySet<string> | undefined) =>
  nextQuestAfter({ snapshot: snapshotWith([]), quests: QUESTS_9, episodes: EPISODES_9, ...(skip ? { skipQuestIds: skip } : {}) })?.id;

describe('a stage3 result stored at version 8, then Word Builder ships', () => {
  it('the version 9 bundle orders the new quests by stage on the cursor', () => {
    const ids = QUESTS_9.map((q) => q.id);
    expect(ids.indexOf(WB[0] as string)).toBeGreaterThan(ids.indexOf('quest:stage2-nature-q1'));
    expect(ids.indexOf(FS[0] as string)).toBeLessThan(ids.indexOf('quest:stage4-rites-q1'));
  });

  it('the next quest is still the first Stage 3 quest', () => {
    expect(next(placedOutSkipSet([stored], QUESTS_9, EPISODES_9, HISTORY_9))).toBe(FS[0]);
  });

  it('without the catalogue-growth rule it would be Word Builder q1', () => {
    expect(next(placedOutSkipSet([stored], QUESTS_9, EPISODES_9, HISTORY_WITHOUT_RULE))).toBe(WB[0]);
  });

  it('every Stage 2 quest stays playable: skipped by the cursor, never marked done', () => {
    const skip = placedOutSkipSet([stored], QUESTS_9, EPISODES_9, HISTORY_9);
    for (const id of WB) expect(skip?.has(id)).toBe(true);
    const offerable = offerableQuests(QUESTS_9, EPISODES_9).map((q) => q.id);
    for (const id of WB) expect(offerable).toContain(id);
  });

  it('startRaised and startPutBack show no plan-update prompt for a plan made at version 8', () => {
    const catalog = appRouteCatalog(QUESTS_9, EPISODES_9);
    const seed = effectiveRoute([stored], catalog, { isEntitled: () => true, completedQuestIds: new Set(), catalogHistory: HISTORY_9 }) as RouteSeed;
    const plan = { level: STAGE3, placedOutQuestIds: stored.placedOutQuestIds, catalogVersion: 8 };
    expect(startRaised(seed, plan, catalog, HISTORY_9)).toBe(false);
    expect(startPutBack(seed, plan, catalog, HISTORY_9)).toBe(false);
    // Before the rule, the new cell alone read as "a later place to start".
    expect(startRaised(seed, { ...plan, catalogVersion: 9 }, catalog, HISTORY_9)).toBe(true);
  });
});
