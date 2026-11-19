import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * The modules of the web start bundle, read from the sources (AMENDMENTS-FINISH-2026-11 FN-7): from `index.ts`, every
 * import Metro's web build folds into the entry chunk, resolved the way it resolves them (a `.web.*` twin wins,
 * `.native.*` is never taken; a workspace package by its `main`, a subpath by the file it names, since Metro does not read
 * `exports`). A literal `import()` starts a chunk of its own; a type-only import is erased. Expo's serializer moves a
 * module that two chunks share into the entry chunk, and so does this walk. Checked against the release build's source
 * map when it was written: the same app and workspace files, but for `require()`s behind the `EXPO_OS` tests the web
 * build folds away (the walk keeps them; they are a few small native-only files).
 */

const MOBILE = join(__dirname, '..', '..');
export const REPO = join(MOBILE, '..', '..');

/** A path relative to the repository, with forward slashes. */
export const repoPath = (file: string): string => relative(REPO, file).split(sep).join('/');

const EXTENSIONS = ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js', '.mjs', '.cjs'];

function resolveFile(base: string): string | null {
  const candidates = [...EXTENSIONS.map((ext) => `${base}${ext}`), ...EXTENSIONS.map((ext) => join(base, `index${ext}`)), base];
  for (const candidate of candidates) {
    if (/\.([cm]?js|tsx?)$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** A workspace package (`@hangul-route/<name>`) or one of its subpaths, as Metro finds it; null for any other package. */
function resolveWorkspace(specifier: string): string | null {
  const match = /^@hangul-route\/([^/]+)(?:\/(.+))?$/.exec(specifier);
  if (match === null) return null;
  const root = join(REPO, 'packages', match[1] as string);
  if (!existsSync(join(root, 'package.json'))) return null;
  if (match[2] !== undefined) return resolveFile(join(root, match[2]));
  const main = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { main?: string }).main ?? 'index';
  return resolveFile(join(root, main.replace(/\.(tsx?|js)$/, '')));
}

/** The source without comments (a comment may quote an import). */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every specifier the module imports into its own chunk: static imports and re-exports that are not type-only, and `require()`. */
export function staticSpecifiers(source: string): string[] {
  const text = code(source);
  const found: string[] = [];
  for (const m of text.matchAll(/(?:^|[;\n}])\s*(import|export)\s+(type\s+)?([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    if (m[2] !== undefined) continue;
    const clause = (m[3] as string).trim();
    // `import { type A, type B } from` imports nothing at run time.
    const named = /^\{([\s\S]*)\}$/.exec(clause);
    if (named !== null && named[1]!.split(',').every((s) => s.trim() === '' || /^type\s/.test(s.trim()))) continue;
    found.push(m[4] as string);
  }
  for (const m of text.matchAll(/(?:^|[;\n])\s*import\s*['"]([^'"]+)['"]/g)) found.push(m[1] as string);
  for (const m of text.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1] as string);
  return found;
}

/** The literal `import()`s of a module: each starts a chunk of its own. */
export function dynamicSpecifiers(source: string): string[] {
  return [...code(source).matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] as string);
}

export interface StartGraph {
  /** Every app or workspace file in the start bundle, with the import chain that reaches it (repository paths). */
  files: Map<string, string[]>;
  /** The targets of literal `import()`s anywhere in the build (repository paths): each starts a chunk of its own. */
  chunks: Set<string>;
  /** The files two chunks share, which Expo's serializer moves into the start bundle (`serializeChunks.js`). */
  shared: Set<string>;
}

function resolveFrom(from: string, specifier: string): string | null {
  return specifier.startsWith('.') ? resolveFile(resolve(dirname(from), specifier)) : resolveWorkspace(specifier);
}

/** The files `entry` imports statically (itself included), with their chains, and the chunks they load. */
function closure(entry: string, chain0: string[]): { files: Map<string, string[]>; chunks: Map<string, string> } {
  const files = new Map<string, string[]>();
  const chunks = new Map<string, string>();
  const queue: [string, string[]][] = [[entry, chain0]];
  while (queue.length > 0) {
    const [file, chain] = queue.shift() as [string, string[]];
    const key = repoPath(file);
    if (files.has(key)) continue;
    files.set(key, chain);
    const source = readFileSync(file, 'utf8');
    for (const specifier of staticSpecifiers(source)) {
      const target = resolveFrom(file, specifier);
      if (target !== null && !/\.native\.[jt]sx?$/.test(target)) queue.push([target, [...chain, repoPath(target)]]);
    }
    for (const specifier of dynamicSpecifiers(source)) {
      const target = resolveFrom(file, specifier);
      if (target !== null && !chunks.has(repoPath(target))) chunks.set(repoPath(target), target);
    }
  }
  return { files, chunks };
}

/**
 * The start bundle's files from `entry` (default: the app's `index.ts`): its static closure, plus every file that two
 * chunks (literal `import()`s, at any depth) both import statically, as Expo's serializer moves those into it.
 */
export function startGraph(entry: string = join(MOBILE, 'index.ts')): StartGraph {
  const start = closure(entry, [repoPath(entry)]);
  const files = new Map(start.files);
  const pending = [...start.chunks.values()];
  const byChunk = new Map<string, Map<string, string[]>>();
  while (pending.length > 0) {
    const target = pending.shift() as string;
    const key = repoPath(target);
    if (byChunk.has(key)) continue;
    const own = closure(target, [`import(${key})`]);
    byChunk.set(key, own.files);
    pending.push(...own.chunks.values());
  }
  const shared = new Set<string>();
  const seen = new Map<string, string>();
  for (const [chunk, own] of byChunk) {
    for (const [file, chain] of own) {
      if (start.files.has(file)) continue;
      const other = seen.get(file);
      if (other === undefined) seen.set(file, chunk);
      else if (other !== chunk && !shared.has(file)) {
        shared.add(file);
        files.set(file, [`shared by import(${other}) and`, ...chain]);
      }
    }
  }
  return { files, chunks: new Set(byChunk.keys()), shared };
}
