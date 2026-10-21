import { describe, expect, it } from 'vitest';
import { OFFLINE_READY_MS, onPwaBanner, visibleBanner, type BannerState } from '../banners';

const idle: BannerState = { banner: null, waitForHome: false };

describe('onPwaBanner: what an event leaves queued', () => {
  it('offline-ready before any learner profile waits for the first Home', () => {
    expect(onPwaBanner(idle, 'offline-ready', { hasProfile: false })).toEqual({ banner: 'offline-ready', waitForHome: true });
  });
  it('offline-ready with a profile shows where the learner is, as before', () => {
    expect(onPwaBanner(idle, 'offline-ready', { hasProfile: true })).toEqual({ banner: 'offline-ready', waitForHome: false });
  });
  it('update-ready replaces the toast and never waits for a profile (the tab screen rule holds it)', () => {
    const waiting = onPwaBanner(idle, 'offline-ready', { hasProfile: false });
    expect(onPwaBanner(waiting, 'update-ready', { hasProfile: false })).toEqual({ banner: 'update-ready', waitForHome: false });
  });
});

describe('visibleBanner', () => {
  const queued: BannerState = { banner: 'offline-ready', waitForHome: true };
  it('keeps the queued toast hidden on Welcome and Steps 1 to 3 (no profile, no tab bar)', () => {
    expect(visibleBanner(queued, { hasProfile: false, onTabScreen: false })).toBeNull();
  });
  it('keeps it hidden on the screens between the new profile and Home (the fork, the first-quest preview)', () => {
    expect(visibleBanner(queued, { hasProfile: true, onTabScreen: false })).toBeNull();
  });
  it('shows it on the first Home, above the tab bar', () => {
    expect(visibleBanner(queued, { hasProfile: true, onTabScreen: true })).toBe('offline-ready');
  });
  it('a toast that did not wait shows on any screen', () => {
    expect(visibleBanner({ banner: 'offline-ready', waitForHome: false }, { hasProfile: true, onTabScreen: false })).toBe('offline-ready');
  });
  it('the update bar still waits for a tab screen', () => {
    const update: BannerState = { banner: 'update-ready', waitForHome: false };
    expect(visibleBanner(update, { hasProfile: true, onTabScreen: false })).toBeNull();
    expect(visibleBanner(update, { hasProfile: true, onTabScreen: true })).toBe('update-ready');
  });
  it('nothing queued shows nothing', () => {
    expect(visibleBanner(idle, { hasProfile: true, onTabScreen: true })).toBeNull();
  });
});

it('the toast stays four seconds once it shows', () => {
  expect(OFFLINE_READY_MS).toBe(4000);
});
