import type { TelemetryEvent } from '../../store';

/**
 * The text of stored telemetry events for a "no personal words" check.
 *
 * An event id is random (`event:j1jmcjmn7mom`), so a short word such as `mom`
 * can appear inside it by chance. The id carries no learner data, so it is left
 * out; every field that could hold personal data (profileId, payload, name, at)
 * stays in.
 */
export function eventText(events: TelemetryEvent | readonly TelemetryEvent[]): string {
  const list = Array.isArray(events) ? events : [events as TelemetryEvent];
  return JSON.stringify(list.map(({ id: _id, ...kept }) => kept));
}
