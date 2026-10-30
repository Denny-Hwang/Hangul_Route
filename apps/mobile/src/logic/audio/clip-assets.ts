import type { AudioPack } from '@hangul-route/content-schema/audio-packs';

/**
 * The bundled clip map, split per pack (AMENDMENTS-AUDIO-CLIPS AC-B6, bundle size; row AC-6), start side. The start
 * bundle carries only the precached pack's clips (`jamo-s1`, `__generated__/audio-assets.ts`) and this registry; every
 * other pack's clips are a map chunk of their own (`__generated__/audio-packs/audio-pack-<pack>.ts`), which the clip
 * pack loader (`clip-pack-loader.ts`, in the lazy `clip-packs-chunk`) adds here when a lesson, story or level check
 * opens. The registry itself is `createClipRegistry` in `platform/audio-assets-store.ts`, beside the start map, so the
 * start bundle carries one small module for it.
 * - `pending()` is what the controller waits on, briefly, before it looks for a clip, so a prompt asked while its
 *   lesson's chunk is on its way still finds the clip; a chunk that never arrives leaves it to the device voice.
 */

/** One pack's map chunk, as the generator writes it. */
export interface AudioPackChunk {
  pack: AudioPack;
  /** Ref => the bundled asset (a native registry id, or the URL string Metro's web asset transformer returns). */
  clips: Readonly<Record<string, number | string>>;
  /** Warm unit (a lesson cell, a Stage 1 quest or game, a story, `placement`) => indexes into the keys of `clips`. */
  units: Readonly<Record<string, readonly number[]>>;
}

export interface ClipRegistry {
  /** The clip is in the start map or in a chunk added so far. */
  has(ref: string): boolean;
  /** Its bundled asset, when it has one. */
  asset(ref: string): number | string | undefined;
  /** Its pack (start map or added chunk); none for a clip with no pack or one not added. */
  packOf(ref: string): AudioPack | undefined;
  /** The build holds at least one clip of this pack, its chunk added or not. */
  packHas(pack: AudioPack): boolean;
  /** Every clip the build holds, added or not. */
  readonly size: number;
  /** The packs that have a map chunk. */
  readonly chunkPacks: readonly AudioPack[];
  /** Adds a pack chunk's clips. */
  add(chunk: AudioPackChunk): void;
  /** Counts a load as pending until it settles. */
  track(load: Promise<unknown>): void;
  /** The loads still on their way, or null when none is. */
  pending(): Promise<void> | null;
}
