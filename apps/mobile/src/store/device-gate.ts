import { DEVICE_GATE_KEY, type DeviceGateMarker } from '@hangul-route/content-schema';
import { deviceGateMarker, sameMarker, storedMarkerProfiles } from '../logic/shell/device-gate';
import { readJsonStrict, writeJson } from '../platform/storage';
import { useAccountStore } from './account-store';
import { PROFILES_KEY, useProfileStore } from './profile-store';

/**
 * The device gate marker writer (F-APP-001 section 3.9, A-6). It keeps `hr:device:gate` in step
 * with this device: on boot and whenever the profiles or the PIN change, independent of
 * `flags.grownUpHomeEnabled`. The console's grown-up lock reads the marker on the same origin
 * (A-4a `lib/console/device-marker.ts`) and trusts it over its `hr:profiles` fallback, so a
 * marker that says less than the device holds would open grown-up pages to a child:
 * - nothing is written before both the profiles and the account have loaded (an empty store
 *   would say `none`);
 * - on the first evaluation the account reconciles the PIN epoch (a PIN an older bundle changed
 *   moves it to now), before the first marker is written;
 * - a `none` marker is written only when the stored profile list, read again strictly, gives
 *   `none` too (no learner, or self learners only without a PIN): a profile read that failed at
 *   boot (the store then looks empty) writes nothing, and the console keeps the previous marker
 *   or its own fallback. A `none` the stored list refuses is not checked again until the marker
 *   changes;
 * - writes run one at a time, each for the newest marker, and a marker equal to the last one
 *   written is not written again.
 *
 * `currentDeviceGateMarker()` is the marker for this device as the app sees it now (`null`
 * before the stores load); the grown-up hand-off copies its epoch into the unlock.
 */

let current: DeviceGateMarker | null = null;
let written: DeviceGateMarker | null = null;
/** A `none` the stored list did not confirm; not read again until the marker changes. */
let refused: DeviceGateMarker | null = null;
let generation = 0;
let reconciled = false;
let scheduled = false;
let tail: Promise<void> = Promise.resolve();

export function currentDeviceGateMarker(): DeviceGateMarker | null {
  return current;
}

/** Whether the stored profile list, read strictly, gives the same marker; a failed read throws. */
async function storageAgrees(marker: DeviceGateMarker): Promise<boolean> {
  const profiles = storedMarkerProfiles(await readJsonStrict<unknown>(PROFILES_KEY));
  const { parentPinHash, pinSetAt } = useAccountStore.getState();
  return sameMarker(deviceGateMarker({ profiles, parentPinHash, pinSetAt }), marker);
}

async function flush(gen: number): Promise<void> {
  const marker = current;
  if (gen !== generation || marker === null || sameMarker(written, marker) || sameMarker(refused, marker)) return;
  if (marker.gate === 'none') {
    let agrees: boolean;
    try {
      agrees = await storageAgrees(marker);
    } catch {
      // A failed strict read refuses `none` like a list that disagrees.
      agrees = false;
    }
    if (!agrees) {
      if (gen === generation) refused = marker;
      return;
    }
  }
  // A newer marker arrived meanwhile: its own flush, queued behind this one, writes it.
  if (gen !== generation || current !== marker) return;
  try {
    await writeJson(DEVICE_GATE_KEY, marker);
    if (gen === generation) written = marker;
  } catch {
    // Best effort: the stored marker stays as it was, and the next change tries again.
  }
}

/**
 * Queues one flush after the current task, so the profile list a store change persists is
 * already on its way to storage when a `none` marker reads it back.
 */
function schedule(gen: number): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    const run = (): Promise<void> => flush(gen);
    tail = tail.then(run, run);
  }, 0);
}

function evaluate(gen: number): void {
  if (gen !== generation) return;
  const { profiles, hydrated: profilesIn } = useProfileStore.getState();
  if (!profilesIn || !useAccountStore.getState().hydrated) return;
  if (!reconciled) {
    reconciled = true;
    // May update the account store, which evaluates again with the moved epoch.
    useAccountStore.getState().reconcilePinEpoch(Date.now());
  }
  const { parentPinHash, pinSetAt } = useAccountStore.getState();
  current = deviceGateMarker({ profiles, parentPinHash, pinSetAt });
  // A refused `none` is checked again once the device said something else in between.
  if (refused !== null && !sameMarker(refused, current)) refused = null;
  schedule(gen);
}

/** Starts the writer (App boot, before the stores hydrate); returns the stop function. */
export function bindDeviceGateMarker(): () => void {
  generation += 1;
  const gen = generation;
  current = null;
  written = null;
  refused = null;
  reconciled = false;
  scheduled = false;
  const offProfiles = useProfileStore.subscribe(() => evaluate(gen));
  const offAccount = useAccountStore.subscribe(() => evaluate(gen));
  evaluate(gen);
  return () => {
    offProfiles();
    offAccount();
    if (gen === generation) {
      generation += 1;
      current = null;
      written = null;
      refused = null;
      reconciled = false;
      scheduled = false;
    }
  };
}
