import { describe, expect, it } from 'vitest';
import { PRIVACY_FALLBACK_NOTE, privacyUrl } from '../links';

describe('privacyUrl (F-LEARN-001 §3.3)', () => {
  it('defaults to the production site', () => {
    expect(privacyUrl({})).toBe('https://hangulroute.com/privacy');
  });

  it('follows the configured console base, ignoring a trailing slash and spaces', () => {
    expect(privacyUrl({ EXPO_PUBLIC_CONSOLE_URL: ' https://staging.example/ ' })).toBe('https://staging.example/privacy');
  });

  it('reads the build environment when no env is passed', () => {
    expect(privacyUrl()).toMatch(/\/privacy$/);
  });

  it('has a calm fallback line for when the browser cannot be opened', () => {
    expect(PRIVACY_FALLBACK_NOTE).toBe('Open hangulroute.com/privacy in a browser.');
  });
});
