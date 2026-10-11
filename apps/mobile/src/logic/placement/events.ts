import {
  legacyLengthOf,
  modeOf,
  type AssessmentResponse,
  type PlacementGate,
  type PlacementMode,
  type PlacementResult,
  type PlacementSource,
  type TelemetryEventName,
  type UiLocale,
} from '@hangul-route/content-schema';

/**
 * The level check's telemetry events (F-PLC-001 section 3.13, AM-34): ids,
 * codes and counts only, never option text or `learnerType`. The screens pass
 * these to `platform/telemetry` `track`.
 */

export interface PlacementTelemetryEvent<P> {
  name: TelemetryEventName;
  profileId: string;
  payload: P;
}

export interface StartPayloadInput {
  source: PlacementSource;
  testLocale: UiLocale;
  mode: PlacementMode;
  revealMode: 'tap' | 'always';
  /** The profile's D1 level id (`ageGroup`), or null when unknown. */
  level: string | null;
}

/** When the first scored question is shown. `length` is the legacy `quick` | `full`. */
export function startEvent(profileId: string, input: StartPayloadInput) {
  return {
    name: 'placement.start',
    profileId,
    payload: {
      source: input.source,
      testLocale: input.testLocale,
      length: legacyLengthOf(input.mode),
      mode: input.mode,
      revealMode: input.revealMode,
      level: input.level,
    },
  } satisfies PlacementTelemetryEvent<Record<string, unknown>>;
}

/** Each scored response. */
export function itemAnsweredEvent(profileId: string, response: AssessmentResponse, gate: PlacementGate) {
  return {
    name: 'placement.item_answered',
    profileId,
    payload: { itemId: response.questionId, gate, outcome: response.outcome, assisted: response.assisted, ms: response.ms },
  } satisfies PlacementTelemetryEvent<Record<string, unknown>>;
}

/** When the result is computed. `strandsSecure` is a count. */
export function completeEvent(profileId: string, result: Omit<PlacementResult, 'mode'> & { mode?: PlacementMode }) {
  return {
    name: 'placement.complete',
    profileId,
    payload: {
      stopReason: result.stopReason,
      asked: result.responses.length,
      stage: result.level.stage,
      band: result.level.band,
      oralStage: result.oralStage,
      beyondContent: result.beyondContent,
      strandsSecure: Object.values(result.strands).filter((s) => s === 'secure').length,
      mode: modeOf(result),
    },
  } satisfies PlacementTelemetryEvent<Record<string, unknown>>;
}

/** "I am new to Korean" on the fork, or Home's "Not now". */
export function skippedEvent(profileId: string, source: 'onboarding' | 'home') {
  return {
    name: 'placement.skipped',
    profileId,
    payload: { source },
  } satisfies PlacementTelemetryEvent<Record<string, unknown>>;
}
