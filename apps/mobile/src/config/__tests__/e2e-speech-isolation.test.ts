import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A developer's Mac has real Korean voices, and headless Chromium uses them:
 * a web e2e spec that reaches a minigame without replacing `speechSynthesis`
 * reads the letters aloud ("gi-yeok", "ga", "na", "da") through the speakers,
 * once per quest step, for as long as the suite runs. Every spec therefore
 * takes `test` from `./fixtures`, whose auto fixture swaps in a silent engine
 * before the app loads (a spec that needs to hear utterances installs its own
 * recording fake on top of it).
 */
const E2E_DIR = join(__dirname, '..', '..', '..', 'e2e', 'web');
const specs = readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.ts'));
const IMPORTS_TEST_FROM_PLAYWRIGHT = /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/;

describe('web e2e specs never reach the real speech engine', () => {
  it('finds the specs', () => {
    expect(specs.length).toBeGreaterThan(5);
  });

  it.each(specs)('%s takes test from ./fixtures', (file) => {
    const source = readFileSync(join(E2E_DIR, file), 'utf8');
    expect(source).not.toMatch(IMPORTS_TEST_FROM_PLAYWRIGHT);
    expect(source).toMatch(/from '\.\/fixtures'/);
  });

  it('the fixtures file installs a silent speech engine for every test', () => {
    const source = readFileSync(join(E2E_DIR, 'fixtures.ts'), 'utf8');
    expect(source).toContain('auto: true');
    expect(source).toContain('addInitScript');
    expect(source).toContain('speechSynthesis');
  });

  // `./fixtures` resolves to fixtures.ts only while the data folder next to it
  // (fixtures/, e.g. the touch-target allowlist) has no index module; one would
  // silently take over every spec's `test` import and drop the silent engine.
  it.each(['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.cjs'])('the fixtures/ data folder has no %s', (file) => {
    expect(existsSync(join(E2E_DIR, 'fixtures', file))).toBe(false);
  });
});
