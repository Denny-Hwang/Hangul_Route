import { nativeAccountEnabled, nativeSignInSwitch, publishableKeyFor } from '../logic/account/native-account';

/**
 * F-AUTH-004 sections 6.1 and 16.1 (row NS-2): the native grown-up account's build values. `EXPO_PUBLIC_*` values are
 * read by their literal names, so Metro inlines them when it bundles; they are set in the native build's environment
 * (owner step O-3), never committed.
 *
 * Only native code imports this module (`navigation/grown-up-stack.native.tsx` and the files it loads), so the web
 * bundle carries none of it: the web start bundle has a few hundred bytes of room (`pwa-postbuild.mjs --budget`), and
 * the web never offers the native account (the console is its grown-up area). For the same reason the switch lives
 * here and not in `flags.ts`, which every web page loads; `nativeSignInSwitch` reads `parseKillSwitch`'s words.
 */

/** True in a release build: React Native sets `__DEV__`; elsewhere (tests) a production `NODE_ENV` counts. */
function releaseBuild(): boolean {
  const dev = (globalThis as { __DEV__?: unknown }).__DEV__;
  if (typeof dev === 'boolean') return !dev;
  return process.env.NODE_ENV === 'production';
}

export interface NativeSignInConfig {
  /** `EXPO_PUBLIC_NATIVE_SIGNIN` (off until row NS-8). */
  flag: boolean;
  /** The publishable key this build accepts, or null (section 6.1). */
  publishableKey: string | null;
  /** The account is offered: `nativeAccountEnabled`. */
  enabled: boolean;
}

/** The build's values, read once per call (the tests stub the environment and read again). */
export function nativeSignInConfig(): NativeSignInConfig {
  const os = process.env.EXPO_OS;
  const flag = nativeSignInSwitch(process.env.EXPO_PUBLIC_NATIVE_SIGNIN);
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const release = releaseBuild();
  const enabled = nativeAccountEnabled({ os, flag, key, release });
  return { flag, publishableKey: enabled ? publishableKeyFor(key, release) : null, enabled };
}
