import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * navigation/types.ts is shared by many parallel PRs. Its layout keeps a new union member a pure
 * line insertion that never edits an existing line (no member carries the closing semicolon). Param
 * lists already close with `};` on its own line, so a new route is an insertion there too. These
 * checks pin that layout (types only, no behaviour). Every multi-line top-level union in the file
 * (`type X =` or `export type X =` with nothing after `=`, first member on the next line) must use
 * the marker layout. Unions nested inside param-list objects are not checked: they end with the
 * property's own `;` as usual.
 */
const types = readFileSync(join(__dirname, '../../navigation/types.ts'), 'utf8');
const lines = types.split('\n');
const MARKER = '// add new members above this line';
const DECLARATION = /^(export )?(type|interface|const|function|declare|namespace) /;

/** Index of the next line that is not blank and not a comment line. */
function nextCodeLine(from: number): number {
  let i = from;
  while (i < lines.length) {
    const t = lines[i]?.trim() ?? '';
    if (t !== '' && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*')) return i;
    i += 1;
  }
  return i;
}

/** Top-level multi-line unions: start line, and the line holding their lone `;` (or -1). */
const unions = lines
  .map((line, i) => ({ line, i }))
  .filter(
    ({ line, i }) =>
      /^(export )?type \w+ =\s*$/.test(line) &&
      (lines[nextCodeLine(i + 1)]?.trim().startsWith('|') ?? false),
  )
  .map(({ line, i }) => {
    let end = i + 1;
    while (end < lines.length && lines[end]?.trim() !== ';' && !DECLARATION.test(lines[end] ?? '')) {
      end += 1;
    }
    return { name: line, start: i, end: lines[end]?.trim() === ';' ? end : -1 };
  });

describe('navigation/types.ts append-only layout', () => {
  it('finds at least one multi-line union to check', () => {
    expect(unions.length).toBeGreaterThan(0);
  });

  it('closes every multi-line union with the marker line, then a lone semicolon', () => {
    for (const { name, end } of unions) {
      expect({ name, closed: end > 0 }).toEqual({ name, closed: true });
      expect({ name, beforeClose: lines[end - 1]?.trim() }).toEqual({ name, beforeClose: MARKER });
    }
  });

  it('never puts a semicolon on a union member line, even before a trailing comment', () => {
    const offenders = unions.flatMap(({ start, end }) =>
      lines.slice(start + 1, end > 0 ? end : lines.length).filter((line) => /^\s*\|[^/]*;/.test(line)),
    );
    expect(offenders).toEqual([]);
  });
});
