/**
 * The seeded shuffle the games share (F-VOC-004 §3.3, S12): a linear
 * congruential generator driving a Fisher-Yates pass. Moved out of
 * `round-builder.ts` unchanged, so every existing round replays exactly as
 * before (`round-builder.test.ts` passes untouched). Seeds from `Date.now()`
 * when none is given; tests always pass one.
 */
export function shuffle<T>(arr: readonly T[], seed?: number): T[] {
  const a = [...arr];
  let s = seed ?? Date.now();
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}
