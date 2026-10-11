/**
 * Who the My route page shows, and how (F-ROUTE-001 section 3.1). No
 * `profileId`, or the active one: the learner's own page. Another profile on
 * this device: read-only and written about that learner, but only while the
 * grown-up gate is open (`gateOpensDirectly`: a session is open, or a
 * self-only device has no PIN); otherwise the PIN screen opens instead, so a
 * later deep link can never show a sibling's progress without the gate. An id
 * this device does not hold falls back to the active learner.
 */
export type MyRouteAccess =
  | { kind: 'self'; profileId: string }
  | { kind: 'readOnly'; profileId: string }
  | { kind: 'gate'; profileId: string }
  | { kind: 'none' };

export function myRouteAccess(i: {
  requestedId: string | undefined;
  activeId: string | null;
  profiles: readonly { id: string }[];
  gateOpen: boolean;
}): MyRouteAccess {
  const id = i.requestedId;
  if (id !== undefined && id !== i.activeId && i.profiles.some((p) => p.id === id)) {
    return i.gateOpen ? { kind: 'readOnly', profileId: id } : { kind: 'gate', profileId: id };
  }
  return i.activeId === null ? { kind: 'none' } : { kind: 'self', profileId: i.activeId };
}
