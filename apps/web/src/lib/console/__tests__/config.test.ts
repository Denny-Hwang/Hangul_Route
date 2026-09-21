import { describe, expect, it } from 'vitest';
import { apiBaseUrl, devAuthEnabled } from '../config';

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
    expect(typeof devAuthEnabled()).toBe('boolean');
    expect(apiBaseUrl() === null || typeof apiBaseUrl() === 'string').toBe(true);
  });
});
