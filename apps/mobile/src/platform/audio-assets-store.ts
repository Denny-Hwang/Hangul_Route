import type { AudioPack } from '@hangul-route/content-schema/audio-packs';
import { useEffect } from 'react';
import { AUDIO_ASSETS, AUDIO_ASSET_PACKS, AUDIO_CHUNK_PACKS, AUDIO_CLIP_COUNT } from '../content/__generated__/audio-assets';
import { PACK_WAIT_MS } from '../logic/audio/controller';
import type { ClipRegistry } from '../logic/audio/clip-assets';
import type { ClipPrep } from './clip-packs-chunk';

/**
 * The app's bundled clips (AMENDMENTS-AUDIO-CLIPS AC-B6, row AC-6; the types are `logic/audio/clip-assets.ts`): the
 * start map of `__generated__/audio-assets.ts` (the `jamo-s1` pack), and the per-pack map chunks the lazy loader
 * (`clip-packs-chunk.ts`) adds when a lesson, story or level check opens. Both audio adapters read clips through it.
 * Kept to one small module: everything else of the clip packs loads lazily (`clip-packs-chunk`). The pack chunks' own
 * literal `import()`s (`loadAudioPackChunk`) are the generated start map's, in the start bundle (one short case per
 * pack): a lazy chunk that held them would name the pack chunks' URLs in its content after Metro hashed it, so its file
 * name would no longer be the md5 of its content (the post-build's chunk check).
 */

/**
 * The registry over the start map. A chunk's clips arrive after a screen first renders, so `version` / `subscribe` let a
 * prompt slot re-render when they do (`useClipRegistryVersion`). A load counts as pending until it settles or
 * `stallMs` passes, whichever is first, so a stalled request costs a prompt at most one wait.
 */
export function createClipRegistry(
  input: {
    start: Readonly<Record<string, number | string>>;
    startPacks: Readonly<Record<string, AudioPack>>;
    count: number;
    chunkPacks: readonly AudioPack[];
  },
  stallMs = PACK_WAIT_MS,
): ClipRegistry {
  const assets = new Map(Object.entries(input.start));
  const packs = new Map(Object.entries(input.startPacks));
  const loads = new Set<Promise<unknown>>();
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    has: (ref) => assets.has(ref),
    asset: (ref) => assets.get(ref),
    packOf: (ref) => packs.get(ref),
    packHas: (pack) => input.chunkPacks.includes(pack) || [...packs.values()].includes(pack),
    size: input.count,
    chunkPacks: input.chunkPacks,
    add: (chunk) => {
      for (const [ref, value] of Object.entries(chunk.clips)) {
        assets.set(ref, value);
        packs.set(ref, chunk.pack);
      }
      version += 1;
      for (const listener of [...listeners]) listener();
    },
    track: (load) => {
      const done = (): boolean => loads.delete(settled);
      const settled = load.then(done, done);
      loads.add(settled);
      setTimeout(done, stallMs);
    },
    pending: () => (loads.size === 0 ? null : Promise.all(loads).then(() => undefined)),
    version: () => version,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const clipRegistry = createClipRegistry({
  start: AUDIO_ASSETS,
  startPacks: AUDIO_ASSET_PACKS,
  count: AUDIO_CLIP_COUNT,
  chunkPacks: AUDIO_CHUNK_PACKS,
});

/**
 * Loads the clip packs a screen may play and warms its clips, through the lazy loader chunk (counted as pending, so a
 * prompt asked meanwhile waits for it briefly). Nothing happens in a build that holds no pack map chunk. Never throws.
 */
export function prepareClips(prep: ClipPrep): void {
  if (AUDIO_CHUNK_PACKS.length === 0) return;
  const load = import('./clip-packs-chunk').then((chunk) => chunk.prepareClips(prep));
  clipRegistry.track(load);
  load.catch(() => undefined);
}

/** A screen of this scope opening: its packs (and every pack before it), then the clips of its warm unit, if any. */
export function useClipPacks(scope: AudioPack, unit?: string): void {
  useEffect(() => prepareClips({ scopes: [scope], units: unit === undefined ? [] : [unit] }), [scope, unit]);
}

/** A lesson (a quest of any stage) opening: this lesson's and the next one's packs and clips (`lessonClipPlan`). */
export function useLessonClips(questId: string, episodeId: string | undefined): void {
  useEffect(() => prepareClips({ questId, episodeId }), [questId, episodeId]);
}
