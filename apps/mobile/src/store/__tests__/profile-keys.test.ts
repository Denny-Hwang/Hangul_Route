import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));

import { PER_PROFILE_KEYS } from '../profile-keys';

/**
 * [OA] Row OA-7a (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.4, CS-20): the registry of per-profile keys names every
 * key template in the app's source, so a store that adds one cannot be missed by Remove from this device (the sweep
 * in `remove-from-device.test.ts` seeds every template listed here).
 */
const SRC = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === '__generated__' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `` `prefix:${profileId}` `` (or `learnerId`), and a prefix constant joined with a profile id. */
const TEMPLATE = /`([a-z][a-z-]*(?::[a-z-]+)*):\$\{(?:profileId|learnerId)\}`/g;

describe('[OA] the per-profile key registry (row OA-7a, CS-20)', () => {
  it('every per-profile key template in the source is in PER_PROFILE_KEYS', () => {
    const listed = new Set(Object.values(PER_PROFILE_KEYS).map((template) => template('ID')));
    const found: string[] = [];
    for (const file of sources(SRC)) {
      for (const match of readFileSync(file, 'utf8').matchAll(TEMPLATE)) {
        const key = `${match[1]}:ID`;
        found.push(key);
        expect(listed.has(key), `${relative(SRC, file)}: ${match[0]} is a per-profile key missing from store/profile-keys.ts`).toBe(true);
      }
    }
    // The scan sees the templates (a regex that matched nothing would pass vacuously).
    expect(found.length).toBeGreaterThanOrEqual(15);
  });

  it('every template keeps the id at its end, so a sweep by id finds it, and no two templates share a key', () => {
    const keys = Object.values(PER_PROFILE_KEYS).map((template) => template('profile:abc12345'));
    for (const key of keys) expect(key.endsWith(':profile:abc12345'), key).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
