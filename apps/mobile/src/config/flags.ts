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
  return parseBool(process.env[name], fallback);
}

/**
 * For a flag whose override must work in the web bundle: Expo inlines
 * `process.env.EXPO_PUBLIC_*` only where the name is written out in full.
 */
function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

/**
 * True in a development build only: React Native and Metro set the global
 * `__DEV__`; elsewhere (tests, scripts) a non-production `NODE_ENV` counts.
 */
function isDevBuild(): boolean {
  const dev = (globalThis as { __DEV__?: unknown }).__DEV__;
  if (typeof dev === 'boolean') return dev;
  return process.env.NODE_ENV !== 'production';
}

export interface Flags {
  /**
   * VoiceEcho mini-game. STT accuracy on young learners' Korean voices is
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

  /**
   * Background progress sync (F-SYNC-002). ON by default, but it only
   * sends anything once `EXPO_PUBLIC_API_BASE_URL` is configured.
   */
  syncEnabled: boolean;

  /**
   * Turns on every free-tier limit on the web app: grid lessons past the free
   * ones (F-ENT-003), non-sampler stories and word topics past the free four
   * (F-STORY-004 D5). Off in production until the owner turns on Stripe Live.
   * Has no effect in native store builds until F-IAP-002 ships. Callers read
   * `gatingActive(flags, bundleOs())`, never this value directly.
   */
  contentGatingEnabled: boolean;

  /**
   * Shows stories whose `review` is not yet approved (F-STORY-004). OFF by
   * default; set it only in dev and design-preview builds.
   */
  showUnreviewedStories: boolean;

  /**
   * The level check (F-PLC-001 section 6): hides the onboarding fork, the Home
   * card, the Profile row and the report entry. OFF until the beta (P-10), and
   * only after a store build carrying the P-3b schema has shipped.
   */
  placementEnabled: boolean;

  /**
   * Bundled recordings play before the device voice (F-AUDIO-004 §3.10, AD4).
   * ON by default; `EXPO_PUBLIC_AUDIO_CLIPS=false` in a build switches a bad
   * batch of clips off without a code change (prompts then use the voice).
   */
  audioClips: boolean;

  /**
   * My route (F-ROUTE-001): the "where am I in the whole journey" page and its
   * entries (the Journey header button in R-3). OFF until R-10 flips it for
   * the beta. The stage latch writer (R-1b) runs with it off.
   */
  myRouteEnabled: boolean;

  /**
   * Words (F-VOC-003): the Library Words card, the topic picker, the topic
   * page and the flashcards. OFF until the free-set topics are approved and
   * native-reviewed (C-7 flips it).
   */
  vocabTopicsEnabled: boolean;

  /**
   * Lists `draft` vocabulary topics in the picker (F-VOC-001 section 3.7).
   * OFF by default and dev builds only: a release build ignores the env
   * value, so a leftover override can never put unreviewed topics in front
   * of learners.
   */
  vocabShowDrafts: boolean;

  /**
   * The learner app's entries to the grown-up area on app.hangulroute.com (F-APP-001 section
   * 3.6): the Welcome persona row, the Profile "Grown-up home" row, the dashboard card and the
   * Plan screen's same-tab billing hand-off (A-7). OFF until M3 (owner step S-3); web only, and
   * native builds never show them (OD-6). The device gate marker, the bounce and the lock's PIN
   * path run with it off.
   */
  grownUpHomeEnabled: boolean;
}

const launchDefaults: Flags = {
  voiceEchoEnabled: false,
  telemetryEnabled: true,
  telemetryNetwork: true,
  syncEnabled: true,
  contentGatingEnabled: false,
  showUnreviewedStories: false,
  placementEnabled: false,
  audioClips: true,
  myRouteEnabled: false,
  vocabTopicsEnabled: false,
  vocabShowDrafts: false,
  grownUpHomeEnabled: false,
};

export const flags: Flags = {
  voiceEchoEnabled: readBool('EXPO_PUBLIC_VOICE_ECHO_ENABLED', launchDefaults.voiceEchoEnabled),
  telemetryEnabled: readBool('EXPO_PUBLIC_TELEMETRY_ENABLED', launchDefaults.telemetryEnabled),
  telemetryNetwork: readBool('EXPO_PUBLIC_TELEMETRY_NETWORK', launchDefaults.telemetryNetwork),
  syncEnabled: readBool('EXPO_PUBLIC_SYNC_ENABLED', launchDefaults.syncEnabled),
  contentGatingEnabled: parseBool(
    process.env.EXPO_PUBLIC_CONTENT_GATING_ENABLED,
    launchDefaults.contentGatingEnabled,
  ),
  showUnreviewedStories: readBool(
    'EXPO_PUBLIC_SHOW_UNREVIEWED_STORIES',
    launchDefaults.showUnreviewedStories,
  ),
  placementEnabled: readBool('EXPO_PUBLIC_PLACEMENT_ENABLED', launchDefaults.placementEnabled),
  audioClips: parseBool(process.env.EXPO_PUBLIC_AUDIO_CLIPS, launchDefaults.audioClips),
  myRouteEnabled: parseBool(process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED, launchDefaults.myRouteEnabled),
  vocabTopicsEnabled: parseBool(process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED, launchDefaults.vocabTopicsEnabled),
  vocabShowDrafts:
    isDevBuild() && parseBool(process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS, launchDefaults.vocabShowDrafts),
  grownUpHomeEnabled: parseBool(process.env.EXPO_PUBLIC_GROWN_UP_HOME, launchDefaults.grownUpHomeEnabled),
};

export const launchDefaultFlags: Readonly<Flags> = launchDefaults;

/**
 * The platform this bundle was built for: 'ios', 'android' or 'web'.
 * babel-preset-expo inlines `process.env.EXPO_OS` at build time, so stores and
 * logic read it here instead of importing react-native; tests and scripts read
 * `undefined`.
 */
export function bundleOs(): string | undefined {
  return process.env.EXPO_OS;
}

/**
 * The effective free-tier switch (F-ENT-003 section 3.4): the flag counts on
 * the web app only. Native builds answer false whatever the env says (App Review
 * Guidelines 3.1.1 and 3.1.3(b), F-BILL-002 OD-5) until F-IAP-002 sells the plan
 * in the app; an unknown platform fails open the same way. Every access caller
 * (`questAccess`, `isContentLocked`) reads this, never the raw flag.
 */
export function gatingActive(f: Pick<Flags, 'contentGatingEnabled'>, platformOs: string | undefined): boolean {
  return f.contentGatingEnabled && platformOs === 'web';
}
