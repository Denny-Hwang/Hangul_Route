import { useEffect, useState } from 'react';
import { flags } from '../../config/flags';
import { biometric } from '../../platform/biometric';

/**
 * [OA] Whether strong face or fingerprint is set up on this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.6,
 * row OA-9). False until the platform answers, always false on the web and with `EXPO_PUBLIC_BIOMETRIC_SHORTCUT` off
 * (the platform is not even asked then). Read again when the screen mounts, so a face or fingerprint added or removed
 * in the system settings shows at the next visit.
 */
export function useBiometricAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!flags.biometricShortcutEnabled) return;
    let live = true;
    void biometric
      .available()
      .then((v) => {
        if (live) setAvailable(v);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return available;
}
