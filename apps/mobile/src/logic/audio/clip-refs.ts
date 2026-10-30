import { clipRefsFor, type ClipLookup } from './controller';

/**
 * The bundled-clip refs of a screen's items, each once, in first-seen order
 * (F-AUDIO-004 §3.10): Match Sound, Discover and Sentence Builder hand them to
 * `warmClips` on mount so a recording starts without a fetch. An item that
 * carries the spoken `text` (a `PlaySpec`) adds its say clip after its own
 * (`clipRefsFor`, AMENDMENTS-AUDIO-CLIPS AC-B7); a record without one adds its
 * `audioRef` only. Refs with no bundled file are dropped later by the platform.
 */
export function clipRefsOf(items: ReadonlyArray<{ audioRef?: string } | ClipLookup | undefined>): string[] {
  const refs = new Set<string>();
  for (const item of items) {
    if (item === undefined) continue;
    const found = 'text' in item && typeof item.text === 'string' ? clipRefsFor(item) : item.audioRef !== undefined && item.audioRef !== '' ? [item.audioRef] : [];
    for (const ref of found) refs.add(ref);
  }
  return [...refs];
}
