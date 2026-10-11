import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_MAX_ITEMS,
  StageKeySchema,
  addDays,
  generateCurriculum,
  type CurriculumParamsInput,
  type PlacementLevel,
  type StageKey,
} from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/**
 * F-PLAN-002 section 5: the invariants over weeks {1, 4, 12, 26, 52} x sessions
 * {1, 2, 3, 5, 7} x four levels x four focuses x {free, all stages}, minus the
 * combinations above 260 sessions, which the params reject.
 */

const WEEKS = [1, 4, 12, 26, 52];
const SESSIONS = [1, 2, 3, 5, 7];
const LEVELS: PlacementLevel[] = [
  { stage: 'stage1', band: 0 },
  { stage: 'stage1', band: 2 },
  { stage: 'stage2', band: 0 },
  { stage: 'stage3', band: 0 },
];
const FOCUSES = ['reading', 'words', 'culture', 'balanced'] as const;
const TIERS: StageKey[][] = [['stage1'], [...StageKeySchema.options]];

const STAGE1_ORDER = CATALOG_2026_10.cells
  .filter((cell) => cell.stage === 'stage1')
  .flatMap((cell) => cell.questIds);
const stageOfQuest = new Map(CATALOG_2026_10.quests.map((quest) => [quest.id, quest.stage]));

const combos: CurriculumParamsInput[] = [];
for (const weeks of WEEKS) {
  for (const sessionsPerWeek of SESSIONS) {
    if (weeks * sessionsPerWeek > CURRICULUM_MAX_ITEMS) continue;
    for (const level of LEVELS) {
      for (const focus of FOCUSES) {
        for (const unlockedStages of TIERS) {
          combos.push({
            audience: 'family',
            level,
            startDate: '2026-10-12',
            weeks,
            sessionsPerWeek,
            minutesPerSession: 15,
            goals: { focus, motivation: 'heritage' },
            daysOff: weeks >= 4 ? [{ from: '2026-11-02', to: '2026-11-08' }] : [],
            unlockedStages,
          });
        }
      }
    }
  }
}

describe('curriculum properties (F-PLAN-002 section 5)', () => {
  it('covers the grid', () => {
    // Only 52 weeks x 7 sessions (364) is above the cap: 768 combinations, the "about 770" of the spec.
    expect(combos.length).toBe(4 * 4 * 2 * (WEEKS.length * SESSIONS.length - 1));
  });

  it('holds every invariant for every combination', () => {
    for (const params of combos) {
      const draft = generateCurriculum(params, CATALOG_2026_10);
      const label = JSON.stringify({ w: params.weeks, s: params.sessionsPerWeek, l: params.level, f: params.goals?.focus, t: params.unlockedStages.length });
      const end = addDays(params.startDate, 7 * params.weeks);
      const dates = draft.items.map((item) => item.targetDate as string);
      const ids = draft.items.map((item) => item.id);

      expect(new Set(dates).size, `${label}: two items on one date`).toBe(dates.length);
      expect(dates.every((date) => date >= params.startDate && date < end), `${label}: date outside the plan`).toBe(true);
      expect(new Set(ids).size, `${label}: repeated id`).toBe(ids.length);
      expect(draft.items.length, `${label}: over the cap`).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);
      expect(draft.weeks).toHaveLength(params.weeks);

      const stage1 = ids.filter((id) => STAGE1_ORDER.includes(id));
      expect(stage1, `${label}: Stage 1 out of canonical order`).toEqual(STAGE1_ORDER.filter((id) => stage1.includes(id)));

      const unlocked = new Set(params.unlockedStages);
      for (const id of ids) {
        const stage = stageOfQuest.get(id);
        if (stage !== undefined && !id.startsWith('quest:story-')) {
          expect(unlocked.has(stage), `${label}: locked lesson ${id} scheduled`).toBe(true);
        }
      }
      for (const id of draft.locked) expect(ids).not.toContain(id);

      for (const week of draft.weeks) {
        const inWeek = draft.items.filter((item) => item.week === week.index);
        if (week.kind === 'review' || week.kind === 'break') {
          expect(inWeek, `${label}: items in ${week.kind} week ${week.index}`).toEqual([]);
        }
        if (week.kind === 'break') {
          const offWeek = week.startDate >= '2026-11-02' && week.startDate <= '2026-11-08';
          expect(offWeek, `${label}: break week ${week.index} has sessions`).toBe(true);
        }
        for (const item of inWeek) {
          expect((item.targetDate as string) >= week.startDate && (item.targetDate as string) < addDays(week.startDate, 7)).toBe(true);
        }
      }

      expect(draft.items.filter((item) => item.kind === 'episode').length).toBeLessThanOrEqual(5);
      expect(draft.stats.readyItems + draft.stats.comingSoonItems).toBe(draft.items.length);
    }
  });
});
