/**
 * Feature flags for the mobile app.
 *
 * Source of truth for "is this code path live?" decisions. Reading
 * `process.env.EXPO_PUBLIC_*` lets us flip flags per-build without a code
 * change. Each flag has a hardcoded *launch default* — that's what ships
 * if no env override is set.
 *
 * Why a tiny module instead of a real flag service:
 * - PH launch needs predictable, fast, offline-safe decisions.
 * - A 5-flag surface doesn't justify GrowthBook / LaunchDarkly cost.
 * - When we need experiments, this module becomes the local cache layer
 *   in front of a remote service.
 */

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

export interface Flags {
  /**
   * VoiceEcho mini-game. STT accuracy on 5–11 yo Korean voices is
   * unverified — the PH launch ships with this OFF and gates it behind a
   * beta opt-in once we have hands-on user data.
   */
  voiceEchoEnabled: boolean;

  /**
   * Whether the client fires telemetry events to the API. Defaults ON so
   * we can measure the PH 24h funnel; flip OFF in private dev builds to
   * avoid polluting the prototype event log.
   */
  telemetryEnabled: boolean;

  /**
   * Whether to make a real network call when the telemetry helper is
   * invoked. Tests and offline previews flip this OFF; the function
   * still runs all its in-process logic.
   */
  telemetryNetwork: boolean;
}

const launchDefaults: Flags = {
  voiceEchoEnabled: false,
  telemetryEnabled: true,
  telemetryNetwork: true,
};

export const flags: Flags = {
  voiceEchoEnabled: readBool('EXPO_PUBLIC_VOICE_ECHO_ENABLED', launchDefaults.voiceEchoEnabled),
  telemetryEnabled: readBool('EXPO_PUBLIC_TELEMETRY_ENABLED', launchDefaults.telemetryEnabled),
  telemetryNetwork: readBool('EXPO_PUBLIC_TELEMETRY_NETWORK', launchDefaults.telemetryNetwork),
};

export const launchDefaultFlags: Readonly<Flags> = launchDefaults;
