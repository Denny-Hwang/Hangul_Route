/**
 * F-AUTH-004 section 8.1 (row NS-2; anti-shame, CLAUDE.md section 1): the order of every list on a native grown-up
 * home, whatever order the server sent. The roster route sorts by last activity (`routes/spaces.ts`) and
 * `GET /api/spaces` newest first; neither order may reach the screen. Pure and stable: the input is not changed.
 *
 * - Learners: by the day they joined the space (`joinedAt`, oldest first), then by id.
 * - Spaces: live ones first, then archived ones; each group oldest first (`createdAt`), then by id.
 *
 * No list is ever sorted by activity, minutes or progress.
 */

/** ISO times compare as text; ids break ties so the order never depends on the server's. */
function byTimeThenId(a: { at: string; id: string }, b: { at: string; id: string }): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export interface OrderableLearner {
  id: string;
  joinedAt: string;
}

export function orderLearners<T extends OrderableLearner>(learners: readonly T[]): T[] {
  return [...learners].sort((a, b) => byTimeThenId({ at: a.joinedAt, id: a.id }, { at: b.joinedAt, id: b.id }));
}

/** A `GET /api/spaces` item, as far as the order reads it. */
export interface OrderableSpace {
  space: { id: string; createdAt: string; archivedAt: string | null };
}

export function orderSpaces<T extends OrderableSpace>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const archivedA = a.space.archivedAt !== null;
    const archivedB = b.space.archivedAt !== null;
    if (archivedA !== archivedB) return archivedA ? 1 : -1;
    return byTimeThenId({ at: a.space.createdAt, id: a.space.id }, { at: b.space.createdAt, id: b.space.id });
  });
}
