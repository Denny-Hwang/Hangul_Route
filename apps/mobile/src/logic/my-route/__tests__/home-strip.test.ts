import { describe, expect, it } from 'vitest';
import { getMessages } from '@hangul-route/i18n';
import { homeStripView, type HomeStripInput } from '../home-strip';
import { buildMyRoute } from '../model';
import type { MyRouteModel } from '../types';
import { stageGroups } from '../view';
import { copyViolations } from './copy-rules';
import { BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith } from './fixtures/bundle-2026-10';

/**
 * The Home route strip (F-ROUTE-001 R-4b, section 3.1 entry 2; amendment
 * LR-A6; wireframes `journey/learning-route.md` H and `journey/my-route-overview.md` D):
 * the title Learning Route, "You are on Stage N: Title", the `here` stage's
 * pips, and the goal and weekly plan lines only when they exist.
 */

const EN = getMessages('en');

const model = (done: readonly string[]): MyRouteModel =>
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
  });

const strip = (m: MyRouteModel, over: Partial<HomeStripInput> = {}) => homeStripView({ model: m, messages: EN, ...over });

describe('homeStripView', () => {
  it('names the page Learning Route and says where the learner is', () => {
    const v = strip(model([]));
    expect(v.title).toBe('Learning Route');
    expect(v.here).toBe('You are on Stage 1: Hangul.');
    expect(v.stage).toBe('stage1');
  });

  it('draws the here stage pips, the same groups as its row on the page', () => {
    const m = model(STAGE1_8.slice(0, 3));
    const here = m.stages.find((s) => s.here);
    expect(here?.stage).toBe('stage1');
    const v = strip(m);
    expect(v.groups).toEqual(stageGroups(here as NonNullable<typeof here>));
    expect(v.groups[0]?.filter((p) => p.state === 'done')).toHaveLength(3);
  });

  it('follows the here stage when it moves past Stage 1', () => {
    const v = strip(model(STAGE1_8));
    const here = model(STAGE1_8).stages.find((s) => s.here);
    expect(v.stage).toBe(here?.stage);
    expect(v.here).toBe(EN.learner.myRoute.hero.here(here?.order ?? 0, here?.title ?? ''));
  });

  it('has no goal line and no week line until they exist', () => {
    const v = strip(model([]));
    expect(v.goal).toBeNull();
    expect(v.week).toBeNull();
    expect(strip(model([]), { goalStage: null, week: null })).toEqual(v);
  });

  it('shows the goal stage by its number and title', () => {
    const v = strip(model([]), { goalStage: 'stage2' });
    expect(v.goal).toBe('Goal: Stage 2 · Words');
  });

  it('shows the goal even when it is the stage the learner is on', () => {
    expect(strip(model([]), { goalStage: 'stage1' }).goal).toBe('Goal: Stage 1 · Hangul');
  });

  it('drops a goal stage the route does not know', () => {
    expect(strip(model([]), { goalStage: 'stage9' as never }).goal).toBeNull();
  });

  it('shows the weekly plan week only for a whole week number from 1', () => {
    expect(strip(model([]), { week: 3 }).week).toBe('Week 3 of your weekly plan');
    expect(strip(model([]), { week: 1 }).week).toBe('Week 1 of your weekly plan');
    for (const bad of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(strip(model([]), { week: bad }).week).toBeNull();
  });

  it('reads as one button label: title, where, goal and week, without the middle dot', () => {
    expect(strip(model([])).a11yLabel).toBe('Learning Route. You are on Stage 1: Hangul.');
    const full = strip(model([]), { goalStage: 'stage2', week: 3 }).a11yLabel;
    expect(full).toBe('Learning Route. You are on Stage 1: Hangul. Goal: Stage 2, Words. Week 3 of your weekly plan.');
    expect(full).not.toContain('·');
  });

  it('keeps the copy rules: no ratio, no percent, no count of what is left', () => {
    const v = strip(model(STAGE1_8.slice(0, 5)), { goalStage: 'stage2', week: 2 });
    for (const text of [v.title, v.here, v.goal, v.week]) expect(copyViolations(text ?? '', 'en', 'learner', [1, 2, 5])).toEqual([]);
    expect(copyViolations(v.a11yLabel, 'en', 'a11y')).toEqual([]);
    expect(v.title.toLowerCase()).not.toContain('my route');
  });

  it('reads es and ko dictionaries (English fallback until native review)', () => {
    for (const locale of ['es', 'ko'] as const) {
      const v = homeStripView({ model: model([]), messages: getMessages(locale), goalStage: 'stage2', week: 3 });
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.goal).not.toBeNull();
      expect(v.week).not.toBeNull();
    }
  });
});
