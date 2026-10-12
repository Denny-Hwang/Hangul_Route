/**
 * Who the My route page shows, and how (F-ROUTE-001 section 3.1). No
 * `profileId`, or the active one: the learner's own page. Another profile on
 * this device: read-only and written about that learner, but only while the
 * grown-up gate is open (`gateOpensDirectly`: a session is open, or a
 * self-only device has no PIN); otherwise the PIN screen opens instead, so a
 * later deep link can never show a sibling's progress without the gate. An id
 * this device does not hold falls back to the active learner.
 *
 * `entry` (amendment section 5.1, LR-4):
 * - `'tab'`: the learner's Route tab, as above.
 * - `'grownup'`: the root-stack screen, opened only by a grown-up (the parent
 *   dashboard row, R-9b, and the PIN screen it may pass through). Always
 *   read-only, also for the active profile, so a grown-up never plays as the
 *   learner, sends the learner's telemetry or writes the learner's seen record.
 *   It never resolves to `self`; an id this device does not hold, or none,
 *   shows nothing.
 */
export type MyRouteAccess =
  | { kind: 'self'; profileId: string }
  | { kind: 'readOnly'; profileId: string }
  | { kind: 'gate'; profileId: string }
  | { kind: 'none' };

export type MyRouteEntry = 'tab' | 'grownup';

export function myRouteAccess(i: {
  entry: MyRouteEntry;
  requestedId: string | undefined;
  activeId: string | null;
  profiles: readonly { id: string }[];
  gateOpen: boolean;
}): MyRouteAccess {
  const id = i.requestedId;
  if (i.entry === 'grownup') {
    if (id === undefined || !i.profiles.some((p) => p.id === id)) return { kind: 'none' };
    return i.gateOpen ? { kind: 'readOnly', profileId: id } : { kind: 'gate', profileId: id };
  }
  if (id !== undefined && id !== i.activeId && i.profiles.some((p) => p.id === id)) {
    return i.gateOpen ? { kind: 'readOnly', profileId: id } : { kind: 'gate', profileId: id };
  }
  return i.activeId === null ? { kind: 'none' } : { kind: 'self', profileId: i.activeId };
}

/**
 * The entry of the root-stack screen from its params. Its params are
 * `{ profileId, viewer: 'grownup' }`, both required (section 5.1); anything
 * else is an old call and reads as the tab entry, so the active learner
 * resolves to `self` and the screen moves to the tab (`selfEntryTab`).
 */
export function myRouteEntryOf(params: unknown): MyRouteEntry {
  if (typeof params !== 'object' || params === null) return 'tab';
  const { profileId, viewer } = params as { profileId?: unknown; viewer?: unknown };
  return viewer === 'grownup' && typeof profileId === 'string' ? 'grownup' : 'tab';
}

/**
 * Where the root-stack screen sends a learner who reached it as `self`: the
 * Route tab, so there is one learner page in the history, never a second
 * copy. With the tab off (`flags.myRouteEnabled`), Today.
 */
export function selfEntryTab(myRouteEnabled: boolean): 'Route' | 'Home' {
  return myRouteEnabled ? 'Route' : 'Home';
}
