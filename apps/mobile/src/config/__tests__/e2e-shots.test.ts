import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOTS_DIR, shotFile, shotsEnabled } from '../../../e2e/web/shots';

/**
 * F-LAYOUT-001 §5 / PR 7: the screenshot helper of the web e2e specs. A UI pull
 * request attaches PNGs of Home, Journey and Library; `tablet-layout.spec.ts`
 * writes them with `shot(page, name)` only when `HR_SHOTS=1`, into a
 * git-ignored folder.
 */
const ROOT = join(__dirname, '..', '..', '..');

describe('HR_SHOTS screenshot helper', () => {
  it('is on only when HR_SHOTS is 1', () => {
    expect(shotsEnabled({ HR_SHOTS: '1' })).toBe(true);
    expect(shotsEnabled({ HR_SHOTS: '0' })).toBe(false);
    expect(shotsEnabled({ HR_SHOTS: 'true' })).toBe(false);
    expect(shotsEnabled({})).toBe(false);
  });

  it('writes a PNG named after the shot into e2e/web/__shots__', () => {
    expect(SHOTS_DIR).toBe(join(ROOT, 'e2e', 'web', '__shots__'));
    expect(shotFile('home-1180x820')).toBe(join(SHOTS_DIR, 'home-1180x820.png'));
  });

  it('refuses a name that would leave the folder', () => {
    expect(() => shotFile('../home')).toThrow();
    expect(() => shotFile('a/b')).toThrow();
    expect(() => shotFile('')).toThrow();
  });

  it('the folder is git-ignored', () => {
    const ignore = readFileSync(join(ROOT, '..', '..', '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^apps\/mobile\/e2e\/web\/__shots__\/$/m);
  });
});
