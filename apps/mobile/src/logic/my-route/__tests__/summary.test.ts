import { JourneySummarySchema, ProgressSnapshotSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildMyRoute } from '../model';
import { journeySummaryOf, summarizeJourney, type JourneyContent } from '../summary';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { seed } from './fixtures/route';

const model = (done: string[], bundle: Bundle = BUNDLE_8, extra = {}, route = null as ReturnType<typeof seed> | null) =>
  buildMyRoute({
    snapshot: snapshotWith(done, extra),
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
    route,
    now: new Date('2026-10-11T00:00:00.000Z'),
  });

describe('summarizeJourney (F-ROUTE-001 section 3.12)', () => {
  it('Appendix C', () => {
    const summary = summarizeJourney(model(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1']));
    expect(summary.v).toBe(1);
    expect(summary.here).toBe('stage1');
    expect(summary.stages.slice(0, 4)).toEqual([
      { stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 },
      { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 },
      { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
      { stage: 'stage4', state: 'open', done: 0, known: 0, total: 1 },
    ]);
  });

  it('equals the rows, with at most seven entries', () => {
    const m = model([], BUNDLE_8, {}, seed(STAGE1_8));
    const summary = summarizeJourney(m);
    expect(summary.stages).toHaveLength(7);
    expect(summary.stages.length).toBeLessThanOrEqual(7);
    summary.stages.forEach((s, i) => {
      const r = m.stages[i];
      expect(s).toEqual({ stage: r?.stage, state: r?.state, done: r?.done, known: r?.known, total: (r?.pips.filter((p) => p.kind === 'quest').length ?? 0) + (r?.newPips.length ?? 0) });
    });
    expect(summary.stages[0]).toMatchObject({ state: 'known', known: 8, done: 0 });
  });

  it('counts new quests of a latched stage in the total', () => {
    const summary = summarizeJourney(model(STAGE1_8, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } }));
    expect(summary.stages[0]).toEqual({ stage: 'stage1', state: 'complete', done: 8, known: 0, total: 15 });
  });

  it('has a null here only for a model without a here row', () => {
    const m = model([]);
    expect(summarizeJourney({ ...m, stages: m.stages.map((s) => ({ ...s, here: false })) }).here).toBeNull();
  });

  it('is small: stage-level counts only', () => {
    const summary = summarizeJourney(model(STAGE1_8));
    expect(JSON.stringify(summary).length).toBeLessThan(600);
    expect(Object.keys(summary).sort()).toEqual(['here', 'stages', 'v']);
  });
});

describe('the wire shape (F-ROUTE-001 R-8)', () => {
  it('parses with JourneySummarySchema unchanged, at most seven entries', () => {
    for (const m of [model([]), model(STAGE1_8), model([], BUNDLE_8, {}, seed(STAGE1_8)), model(STAGE1_8, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } })]) {
      const summary = summarizeJourney(m);
      expect(JourneySummarySchema.parse(summary)).toEqual(summary);
      expect(summary.stages.length).toBeLessThanOrEqual(7);
    }
  });
});

describe('journeySummaryOf: the sync-store input (F-ROUTE-001 R-8)', () => {
  const content = (bundle: Bundle = BUNDLE_8): JourneyContent => ({
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
  });
  const now = new Date('2026-10-11T00:00:00.000Z');

  it('equals summarizeJourney(buildMyRoute(...)) with no route until R-7a', () => {
    const snapshot = snapshotWith(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1']);
    const summary = journeySummaryOf(snapshot, content(), now);
    expect(summary).toEqual(summarizeJourney(buildMyRoute({ snapshot, ...content(), route: null, now })));
    expect(summary?.stages[0]).toEqual({ stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 });
  });

  it('a fresh learner sends seven stages, here on Stage 1, nothing done', () => {
    const summary = journeySummaryOf(ProgressSnapshotSchema.parse(snapshotWith([])), content(), now);
    expect(summary?.here).toBe('stage1');
    expect(summary?.stages).toHaveLength(7);
    expect(summary?.stages.every((s) => s.done === 0 && s.known === 0)).toBe(true);
  });

  it('never throws: a snapshot it cannot read gives no journey, so the upload goes on without it', () => {
    const broken = { ...snapshotWith([]), quests: null } as unknown as Parameters<typeof journeySummaryOf>[0];
    expect(journeySummaryOf(broken, content(), now)).toBeUndefined();
  });
});
