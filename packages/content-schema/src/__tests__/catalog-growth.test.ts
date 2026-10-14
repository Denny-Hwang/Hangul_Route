import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_HISTORY,
  CATALOG_QUEST_ADDITIONS,
  CATALOG_QUEST_IDS_V8,
  CATALOG_VERSION,
  LEGACY_CATALOG_VERSION,
  PlacementResultSchema,
  StageKeySchema,
  effectiveRoute,
  generateCurriculum,
  placedOutGrowth,
  questIdsAtVersion,
  questsPlacedOutAtLevel,
  regenerateFrom,
  routeCatalogOf,
  seedRoute,
  toMeta,
  toPlanItems,
  type Catalog,
  type CatalogHistory,
  type CurriculumParamsInput,
  type PlacementLevel,
  type PlacementResult,
  type StageKey,
} from '../index';

/**
 * The catalogue-growth rule (F-CURR-001 §3.13, row C-2): a placed-out set
 * stored at catalogue version 8 gains the quests a later version ships that
 * the stored level places out, so a learner placed at `stage3` before Word
 * Builder shipped still starts at Stage 3.
 */

const WB = [1, 2, 3, 4, 5, 6].map((k) => `quest:stage2-letters-q${k}`);
const FS = [1, 2, 3].map((k) => `quest:stage3-letters-q${k}`);

/** Version 9 of a later catalogue: Word Builder (Stage 2) and First Sentences (Stage 3) shipped. */
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
const HISTORY_9: CatalogHistory = {
  version: 9,
  idsAt: (v) => new Set([...CATALOG_QUEST_IDS_V8, ...(v >= 9 ? [...WB, ...FS] : [])]),
};
const STAGE3: PlacementLevel = { stage: 'stage3', band: 0 };
const ROUTE_8 = routeCatalogOf(CATALOG);
const ROUTE_9 = routeCatalogOf(CATALOG_9);

/** A `stage3` result stored at version 8 (no `catalogVersion`, as every result before the rule). */
function storedResult(extra: Partial<PlacementResult> = {}): PlacementResult {
  return PlacementResultSchema.parse({
    id: 'placement:abc',
    startedAt: '2026-10-01T10:00:00.000Z',
    completedAt: '2026-10-01T10:05:00.000Z',
    source: 'onboarding',
    testLocale: 'en',
    length: 'full',
    revealMode: 'tap',
    bankVersion: 1,
    contentVer: '1',
    responses: [],
    gates: [],
    strands: { 'hangul-recognition': 'secure', 'sound-letter': 'secure', 'syllable-reading': 'secure', vocabulary: 'secure', sentences: 'secure' },
    level: STAGE3,
    oralStage: null,
    beyondContent: true,
    startQuestId: null,
    placedOutQuestIds: questsPlacedOutAtLevel(STAGE3, ROUTE_8),
    priorityTokens: [],
    needsStage: null,
    stopReason: 'complete',
    ...extra,
  });
}
const OPTS = { isEntitled: () => true, completedQuestIds: new Set<string>(), catalogHistory: HISTORY_9 };

describe('the frozen catalogue history', () => {
  it('lists every quest of the shipped catalogue at its version', () => {
    expect(LEGACY_CATALOG_VERSION).toBe(8);
    expect(new Set(CATALOG_QUEST_IDS_V8).size).toBe(CATALOG_QUEST_IDS_V8.length);
    expect([...questIdsAtVersion(CATALOG_VERSION)].sort()).toEqual(CATALOG.quests.map((q) => q.id).sort());
    expect(CATALOG_HISTORY.version).toBe(CATALOG_VERSION);
  });

  it('adds each later version once, after version 8 and not past today', () => {
    const seen = new Set(CATALOG_QUEST_IDS_V8);
    for (const [version, ids] of Object.entries(CATALOG_QUEST_ADDITIONS)) {
      expect(Number(version)).toBeGreaterThan(LEGACY_CATALOG_VERSION);
      expect(Number(version)).toBeLessThanOrEqual(CATALOG_VERSION);
      for (const id of ids) {
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
  });

  it('reads a version before 8 as the version 8 list', () => {
    expect(questIdsAtVersion(3)).toEqual(new Set(CATALOG_QUEST_IDS_V8));
    expect(CATALOG_HISTORY.idsAt(8)).toEqual(new Set(CATALOG_QUEST_IDS_V8));
  });

  it('adds each version\'s quests from that version on', () => {
    const additions = { 9: WB, 10: FS };
    expect(questIdsAtVersion(8, additions).has(WB[0] as string)).toBe(false);
    expect(questIdsAtVersion(9, additions).has(WB[0] as string)).toBe(true);
    expect(questIdsAtVersion(9, additions).has(FS[0] as string)).toBe(false);
    expect(questIdsAtVersion(10, additions).size).toBe(CATALOG_QUEST_IDS_V8.length + WB.length + FS.length);
  });
});

describe('placedOutGrowth', () => {
  it('adds the shipped-later quests the level places out, and nothing at today\'s version', () => {
    expect(placedOutGrowth(STAGE3, undefined, ROUTE_9, new Set(), HISTORY_9)).toEqual(WB);
    expect(placedOutGrowth(STAGE3, 8, ROUTE_9, new Set(), HISTORY_9)).toEqual(WB);
    expect(placedOutGrowth(STAGE3, 9, ROUTE_9, new Set(), HISTORY_9)).toEqual([]);
    // Stage 3 is never placed out at stage3, so First Sentences never joins.
    expect(placedOutGrowth({ stage: 'stage2', band: 0 }, 8, ROUTE_9, new Set(), HISTORY_9)).toEqual([]);
  });

  it('never adds a completed quest', () => {
    expect(placedOutGrowth(STAGE3, 8, ROUTE_9, new Set([WB[0] as string]), HISTORY_9)).toEqual(WB.slice(1));
  });

  it('is empty with the shipped history while no version has added quests', () => {
    expect(placedOutGrowth(STAGE3, undefined, ROUTE_8)).toEqual([]);
  });
});

describe('regression: a stage3 result stored at version 8, then Word Builder ships (§3.13, behaviour 6)', () => {
  it('effectiveRoute starts at the first Stage 3 quest; every Stage 2 quest stays placed out', () => {
    const seed = effectiveRoute([storedResult()], ROUTE_9, OPTS);
    expect(seed?.startQuestId).toBe(FS[0]);
    for (const id of WB) expect(seed?.placedOutQuestIds).toContain(id);
    expect(seedRoute(storedResult(), ROUTE_9, OPTS).startQuestId).toBe(FS[0]);
  });

  it('without the rule the start would fall back to Word Builder q1', () => {
    const seed = effectiveRoute([storedResult()], ROUTE_9, { ...OPTS, catalogHistory: { version: 8, idsAt: HISTORY_9.idsAt } });
    expect(seed?.startQuestId).toBe(WB[0]);
  });

  it('a result stored at version 9 is not widened', () => {
    const seed = effectiveRoute([storedResult({ catalogVersion: 9 })], ROUTE_9, OPTS);
    expect(seed?.startQuestId).toBe(WB[0]);
  });

  it('keeps a grown-up override\'s put-backs put back', () => {
    const override = { by: 'parent' as const, at: '2026-10-02T09:00:00.000Z', startQuestId: 'quest:stage1-crafts-q3' };
    const seed = effectiveRoute([storedResult({ override })], ROUTE_9, OPTS);
    expect(seed?.startQuestId).toBe('quest:stage1-crafts-q3');
    for (const id of WB) expect(seed?.placedOutQuestIds).not.toContain(id);
  });

  it('never places out a completed quest', () => {
    const seed = effectiveRoute([storedResult()], ROUTE_9, { ...OPTS, completedQuestIds: new Set([WB[0] as string]) });
    expect(seed?.placedOutQuestIds).not.toContain(WB[0]);
    expect(seed?.startQuestId).toBe(FS[0]);
  });

  it('a new result records the catalogue version it was taken at', () => {
    expect(PlacementResultSchema.shape.catalogVersion.safeParse(undefined).success).toBe(true);
    expect(PlacementResultSchema.shape.catalogVersion.safeParse(0).success).toBe(false);
  });
});

describe('regression: a plan made at version 8 from a stage3 result (generate.ts queues)', () => {
  const PARAMS: CurriculumParamsInput = {
    audience: 'self',
    level: STAGE3,
    placedOutQuestIds: questsPlacedOutAtLevel(STAGE3, ROUTE_8),
    startDate: '2026-10-05',
    weeks: 8,
    sessionsPerWeek: 3,
    sessionDays: ['mon', 'wed', 'fri'],
    minutesPerSession: 10,
    goals: { focus: 'balanced' },
    unlockedStages: StageKeySchema.options as StageKey[],
  };
  const plan8 = (() => {
    // Made before the bumps: the shipped catalogue read as version 8 (S4-1's Read Along made it 9, S3-4's Animal Sentences 10;
    // neither is a Stage 2 quest, so the Word Builder widening below is unchanged).
    const draft = generateCurriculum(PARAMS, { ...CATALOG, version: 8 });
    return { meta: toMeta(draft), items: toPlanItems(draft) };
  })();
  const firstLesson = (items: readonly { kind: string; id: string }[]) =>
    items.find((item) => item.kind === 'quest' && item.id.startsWith('quest:stage'))?.id;

  it('was made at version 8', () => {
    expect(plan8.meta.catalogVersion).toBe(8);
  });

  for (const mode of ['requeue', 'reseed'] as const) {
    it(`${mode}: the rebuilt queue starts at Stage 3 and schedules no Word Builder quest`, () => {
      const opts = mode === 'reseed' ? { mode, paramsPatch: { level: STAGE3 }, catalogHistory: HISTORY_9 } : { mode, catalogHistory: HISTORY_9 };
      const draft = regenerateFrom(plan8, '2026-10-12', CATALOG_9, opts);
      const future = draft.items.filter((item) => (item.targetDate ?? '') >= '2026-10-12');
      expect(firstLesson(future)).toBe(FS[0]);
      for (const id of WB) expect(draft.items.map((i) => i.id)).not.toContain(id);
    });
  }

  it('without the rule, requeue would schedule Word Builder first', () => {
    const draft = regenerateFrom(plan8, '2026-10-12', CATALOG_9, { mode: 'requeue', catalogHistory: { version: 8, idsAt: HISTORY_9.idsAt } });
    expect(draft.items.map((i) => i.id)).toContain(WB[0]);
  });

  it('saves the widened set next to today\'s version, so a second regeneration keeps it', () => {
    const save = (draft: ReturnType<typeof regenerateFrom>) => ({ meta: toMeta(draft), items: toPlanItems(draft) });
    for (const first of ['requeue', 'shift'] as const) {
      const once = save(regenerateFrom(plan8, '2026-10-12', CATALOG_9, { mode: first, catalogHistory: HISTORY_9 }));
      expect(once.meta.catalogVersion).toBe(9);
      for (const id of WB) expect(once.meta.params.placedOutQuestIds, first).toContain(id);
      const twice = regenerateFrom(once, '2026-10-19', CATALOG_9, { mode: 'requeue', catalogHistory: HISTORY_9 });
      for (const id of WB) expect(twice.items.map((i) => i.id), first).not.toContain(id);
      expect(firstLesson(twice.items.filter((item) => (item.targetDate ?? '') >= '2026-10-19'))).toBe(FS[0]);
      expect(new Set(twice.params.placedOutQuestIds).size).toBe(twice.params.placedOutQuestIds?.length);
    }
  });

  it('does not save a completed quest into the widened set', () => {
    const draft = regenerateFrom(plan8, '2026-10-12', CATALOG_9, { mode: 'requeue', completedQuestIds: [WB[0] as string], catalogHistory: HISTORY_9 });
    expect(draft.params.placedOutQuestIds).not.toContain(WB[0]);
    expect(draft.params.placedOutQuestIds).toContain(WB[1]);
  });

  it('a reseed that sends its own set (from today\'s catalogue) is not widened', () => {
    const set = [...questsPlacedOutAtLevel(STAGE3, ROUTE_8)];
    const draft = regenerateFrom(plan8, '2026-10-12', CATALOG_9, { mode: 'reseed', paramsPatch: { level: STAGE3, placedOutQuestIds: set }, catalogHistory: HISTORY_9 });
    expect(draft.items.map((i) => i.id)).toContain(WB[0]);
  });
});
