/**
 * Which PWA banner shows now (wireframe pwa/system-banners; `components/PwaBanners`). Pure, so the queue rules are
 * testable without a browser.
 *
 * The offline-ready toast that arrives before any learner profile exists (a first visit: Welcome and Steps 1 to 3,
 * where it hung over the title and the step label) waits for the first Home and shows there once, above the tab bar.
 * A toast that arrives once a profile exists shows where the learner is, as before. The update bar waits for a tab
 * screen whatever the profile, so a refresh never lands mid-quest.
 */
export type PwaBanner = 'offline-ready' | 'update-ready';

export interface BannerState {
  banner: PwaBanner | null;
  /** The offline-ready toast arrived with no learner profile: it waits for a tab screen (the first Home). */
  waitForHome: boolean;
}

/** How long the offline-ready toast stays once it shows. */
export const OFFLINE_READY_MS = 4000;

/** The state after a banner event; `hasProfile` is read when the event arrives. */
export function onPwaBanner(_state: BannerState, event: PwaBanner, { hasProfile }: { hasProfile: boolean }): BannerState {
  if (event === 'offline-ready') return { banner: 'offline-ready', waitForHome: !hasProfile };
  return { banner: 'update-ready', waitForHome: false };
}

/** The banner on screen now, or null while it is queued. */
export function visibleBanner(state: BannerState, { hasProfile, onTabScreen }: { hasProfile: boolean; onTabScreen: boolean }): PwaBanner | null {
  if (state.banner === 'update-ready') return onTabScreen ? 'update-ready' : null;
  if (state.banner === 'offline-ready') return !state.waitForHome || (hasProfile && onTabScreen) ? 'offline-ready' : null;
  return null;
}
