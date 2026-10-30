import type { AudioPack } from '@hangul-route/content-schema/audio-packs';
import { episodesWithVolumes, questsAll } from '../content';
import { loadAudioPackChunk } from '../content/__generated__/audio-assets';
import { createClipPackLoader } from '../logic/audio/clip-pack-loader';
import { lessonClipPlan } from '../logic/audio/lesson-clips';
import { warmClips } from './audio';
import { clipRegistry } from './audio-assets-store';
import { packSwitchOn } from './audio-switches';

/**
 * The clip pack loader's chunk (AMENDMENTS-AUDIO-CLIPS AC-B6, row AC-6): reached only through the literal `import()` of
 * `audio-assets-store.ts` (`prepareClips`), so the start bundle carries none of it, and only once the build holds a pack
 * map chunk. It loads the map chunks a screen may play, each while its switch is on (AC-B8), into the start-side
 * registry, then warms the clips of the screen's warm units (`warmClips`, which fetches each through the service
 * worker's runtime cache, so a learner who goes offline after opening the screen still hears them).
 */
export const CLIP_PACKS_CHUNK = 'clip-packs-chunk:loader';

/** The one loader of the app. CM-5B's Save for offline takes a stage's pack from it (`loadPack`, then `packRefs`). */
export const clipPackLoader = createClipPackLoader({ registry: clipRegistry, load: loadAudioPackChunk, packOn: packSwitchOn });

/** What to load and warm: scopes and warm units, or a lesson (this one and the next, `lessonClipPlan`). */
export type ClipPrep = { scopes: readonly AudioPack[]; units: readonly string[] } | { questId: string; episodeId?: string | undefined };

/** Loads the packs; the warm-up then runs on its own (a prompt waits for the packs, never for the warm-up). */
export async function prepareClips(prep: ClipPrep): Promise<void> {
  // Every shipped episode, a cell's Volume 2 included (F-CURR-002 row CM-40), so a Volume 2 lesson warms its stage's pack.
  const plan = 'questId' in prep ? lessonClipPlan({ ...prep, quests: questsAll, episodes: episodesWithVolumes }) : prep;
  await Promise.all(plan.scopes.map((scope) => clipPackLoader.loadFor(scope)));
  const refs = clipPackLoader.unitRefs(plan.units);
  if (refs.length > 0) void warmClips(refs).catch(() => undefined);
}
