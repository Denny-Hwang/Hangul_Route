import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '__tests__') continue;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('Hermes-safe source (F-I18N-001 §3.1, §10)', () => {
  const files = sourceFiles(SRC);

  it('scans real files', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = file.slice(SRC.length + 1);

    it(`${rel}: no \\p{...} property escapes`, () => {
      expect(/\\[pP]\{/.test(text)).toBe(false);
    });

    it(`${rel}: no look-behind assertions`, () => {
      expect(/\(\?<[=!]/.test(text)).toBe(false);
    });

    it(`${rel}: no String.prototype.normalize or Intl.PluralRules (unverified on Hermes)`, () => {
      expect(/\.normalize\(/.test(text)).toBe(false);
      expect(/PluralRules/.test(text)).toBe(false);
    });
  }
});
