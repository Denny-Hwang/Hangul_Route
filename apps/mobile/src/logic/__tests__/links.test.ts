import { describe, expect, it } from 'vitest';
import { PRIVACY_FALLBACK_NOTE, privacyUrl } from '../links';

describe('privacyUrl (F-LEARN-001 §3.3)', () => {
  it('defaults to the production site', () => {
    expect(privacyUrl({})).toBe('https://hangulroute.com/privacy');
  });

  it('follows the configured console base, ignoring a trailing slash and spaces', () => {
    expect(privacyUrl({ EXPO_PUBLIC_CONSOLE_URL: ' https://staging.example/ ' })).toBe('https://staging.example/privacy');
  });

  // F-APP-001 A-7, section 3.6: the site root is EXPO_PUBLIC_SITE_URL, then EXPO_PUBLIC_CONSOLE_URL
  // (back-compat), then hangulroute.com. Legal pages stay on the site.
  it('reads EXPO_PUBLIC_SITE_URL before the console base', () => {
    expect(
      privacyUrl({ EXPO_PUBLIC_SITE_URL: 'https://site.example/', EXPO_PUBLIC_CONSOLE_URL: 'https://console.example' }),
    ).toBe('https://site.example/privacy');
    expect(privacyUrl({ EXPO_PUBLIC_SITE_URL: 'https://site.example' })).toBe('https://site.example/privacy');
  });

  it('falls back to the console base, then the production site, when the site variable is blank', () => {
    expect(privacyUrl({ EXPO_PUBLIC_SITE_URL: '  ', EXPO_PUBLIC_CONSOLE_URL: 'https://console.example' })).toBe(
      'https://console.example/privacy',
    );
    expect(privacyUrl({ EXPO_PUBLIC_SITE_URL: '', EXPO_PUBLIC_CONSOLE_URL: ' ' })).toBe('https://hangulroute.com/privacy');
  });

  it('reads the build environment when no env is passed', () => {
    expect(privacyUrl()).toMatch(/\/privacy$/);
  });

  it('has a calm fallback line for when the browser cannot be opened', () => {
    expect(PRIVACY_FALLBACK_NOTE).toBe('Open hangulroute.com/privacy in a browser.');
  });
});
