import { composeSyllable, decomposeSyllable, type ListenPickRound } from '@hangul-route/content-schema';
import type { MinigameScope } from './minigame-config';

/**
 * Listen & Pick helpers (F-QUEST-002 §3.10). Pure: the component and its
 * reducer sit on top of these.
 */

/** The six taught final consonants, in teaching order (F-QUEST-002 §3.6). */
const TAUGHT_FINALS: readonly string[] = ['ㄴ', 'ㄹ', 'ㅇ', 'ㄱ', 'ㅁ', 'ㅂ'];

/** mulberry32: a small, well-spread seeded generator. Shared with the other games' shuffles. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The round with its options in a deterministic order for `seed`. Builders put
 * the answer first; this is what keeps it from staying there. The input is not
 * changed.
 */
export function shuffleOptions(round: ListenPickRound, seed: number): ListenPickRound {
  const next = seededRandom(seed);
  const options = [...round.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return { ...round, options };
}

/**
 * The scope's playable rounds: at least two options and an `answerId` that is
 * one of them. A round that fails this is skipped (and the content test fails).
 */
export function validRounds(scope: Pick<MinigameScope, 'listenPick'>): ListenPickRound[] {
  return (scope.listenPick?.rounds ?? []).filter(
    (r) => r.options.length >= 2 && r.options.some((o) => o.id === r.answerId),
  );
}

/** How many rounds the scope plays. */
export function roundCount(scope: Pick<MinigameScope, 'listenPick'>): number {
  return validRounds(scope).length;
}

/**
 * Up to `count` syllables that differ from `syllable` only in the final: the
 * open syllable first (unless `syllable` is open), then each of `finals` in
 * order. Fewer come back when `finals` runs out.
 */
export function distractorsFor(syllable: string, count: number, finals: readonly string[] = TAUGHT_FINALS): string[] {
  const parts = decomposeSyllable(syllable);
  if (!parts) throw new Error(`"${syllable}" is not one Hangul syllable`);
  const out: string[] = [];
  for (const final of ['', ...finals]) {
    if (out.length >= count) break;
    if (final === parts.final) continue;
    const candidate = composeSyllable({ ...parts, final });
    if (candidate === null) throw new Error(`"${final}" is not a final consonant`);
    out.push(candidate);
  }
  return out;
}
