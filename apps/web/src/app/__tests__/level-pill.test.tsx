import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** F-LEARN-001 §3.7: a level label, never an age (the /parent demo that printed one left with F-APP-001 A-5b). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no "Age X" label in web sources (F-LEARN-001 §3.7)', () => {
  const root = join(__dirname, '..', '..');
  for (const file of sources(root)) {
    it(file.slice(root.length + 1), () => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/Age \{/);
      expect(src).not.toMatch(/Age \$\{/);
      expect(src).not.toMatch(/'Age \d/);
    });
  }
});
