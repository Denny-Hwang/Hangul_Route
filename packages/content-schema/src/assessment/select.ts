import { shuffleSeeded } from './rng';

export interface SelectSpreadInput<T extends { readonly id: string }> {
  candidates: readonly T[];
  count: number;
  rng: () => number;
  /** Candidate ids to leave out. */
  exclude?: readonly string[] | ReadonlySet<string>;
  /** Groups the candidates (symbol key, group, ...): every group is used once before any is used twice. */
  spreadBy: (candidate: T) => string;
  filter?: (candidate: T) => boolean;
}

/**
 * Picks up to `count` candidates: filter and exclude first, then spread over the
 * distinct `spreadBy` values (round-robin, group order reshuffled every round)
 * before repeating one. Returns what it has when fewer than `count` remain; the
 * caller decides what to do about that. Deterministic for a seeded `rng`.
 */
export const selectSpread = <T extends { readonly id: string }>(input: SelectSpreadInput<T>): T[] => {
  const { candidates, rng, spreadBy, filter, exclude } = input;
  const want = Math.max(0, Math.trunc(input.count));
  const skip = new Set<string>(exclude ?? []);
  const pool = candidates.filter((c) => !skip.has(c.id) && (filter === undefined || filter(c)));

  const groups = new Map<string, T[]>();
  for (const c of shuffleSeeded(pool, rng)) {
    const key = spreadBy(c);
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [c]);
    else bucket.push(c);
  }

  const out: T[] = [];
  let live = Array.from(groups.values());
  while (out.length < want && live.length > 0) {
    for (const bucket of shuffleSeeded(live, rng)) {
      if (out.length >= want) break;
      out.push(bucket.shift() as T);
    }
    live = live.filter((bucket) => bucket.length > 0);
  }
  return out;
};
