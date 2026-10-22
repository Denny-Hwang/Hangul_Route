/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON GU-D15, CS-G7 (row GU-2): the rule every telemetry event passes in `track()`
 * before validation, listeners, the network and the queue. It returns the event to send (a guest run's events
 * without their `profileId`), or `null` for one not to send. Set once by `store/guest-store.ts`. A module of its own
 * with no imports, so the All lessons root, which loads `telemetry.ts`, never loads a learner store, and a test that
 * stands in for `telemetry.ts` leaves the rule in place.
 */

/** The fields of an event the rule reads and may drop. */
export interface FilterableEvent {
  name: string;
  profileId?: string;
  payload?: Record<string, unknown>;
}

type TelemetryProfileFilter = <E extends FilterableEvent>(event: E) => E | null;
let profileFilter: TelemetryProfileFilter | null = null;

/** Sets the rule; `null` lifts it. */
export function setTelemetryProfileFilter(filter: TelemetryProfileFilter | null): void {
  profileFilter = filter;
}

/** The event after the rule. A rule that throws sends the event without its `profileId` (the safe side). */
export function filteredEvent<E extends FilterableEvent>(event: E): E | null {
  if (!profileFilter) return event;
  try {
    return profileFilter(event);
  } catch {
    const { profileId: _dropped, ...rest } = event;
    return rest as E;
  }
}
