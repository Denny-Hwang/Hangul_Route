import type { StageKey } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MyRouteModel, StageRow } from './types';

/**
 * The three `route_map.*` events (F-ROUTE-001 section 3.16). Payloads carry
 * stage keys, booleans and codes only, and only for the active profile: a
 * grown-up viewing another profile read-only sends nothing (null).
 */

/** Where the page was opened from: the Journey header (R-3), the Home strip, the level-check result, the parent dashboard. */
export type MyRouteSource = 'home' | 'journey' | 'result' | 'parent';

/** Exactly one stage is `here` (section 3.3). */
const hereOf = (model: MyRouteModel): StageKey => (model.stages.find((s) => s.here) as StageRow).stage;

export function viewedEvent(i: { profileId: string; model: MyRouteModel; source: MyRouteSource; hasPlan: boolean; readOnly: boolean }): TelemetryEvent | null {
  if (i.readOnly) return null;
  return {
    name: 'route_map.viewed',
    profileId: i.profileId,
    payload: { source: i.source, stage: hereOf(i.model), hasStart: i.model.start !== null, hasPlan: i.hasPlan },
  };
}

export function stageOpenedEvent(i: { profileId: string; stage: StageKey; readOnly: boolean }): TelemetryEvent | null {
  return i.readOnly ? null : { name: 'route_map.stage_opened', profileId: i.profileId, payload: { stage: i.stage } };
}

/** The hero button when it opens the cursor quest (hero `start` or `continue`); the rest and beyond buttons are not tracked. */
export function continueTappedEvent(i: { profileId: string; model: MyRouteModel; readOnly: boolean }): TelemetryEvent | null {
  const { hero } = i.model;
  if (i.readOnly || (hero !== 'start' && hero !== 'continue')) return null;
  return { name: 'route_map.continue_tapped', profileId: i.profileId, payload: { stage: hereOf(i.model), hero } };
}
