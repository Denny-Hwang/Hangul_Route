import { showAllLocalesEnabled, type UiLocale } from '@hangul-route/i18n';

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
 * An on-by-default flag whose env value is the owner's kill switch: trimmed and read in any case, `false`, `0`,
 * `off` and `no` turn it off; anything else (unset, `true`, a typo) leaves the default. Wider than `parseBool` so a
 * rollback typed as `FALSE` or ` false ` still rolls back (F-APP-001 A-10).
 */
function parseKillSwitch(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
  if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
  return fallback;
}

/**
 * The lecture mode switch (AMENDMENTS-LECTURE-V2 LV-D1): the kill switch's values (`parseKillSwitch`) plus the
 * console's own pair, `disabled` off and `enabled` on (`NEXT_PUBLIC_LECTURE_MODE` uses them), trimmed and in any case.
 * Anything else, or unset, is the launch default.
 */
function parseLectureSwitch(raw: string | undefined, fallback: boolean): boolean {
  const v = raw?.trim().toLowerCase();
  if (v === 'disabled') return false;
  if (v === 'enabled') return true;
  return parseKillSwitch(raw, fallback);
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
   * The level check (F-PLC-001 section 6): the onboarding fork, the Home card,
   * the Profile row and the report entry. ON on every platform since P-10 (the
   * beta flip, owner decision 2026-10-14: no native build has been released
   * to any store or TestFlight, so the store-build gate of section 3.8 has no
   * older released build to protect). `EXPO_PUBLIC_PLACEMENT_ENABLED=false`
   * (or `0`) in a build is the kill switch; it is read by its literal name so
   * the web bundle inlines it.
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
   * entries (the Journey header button in R-3). ON since R-10b flipped it for
   * the beta; `EXPO_PUBLIC_MY_ROUTE_ENABLED=false` in a build switches it back
   * off without a code change. The stage latch writer (R-1b) runs either way.
   */
  myRouteEnabled: boolean;

  /**
   * Words (F-VOC-003): the Library Words card, the topic picker, the topic
   * page and the flashcards. ON since C-7 (owner decision 2026-10-13) in the
   * web app (and in tests and scripts, which have no platform); OFF by default
   * in iOS and Android bundles until the owner's FlipCard device pass
   * (design/screens/vocab/cards.md, "Device flip pass") is recorded.
   * `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=false` (or `0`) in a build switches it
   * off anywhere, and `true` (or `1`) switches it on in a native build.
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
   * 3.6): the Welcome persona row, the Profile "Account pages" row, the dashboard card and the
   * Plan screen's same-tab billing hand-off (A-7). ON since A-10 (2026-10-14, after M3; owner
   * decision: no 14-day wait); `EXPO_PUBLIC_GROWN_UP_HOME=false` (or `0`, `off`, `no`, any case) switches it off. Web only, and
   * native builds never show them (OD-6). The device gate marker, the bounce and the lock's PIN
   * path run with it off.
   */
  grownUpHomeEnabled: boolean;

  /**
   * Notes from grown-ups (F-FEEDBACK-001): the Home card, My notes, the note page and the
   * grown-up zone rows; with it off the inbox's notes are neither flushed nor applied. ON since
   * FB-14 (owner decision 2026-10-13, OD-19); `EXPO_PUBLIC_NOTES_ENABLED=false` switches it off.
   */
  notesEnabled: boolean;

  /**
   * Progress reports in the learner app (F-REPORT-001 section 3.1, RP-9): the **See report** button on each
   * grown-up dashboard card and the `LearnerReport` screen behind the gate. With it off the button is not
   * drawn and the screen is not registered. ON since RP-11 (`EXPO_PUBLIC_REPORTS_ENABLED=false` switches it off). The stack registers the screen on this flag;
   * the button and the screen read `reportsEnabledFor(locale)`, which also holds reports back in a UI locale whose
   * `report.*` words are not reviewed yet.
   */
  reportsEnabled: boolean;

  /**
   * The learner's own weekly plan (F-PLAN-002 section 3.9): the Home prompt, the Profile row
   * "Make a weekly plan" and the proposal screen. ON since P2-8b (the beta flip, after OD-17 was
   * decided 2026-10-13); the Worker that keeps `selfRoute` (P2-4) is already deployed. The learner
   * entries read `routeEnabledFor(locale)`, which holds the plan back in a UI locale whose
   * `learner.weeklyPlan` words have no signed review yet.
   */
  routeEnabled: boolean;

  /**
   * Lecture mode in the learner app (AMENDMENTS-LECTURE-V2 section 3 E5, LV-D1): the Lecture mode card in the grown-up
   * area (`ParentDashboardScreen`, web only, behind the grown-up gate). ON at launch since LV-7, which turned the web
   * and app defaults on together; `EXPO_PUBLIC_LECTURE_MODE` is only a kill switch (`false`, `0`, `off`, `no` or
   * `disabled`, any case, trimmed). It hides the entry only: `/present` stays served (F-TCH-004 TD2). Build time:
   * switching it off needs a rebuild and redeploy of the learner app.
   */
  lectureModeEnabled: boolean;
}

const launchDefaults: Flags = {
  voiceEchoEnabled: false,
  telemetryEnabled: true,
  telemetryNetwork: true,
  syncEnabled: true,
  contentGatingEnabled: false,
  showUnreviewedStories: false,
  placementEnabled: true,
  audioClips: true,
  myRouteEnabled: true,
  // Web-first (F-VOC-003 C-7): native bundles wait for the device flip pass.
  vocabTopicsEnabled: !isNativeBundle(),
  vocabShowDrafts: false,
  grownUpHomeEnabled: true,
  notesEnabled: true,
  reportsEnabled: true,
  routeEnabled: true,
  // LV-7 turned this on with the web default and the site claim (AMENDMENTS-LECTURE-V2 LV-D1).
  lectureModeEnabled: true,
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
  placementEnabled: parseBool(process.env.EXPO_PUBLIC_PLACEMENT_ENABLED, launchDefaults.placementEnabled),
  audioClips: parseBool(process.env.EXPO_PUBLIC_AUDIO_CLIPS, launchDefaults.audioClips),
  myRouteEnabled: parseBool(process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED, launchDefaults.myRouteEnabled),
  vocabTopicsEnabled: parseBool(process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED, launchDefaults.vocabTopicsEnabled),
  vocabShowDrafts:
    isDevBuild() && parseBool(process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS, launchDefaults.vocabShowDrafts),
  grownUpHomeEnabled: parseKillSwitch(process.env.EXPO_PUBLIC_GROWN_UP_HOME, launchDefaults.grownUpHomeEnabled),
  notesEnabled: parseBool(process.env.EXPO_PUBLIC_NOTES_ENABLED, launchDefaults.notesEnabled),
  reportsEnabled: parseBool(process.env.EXPO_PUBLIC_REPORTS_ENABLED, launchDefaults.reportsEnabled),
  routeEnabled: parseBool(process.env.EXPO_PUBLIC_ROUTE_ENABLED, launchDefaults.routeEnabled),
  lectureModeEnabled: parseLectureSwitch(process.env.EXPO_PUBLIC_LECTURE_MODE, launchDefaults.lectureModeEnabled),
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

/** True in an iOS or Android bundle; false on the web and where no platform is inlined (tests, scripts). */
function isNativeBundle(): boolean {
  const os = bundleOs();
  return os === 'ios' || os === 'android';
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

/**
 * UI locales whose `report.*` words have a signed review (F-REPORT-001 section 3.1; F-I18N-001 section 3.10). The
 * same list as the console's `REPORT_REVIEWED_LOCALES` (`apps/web/src/lib/console/config.ts`), so a ko or es learner
 * app never shows a report the console would hold back. Spanish and Korean joined both with the 2026-10-13 MAR
 * re-review of `report`; whether es and ko are selectable is still `LOCALE_STATUS` (rows 15b / 16b).
 */
export const REPORT_REVIEWED_LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];

/**
 * The effective reports switch in the learner app (F-REPORT-001 section 3.1, RP-9): the flag is on **and** the UI
 * locale is in `REPORT_REVIEWED_LOCALES`. The dashboard's **See report** and the `LearnerReport` screen read this,
 * never the raw flag.
 */
export function reportsEnabledFor(locale: UiLocale, f: Pick<Flags, 'reportsEnabled'> = flags): boolean {
  return f.reportsEnabled && REPORT_REVIEWED_LOCALES.includes(locale);
}

/**
 * UI locales whose `learner.weeklyPlan` words carry a signed review (F-PLAN-002 section 6, P2-8b). Spanish and Korean
 * joined with the 2026-10-13 MAR re-review of `learner` (F-I18N-001 section 3.10). Whether es and ko are selectable is
 * still `LOCALE_STATUS` (rows 15b / 16b).
 */
export const ROUTE_REVIEWED_LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];

/**
 * The effective weekly plan switch for the learner entries (F-PLAN-002 P2-8b): the flag is on **and** the UI
 * locale is in `ROUTE_REVIEWED_LOCALES`. The QA build that shows every locale (`EXPO_PUBLIC_SHOW_ALL_LOCALES=1`,
 * never a release build) plays every locale, so the es and ko 320 px pass keeps running. Home's plan slot and the
 * Profile row read this, never the raw flag. Release builds offer only `en` today, so the locale check is a guard for
 * the day es or ko ships; `flags.test.ts` requires every shipped locale to be in `ROUTE_REVIEWED_LOCALES`.
 */
export function routeEnabledFor(
  locale: UiLocale,
  f: Pick<Flags, 'routeEnabled'> = flags,
  showAll: boolean = showAllLocalesEnabled(),
): boolean {
  return f.routeEnabled && (showAll || ROUTE_REVIEWED_LOCALES.includes(locale));
}

/**
 * The F-CURR-002 switches (section 12.2, row CM-2). Each has two parts:
 * - a **build-time floor**: `parseKillSwitch` on its literal `EXPO_PUBLIC_CURR_*` variable (on unless it says
 *   `false`, `0`, `off` or `no`). A `pack.<key>` or `game.<kind>` floor is off when the key is listed in
 *   `EXPO_PUBLIC_CURR_PACKS_OFF` or `EXPO_PUBLIC_CURR_GAMES_OFF` (comma-separated, any case);
 * - a **remote form** from `GET /api/config` (`store/remote-config-store.ts`), which can only reduce: `on: false` or
 *   a lower `pct`, bucketed per profile (`logic/remote-config`). It never turns on a flag the build has off.
 * When the device has never fetched the config, a flag uses its built-in pct. Every F-CURR-002 flag ships with
 * built-in pct 0 because no surface exists yet; the row that ships a surface sets its own after the ramp.
 * Callers read `currFlagOn(flag)` (store/remote-config-store.ts), never these tables directly.
 */
export const CURR_FLAGS = [
  // Memory and review
  'memoryRecord',
  'dailyReview',
  'questWarmup',
  'missedPractice',
  'questAdapt',
  // Achievement
  'mastery',
  'cellCheck',
  'stageChecks',
  'upperCards',
  // Habit
  'goals',
  // Content (plus `pack.<key>` and `game.<kind>`)
  'volumes',
  'topicPacks',
  'decodingSprint',
  'weeklyDrop',
  // Social and lecture
  'weeklyQuests',
  'familyGoal',
  'classGoal',
  'lectureGames',
  // Measurement
  'fsrsShadow',
] as const;

export type CurrFlag = (typeof CURR_FLAGS)[number];
/** A switch name: one of `CURR_FLAGS`, a pack (`pack.<key>`) or a new round format (`game.<kind>`). */
export type CurrFlagName = CurrFlag | `pack.${string}` | `game.${string}`;

/** The build-time floors, read by literal name so the web bundle inlines each one. */
export const currBuildFloors: Readonly<Record<CurrFlag, boolean>> = {
  memoryRecord: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_MEMORY_RECORD, true),
  dailyReview: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_DAILY_REVIEW, true),
  questWarmup: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_QUEST_WARMUP, true),
  missedPractice: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_MISSED_PRACTICE, true),
  questAdapt: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_QUEST_ADAPT, true),
  mastery: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_MASTERY, true),
  cellCheck: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_CELL_CHECK, true),
  stageChecks: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_STAGE_CHECKS, true),
  upperCards: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_UPPER_CARDS, true),
  goals: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_GOALS, true),
  volumes: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_VOLUMES, true),
  topicPacks: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_TOPIC_PACKS, true),
  decodingSprint: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_DECODING_SPRINT, true),
  weeklyDrop: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_WEEKLY_DROP, true),
  weeklyQuests: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_WEEKLY_QUESTS, true),
  familyGoal: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_FAMILY_GOAL, true),
  classGoal: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_CLASS_GOAL, true),
  lectureGames: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_LECTURE_GAMES, true),
  fsrsShadow: parseKillSwitch(process.env.EXPO_PUBLIC_CURR_FSRS_SHADOW, true),
};

/** The built-in pct of every F-CURR-002 flag, used until the device has fetched the config: 0, no surface yet. */
export const currBuiltInPcts: Readonly<Record<CurrFlag, number>> = Object.fromEntries(CURR_FLAGS.map((f) => [f, 0])) as Record<CurrFlag, number>;
/** The built-in pct of every `pack.<key>` and `game.<kind>` flag. */
export const CURR_KEYED_BUILT_IN_PCT = 0;

/** A comma-separated key list, trimmed and lower-cased; empty entries dropped. */
function parseKeyList(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? '').split(',').map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0));
}

const packsOff = parseKeyList(process.env.EXPO_PUBLIC_CURR_PACKS_OFF);
const gamesOff = parseKeyList(process.env.EXPO_PUBLIC_CURR_GAMES_OFF);

function isCurrFlag(flag: string): flag is CurrFlag {
  return (CURR_FLAGS as readonly string[]).includes(flag);
}

/** The build-time floor of any switch name; an unknown name is off. */
export function currBuildFloor(flag: CurrFlagName): boolean {
  if (isCurrFlag(flag)) return currBuildFloors[flag];
  if (flag.startsWith('pack.')) return flag.length > 5 && !packsOff.has(flag.slice(5).toLowerCase());
  if (flag.startsWith('game.')) return flag.length > 5 && !gamesOff.has(flag.slice(5).toLowerCase());
  return false;
}

/** The built-in pct of any switch name; an unknown name is 0. */
export function currBuiltInPct(flag: CurrFlagName): number {
  if (isCurrFlag(flag)) return currBuiltInPcts[flag];
  return CURR_KEYED_BUILT_IN_PCT;
}
