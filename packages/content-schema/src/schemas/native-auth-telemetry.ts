import { z } from 'zod';
import type { TelemetryEventName } from './telemetry';

/**
 * The native grown-up sign-in names (F-AUTH-004 section 15, TELEMETRY-NAMES-2 section V, row NS-1, Worker first):
 * `auth.native.signin`, `.signout`, `.lock` and `.home`, sent only by the iOS and Android builds. Strict payloads of
 * codes and one boolean: never an email, an account, space or learner id, a code, a period or error text. The Worker
 * stores each without a profile id, keeps per key only a value these schemas accept (`NATIVE_AUTH_PAYLOAD_RULES`,
 * packages/backend) and counts each in `telemetry_daily`. Reached by the `@hangul-route/content-schema/native-auth-telemetry`
 * subpath, so the schemas stay out of the learner start bundle.
 */
export const NATIVE_AUTH_OS = ['ios', 'android'] as const;
/** The factor of the flow's last attempt; `none` before one. */
export const NATIVE_SIGNIN_METHODS = ['none', 'email_code', 'password'] as const;
/** How a sign-in flow ended (section 15: one event per flow; `cancelled` when it was left with no result). */
export const NATIVE_SIGNIN_RESULTS = ['ok', 'wrong_code', 'wrong_password', 'expired', 'refused', 'too_many', 'unsupported', 'offline', 'error', 'cancelled'] as const;
export const NATIVE_SIGNOUT_VIAS = ['user', 'lock'] as const;
/** The locked decisions of `AccountGate` (sections 7.2 and 7.3). */
export const NATIVE_LOCK_CAUSES = ['unknown', 'needs_pin', 'epoch_zero', 'no_trust', 'pin_changed', 'retrust_password'] as const;
/** The use a native home was opened for (`account`: the Grown-up account row of a record with no use, section 7.1). */
export const NATIVE_HOME_USES = ['family', 'teacher', 'school', 'account'] as const;
/** How many spaces the home listed, as a bucket (never the count itself). */
export const NATIVE_HOME_SPACES = ['0', '1', '2-4', '5+'] as const;

const os = z.enum(NATIVE_AUTH_OS);

export const NATIVE_AUTH_TELEMETRY_PAYLOADS = {
  'auth.native.signin': z
    .object({
      os,
      method: z.enum(NATIVE_SIGNIN_METHODS),
      result: z.enum(NATIVE_SIGNIN_RESULTS),
      /** A second step or new-device check was asked during the flow. */
      second: z.boolean(),
    })
    .strict(),
  'auth.native.signout': z.object({ os, via: z.enum(NATIVE_SIGNOUT_VIAS) }).strict(),
  'auth.native.lock': z.object({ os, cause: z.enum(NATIVE_LOCK_CAUSES) }).strict(),
  'auth.native.home': z.object({ os, use: z.enum(NATIVE_HOME_USES), spaces: z.enum(NATIVE_HOME_SPACES) }).strict(),
} as const satisfies Partial<Record<TelemetryEventName, z.AnyZodObject>>;

export type NativeAuthTelemetryName = keyof typeof NATIVE_AUTH_TELEMETRY_PAYLOADS;
export type NativeAuthTelemetryPayload<N extends NativeAuthTelemetryName> = z.infer<(typeof NATIVE_AUTH_TELEMETRY_PAYLOADS)[N]>;
export const NATIVE_AUTH_TELEMETRY_NAMES = Object.keys(NATIVE_AUTH_TELEMETRY_PAYLOADS) as NativeAuthTelemetryName[];
