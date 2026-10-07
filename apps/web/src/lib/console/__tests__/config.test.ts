import { describe, expect, it } from 'vitest';
import { apiBaseUrl, clerkPublishableKey, devAuthEnabled, schoolConsentModeEnabled } from '../config';

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

  it('school consent mode is locked until explicitly enabled (legal review)', () => {
    expect(schoolConsentModeEnabled({})).toBe(false);
    expect(schoolConsentModeEnabled({ NEXT_PUBLIC_SCHOOL_CONSENT_MODE: 'true' })).toBe(false);
    expect(schoolConsentModeEnabled({ NEXT_PUBLIC_SCHOOL_CONSENT_MODE: 'enabled' })).toBe(true);
    expect(typeof schoolConsentModeEnabled()).toBe('boolean');
  });
});
