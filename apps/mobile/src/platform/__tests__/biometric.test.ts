import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { biometric } from '../biometric';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9 (section 8.6): the web build has no face or fingerprint shortcut.
 * The stub reports unavailable, writes and reads nothing, and imports no native module, so
 * `expo-local-authentication` and `expo-secure-store` stay out of the web bundle (section 16).
 */
describe('[OA] platform/biometric (web and tests)', () => {
  it('reports unavailable and never turns anything on', async () => {
    expect(await biometric.available()).toBe(false);
    expect(await biometric.write('prompt')).toBe('unavailable');
    expect(await biometric.read('prompt')).toBe('cancelled');
    await expect(biometric.remove()).resolves.toBeUndefined();
  });

  it('imports no native module', () => {
    const src = readFileSync(join(__dirname, '../biometric.ts'), 'utf8');
    expect(src).not.toMatch(/from 'expo-(local-authentication|secure-store|crypto)'/);
    expect(src).not.toMatch(/require\(/);
  });
});
