import { describe, expect, it } from 'vitest';
import { isTelemetryEventName } from '@hangul-route/content-schema';
import { buildMyRoute } from '../model';
import type { MyRouteInput, MyRouteModel } from '../types';
import { continueTappedEvent, stageOpenedEvent, viewedEvent } from '../telemetry';
import { BUNDLE_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith } from './fixtures/bundle-2026-10';

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

describe('route_map.* events (F-ROUTE-001 section 3.16: stage keys, booleans and codes only; active profile only)', () => {
  it('viewed: the entry, the here stage, whether a start marker or a weekly plan exists, and the goal source', () => {
    const e = viewedEvent({ profileId: 'p1', model: model(['quest:stage2-life-q1']), source: 'journey', readOnly: false });
    expect(e).toEqual({ name: 'route_map.viewed', profileId: 'p1', payload: { source: 'journey', stage: 'stage1', hasStart: false, hasPlan: false, goalFrom: 'default' } });
    expect(isTelemetryEventName(e?.name)).toBe(true);
  });

  it('viewed from the Route tab (LR-4): source tab, the only entry that sends it', () => {
    const e = viewedEvent({ profileId: 'p1', model: model([]), source: 'tab', readOnly: false });
    expect(e).toEqual({ name: 'route_map.viewed', profileId: 'p1', payload: { source: 'tab', stage: 'stage1', hasStart: false, hasPlan: false, goalFrom: 'default' } });
  });

  it('viewed (LR-5a): goalFrom names the plan that sets the goal, with hasPlan; none at the end of the open road', () => {
    const goal = (from: 'class' | 'self') => ({ ...model([]), goal: { stage: 'stage2' as const, from, sourceId: 'plan:x', endsOn: '2026-11-01', reached: false, taste: true } });
    expect(viewedEvent({ profileId: 'p1', model: goal('class'), source: 'tab', readOnly: false })?.payload).toMatchObject({ hasPlan: true, goalFrom: 'class' });
    expect(viewedEvent({ profileId: 'p1', model: goal('self'), source: 'tab', readOnly: false })?.payload).toMatchObject({ hasPlan: true, goalFrom: 'self' });
    const end = model(BUNDLE_8.quests.map((q) => q.id));
    expect(end.goal).toBeNull();
    expect(viewedEvent({ profileId: 'p1', model: end, source: 'tab', readOnly: false })?.payload).toMatchObject({ hasPlan: false, goalFrom: 'none' });
    // Codes only: no plan id, no date.
    expect(JSON.stringify(viewedEvent({ profileId: 'p1', model: goal('class'), source: 'tab', readOnly: false })?.payload)).not.toMatch(/plan:x|2026/);
  });

  it('stage_opened and continue_tapped', () => {
    expect(stageOpenedEvent({ profileId: 'p1', stage: 'stage3', readOnly: false })).toEqual({ name: 'route_map.stage_opened', profileId: 'p1', payload: { stage: 'stage3' } });
    expect(continueTappedEvent({ profileId: 'p1', model: model([]), readOnly: false })).toEqual({
      name: 'route_map.continue_tapped',
      profileId: 'p1',
      payload: { stage: 'stage1', hero: 'start', from: 'cursor' },
    });
    expect(continueTappedEvent({ profileId: 'p1', model: model(['quest:stage1-letters-q1']), readOnly: false })?.payload).toEqual({ stage: 'stage1', hero: 'continue', from: 'cursor' });
  });

  it('continue_tapped carries from: where the one next comes from (LR-5a, F-ENT-003 NextSource)', () => {
    for (const source of ['class', 'school', 'family', 'self', 'cursor'] as const) {
      const routeNext = { kind: 'quest' as const, questId: 'quest:stage1-life-q1', episodeId: 'episode:stage1-life', stage: 'stage1' as const, source, sourceId: null };
      expect(continueTappedEvent({ profileId: 'p1', model: model(['quest:stage1-letters-q1'], { routeNext }), readOnly: false })?.payload).toEqual({ stage: 'stage1', hero: 'continue', from: source });
    }
    expect(continueTappedEvent({ profileId: 'p1', model: model(['quest:stage1-letters-q1'], { routeNext: { kind: 'free-end', placedOut: false } }), readOnly: false })).toBeNull();
  });

  it('continue_tapped only for the quest button (start or continue), never at rest', () => {
    expect(continueTappedEvent({ profileId: 'p1', model: model(BUNDLE_8.quests.map((q) => q.id)), readOnly: false })).toBeNull();
  });

  it('read-only (a grown-up viewing a child) sends nothing', () => {
    expect(viewedEvent({ profileId: 'p2', model: model([]), source: 'parent', readOnly: true })).toBeNull();
    expect(stageOpenedEvent({ profileId: 'p2', stage: 'stage1', readOnly: true })).toBeNull();
    expect(continueTappedEvent({ profileId: 'p2', model: model([]), readOnly: true })).toBeNull();
  });
});
