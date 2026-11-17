import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colors } from '../../tokens';

/**
 * F-VOC-002 §3.4 and behaviour 6: `vocab.red` is a just-noticeable 3.4 from
 * `feedback.danger`, so the hue cannot keep a content red out of feedback; this
 * scan does. Only pictures may read `colors.vocab` or write a `'vocab.<key>'`
 * tone: `src/word-art/` and `components/WordArt/`, and since
 * AMENDMENTS-PICTURES-2026-11 rule R4 (row PX-0) the heritage card art
 * (`components/HeritageCardArt/`) and the hidden-heritage scene art
 * (`scene-art/hidden-heritage/`), so kimchi can be red in all three. Every
 * other file, feedback and UI chrome first, stays forbidden: the story
 * settings and props beside the hidden-heritage scenes keep their own palette.
 * The scan is the only gate loosened here: scene art's `ColorToken` type and
 * `isColorToken` (scene-art/tokens-map.ts) still leave the vocab group out for
 * every scene, so a hidden-heritage thing gets a vocab tone only once row PX-4
 * opens that type for those scenes. Tests are left
 * out (they hold the token tests and the negative samples); `tokens.ts`
 * defines the group and reads nothing.
 */

const REPO = join(__dirname, '..', '..', '..', '..', '..');

/** Source roots of every package and app that ships code. */
const ROOTS = ['packages', 'apps'];

const SKIP_DIRS = new Set(['node_modules', '__tests__', '__golden__', 'dist', 'build', 'out', 'coverage', '.next', '.expo', '.turbo', '.wrangler', 'ios', 'android', 'e2e']);

/** The places a picture is drawn: each a folder, with its separator, so a sibling folder with a longer name stays out. */
export const ALLOWED: readonly string[] = [
  join('packages', 'design-system', 'src', 'word-art') + sep,
  join('packages', 'design-system', 'src', 'components', 'WordArt') + sep,
  // rule R4 (PX-0): real colours for real things in card art and hidden-heritage things
  join('packages', 'design-system', 'src', 'components', 'HeritageCardArt') + sep,
  join('packages', 'design-system', 'src', 'scene-art', 'hidden-heritage') + sep,
];

/** True where a picture may use the vocab tones: inside an allowed folder. */
export const mayReadVocab = (rel: string): boolean => ALLOWED.some((folder) => rel.startsWith(folder));

const VOCAB_KEYS = Object.keys(colors.vocab).join('|');

export const VOCAB_READS: readonly RegExp[] = [
  // colors.vocab, colors?.vocab, colors['vocab'], colors["vocab"], colors[`vocab`]
  /\bcolors\s*\??\.\s*vocab\b/,
  /\bcolors\s*\[\s*['"`]vocab['"`]\s*\]/,
  // a tone path string: 'vocab.red', "vocab.skyBlue", `vocab.pink`
  new RegExp(`['"\`]vocab\\.(?:${VOCAB_KEYS})['"\`]`),
  // a tone built at runtime: `vocab.${key}`, 'vocab.' + key
  /`vocab\.\$\{/,
  /['"`]vocab\.['"`]\s*\+/,
  // destructuring the group: const { vocab } = colors; const { vocab: v } = tokens.colors
  /\{[^}]*\bvocab\b[^}]*\}\s*=\s*(?:[\w$]+\s*\.\s*)?colors\b/,
];

/** Local names `colors` is imported under (`import { colors as c }`), so `c.vocab` is caught too. */
function colorsAliases(source: string): string[] {
  return [...source.matchAll(/\bcolors\s+as\s+([\w$]+)/g)].map((m) => m[1]!);
}

export function readsVocab(source: string): boolean {
  if (VOCAB_READS.some((re) => re.test(source))) return true;
  return colorsAliases(source).some((alias) => {
    const name = `(?<![\\w$.])${alias.replace(/\$/g, '\\$')}`;
    return new RegExp(`${name}\\s*\\??\\.\\s*vocab\\b|${name}\\s*\\[\\s*['"\`]vocab['"\`]`).test(source);
  });
}

function sourceFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) || name.startsWith('.') ? [] : sourceFiles(path);
    if (!/\.(?:[cm]?[jt]s|[jt]sx)$/.test(name) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name) || name.endsWith('.d.ts')) return [];
    return [path];
  });
}

describe('readsVocab', () => {
  it.each([
    ['colors.vocab.red', 'const c = colors.vocab.red;'],
    ['optional chain', 'colors?.vocab'],
    ['bracket', "colors['vocab']"],
    ['template bracket', 'colors[`vocab`]'],
    ['single-quoted tone', "fill: 'vocab.red'"],
    ['double-quoted tone', 'stroke: "vocab.skyBlue"'],
    ['template tone', 'f: `vocab.pink`'],
    ['a tone built from a template', 'const tone = `vocab.${key}`;'],
    ['a tone built by concatenation', "const tone = 'vocab.' + key;"],
    ['destructuring', 'const { vocab } = colors;'],
    ['destructuring with a rename', 'const { brand, vocab: v } = tokens.colors;'],
    ['an aliased import', "import { colors as c } from '@hangul-route/design-system';\nconst red = c.vocab.red;"],
    ['an aliased import, bracket', "import { colors as palette } from '../tokens';\npalette['vocab'];"],
  ])('fires on %s', (_name, source) => {
    expect(readsVocab(source)).toBe(true);
  });

  it.each([
    ['a group name in an exclusion list', "const RESERVED = new Set(['vocab']);"],
    ['a file name', "import x from './vocab.ts'; join('__generated__', 'vocab.ts')"],
    ['an item id', "'vocab:ppalgansaek'"],
    ['a schema name', 'VocabItemSchema.parse(x); vocabulary.red'],
    ['an unknown key', "'vocab.magenta'"],
    ['destructuring something else', 'const { brand, text } = colors; const { vocab } = content;'],
    ['an alias reading another group', "import { colors as c } from '../tokens';\nc.brand.primary; other.vocab;"],
  ])('lets %s through', (_name, source) => {
    expect(readsVocab(source)).toBe(false);
  });
});

describe('the source tree (behaviour 6)', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(join(REPO, root)));

  it('scans the design system, the apps and the packages', () => {
    const rel = files.map((f) => relative(REPO, f));
    expect(rel).toContain(join('packages', 'design-system', 'src', 'tokens.ts'));
    expect(rel).toContain(join('packages', 'design-system', 'src', 'scene-art', 'tokens-map.ts'));
    expect(rel.some((f) => f.startsWith(join('apps', 'mobile', 'src') + sep))).toBe(true);
    expect(rel.some((f) => f.startsWith(join('apps', 'web', 'src') + sep))).toBe(true);
    expect(rel.some((f) => f.startsWith(join('packages', 'design-system', 'src', 'word-art') + sep))).toBe(true);
  });

  it('lets the card art and the hidden-heritage scene art through (R4), and nothing beside them', () => {
    const ds = join('packages', 'design-system', 'src');
    expect(mayReadVocab(join(ds, 'components', 'HeritageCardArt', 'HeritageCardArt.tsx'))).toBe(true);
    expect(mayReadVocab(join(ds, 'components', 'HeritageCardArt', 'UpperCellArt.tsx'))).toBe(true);
    expect(mayReadVocab(join(ds, 'scene-art', 'hidden-heritage', 'food-market.ts'))).toBe(true);
    // the app screen that paints the scene, a folder whose name only starts the same, the story scene art and feedback UI stay out
    expect(mayReadVocab(join('apps', 'mobile', 'src', 'screens', 'minigames', 'HiddenHeritageScene.tsx'))).toBe(false);
    expect(mayReadVocab(join(ds, 'components', 'HeritageCardArtExtras', 'x.tsx'))).toBe(false);
    expect(mayReadVocab(join(ds, 'scene-art', 'props', 'food.ts'))).toBe(false);
    expect(mayReadVocab(join(ds, 'scene-art', 'settings', 'seashore.ts'))).toBe(false);
    expect(mayReadVocab(join(ds, 'components', 'Card', 'Card.tsx'))).toBe(false);
    expect(mayReadVocab(join(ds, 'components', 'HoyaBubble', 'HoyaBubble.tsx'))).toBe(false);
    expect(mayReadVocab(join(ds, 'scene-art', 'tokens-map.ts'))).toBe(false);
    expect(mayReadVocab(join(ds, 'tokens.ts'))).toBe(false);
  });

  it('the allowed folders exist, so a rename cannot leave a dead entry', () => {
    for (const folder of ALLOWED) expect(statSync(join(REPO, folder)).isDirectory(), folder).toBe(true);
  });

  it('only the pictures (word-art, WordArt, the card art, the hidden-heritage scene art) read colors.vocab or write a vocab tone', () => {
    const offenders = files
      .map((f) => relative(REPO, f))
      .filter((rel) => !mayReadVocab(rel))
      .filter((rel) => readsVocab(readFileSync(join(REPO, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });
});

/** W1 and W6: WordArt holds token paths only; no colour literal, text, raster or emoji in its source. */
const LITERALS: ReadonlyArray<{ name: string; re: RegExp }> = [
  // a quoted colour ('#D83A34', "#fff"); an issue or PR number in a comment (see #214) is not one
  { name: 'hex colour', re: /['"`]#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])/ },
  { name: 'rgb()', re: /\brgba?\s*\(/i },
  { name: 'hsl()', re: /\bhsla?\s*\(/i },
  { name: 'text element', re: /<text\b/i },
  { name: 'image element', re: /<image\b/i },
  { name: 'emoji', re: /\p{Extended_Pictographic}/u },
];

const literalsIn = (source: string): string[] => LITERALS.filter(({ re }) => re.test(source)).map(({ name }) => name);

describe('word-art source holds no literal colour, text, raster or emoji', () => {
  it('the scan fires on each construct and lets token paths through', () => {
    expect(literalsIn("f: '#D83A34'")).toEqual(['hex colour']);
    expect(literalsIn('rgba(0, 0, 0, 0.4)')).toEqual(['rgb()']);
    expect(literalsIn('hsl(10 20% 30%)')).toEqual(['hsl()']);
    expect(literalsIn('<text x="1">a</text>')).toEqual(['text element']);
    expect(literalsIn('<image href="a.png" />')).toEqual(['image element']);
    expect(literalsIn('const e = "\u{1F600}";')).toEqual(['emoji']);
    expect(literalsIn("f: 'vocab.red' // see #12")).toEqual([]);
    expect(literalsIn('// drawn in #214, reviewed in #230 (abc1234)')).toEqual([]);
    expect(literalsIn('fill="#fff"')).toEqual(['hex colour']);
    expect(literalsIn('const c = `#00ff00`;')).toEqual(['hex colour']);
  });

  const dir = join(REPO, 'packages', 'design-system', 'src', 'word-art');
  it.each(sourceFiles(dir).map((f) => [relative(dir, f), f]))('%s', (_name, file) => {
    expect(literalsIn(readFileSync(file as string, 'utf8'))).toEqual([]);
  });
});
