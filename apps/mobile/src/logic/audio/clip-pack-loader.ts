import { AUDIO_PACKS, type AudioPack } from '@hangul-route/content-schema/audio-packs';
import type { AudioPackChunk, ClipRegistry } from './clip-assets';

/**
 * The clip pack loader (AMENDMENTS-AUDIO-CLIPS AC-B6, row AC-6), lazy side: it lives in `clip-packs-chunk`, so the
 * start bundle carries none of it. It loads a pack's map chunk into the start-side registry (`clip-assets.ts`) and
 * keeps the warm units of the chunks it loaded. Pure: the registry, the chunk loader and the switches are arguments.
 * - A pack is loaded only while its switch is on (the build ceiling `flags.audioClipPacks` and the remote
 *   `audioPack.<pack>`, AC-B8); one switched off is asked again on the next load, so switching it back on needs no
 *   reload. A clip of a loaded pack switched off later still plays the device voice: the controller reads the switch at
 *   each prompt.
 * - A chunk that fails to load (offline before the service worker held it, a hung request) leaves its clips out: the
 *   prompt falls through to the device voice (AC-B7), and the next load asks again.
 */

export interface ClipPackLoaderDeps {
  registry: ClipRegistry;
  /** The pack's chunk (`loadAudioPackChunk`); undefined for a pack with none. */
  load(pack: AudioPack): Promise<{ AUDIO_PACK: AudioPackChunk }> | undefined;
  /** The build ceiling and the remote `audioPack.<pack>` (AC-B8), read at each load. */
  packOn(pack: AudioPack): boolean;
}

export interface ClipPackLoader {
  /** Loads one pack's chunk; true once its clips are in. Never throws. */
  loadPack(pack: AudioPack): Promise<boolean>;
  /** Loads the chunks a screen of this scope may play (`packsUpTo`). Never throws. */
  loadFor(scope: AudioPack): Promise<void>;
  /** The clips of these warm units, from the loaded chunks, each once, in first-seen order. */
  unitRefs(units: readonly string[]): string[];
  /** The clips of a loaded pack (CM-5B's Save for offline takes a stage's pack, F-CURR-002). */
  packRefs(pack: AudioPack): string[];
}

/**
 * The packs a screen of this scope may play: its own and every pack before it in the AC-B6 order, because a text used
 * by two packs belongs to the first (a Stage 7 lesson says words Stage 1 owns). The precached `jamo-s1` is always in.
 */
export function packsUpTo(scope: AudioPack): AudioPack[] {
  return AUDIO_PACKS.slice(0, AUDIO_PACKS.indexOf(scope) + 1);
}

export function createClipPackLoader(deps: ClipPackLoaderDeps): ClipPackLoader {
  const { registry } = deps;
  const units = new Map<string, string[]>();
  const byPack = new Map<AudioPack, string[]>();
  const inFlight = new Map<AudioPack, Promise<boolean>>();

  const merge = (chunk: AudioPackChunk): void => {
    registry.add(chunk);
    const refs = Object.keys(chunk.clips);
    byPack.set(chunk.pack, refs);
    for (const [unit, indexes] of Object.entries(chunk.units)) {
      const list = units.get(unit) ?? [];
      for (const i of indexes) {
        const ref = refs[i];
        if (ref !== undefined && !list.includes(ref)) list.push(ref);
      }
      units.set(unit, list);
    }
  };

  const switchedOn = (pack: AudioPack): boolean => {
    try {
      return deps.packOn(pack);
    } catch {
      return false;
    }
  };

  const loadPack = (pack: AudioPack): Promise<boolean> => {
    if (byPack.has(pack)) return Promise.resolve(true);
    const flying = inFlight.get(pack);
    if (flying !== undefined) return flying;
    if (!registry.chunkPacks.includes(pack) || !switchedOn(pack)) return Promise.resolve(false);
    let request: Promise<{ AUDIO_PACK: AudioPackChunk }> | undefined;
    try {
      request = deps.load(pack);
    } catch {
      request = undefined;
    }
    if (request === undefined) return Promise.resolve(false);
    const done = request
      .then((mod) => {
        if (mod.AUDIO_PACK.pack !== pack) return false;
        merge(mod.AUDIO_PACK);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        inFlight.delete(pack);
      });
    inFlight.set(pack, done);
    registry.track(done);
    return done;
  };

  return {
    loadPack,
    loadFor: async (scope) => {
      await Promise.all(packsUpTo(scope).filter((p) => registry.chunkPacks.includes(p)).map(loadPack));
    },
    unitRefs: (wanted) => {
      const out: string[] = [];
      for (const unit of wanted) for (const ref of units.get(unit) ?? []) if (!out.includes(ref)) out.push(ref);
      return out;
    },
    packRefs: (pack) => [...(byPack.get(pack) ?? [])],
  };
}
