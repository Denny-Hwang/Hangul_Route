import type { RuntimeVocabItem, VocabItemState, VocabProgress } from '@hangul-route/content-schema';
import { shuffle } from '../shuffle';
import { normaliseSeed } from './question-builder';
import { addDays, isDue } from './srs';

/**
 * Choosing the words for a Speed Round — F-VOC-005 section 3.5. Pure.
 *
 * About 60 % due words (oldest due first), about 30 % words collected this
 * week (most recently collected first) and about 10 % strong words (box 4 or
 * 5, the longest unpractised first). A group that runs short passes its places
 * on to the next group; whatever is still open is filled from any remaining
 * collected word, the longest unpractised first. The seed only breaks ties
 * inside a group; nothing else is random. The result is in selection priority
 * order, which is the `pool` order of F-VOC-004's `buildQuestions`.
 */

export interface SelectSpeedWordsInput {
  /** The topic's collected items, in file order. */
  collected: readonly RuntimeVocabItem[];
  progress: VocabProgress;
  /** The device's local day (`localDay`). */
  today: string;
  count: number;
  seed: number;
}

export interface SpeedMix {
  due: number;
  fresh: number;
  strong: number;
}

/** A word collected on or after `today - NEW_WITHIN_DAYS` counts as new this week. */
export const NEW_WITHIN_DAYS = 7;
/** Box 4 or 5 is strong enough for the review share. */
export const STRONG_FROM_BOX = 4;

/** The target split of `count` places: 10 -> 6 / 3 / 1. Always adds up to `count`. */
export function mixFor(count: number): SpeedMix {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const due = Math.round(n * 0.6);
  const fresh = Math.min(n - due, Math.round(n * 0.3));
  return { due, fresh, strong: n - due - fresh };
}

type Entry = { item: RuntimeVocabItem; state: VocabItemState | undefined };

/** Shuffle by the seed first, then stable-sort: the key decides, the seed only orders equal keys. */
function ordered(entries: readonly Entry[], seed: number, compare: (a: Entry, b: Entry) => number): Entry[] {
  return shuffle(entries, seed).sort(compare);
}

const asc = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** A word with no saved state has never been practised: it sorts as the oldest. */
const lastOf = (e: Entry): string => e.state?.last ?? '';

export function selectSpeedWords(input: SelectSpeedWordsInput): RuntimeVocabItem[] {
  const { collected, progress, today, count } = input;
  // The same clean-up buildQuestions applies: a hashed, negative or NaN seed
  // would otherwise leave holes in the shuffled list.
  const seed = normaliseSeed(input.seed);
  const states = new Map(progress.items.map((s) => [s.id, s]));
  const unique = new Map<string, Entry>();
  for (const item of collected) {
    if (!unique.has(item.id)) unique.set(item.id, { item, state: states.get(item.id) });
  }
  const entries = [...unique.values()];
  const mix = mixFor(count);
  const weekStart = addDays(today, -NEW_WITHIN_DAYS);

  const taken = new Set<string>();
  const out: RuntimeVocabItem[] = [];
  const take = (group: readonly Entry[], places: number): number => {
    let left = places;
    for (const e of group) {
      if (left <= 0) break;
      if (taken.has(e.item.id)) continue;
      taken.add(e.item.id);
      out.push(e.item);
      left -= 1;
    }
    return left;
  };

  const due = ordered(
    entries.filter((e) => e.state !== undefined && isDue(e.state, today)),
    seed,
    (a, b) => asc(a.state!.due!, b.state!.due!),
  );
  let carry = take(due, mix.due);

  const fresh = ordered(
    entries.filter((e) => e.state !== undefined && e.state.first >= weekStart),
    seed,
    (a, b) => asc(b.state!.first, a.state!.first),
  );
  carry = take(fresh, mix.fresh + carry);

  const strong = ordered(
    entries.filter((e) => e.state !== undefined && e.state.box >= STRONG_FROM_BOX),
    seed,
    (a, b) => asc(lastOf(a), lastOf(b)),
  );
  carry = take(strong, mix.strong + carry);

  take(
    ordered(entries, seed, (a, b) => asc(lastOf(a), lastOf(b))),
    carry,
  );
  return out;
}
