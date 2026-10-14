import {
  CATALOG,
  CATALOG_QUEST_IDS_V8,
  StageKeySchema,
  effectiveRoute,
  generateCurriculum,
  questsPlacedOutAtLevel,
  routeCatalogOf,
  type Catalog,
  type CatalogHistory,
  type StageKey,
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
import { setupBasisOf, setupParams } from '../../route/setup-flow';
import { selfRouteOf } from '../../route/self-route';
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

describe('a plan made at version 8: Change the plan after Word Builder ships', () => {
  /** The version 9 catalogue the plan generator reads (the same cells as the bundle above). */
  const CATALOG_9: Catalog = {
    ...CATALOG,
    version: 9,
    cells: CATALOG.cells.map((cell) => {
      if (cell.episodeId === 'episode:stage2-letters') return { ...cell, status: 'shipped', minutes: 26, questIds: WB };
      if (cell.episodeId === 'episode:stage3-letters') return { ...cell, status: 'shipped', minutes: 13, questIds: FS };
      return cell;
    }),
    quests: [
      ...CATALOG.quests,
      ...WB.map((id) => ({ id, episodeId: 'episode:stage2-letters', stage: 'stage2' as const, theme: 'letters' as const, title: id, minutes: 4, teaches: [], kind: 'lesson' as const })),
      ...FS.map((id) => ({ id, episodeId: 'episode:stage3-letters', stage: 'stage3' as const, theme: 'letters' as const, title: id, minutes: 4, teaches: [], kind: 'lesson' as const })),
    ],
  };
  const plan8 = selfRouteOf(
    generateCurriculum(
      {
        audience: 'self',
        level: STAGE3,
        placedOutQuestIds: stored.placedOutQuestIds,
        startDate: '2026-10-05',
        weeks: 8,
        sessionsPerWeek: 3,
        sessionDays: ['mon', 'wed', 'fri'],
        minutesPerSession: 10,
        goals: { focus: 'balanced' },
        unlockedStages: StageKeySchema.options as StageKey[],
      },
      // Made before the bumps: the shipped catalogue read as version 8 (Read Along, S4-1, is version 9 and
      // Animal Sentences, S3-4, version 10; neither is a Stage 2 quest, so the Word Builder widening below holds).
      { ...CATALOG, version: 8 },
    ),
    'route:a',
    '2026-10-05T09:00:00.000Z',
  );
  const basisAt = (completed: string[]) =>
    setupBasisOf({
      active: plan8,
      proposal: null,
      completedQuestIds: completed,
      unlockedStages: StageKeySchema.options as StageKey[],
      today: '2026-10-12',
      catalog: routeCatalogOf(CATALOG_9),
      catalogHistory: HISTORY_9,
    });
  const firstLesson = (items: readonly { kind: string; id: string }[]) => items.find((item) => item.kind === 'quest' && item.id.startsWith('quest:stage'))?.id;

  it('the plan was made at version 8', () => {
    expect(plan8.meta.catalogVersion).toBe(8);
  });

  it('keeping the same start, the rebuilt plan starts at First Sentences q1 and schedules no Word Builder quest', () => {
    const basis = basisAt([]);
    for (const id of WB) expect(basis?.ctx.placedOutQuestIds).toContain(id);
    const draft = generateCurriculum(setupParams(basis!.ctx, basis!.state), CATALOG_9);
    expect(firstLesson(draft.items)).toBe(FS[0]);
    for (const id of WB) expect(draft.items.map((i) => i.id)).not.toContain(id);
    // The new plan saves the widened set next to version 9, so it is never widened again.
    expect(draft.catalogVersion).toBe(9);
    for (const id of WB) expect(draft.params.placedOutQuestIds).toContain(id);
  });

  it('never adds a completed quest to the set', () => {
    expect(basisAt([WB[0] as string])?.ctx.placedOutQuestIds).not.toContain(WB[0]);
  });
});

describe('a quest shipped later that the learner completed is not a put-back (plan-offer comparison)', () => {
  it('startPutBack and startRaised compare both sides without completed quests', () => {
    const catalog = appRouteCatalog(QUESTS_9, EPISODES_9);
    const done = new Set([WB[0] as string]);
    const seed = effectiveRoute([stored], catalog, { isEntitled: () => true, completedQuestIds: done, catalogHistory: HISTORY_9 }) as RouteSeed;
    expect(seed.placedOutQuestIds).not.toContain(WB[0]);
    const plan8 = { level: STAGE3, placedOutQuestIds: stored.placedOutQuestIds, catalogVersion: 8 };
    expect(startPutBack(seed, plan8, catalog, HISTORY_9, done)).toBe(false);
    expect(startRaised(seed, plan8, catalog, HISTORY_9, done)).toBe(false);
    // A plan saved at version 9 with the widened set (WB[0] still open then), completed since.
    const plan9 = { level: STAGE3, placedOutQuestIds: [...stored.placedOutQuestIds, ...WB], catalogVersion: 9 };
    expect(startPutBack(seed, plan9, catalog, HISTORY_9, done)).toBe(false);
    expect(startRaised(seed, plan9, catalog, HISTORY_9, done)).toBe(false);
    // Without the completed set the same plan would read as a put-back.
    expect(startPutBack(seed, plan9, catalog, HISTORY_9)).toBe(true);
  });
});
