import type { AudioPack } from '@hangul-route/content-schema';
import { audioPackFlag, type AudioFlagName } from '../config/flags';
import { currFlagOn, useRemoteConfigStore } from '../store/remote-config-store';

/**
 * The clip switches the audio adapters hand the controller (AMENDMENTS-AUDIO-CLIPS AC-B8), read at each prompt so a
 * pack switched off plays the device voice on the next prompt, with no rebuild or release:
 * - `audioClips` (every clip) and `audioPack.<pack>` (one pack, under `audioClips`) through `currFlagOn`, whose build
 *   floor is the build ceiling (`flags.audioClips`, `flags.audioClipPacks`), so the remote copy can only turn off;
 * - the copy is the one `store/remote-config-store.ts` keeps. The learner app fetches it at start and on each
 *   foreground (`App.tsx`); the presenter and All lessons roots never start the remote config, so the switches reach
 *   them here: the adapter primes them when it is created (the stored copy is read, then `GET /api/config` is fetched
 *   when due: anonymous, no identifier), and each prompt asks for a fetch again once the copy is due (`refreshIfDue`:
 *   15 minutes and its max-age, 5 minutes after a failure), so a classroom screen that never hides still picks up an
 *   urgent off.
 * - With no copy (never fetched, or the stored one still being read) each switch is its built-in pct, 100 (on):
 *   unlike the F-CURR-002 surfaces (`currFlagOn` with no copy argument is off until the stored copy is read), a clip
 *   is the better default than the device voice, and the adapter's capability (`clips`), read once when it is
 *   created, must agree with what plays. The window before the stored copy is in is one storage read, started when
 *   the adapter is created (before any prompt can be asked for), so a pack switched off on this device is off by the
 *   first prompt.
 * Pct is on/off only: 100 is on, and anything below is off on every device and screen (there is never a profile to
 * bucket here).
 */
let primed = false;

/** Reads the stored copy, then fetches a new one when due. Once per app run; never throws. */
export function primeAudioSwitches(): void {
  if (primed) return;
  primed = true;
  void useRemoteConfigStore
    .getState()
    .hydrate()
    .catch(() => undefined)
    .then(() => useRemoteConfigStore.getState().refreshIfDue())
    .catch(() => undefined);
}

function switchOn(flag: AudioFlagName): boolean {
  primeAudioSwitches();
  const state = useRemoteConfigStore.getState();
  if (state.hydrated) void state.refreshIfDue().catch(() => undefined);
  // The copy passed explicitly: with none the built-in pct (100) holds, never the F-CURR-002 "off until read".
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
