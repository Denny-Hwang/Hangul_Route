/**
 * Which PWA banner shows now (wireframe pwa/system-banners; `components/PwaBanners`). Pure, so the queue rules are
 * testable without a browser.
 *
 * The offline-ready toast that arrives before the first Home of this visit waits for it and shows there once, above
 * the tab bar. That covers a first visit end to end: Welcome and Steps 1 to 3 (no profile yet, where it hung over the
 * title and the step label), and the fork, the first-quest preview and the first quest (a profile exists, but no tab
 * screen has shown yet). The event fires once the whole precache is down, which on a slow phone can be after Step 3,
 * so having a profile alone is not enough. A toast that arrives after a tab screen has shown appears where the
 * learner is, as before. The update bar waits for a tab screen whatever the profile, so a refresh never lands
 * mid-quest.
 */
export type PwaBanner = 'offline-ready' | 'update-ready';

export interface BannerState {
  banner: PwaBanner | null;
  /** The offline-ready toast arrived before the first Home of this visit: it waits for a tab screen. */
  waitForHome: boolean;
}

/** How long the offline-ready toast stays once it shows. */
export const OFFLINE_READY_MS = 4000;

/**
 * The state after a banner event. `hasProfile` and `seenTabScreen` (a tab screen has shown since the app opened) are
 * read when the event arrives.
 */
export function onPwaBanner(
  _state: BannerState,
  event: PwaBanner,
  { hasProfile, seenTabScreen }: { hasProfile: boolean; seenTabScreen: boolean },
): BannerState {
  if (event === 'offline-ready') return { banner: 'offline-ready', waitForHome: !hasProfile || !seenTabScreen };
  return { banner: 'update-ready', waitForHome: false };
}

/** The banner on screen now, or null while it is queued. */
export function visibleBanner(state: BannerState, { hasProfile, onTabScreen }: { hasProfile: boolean; onTabScreen: boolean }): PwaBanner | null {
  if (state.banner === 'update-ready') return onTabScreen ? 'update-ready' : null;
  if (state.banner === 'offline-ready') return !state.waitForHome || (hasProfile && onTabScreen) ? 'offline-ready' : null;
  return null;
}
