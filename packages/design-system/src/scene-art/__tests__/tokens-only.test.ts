import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-002 §3.9.1: every colour in scene-art is a token path. A source scan
 * keeps literals, text, raster and emoji out of everything under scene-art/
 * (the tests excluded, since they hold the negative samples).
 */

export const FORBIDDEN: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb()', re: /\brgba?\s*\(/i },
  { name: 'hsl()', re: /\bhsla?\s*\(/i },
  { name: 'text element', re: /<text\b/i },
  { name: 'image element', re: /<image\b/i },
  { name: 'emoji', re: /\p{Extended_Pictographic}/u },
];

export function scan(source: string): string[] {
  return FORBIDDEN.filter(({ re }) => re.test(source)).map(({ name }) => name);
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const ROOT = join(__dirname, '..');

describe('scan', () => {
  it('flags each forbidden construct', () => {
    expect(scan('const c = "#B24915";')).toEqual(['hex colour']);
    expect(scan('fill: "#fff"')).toEqual(['hex colour']);
    expect(scan('rgba(0, 0, 0, 0.4)')).toEqual(['rgb()']);
    expect(scan('hsl(10 20% 30%)')).toEqual(['hsl()']);
    expect(scan('<text x="1">a</text>')).toEqual(['text element']);
    expect(scan('<image href="a.png" />')).toEqual(['image element']);
    expect(scan('const e = "\u{1F600}";')).toEqual(['emoji']);
  });

  it('lets token paths, issue numbers and prose through', () => {
    expect(scan("fill: 'theme.rites'; // see #12, the 40 shapes rule")).toEqual([]);
  });
});

describe('scene-art sources', () => {
  const files = sources(ROOT);

  it('finds the core files', () => {
    const names = files.map((f) => relative(ROOT, f));
    for (const n of ['types.ts', 'tokens-map.ts', 'resolve.ts', 'rules.ts', 'index.ts']) expect(names).toContain(n);
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))('%s has no literal colours, text, raster or emoji', (_name, file) => {
    expect(scan(readFileSync(file as string, 'utf8'))).toEqual([]);
  });
});
