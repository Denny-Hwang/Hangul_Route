/**
 * Round keys for first-try scoring (F-001 §3.2 revised). The quest-run store
 * scores only the first answer per `stepIndex:roundKey`, so a game must give
 * a wrong tap and the right tap that follows it the SAME key — and give two
 * different rounds different keys. Games with a plain round index pass the
 * index; these helpers cover the two games that do not.
 */

/** Card Match: one key per Korean card, whichever English card the child picks. */
export function pairRoundKey(koIdx: number): string {
  return `pair-${koIdx}`;
}

/** Story Sequence: one key per slot, i.e. per number of cards already placed. */
export function sequenceRoundKey(placedCount: number): number {
  return placedCount;
}
