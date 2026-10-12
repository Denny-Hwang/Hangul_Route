import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_URL, apiBaseUrl, appUrl, buildEnv, clerkPublishableKey, contentGatingEnabled, devAuthEnabled, lectureModeEnabled, notesEnabled, schoolConsentModeEnabled } from '../config';

describe('console config (F-CONSOLE-001 §3.2)', () => {
  it('apiBaseUrl trims and rejects the placeholder', () => {
    expect(apiBaseUrl({})).toBeNull();
    expect(apiBaseUrl({ NEXT_PUBLIC_API_BASE_URL: 'https://api.hangulroute.example' })).toBeNull();
    expect(apiBaseUrl({ NEXT_PUBLIC_API_BASE_URL: ' https://api.example.com/ ' })).toBe('https://api.example.com');
  });

  it('dev auth is on outside production, or when forced', () => {
    expect(devAuthEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(devAuthEnabled({ NODE_ENV: 'test' })).toBe(true);
    expect(devAuthEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(devAuthEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_CONSOLE_DEV_AUTH: 'true' })).toBe(true);
    expect(devAuthEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_CONSOLE_DEV_AUTH: 'false' })).toBe(false);
    expect(devAuthEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_CONSOLE_DEV_AUTH: 'true', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc' })).toBe(false); // Clerk wins
    expect(typeof devAuthEnabled()).toBe('boolean');
    expect(apiBaseUrl() === null || typeof apiBaseUrl() === 'string').toBe(true);
  });

  it('reads the Clerk publishable key only when it looks like one (F-AUTH-002)', () => {
    expect(clerkPublishableKey({})).toBeNull();
    expect(clerkPublishableKey({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ' pk_test_abc123 ' })).toBe('pk_test_abc123');
    expect(clerkPublishableKey({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_xyz' })).toBe('pk_live_xyz');
    expect(clerkPublishableKey({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_secret' })).toBeNull(); // a secret key never belongs in a build
    expect(clerkPublishableKey({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '' })).toBeNull();
    expect(clerkPublishableKey() === null || typeof clerkPublishableKey() === 'string').toBe(true);
  });

  it('appUrl is the learner app origin for the presenter link, defaulting to production (F-TCH-004 §3.2)', () => {
    expect(DEFAULT_APP_URL).toBe('https://app.hangulroute.com');
    expect(appUrl({})).toBe('https://app.hangulroute.com');
    expect(appUrl({ NEXT_PUBLIC_APP_URL: ' https://preview.app.example.com/ ' })).toBe('https://preview.app.example.com');
    expect(appUrl({ NEXT_PUBLIC_APP_URL: 'http://localhost:4173' })).toBe('http://localhost:4173');
    expect(appUrl({ NEXT_PUBLIC_APP_URL: 'javascript:alert(1)' })).toBe('https://app.hangulroute.com');
    expect(appUrl({ NEXT_PUBLIC_APP_URL: 'not a url' })).toBe('https://app.hangulroute.com');
    expect(appUrl({ NEXT_PUBLIC_APP_URL: 'https://app.example.com/some/path' })).toBe('https://app.example.com');
    expect(typeof appUrl()).toBe('string');
  });

  it('school consent mode is locked until explicitly enabled (legal review)', () => {
    expect(schoolConsentModeEnabled({})).toBe(false);
    expect(schoolConsentModeEnabled({ NEXT_PUBLIC_SCHOOL_CONSENT_MODE: 'true' })).toBe(false);
    expect(schoolConsentModeEnabled({ NEXT_PUBLIC_SCHOOL_CONSENT_MODE: 'enabled' })).toBe(true);
    expect(typeof schoolConsentModeEnabled()).toBe('boolean');
  });

  it('lecture mode stays hidden until the presenter ships (F-TCH-004 PR 6), then is switched on', () => {
    expect(lectureModeEnabled({})).toBe(false);
    expect(lectureModeEnabled({ NEXT_PUBLIC_LECTURE_MODE: 'true' })).toBe(false);
    expect(lectureModeEnabled({ NEXT_PUBLIC_LECTURE_MODE: 'enabled' })).toBe(true);
    expect(typeof lectureModeEnabled()).toBe('boolean');
  });

  it('the free-plan switch is off unless the build sets it, parsed like the learner app (F-ENT-003 section 3.4)', () => {
    expect(contentGatingEnabled({})).toBe(false);
    expect(contentGatingEnabled({ NEXT_PUBLIC_CONTENT_GATING_ENABLED: 'true' })).toBe(true);
    expect(contentGatingEnabled({ NEXT_PUBLIC_CONTENT_GATING_ENABLED: '1' })).toBe(true);
    for (const off of ['false', '0', '', 'TRUE', 'yes', 'enabled', ' true']) {
      expect(contentGatingEnabled({ NEXT_PUBLIC_CONTENT_GATING_ENABLED: off }), off).toBe(false);
    }
    expect(typeof contentGatingEnabled()).toBe('boolean');
  });

  describe('build env', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('defaults read the build variables', () => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://hangul-route-api.example.workers.dev/');
      vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
      expect(apiBaseUrl()).toBe('https://hangul-route-api.example.workers.dev');
      expect(clerkPublishableKey()).toBe('pk_test_abc');
      expect(buildEnv().NEXT_PUBLIC_API_BASE_URL).toBe('https://hangul-route-api.example.workers.dev/');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.preview.example.com');
      expect(appUrl()).toBe('https://app.preview.example.com');
      vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
      expect(buildEnv().NEXT_PUBLIC_CONTENT_GATING_ENABLED).toBe('true');
      expect(contentGatingEnabled()).toBe(true);
    });

    it('never hands process.env around as an object (the browser bundle would see {})', () => {
      const source = readFileSync(new URL('../config.ts', import.meta.url), 'utf8');
      expect(source).not.toMatch(/process\.env(?!\.[A-Z_]+)/);
    });
  });
});

/** F-FEEDBACK-001 FB-10: the console notes switch, the twin of the learner app's `EXPO_PUBLIC_NOTES_ENABLED`. */
describe('notesEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off unless NEXT_PUBLIC_NOTES_ENABLED is "true" or "1"', () => {
    expect(notesEnabled({})).toBe(false);
    expect(notesEnabled({ NEXT_PUBLIC_NOTES_ENABLED: 'true' })).toBe(true);
    expect(notesEnabled({ NEXT_PUBLIC_NOTES_ENABLED: '1' })).toBe(true);
    for (const off of ['false', '0', 'enabled', 'TRUE', '', ' true']) expect(notesEnabled({ NEXT_PUBLIC_NOTES_ENABLED: off }), off).toBe(false);
    expect(typeof notesEnabled()).toBe('boolean');
  });

  it('reads the build value by its literal name', () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    expect(buildEnv().NEXT_PUBLIC_NOTES_ENABLED).toBe('true');
    expect(notesEnabled()).toBe(true);
  });
});
