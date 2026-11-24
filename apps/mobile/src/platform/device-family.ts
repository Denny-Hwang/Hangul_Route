import { Platform } from 'react-native';
import { deviceFamily, type DeviceFamily } from '../logic/device-family';
import { installEnv } from './pwa';

/**
 * This device's family (AMENDMENTS-AUDIO-CANT-HEAR section 3.4): `Platform.OS` on native; on the web, where
 * `Platform.OS` is 'web' in every browser, the user agent `installEnv()` reads. Read once per sheet open; there is no
 * stored value.
 */
export function currentDeviceFamily(): DeviceFamily {
  const { userAgent, maxTouchPoints } = installEnv();
  return deviceFamily({ os: Platform.OS, userAgent, maxTouchPoints });
}
