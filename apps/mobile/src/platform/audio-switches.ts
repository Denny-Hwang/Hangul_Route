import type { AudioPack } from '@hangul-route/content-schema';
import { audioPackFlag, type AudioFlagName } from '../config/flags';
import { AUDIO_ASSET_PACKS } from '../content/__generated__/audio-assets';
import { currFlagOn, useRemoteConfigStore } from '../store/remote-config-store';

/**
 * The clip switches the audio adapters hand the controller (AMENDMENTS-AUDIO-CLIPS AC-B8), read at each prompt so a
 * pack switched off plays the device voice on the next prompt, with no rebuild or release:
 * - `audioClips` (every clip) and `audioPack.<pack>` (one pack, under `audioClips`) through `currFlagOn`, whose build
 *   floor is the build ceiling (`flags.audioClips`, `flags.audioClipPacks`), so the remote copy can only turn off;
 * - the copy is the last one `store/remote-config-store.ts` kept (fetched at start and on each foreground by
 *   `App.tsx`). Before the stored copy is read, and on a device with no copy at all, each switch is its built-in pct,
 *   100 (on): unlike the F-CURR-002 surfaces, a clip is the better default than the device voice, and the presenter
 *   and All lessons roots, which never start the remote config, still play clips. The first read there loads the
 *   copy this device stored, so a pack switched off in the learner app is off there too.
 * Pct is on/off only: 100 is on, anything below with no profile to bucket is off.
 */
let hydrateAsked = false;

function switchOn(flag: AudioFlagName): boolean {
  const state = useRemoteConfigStore.getState();
  if (!state.hydrated && !hydrateAsked) {
    hydrateAsked = true;
    void state.hydrate().catch(() => undefined);
  }
  return currFlagOn(flag, null, state.cache);
}

/** `audioClips`: the build flag and the remote switch. */
export function clipsSwitchOn(): boolean {
  return switchOn('audioClips');
}

/** `audioPack.<pack>`: the build ceiling, `audioClips` and the pack's remote switch. */
export function packSwitchOn(pack: AudioPack): boolean {
  return switchOn(audioPackFlag(pack));
}

/** The pack of a bundled clip, from the generated map (AC-B6); none for a clip the map gives no pack. */
export function bundledPackOf(ref: string): AudioPack | undefined {
  return Object.prototype.hasOwnProperty.call(AUDIO_ASSET_PACKS, ref) ? AUDIO_ASSET_PACKS[ref] : undefined;
}
