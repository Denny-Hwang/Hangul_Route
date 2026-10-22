import { useEffect, useState } from 'react';
import { flags } from '../../config/flags';
import { biometric } from '../../platform/biometric';

/** The last answer on this run of the app, so the next screen starts from it instead of from "not yet known". */
let lastKnown: boolean | null = null;

/**
 * [OA] Whether strong face or fingerprint is set up on this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.6,
 * row OA-9): `null` while the platform has not answered yet on this run, then true or false. Always false on the web
 * and with `EXPO_PUBLIC_BIOMETRIC_SHORTCUT` off (the platform is not even asked then). Read again when the screen
 * mounts, so a face or fingerprint added or removed in the system settings shows at the next visit; until then the
 * last answer stands, so the PIN screen draws its button (and the pad its final size) in the first frame.
 */
export function useBiometricAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(() => (flags.biometricShortcutEnabled ? lastKnown : false));
  useEffect(() => {
    if (!flags.biometricShortcutEnabled) return;
    let live = true;
    void biometric
      .available()
      .then((v) => {
        lastKnown = v;
        if (live) setAvailable(v);
      })
      .catch(() => {
        if (live) setAvailable(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return available;
}

/** [OA] `useBiometricAvailability`, with "not yet known" read as unavailable. */
export function useBiometricAvailable(): boolean {
  return useBiometricAvailability() === true;
}

/** Test seam: forgets the last answer. */
export function resetBiometricAvailabilityForTests(): void {
  lastKnown = null;
}
