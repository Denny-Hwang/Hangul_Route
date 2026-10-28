import { CATALOG } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SEED_PER_DAY, deriveSeed } from '../../memory/seed';
import { applyAnswer, type DayFacts } from '../../memory/spacing';
import { addDays, daysBetween } from '../../vocab/srs';
import { INDEX, ITEMS, RETIRED, finished, utcDay } from '../../memory/__tests__/fixtures';
import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { DAILY_REVIEW_DUE_CAP, DAILY_REVIEW_SIZE, REVIEW_FIRST_FACTOR, buildDailyReview, dueCount, withSentenceCredit, wordsInside } from '../engine';
import { DEFAULT_KNOBS, START_DAY, Sim, questPlans, scenarioA, scenarioB } from './simulate';

/**
 * The simulation gate of F-CURR-002 section 4.3 (row CM-13): 60 days of the review engine on the
 * review items of this build, scenarios S-a to S-e with the assertions of the section 4.3 table.
 * The tuning knobs (Keep going rounds, warm-up size, credit inside sentences) ship at the values
 * these runs pass with; the decision record of row CM-13 has the table that chose them.
 *
 * "The pool" of S-a and S-b is the due pool a day leaves (what the next day inherits on top of
 * what falls due then), and S-a's "one Keep going" is one sitting of up to 3 rounds: the readings
 * of row CM-13 in the section 4.3 table, open for the owner (section 21). S-b holds on the opening
 * pool as well. What those readings cost is pinned too: the opening pool, the days the review-first
 * suggestion shows and the items answered a day, so a change cannot make them worse unseen.
 */

const SEEDS = [1, 2, 3, 4, 5];
const DAYS = 60;
const POOL_LINE = REVIEW_FIRST_FACTOR * DAILY_REVIEW_SIZE;
/** Days 30-60 of a run whose first day is day 1. */
const lateDays = (sim: Sim) => sim.days.filter((d) => d.day >= 29);
/** The day series, for a failure message: a content change that trips the gate shows why. */
const series = (sim: Sim, key: 'pool' | 'left' | 'answered') => `${key} by day: ${sim.days.map((d) => d[key]).join(' ')}`;
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] as number;

/** Pins of what the S-a readings cost (measured on this build: opening pool at most 71, review-first on 26-27 of days 30-60, a median of 55-57 answers a day). */
const OPENING_POOL_MAX = 80;
const REVIEW_FIRST_LATE_DAYS_MAX = 28;
const ANSWERED_MEDIAN_MAX = 60;

describe('S-a: one quest a day, the Daily Review every day, Keep going on days the pool is over 20', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: the pool is at most 3 x the Daily Review size on 90% of days 30-60, and G2 is reachable`, () => {
      const sim = new Sim(seed);
      scenarioA(sim, DAYS);
      const late = lateDays(sim);
      expect(late).toHaveLength(31);
      expect(late.filter((d) => d.left <= POOL_LINE).length / late.length, series(sim, 'left')).toBeGreaterThanOrEqual(0.9);
      const introduced = [...sim.intro].filter(([, day]) => day < 30).map(([id]) => id);
      expect(introduced.length).toBeGreaterThan(150);
      const g2 = introduced.filter((id) => sim.spacedWithin(id, 30) >= 3).length / introduced.length;
      expect(g2).toBeGreaterThanOrEqual(0.7);
    });

    it(`seed ${seed}: the cost of those readings stays pinned: the opening pool, the review-first days and the answers a day`, () => {
      const sim = new Sim(seed);
      scenarioA(sim, DAYS);
      const late = lateDays(sim);
      expect(Math.max(...late.map((d) => d.pool)), series(sim, 'pool')).toBeLessThanOrEqual(OPENING_POOL_MAX);
      expect(late.filter((d) => d.reviewFirst).length, series(sim, 'pool')).toBeLessThanOrEqual(REVIEW_FIRST_LATE_DAYS_MAX);
      expect(median(late.map((d) => d.answered)), series(sim, 'answered')).toBeLessThanOrEqual(ANSWERED_MEDIAN_MAX);
    });
  }

  it('holds with game.syllable-build on too (row CM-32): the surface index with Syllable Build, and no due item dropped', () => {
    for (const seed of [1, 2]) {
      const sim = new Sim(seed, { ...DEFAULT_KNOBS, games: true });
      scenarioA(sim, DAYS);
      const late = lateDays(sim);
      expect(late.filter((d) => d.left <= POOL_LINE).length / late.length, series(sim, 'left')).toBeGreaterThanOrEqual(0.9);
      expect(sim.dropped).toBe(0);
    }
  });

  it('holds with no device voice too, on the two-rung ladder', () => {
    const sim = new Sim(1, { ...DEFAULT_KNOBS, voice: false });
    scenarioA(sim, DAYS);
    const late = lateDays(sim);
    expect(late.filter((d) => d.left <= POOL_LINE).length / late.length, series(sim, 'left')).toBeGreaterThanOrEqual(0.9);
  });

  it('needs the knobs: one 10-item Keep going round a day cannot hold the pool', () => {
    const sim = new Sim(1, { ...DEFAULT_KNOBS, keepGoingRounds: 1 });
    scenarioA(sim, DAYS);
    const late = lateDays(sim);
    expect(late.filter((d) => d.left <= POOL_LINE).length / late.length).toBeLessThan(0.9);
  });
});

describe('S-b: two quests a day; on review-first days the Daily Review and Keep going replace the second quest', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: the pool on day 60 is no more than the pool on day 30 plus 30`, () => {
      const sim = new Sim(seed);
      scenarioB(sim, DAYS);
      const [day30, day60] = [sim.days[29], sim.days[59]];
      expect(day60?.left, series(sim, 'left')).toBeLessThanOrEqual((day30?.left ?? 0) + 30);
      expect(day60?.pool, series(sim, 'pool')).toBeLessThanOrEqual((day30?.pool ?? 0) + 30);
      expect(sim.days.some((d) => d.reviewFirst)).toBe(true);
    });
  }
});

describe('S-c: a learner with all 107 quests done, seeded, then S-a', () => {
  const seededAt = '2026-11-01T08:00:00.000Z';
  const seedDay = '2026-11-01';
  const seed = deriveSeed({ snapshot: finished(107), items: ITEMS, retired: RETIRED, quests: CATALOG.quests, cells: CATALOG.cells, seededAt, dayOf: utcDay });

  it('every seeded item has a due day, no day has more than 15 seeded due, and the spread ends by day 62', () => {
    expect(seed.count).toBeGreaterThan(500);
    const perDay = new Map<string, number>();
    for (const { state } of seed.states.values()) {
      expect(state.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      perDay.set(state.d as string, (perDay.get(state.d as string) ?? 0) + 1);
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(SEED_PER_DAY);
    const last = [...perDay.keys()].sort().at(-1) as string;
    expect(daysBetween(seedDay, last)).toBeLessThanOrEqual(62);
  });

  const seeded = (): Sim => {
    expect(addDays(seedDay, 1)).toBe(START_DAY);
    // Every quest is done, so the run plays no quest: the Daily Review every day, Keep going when the pool is over 20.
    const sim = new Sim(1, DEFAULT_KNOBS, []);
    for (const [id, { shard, state }] of seed.states) sim.rows[id] = { sh: shard, st: state };
    return sim;
  };

  it('the Daily Reviews of a day draw at most 20 due items, seeded ones included; then the next one draws none and offers Keep going', () => {
    const sim = seeded();
    let capDays = 0;
    for (let day = 0; day < DAYS; day += 1) {
      sim.day(() => {
        let drawn = 0;
        for (let round = 0; round < 4; round += 1) drawn += sim.dailyReview();
        expect(drawn).toBeLessThanOrEqual(DAILY_REVIEW_DUE_CAP);
        const next = buildDailyReview(sim.ctx(), sim.dayLog());
        expect(next.questions.filter((q) => !q.stretch)).toEqual([]);
        if (dueCount(sim.ctx()) > 0) {
          expect(drawn).toBe(DAILY_REVIEW_DUE_CAP);
          expect(next.capped).toBe(true);
          expect(next.endsEarly).toBe(false);
          capDays += 1;
        }
        while (sim.keepGoing());
      });
    }
    // The cap binds on the seeded backlog's busy days, so the check above is not vacuous.
    expect(capDays).toBeGreaterThan(10);
  });

  it('then S-a: every seeded item is answered, and the backlog stays within its pins', () => {
    const sim = seeded();
    scenarioA(sim, DAYS);
    const unanswered = [...seed.states.keys()].filter((id) => (sim.rows[id]?.st.n ?? 0) === 0);
    expect(unanswered).toEqual([]);
    // Section 4.3 sets no pool line for S-c. Measured on this build (every seeded item at box 1 under CM-12's cautious seed box): the opening
    // pool peaks at 414 on day 42 and 190 are left on day 60 (decision record, owner-visible risk).
    expect(Math.max(...sim.days.map((d) => d.pool)), series(sim, 'pool')).toBeLessThanOrEqual(440);
    expect(sim.days[59]?.left, series(sim, 'left')).toBeLessThanOrEqual(210);
    expect(sim.days[59]?.left, series(sim, 'left')).toBeLessThan(Math.max(...sim.days.map((d) => d.left)));
  });
});

describe('S-d: any number of right answers to one item in one day', () => {
  it('the box rises by 1 or less and falls by 1 or less, through sessions and credits', () => {
    // A real sentence of this build and a taught word inside it.
    const pat = INDEX.items.find((i) => i.kind === 'pat' && wordsInside(i, INDEX).length > 0) as ReviewItem;
    const word = wordsInside(pat, INDEX)[0] as string;
    expect(INDEX.byId.get(word)?.kind).toBe('lex');
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }),
        fc.integer({ min: -3, max: 3 }),
        fc.array(fc.record({ correct: fc.boolean(), hinted: fc.boolean(), viaSentence: fc.boolean() }), { minLength: 1, maxLength: 15 }),
        (box, dueIn, steps) => {
          const day = START_DAY;
          let row: { st: Parameters<typeof applyAnswer>[0] } & DayFacts = box === 0 ? { st: undefined } : { st: { b: box, d: addDays(day, dueIn), c: 1, r: 1, n: 3, f: '2026-10-01', s: box, at: '2026-10-30T09:00:00.000Z' } };
          const before = row.st?.b ?? 0;
          let [high, low] = [before, before];
          for (const step of steps) {
            const states = row.st ? { [word]: { st: row.st, ...(row.l ? { l: row.l } : {}) } } : {};
            const answer = step.viaSentence
              ? { itemId: pat.id, correct: step.correct, hinted: step.correct && step.hinted, rung: 'read' as const }
              : { itemId: word, correct: step.correct, hinted: step.correct && step.hinted, rung: 'read' as const };
            for (const a of withSentenceCredit({ index: INDEX, states, today: day, voice: true }, [answer])) {
              if (a.itemId !== word) continue;
              const out = applyAnswer(row.st, row, a, day, `${day}T10:00:00.000Z`);
              row = { st: out.state, ...out.facts };
              high = Math.max(high, out.state.b);
              low = Math.min(low, out.state.b);
            }
          }
          // Along the whole day, not only its end: never up 2, never down 2, at any step.
          expect(high - before).toBeLessThanOrEqual(1);
          expect(before - low).toBeLessThanOrEqual(1);
          expect(before === 0 || high === before || low === before).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('S-e: one quest-day introduces 8 items, then S-a', () => {
  it('no item reaches box 3 before day 4', () => {
    const plans = questPlans();
    const eight = plans.flatMap((p) => p.introduces).slice(0, 8);
    const first = { ...(plans[0] as (typeof plans)[number]), introduces: eight, recycles: [] };
    const rest = plans.map((p) => ({ ...p, introduces: p.introduces.filter((id) => !eight.includes(id)) }));
    const sim = new Sim(1, DEFAULT_KNOBS, [first, ...rest]);
    scenarioA(sim, DAYS);
    expect(eight.every((id) => sim.intro.get(id) === 0)).toBe(true);
    expect(eight.filter((id) => sim.held3.has(id)).length).toBeGreaterThan(0);
    for (const [id, day] of sim.held3) expect(day - (sim.intro.get(id) as number)).toBeGreaterThanOrEqual(4);
    expect(Math.min(...eight.map((id) => sim.held3.get(id) ?? Number.POSITIVE_INFINITY))).toBeGreaterThanOrEqual(4);
  });
});
