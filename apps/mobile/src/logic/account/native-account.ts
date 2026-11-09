/**
 * F-AUTH-004 section 6.1 (row NS-2): whether this native build offers the grown-up account at all. Pure: the build's
 * values are passed in (`config/native-signin.ts` reads them), so every input has a test.
 *
 * The account is on only when all hold:
 * - the bundle is for `ios` or `android` (the web keeps the console, F-APP-001);
 * - the build switch `EXPO_PUBLIC_NATIVE_SIGNIN` is on (`nativeSignInSwitch`, the words of `parseKillSwitch` with
 *   the launch default off until row NS-8);
 * - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is a publishable key this build accepts (`publishableKeyFor`).
 *
 * Off hides every native row and screen of the spec and leaves the native app exactly as at the basis (CS-N13).
 */

/** The launch default of `EXPO_PUBLIC_NATIVE_SIGNIN`: off until row NS-8 flips it after the owner's device checks. */
export const NATIVE_SIGNIN_LAUNCH_DEFAULT = false;

/**
 * `EXPO_PUBLIC_NATIVE_SIGNIN` read with `parseKillSwitch`'s words (`config/flags.ts`): trimmed and in any case,
 * `false`, `0`, `off` and `no` are off; `true`, `1`, `on` and `yes` are on; anything else (unset, a typo) is the
 * launch default. `config/__tests__/native-signin.test.ts` holds the words equal to a `flags.ts` kill switch's.
 */
export function nativeSignInSwitch(raw: string | undefined, fallback: boolean = NATIVE_SIGNIN_LAUNCH_DEFAULT): boolean {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
  if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
  return fallback;
}

/** Clerk's publishable key: a prefix, then base64 of the Frontend API host followed by `$`. */
const KEY_SHAPE = /^pk_(live|test)_([A-Za-z0-9+/]+={0,2})$/;
/** The decoded host: letters, digits, dots and hyphens, then the `$` Clerk appends. */
const FRONTEND_API = /^[a-z0-9.-]+\.[a-z]{2,}\$$/i;

function decodeBase64(text: string): string | null {
  try {
    return globalThis.atob(text);
  } catch {
    return null;
  }
}

/**
 * The publishable key this build may hand to Clerk, or null. A release build takes only `pk_live_`; a development
 * build also `pk_test_`. Anything else is ignored and the native rows stay hidden: a secret key (`sk_`), a test key in
 * a release build, a key with spaces around it or a value that does not decode to a Frontend API host. Never logged.
 */
export function publishableKeyFor(raw: string | undefined, release: boolean): string | null {
  if (raw === undefined) return null;
  const match = KEY_SHAPE.exec(raw);
  if (match === null) return null;
  if (match[1] === 'test' && release) return null;
  const host = decodeBase64(match[2] as string);
  return host !== null && FRONTEND_API.test(host) ? raw : null;
}

export interface NativeAccountInput {
  /** `process.env.EXPO_OS` as the bundle was built (`bundleOs()`); undefined in tests and scripts. */
  os: string | undefined;
  /** `nativeSignInSwitch(process.env.EXPO_PUBLIC_NATIVE_SIGNIN)`. */
  flag: boolean;
  /** `process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` as built. */
  key: string | undefined;
  /** True in a release build (`__DEV__` false). */
  release: boolean;
}

/** Section 6.1: true only on `ios` or `android`, with the switch on and a key this build accepts. */
export function nativeAccountEnabled(input: NativeAccountInput): boolean {
  if (input.os !== 'ios' && input.os !== 'android') return false;
  if (!input.flag) return false;
  return publishableKeyFor(input.key, input.release) !== null;
}
