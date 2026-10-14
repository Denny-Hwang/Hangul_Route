import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/data';
import { freeLessonsLine, planFreeFacts, type FreeLessonsLineInput, type FreeLessonsPlanCounts } from '../catalog/free-lessons-line';
import type { Catalog } from '../catalog/schema';
import type { PlanItem } from '../schemas/plan-item';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/**
 * F-ENT-003 section 3.9.2 (E3-12): the grown-up free-lessons line. One pure function returns a
 * code and its params, never a string; each host words it (`console.access`, `caregiver.access`).
 * It shows only with the switch on, to the space owner, for a space no plan covers.
 */
const base: FreeLessonsLineInput = { gating: true, owner: true, covered: false, spaceKind: 'class' };
const counts = (done: number, total: number, notReady: number, closed = notReady, openAhead = false, closedInHorizon = Math.min(closed, notReady)): FreeLessonsPlanCounts => ({
  done,
  total,
  notReady,
  closed,
  closedInHorizon,
  openAhead,
});

describe('freeLessonsLine: when it shows at all', () => {
  it('is null with the switch off, for a viewer who does not own the space, and for a covered space', () => {
    const waiting = { plans: [counts(4, 4, 3)], freeEnd: true, neutral: true };
    expect(freeLessonsLine({ ...base, ...waiting })).not.toBeNull();
    expect(freeLessonsLine({ ...base, ...waiting, gating: false })).toBeNull();
    expect(freeLessonsLine({ ...base, ...waiting, owner: false })).toBeNull();
    expect(freeLessonsLine({ ...base, ...waiting, covered: true })).toBeNull();
  });

  it('is null while coverage is unknown (a failed entitlements read never claims a limit)', () => {
    expect(freeLessonsLine({ ...base, covered: null, plans: [counts(4, 4, 3)], neutral: true })).toBeNull();
  });

  it('is null when nothing fires and the host shows no neutral line', () => {
    expect(freeLessonsLine(base)).toBeNull();
    expect(freeLessonsLine({ ...base, plans: [], freeEnd: false, neutral: false })).toBeNull();
  });
});

describe('freeLessonsLine: the product by space kind', () => {
  it('names the Family Plan for a family and a Group License for a class or a school', () => {
    expect(freeLessonsLine({ ...base, spaceKind: 'family', neutral: true })).toEqual({ code: 'free-plan', product: 'family' });
    expect(freeLessonsLine({ ...base, spaceKind: 'class', neutral: true })).toEqual({ code: 'free-plan', product: 'class' });
    expect(freeLessonsLine({ ...base, spaceKind: 'school', neutral: true })).toEqual({ code: 'free-plan', product: 'class' });
  });
});

describe('freeLessonsLine: the codes and their thresholds', () => {
  it('free-end: the device knows the learner finished everything open (routeNext is free-end)', () => {
    expect(freeLessonsLine({ ...base, spaceKind: 'family', freeEnd: true })).toEqual({ code: 'free-end', product: 'family' });
    expect(freeLessonsLine({ ...base, freeEnd: false })).toBeNull();
    // It leads every other code.
    expect(freeLessonsLine({ ...base, freeEnd: true, plans: [counts(4, 4, 3)], neutral: true })).toEqual({ code: 'free-end', product: 'class' });
  });

  it('plan-waiting: every derived open item is done, nothing open is ahead, and the plan holds closed lessons', () => {
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 3)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 3 });
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 1)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 1 });
    // The count is the plan's closed lessons, not the device's notReady (which also counts unreleased items).
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 5, 2)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 2 });
    // Nothing the device skipped: the plan is simply done so far.
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 0, 3)] })).toBeNull();
    // Only unreleased or unknown items were skipped: buying would not open them.
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 2, 0)] })).toBeNull();
    // Something open is still to do now, or later in the plan.
    expect(freeLessonsLine({ ...base, plans: [counts(7, 8, 3)] })).toBeNull();
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 3, 3, true)] })).toBeNull();
    // Nothing open was ever derived: the learner has not "finished" anything in this plan.
    expect(freeLessonsLine({ ...base, plans: [counts(0, 0, 2)] })).toBeNull();
  });

  it('plan-waiting: never when the device skipped fewer items than the closed lessons it derived (they are open for this learner)', () => {
    // Premium through another space, or kept after finishing them: the Stage 2 lessons were open and done, one unreleased item was skipped.
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 1, 3, false, 3)] })).toBeNull();
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 2, 3, false, 3)] })).toBeNull();
    // A free learner: every closed lesson inside the horizon was skipped at least once.
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 3, 3, false, 3)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 3 });
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 4, 3, false, 3)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 3 });
    // Closed lessons dated past the horizon are not derived yet, so they are not expected in notReady.
    expect(freeLessonsLine({ ...base, plans: [counts(8, 8, 1, 3, false, 1)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 3 });
  });

  it('plan-waiting: the first plan that qualifies, in the order the host passes them', () => {
    expect(freeLessonsLine({ ...base, plans: [counts(2, 5, 1), counts(3, 3, 4, 4, true), counts(3, 3, 4), counts(6, 6, 2)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 4 });
  });

  it('free-plan: the neutral line, only where the host asks for it, and only when nothing else fires', () => {
    expect(freeLessonsLine({ ...base, neutral: true })).toEqual({ code: 'free-plan', product: 'class' });
    expect(freeLessonsLine({ ...base, neutral: true, plans: [counts(7, 8, 3)] })).toEqual({ code: 'free-plan', product: 'class' });
    expect(freeLessonsLine({ ...base, neutral: true, plans: [counts(8, 8, 3)] })).toEqual({ code: 'plan-waiting', product: 'class', closed: 3 });
  });
});

describe('freeLessonsLine: codes, never words', () => {
  it('returns only a code, a product key and a count', () => {
    const outputs = [
      freeLessonsLine({ ...base, freeEnd: true }),
      freeLessonsLine({ ...base, plans: [counts(1, 1, 2)] }),
      freeLessonsLine({ ...base, spaceKind: 'family', neutral: true }),
    ];
    for (const out of outputs) {
      expect(out).not.toBeNull();
      for (const [key, value] of Object.entries(out ?? {})) {
        if (key === 'closed') expect(typeof value).toBe('number');
        else expect(['free-end', 'plan-waiting', 'free-plan', 'family', 'class']).toContain(value);
      }
    }
  });

  it('never changes its input', () => {
    const plans = Object.freeze([Object.freeze(counts(4, 4, 3))]);
    const input = Object.freeze({ ...base, plans });
    expect(() => freeLessonsLine(input)).not.toThrow();
    expect(input.plans).toEqual([counts(4, 4, 3)]);
  });
});

describe('planFreeFacts: what a plan\'s own items say about the free plan', () => {
  const quest = (id: string, targetDate?: string): PlanItem => ({ kind: 'quest', id, ...(targetDate ? { targetDate } : {}) });
  const episode = (id: string, targetDate?: string): PlanItem => ({ kind: 'episode', id, ...(targetDate ? { targetDate } : {}) });
  const story = CATALOG.quests.find((q) => q.kind === 'story')?.id ?? 'quest:story';

  it('counts distinct grid lessons past Stage 1, from quest and episode items', () => {
    const items = [quest('quest:stage1-letters-q1'), quest('quest:stage2-life-q1'), episode('episode:stage2-life'), episode('episode:stage2-nature'), quest('quest:stage4-rites-q1')];
    expect(planFreeFacts(items, CATALOG, null)).toEqual({ closed: 3, closedInHorizon: 3, openAhead: false });
  });

  it('never counts a coming-soon episode, a story, an unknown id or a free lesson', () => {
    const items = [episode('episode:stage7-crafts'), episode('episode:stage7-nature'), episode('episode:nowhere'), quest(story), quest('quest:unknown'), episode('episode:stage1-letters')];
    expect(planFreeFacts(items, CATALOG, null)).toEqual({ closed: 0, closedInHorizon: 0, openAhead: false });
  });

  it('finds an open item dated after the horizon of a curriculum; a classic plan has none', () => {
    const later = [quest('quest:stage1-letters-q1', '2026-10-20'), quest('quest:stage1-crafts-q1', '2026-11-30'), quest('quest:stage2-life-q1', '2026-12-30')];
    expect(planFreeFacts(later, CATALOG, '2026-10-25')).toEqual({ closed: 1, closedInHorizon: 0, openAhead: true });
    expect(planFreeFacts(later, CATALOG, null)).toEqual({ closed: 1, closedInHorizon: 1, openAhead: false });
    // A free lesson inside the horizon, a closed lesson or a coming-soon episode after it, or an undated item, is not open ahead.
    expect(planFreeFacts([quest('quest:stage1-letters-q1', '2026-10-25'), quest('quest:stage2-life-q1', '2026-12-30'), episode('episode:stage7-nature', '2026-12-30'), quest('quest:stage1-life-q1')], CATALOG, '2026-10-25')).toEqual({ closed: 1, closedInHorizon: 0, openAhead: false });
    expect(planFreeFacts([episode('episode:stage1-life', '2026-11-30')], CATALOG, '2026-10-25').openAhead).toBe(true);
    expect(planFreeFacts([quest(story, '2026-11-30')], CATALOG, '2026-10-25').openAhead).toBe(true);
  });

  it('counts the closed lessons inside the horizon once each, from quest and episode items alike', () => {
    const items = [quest('quest:stage2-life-q1', '2026-10-20'), episode('episode:stage2-life', '2026-10-21'), quest('quest:stage4-rites-q1'), quest('quest:stage2-nature-q1', '2026-11-30')];
    const life = CATALOG.cells.find((cell) => cell.episodeId === 'episode:stage2-life')?.questIds.length ?? 0;
    expect(planFreeFacts(items, CATALOG, '2026-10-25')).toEqual({ closed: life + 2, closedInHorizon: life + 1, openAhead: false });
  });

  it('follows the stages it is given and the catalogue it reads (Stage 1 complete on the frozen October catalogue)', () => {
    const items = [episode('episode:stage1-nature'), episode('episode:stage2-life')];
    expect(planFreeFacts(items, CATALOG_2026_10, null)).toEqual({ closed: 1, closedInHorizon: 1, openAhead: false });
    expect(planFreeFacts(items, CATALOG_2026_10, null, ['stage1', 'stage2'])).toEqual({ closed: 0, closedInHorizon: 0, openAhead: false });
    const empty: Catalog = { ...CATALOG, cells: [] };
    expect(planFreeFacts(items, empty, null)).toEqual({ closed: 0, closedInHorizon: 0, openAhead: false });
  });
});
