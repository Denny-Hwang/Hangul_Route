/**
 * The bundled-clip refs of a screen's items, each once, in first-seen order
 * (F-AUDIO-004 §3.10): Match Sound and Discover hand them to `warmClips` on
 * mount so a recording starts without a fetch. Refs with no bundled file are
 * dropped later by the platform.
 */
export function clipRefsOf(items: ReadonlyArray<{ audioRef?: string } | undefined>): string[] {
  const refs = new Set<string>();
  for (const item of items) {
    const ref = item?.audioRef;
    if (ref !== undefined && ref !== '') refs.add(ref);
  }
  return [...refs];
}
