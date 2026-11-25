import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, startGraph } from '../../test-support/start-graph';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7 (finding F4): what the web start bundle carries, read from the sources the way the
 * build folds them (`test-support/start-graph.ts`: static imports from `index.ts`, plus what two chunks share). Each step
 * of the row that moves code out of the start bundle pins it here; the build's post-build check pins each chunk's marker
 * (`scripts/pwa/lesson-chunks.mjs`) and the start bundle's size.
 */

const graph = startGraph();
const reached = (file: string): string | undefined => graph.files.get(file)?.join(' -> ');

const APP = join(REPO, 'apps', 'mobile');
/** Every source of the web build, start bundle or chunk: `.ts`/`.tsx` under `src` and the app entries, tests and `.native` files aside. */
function webSources(): string[] {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sources(path);
      return /\.tsx?$/.test(name) && !/\.(test|native)\.tsx?$/.test(name) ? [path] : [];
    });
  return [...sources(join(APP, 'src')), ...['index.ts', 'App.tsx', 'PresenterApp.tsx', 'BrowseApp.tsx'].map((f) => join(APP, f))];
}
/** The code of a file without its comments. */
const codeOf = (file: string): string => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the start bundle (AMENDMENTS-FINISH-2026-11 FN-7)', () => {
  it('walks the whole start bundle: the app, its navigation and its packages', () => {
    expect(graph.files.has('apps/mobile/App.tsx')).toBe(true);
    expect(graph.files.has('apps/mobile/src/navigation/root.tsx')).toBe(true);
    expect(graph.files.has('packages/content-schema/src/index.ts')).toBe(true);
    expect(graph.files.size).toBeGreaterThan(900);
    // The presenter and All lessons are chunks; what they share is in the start bundle (Expo's serializer).
    expect(graph.chunks.has('apps/mobile/PresenterApp.tsx')).toBe(true);
    expect(graph.shared.size).toBeGreaterThan(0);
  });

  it('step 1: the level check\'s bank is a chunk of its own; the start bundle reads its meta only', () => {
    expect(reached('apps/mobile/src/content/placement.generated.ts')).toBeUndefined();
    expect(reached('apps/mobile/src/content/placement-bank-chunk.ts')).toBeUndefined();
    expect(graph.chunks.has('apps/mobile/src/content/placement-bank-chunk.ts')).toBe(true);
    expect(graph.files.has('apps/mobile/src/content/placement-meta.generated.ts')).toBe(true);
  });

  it('step 2: the content linters are not in it (the content-schema barrel no longer carries them)', () => {
    expect(reached('packages/content-schema/src/story-lint.ts')).toBeUndefined();
    expect(reached('packages/content-schema/src/lesson-cell-lint.ts')).toBeUndefined();
    expect(reached('packages/content-schema/src/lesson-lint.ts')).toBeUndefined();
  });

  it('step 3: more learner screens are chunks of their own, reached through their doors', () => {
    const screens: Record<string, string> = {
      'apps/mobile/src/screens/minigames/writing-chunk.tsx': 'apps/mobile/src/screens/minigames/TypeHangulGame.tsx',
      'apps/mobile/src/screens/minigames/trace-word-chunk.tsx': 'apps/mobile/src/screens/minigames/TraceWordGame.tsx',
      'apps/mobile/src/screens/minigames/sentence-builder-chunk.tsx': 'apps/mobile/src/screens/minigames/SentenceBuilderGame.tsx',
      'apps/mobile/src/screens/story/reader-chunk.tsx': 'apps/mobile/src/screens/story/StoryReaderView.tsx',
      'apps/mobile/src/screens/vocab/speed-round-chunk.tsx': 'apps/mobile/src/screens/vocab/VocabSpeedRoundScreen.tsx',
      'apps/mobile/src/screens/route/route-proposal-chunk.tsx': 'apps/mobile/src/screens/route/RouteProposalScreen.tsx',
      'apps/mobile/src/screens/sync/join-space-chunk.tsx': 'apps/mobile/src/screens/sync/JoinSpaceScreen.tsx',
      'apps/mobile/src/screens/placement/placement-chunk.tsx': 'apps/mobile/src/screens/placement/PlacementScreen.tsx',
    };
    for (const [chunk, screen] of Object.entries(screens)) {
      expect(graph.chunks.has(chunk), chunk).toBe(true);
      expect(reached(chunk), chunk).toBeUndefined();
      expect(reached(screen), screen).toBeUndefined();
    }
    // Write Frame rides with Type Hangul; what only the games use leaves with them.
    for (const file of [
      'apps/mobile/src/screens/minigames/WriteFrameGame.tsx',
      'apps/mobile/src/logic/type-hangul/flow.ts',
      'apps/mobile/src/logic/trace-word/flow.ts',
      'apps/mobile/src/logic/sentence-builder/reducer.ts',
      'apps/mobile/src/logic/story/reader-state.ts',
      'apps/mobile/src/screens/placement/ItemScreen.tsx',
      'apps/mobile/src/screens/sync/JoinBatch.tsx',
    ]) {
      expect(reached(file), file).toBeUndefined();
    }
  });

  it('step 4: the public site\'s strings (`landing`) are not in it; the app reads none of them', () => {
    expect(reached('packages/i18n/src/messages/en/landing.ts')).toBeUndefined();
    expect(graph.files.has('packages/i18n/src/messages/en/index.web.ts')).toBe(true);
    expect(graph.files.has('packages/i18n/src/messages/en/learner.ts')).toBe(true);
    // The twin's `landing` is empty, so no source of the web build, start bundle or chunk, may read it (comments aside).
    const files = webSources();
    expect(files.length).toBeGreaterThan(1000);
    const readers = files.filter((file) => /\.landing\b|\[['"]landing['"]\]/.test(codeOf(file))).map((file) => relative(APP, file));
    expect(readers).toEqual([]);
  });
});

/** `console.log` and its siblings: the global, not the dictionary namespace. */
const CONSOLE_METHODS = new Set(['log', 'warn', 'error', 'info', 'debug', 'trace', 'table', 'group', 'groupEnd', 'time', 'timeEnd', 'assert', 'dir', 'count']);
type Tree = { readonly [key: string]: unknown };
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;
const at = (tree: unknown, path: string): unknown => path.split('.').reduce<unknown>((node, key) => (isTree(node) ? node[key] : undefined), tree);
const leaves = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => (isTree(value) ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]));

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-1: the web twin's `console` (`messages/en/console-app.ts`) holds only what a web
 * source reads. The reads are `.console.<path>` in the sources' code; a path covers its whole subtree.
 */
describe('the console strings of the web English twin (AMENDMENTS-START-BUNDLE-2026-11 SB-1)', () => {
  const reads = new Map<string, string[]>();
  const wholeReaders: string[] = [];
  for (const file of webSources()) {
    const code = codeOf(file);
    // `Messages['console']['billing']` is a type (plan-lines.ts); a value index on a lower-case name is a read.
    if (/(?<!\b[A-Z][\w$]*)\[['"]console['"]\]/.test(code)) wholeReaders.push(relative(APP, file));
    for (const match of code.matchAll(/\.console((?:\.[A-Za-z_$][\w$]*)*)(?![\w$])/g)) {
      const path = (match[1] ?? '').slice(1);
      if (CONSOLE_METHODS.has(path.split('.')[0] ?? '')) continue;
      if (path === '') wholeReaders.push(relative(APP, file));
      else reads.set(path, [...(reads.get(path) ?? []), relative(APP, file)]);
    }
  }
  const twinConsole = async (): Promise<Tree> =>
    (await import('../../../../../packages/i18n/src/messages/en/index.web')).en.console as unknown as Tree;

  it('no web source reads the namespace whole, and the web build reads some of it', () => {
    expect(wholeReaders).toEqual([]);
    expect([...reads.keys()]).toEqual(expect.arrayContaining(['transfer.consent', 'confirm.remove', 'placement.startingSpot']));
  });

  it('every console path a web source reads is in the twin', async () => {
    const twin = await twinConsole();
    const missing = [...reads].filter(([path]) => at(twin, path) === undefined).map(([path, files]) => `${path} (${files.join(', ')})`);
    expect(missing).toEqual([]);
  });

  it('the twin holds nothing a web source does not read', async () => {
    const read = [...reads.keys()];
    const unread = leaves(await twinConsole()).filter((leaf) => !read.some((path) => leaf === path || leaf.startsWith(`${path}.`)));
    expect(unread).toEqual([]);
  });

  it('console.ts is not in the start bundle; the twin\'s console-app.ts is', () => {
    expect(reached('packages/i18n/src/messages/en/console.ts')).toBeUndefined();
    expect(graph.files.has('packages/i18n/src/messages/en/console-app.ts')).toBe(true);
  });
});
