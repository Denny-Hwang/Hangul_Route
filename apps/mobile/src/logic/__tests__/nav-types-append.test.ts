import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * navigation/types.ts is shared by many parallel PRs. Its layout keeps a new union member a pure
 * line insertion that never edits an existing line (no member carries the closing semicolon). Param
 * lists already close with `};` on its own line, so a new route is an insertion there too. These
 * checks pin that layout (types only, no behaviour).
 */
const types = readFileSync(join(__dirname, '../../navigation/types.ts'), 'utf8');
const lines = types.split('\n');
const MARKER = '// add new members above this line';

describe('navigation/types.ts append-only layout', () => {
  it('never ends a union member line with the closing semicolon', () => {
    const offenders = lines.filter((line) => /^\s*\|.*;\s*$/.test(line));
    expect(offenders).toEqual([]);
  });

  it('closes every multi-line union with the marker line, then a lone semicolon', () => {
    const unionStarts = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /^export type \w+ =\s*$/.test(line));
    expect(unionStarts.length).toBeGreaterThan(0);
    for (const { i } of unionStarts) {
      let end = i + 1;
      while (end < lines.length && lines[end]?.trim() !== ';') end += 1;
      expect(end).toBeLessThan(lines.length);
      expect(lines[end - 1]?.trim()).toBe(MARKER);
    }
  });
});
