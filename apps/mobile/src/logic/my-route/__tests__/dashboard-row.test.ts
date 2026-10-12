import { describe, expect, it } from 'vitest';
import type { StageKey } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { SEGMENT_SHAPE, dashboardRowView, type DashboardRowInput } from '../dashboard-row';
import { buildMyRoute } from '../model';
import type { MyRouteInput, MyRouteModel } from '../types';
import { BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith } from './fixtures/bundle-2026-10';

/**
 * F-ROUTE-001 R-9b (section 3.12 "In-app parent dashboard", amendment LR-A6;
 * wireframes `design/wireframes/journey/my-route-overview.md` H and
 * `design/wireframes/parent/learning-route.md` L1a): the Learning Route row on
 * each profile card of the in-app parent dashboard.
 */

const EN = getMessages('en');

const model = (done: string[], over: Partial<MyRouteInput> = {}): MyRouteModel =>
  buildMyRoute({
    snapshot: snapshotWith(done),
    catalog: catalogOf(BUNDLE_8),
    episodes: BUNDLE_8.episodes,
    quests: BUNDLE_8.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
    route: null,
    now: new Date('2026-10-11T00:00:00.000Z'),
    ...over,
  });

const row = (m: MyRouteModel, over: Partial<DashboardRowInput> = {}) =>
  dashboardRowView({ model: m, messages: EN, name: 'Sam', started: null, ...over });

describe('dashboardRowView: the words of the row', () => {
  it('is titled Learning Route and its button says See Learning Route', () => {
    const v = row(model([]));
    expect(v.title).toBe('Learning Route');
    expect(v.cta).toBe('See Learning Route');
  });

  it('says where the learner is now, from the here stage', () => {
    expect(row(model([])).now).toBe('Now: Stage 1 · Hangul');
    expect(row(model(STAGE1_8)).now).toBe('Now: Stage 2 · Words');
  });

  it('draws no goal line without a goal (pickGoal, LR-3a, feeds it later)', () => {
    expect(row(model([])).goal).toBeNull();
    expect(row(model([]), { goalStage: null }).goal).toBeNull();
  });

  it('draws the goal line from the goal stage when one is passed', () => {
    const v = row(model([]), { goalStage: 'stage2' });
    expect(v.goal).toBe('Goal: Stage 2 · Words');
    expect(v.a11y.goal).toBe('Goal: Stage 2, Words.');
  });

  it('ignores a goal stage the model does not hold', () => {
    expect(row(model([]), { goalStage: 'stage9' as StageKey }).goal).toBeNull();
  });

  it('draws the started line only with a level check', () => {
    expect(row(model([])).started).toBeNull();
    const v = row(model([]), { started: { stage: 'stage1', band: 'Letters and sounds', date: 'Oct 9' } });
    expect(v.started).toBe('Started: Stage 1 · Letters and sounds · Oct 9');
    expect(v.a11y.started).toBe('Started: Stage 1, Letters and sounds, Oct 9.');
  });

  it('a started stage that is not a stage key draws no started line', () => {
    expect(row(model([]), { started: { stage: 'stage0' as StageKey, band: 'x', date: 'Oct 9' } }).started).toBeNull();
  });

  it('reads the lines aloud in the third person, without the middle dot', () => {
    const v = row(model([]), { goalStage: 'stage1', started: { stage: 'stage1', band: 'Letters and sounds', date: 'Oct 9' } });
    expect(v.a11y).toEqual({ now: 'Sam is on Stage 1: Hangul.', goal: 'Goal: Stage 1, Hangul.', started: 'Started: Stage 1, Letters and sounds, Oct 9.' });
    expect(row(model([])).a11y).toEqual({ now: 'Sam is on Stage 1: Hangul.', goal: null, started: null });
    for (const text of Object.values(v.a11y)) expect(text).not.toContain('·');
  });

  it('carries the one skills note and the tiles line only when tiles were spelled', () => {
    const v = row(model([]));
    expect(v.note).toBe(EN.caregiver.skillsNote);
    expect(v.tiles).toBeNull();
  });
});

describe('dashboardRowView: the seven segments', () => {
  it('always seven, in stage order, one here', () => {
    const v = row(model(['quest:stage1-letters-q1']));
    expect(v.segments.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(v.segments.filter((s) => s.here).map((s) => s.stage)).toEqual(['stage1']);
  });

  it('each segment carries its stage state, never a count or a ratio', () => {
    const m = model(STAGE1_8);
    const v = row(m);
    expect(v.segments.map((s) => s.state)).toEqual(m.stages.map((s) => s.state));
    expect(v.segments[0]?.state).toBe('complete');
    for (const s of v.segments) expect(Object.keys(s).sort()).toEqual(['a11yLabel', 'here', 'order', 'stage', 'state']);
  });

  it('the screen-reader list reads each stage in words about the child', () => {
    const v = row(model(['quest:stage1-letters-q1']));
    expect(v.segmentsLabel).toBe(EN.a11y.myRoute.trail);
    expect(v.segments[0]?.a11yLabel).toBe('Stage 1, Hangul. Open. Sam is here. 1 quest played.');
    expect(v.segments[2]?.a11yLabel).toBe('Stage 3, Sentences. Coming later.');
    for (const s of v.segments) expect(s.a11yLabel).not.toMatch(/\byou\b/i);
  });
});

describe('SEGMENT_SHAPE: one drawn shape per stage state', () => {
  it('covers the five states, each with its own geometry', () => {
    expect(Object.keys(SEGMENT_SHAPE).sort()).toEqual(['complete', 'explored', 'known', 'later', 'open']);
    const shapes = Object.values(SEGMENT_SHAPE).map((s) => `${s.pip}:${s.checkOnly}`);
    expect(new Set(shapes).size).toBe(5);
  });

  it('explored is never drawn as complete, and known never as done', () => {
    expect(SEGMENT_SHAPE.complete).toEqual({ pip: 'done', checkOnly: false });
    expect(SEGMENT_SHAPE.explored).toEqual({ pip: 'done', checkOnly: true });
    expect(SEGMENT_SHAPE.known.pip).toBe('known');
    expect(SEGMENT_SHAPE.later.pip).toBe('later');
  });
});

describe('dashboardRowView: the three mini rows', () => {
  it('read, listen and write only, never speaking', () => {
    expect(row(model([])).skills.map((s) => s.skill)).toEqual(['read', 'listen', 'write']);
  });

  it('a row with no finished quest says so kindly and draws no mark', () => {
    const v = row(model([]));
    for (const s of v.skills) {
      expect(s.marks).toEqual([]);
      expect(s.detail).toBe('Ready when Sam is');
    }
  });

  it('marks only fill, with an absolute count about the child', () => {
    const v = row(model(STAGE1_8));
    const read = v.skills.find((s) => s.skill === 'read');
    expect(read?.marks.length).toBeGreaterThan(0);
    expect(read?.detail).toMatch(/^In \d+ quests? Sam finished$/);
    expect(read?.a11yLabel).toBe(`Read. ${read?.detail}.`);
  });

  it('shows the tiles line in the third-person wording when tile games were finished', () => {
    const m = { ...model([]), tiles: 2 };
    expect(row(m).tiles).toBe('Spelling with tiles: 2 quests');
  });
});
