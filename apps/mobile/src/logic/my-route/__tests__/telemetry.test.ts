import { describe, expect, it } from 'vitest';
import { isTelemetryEventName } from '@hangul-route/content-schema';
import { buildMyRoute } from '../model';
import type { MyRouteModel } from '../types';
import { continueTappedEvent, stageOpenedEvent, viewedEvent } from '../telemetry';
import { BUNDLE_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith } from './fixtures/bundle-2026-10';

const model = (done: string[]): MyRouteModel =>
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

describe('route_map.* events (F-ROUTE-001 section 3.16: stage keys, booleans and codes only; active profile only)', () => {
  it('viewed: the entry, the here stage, whether a start marker or a weekly plan exists', () => {
    const e = viewedEvent({ profileId: 'p1', model: model(['quest:stage2-life-q1']), source: 'journey', hasPlan: false, readOnly: false });
    expect(e).toEqual({ name: 'route_map.viewed', profileId: 'p1', payload: { source: 'journey', stage: 'stage1', hasStart: false, hasPlan: false } });
    expect(isTelemetryEventName(e?.name)).toBe(true);
  });

  it('stage_opened and continue_tapped', () => {
    expect(stageOpenedEvent({ profileId: 'p1', stage: 'stage3', readOnly: false })).toEqual({ name: 'route_map.stage_opened', profileId: 'p1', payload: { stage: 'stage3' } });
    expect(continueTappedEvent({ profileId: 'p1', model: model([]), readOnly: false })).toEqual({
      name: 'route_map.continue_tapped',
      profileId: 'p1',
      payload: { stage: 'stage1', hero: 'start' },
    });
    expect(continueTappedEvent({ profileId: 'p1', model: model(['quest:stage1-letters-q1']), readOnly: false })?.payload).toEqual({ stage: 'stage1', hero: 'continue' });
  });

  it('continue_tapped only for the quest button (start or continue), never at rest', () => {
    expect(continueTappedEvent({ profileId: 'p1', model: model(BUNDLE_8.quests.map((q) => q.id)), readOnly: false })).toBeNull();
  });

  it('read-only (a grown-up viewing a child) sends nothing', () => {
    expect(viewedEvent({ profileId: 'p2', model: model([]), source: 'parent', hasPlan: false, readOnly: true })).toBeNull();
    expect(stageOpenedEvent({ profileId: 'p2', stage: 'stage1', readOnly: true })).toBeNull();
    expect(continueTappedEvent({ profileId: 'p2', model: model([]), readOnly: true })).toBeNull();
  });
});
