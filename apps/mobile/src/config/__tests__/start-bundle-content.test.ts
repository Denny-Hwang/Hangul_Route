import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, startGraph, staticSpecifiers } from '../../test-support/start-graph';

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
      // F-A11Y-001 row AF-4b: Realia Read is played from Stage 4 on, and its answer feedback left the start bundle's line.
      'apps/mobile/src/screens/minigames/realia-read-chunk.tsx': 'apps/mobile/src/screens/minigames/RealiaReadGame.tsx',
      // [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE row TC-1b: Discover's trace page (its canvas pulls the gesture handler and the stroke tables).
      'apps/mobile/src/screens/quest/discover-trace-chunk.tsx': 'apps/mobile/src/screens/quest/DiscoverTracePad.tsx',
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

  it('[SB] SB-4a: the romanization lint is not in it (the `romanization-lint` subpath); the converter and the reviewed values are', () => {
    for (const file of ['compare', 'extract', 'gaps', 'report', 'exception-notes', 'lint']) {
      expect(reached(`packages/content-schema/src/romanization/${file}.ts`), file).toBeUndefined();
    }
    for (const file of ['rr', 'reviewed', 'exceptions']) {
      expect(graph.files.has(`packages/content-schema/src/romanization/${file}.ts`), file).toBe(true);
    }
    // Metro does not read `exports`, so the subpath would not resolve on the web build: no app source imports it.
    const readers = webSources().filter((file) => /romanization-lint/.test(codeOf(file))).map((file) => relative(APP, file));
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

  it('[MP] MP-2a: the contrast round is a chunk of its own; its catalogue, runtime and compare row are not in the start bundle', () => {
    for (const file of [
      'apps/mobile/src/content/__generated__/contrast-sets.ts',
      'apps/mobile/src/logic/audio/contrast-sets.ts',
      'apps/mobile/src/logic/listen-pick-contrast.ts',
      'apps/mobile/src/screens/minigames/ContrastCompare.tsx',
      'apps/mobile/src/screens/minigames/contrast-chunk.tsx',
    ]) {
      expect(reached(file), file).toBeUndefined();
    }
    expect(graph.chunks.has('apps/mobile/src/screens/minigames/contrast-chunk.tsx')).toBe(true);
    // Its door is the start bundle's: Listen & Pick reaches the chunk through it and through nothing else.
    expect(graph.files.has('apps/mobile/src/screens/minigames/contrast-entry.ts')).toBe(true);
    expect(graph.files.has('apps/mobile/src/screens/minigames/ListenPickGame.tsx')).toBe(true);
  });

  it("[SB] SB-4b: Listen & Pick's contrast branches ride in the contrast kit; the board keeps its calls", () => {
    const board = codeOf(join(REPO, 'apps/mobile/src/screens/minigames/ListenPickGame.tsx'));
    // What the board wrote inline is gone: the mixed-scope draw, the compare player's gap loop, the kind line and its Hear it button.
    for (const gone of ['function mixedRounds', 'compareGapMs', 'contrast-kind-', 'contrast-hear-', 'compareItems(', 'contrastKindLine', 'memberGloss', 'contrastNote', 'contrastRoundPlayable', 'seededRandom']) {
      expect(board, gone).not.toContain(gone);
    }
    // The kit holds them, and the modules they live in are reached from the chunk only.
    const kit = codeOf(join(REPO, 'apps/mobile/src/screens/minigames/contrast-chunk.tsx'));
    for (const name of ['mixedRounds', 'playCompare', 'missLine', 'compareRow', 'optionNaming', 'laterUnplayable', 'laterContrast', 'OptionExtras']) {
      expect(kit, name).toContain(name);
    }
    expect(reached('apps/mobile/src/screens/minigames/ContrastOptionExtras.tsx')).toBeUndefined();
    expect(reached('apps/mobile/src/logic/listen-pick-contrast.ts')).toBeUndefined();
    // The start bundle keeps the flow's own contrast branches and the door; the compare chain's refs are the board's.
    expect(graph.files.has('apps/mobile/src/logic/listen-pick-flow.ts')).toBe(true);
    expect(board).toContain('compareRun');
  });

  it('[SB] SB-4c: the grown-up home reads the Starting spot row without the report page', () => {
    expect(reached('apps/mobile/src/logic/placement/report-page.ts')).toBeUndefined();
    expect(graph.files.has('apps/mobile/src/logic/placement/starting-spot.ts')).toBe(true);
    // Both readers of the row, the dashboard and the route row it draws, take it from its own module.
    for (const file of ['apps/mobile/src/screens/parent/ParentDashboardScreen.tsx', 'apps/mobile/src/screens/parent/LearningRouteRow.tsx']) {
      expect(graph.files.has(file), file).toBe(true);
      expect(codeOf(join(REPO, file)), file).not.toContain('placement/report-page');
    }
  });

  it('[SB] SB-4e: the lecture sources both grown-up roots share are a root chunk of their own, behind a start door', () => {
    const sources = [
      'apps/mobile/src/logic/lecture/content.ts',
      'apps/mobile/src/logic/lecture/sources/story.ts',
      'apps/mobile/src/logic/lecture/sources/vocab.ts',
      'apps/mobile/src/logic/lecture/lecture-sources-chunk.ts',
    ];
    for (const file of sources) expect(reached(file), file).toBeUndefined();
    expect(graph.chunks.has('apps/mobile/src/logic/lecture/lecture-sources-chunk.ts')).toBe(true);
    for (const file of sources) expect(graph.shared.has(file), file).toBe(false);
    // The door is the start bundle's, and `screens/app-roots.tsx` (the roots' loader) is what reaches it.
    expect(graph.files.has('apps/mobile/src/screens/lecture-sources-entry.ts')).toBe(true);
    expect(codeOf(join(APP, 'src', 'screens', 'app-roots.tsx'))).toContain('lectureSourcesDoor.load()');
    // D7: the grown-up Lecture card stays in the start bundle, with the next-lesson link it computes inside the tap that
    // opens the presenter tab (an await before it would let a pop-up blocker stop the tab). None of it waits on the door.
    for (const file of ['apps/mobile/src/screens/parent/LectureCard.tsx', 'apps/mobile/src/logic/lecture/shell.ts']) expect(graph.files.has(file), file).toBe(true);
    expect(codeOf(join(APP, 'src', 'screens', 'parent', 'LectureCard.tsx'))).not.toMatch(/lecture-sources|lectureSources/);
  });

  it('[SB] SB-4e: only the chunk imports the lecture sources; the roots read them through the door, at call time', () => {
    const rel = (file: string): string => relative(APP, file).split(sep).join('/');
    const modules = ['src/logic/lecture/content.ts', 'src/logic/lecture/sources/story.ts', 'src/logic/lecture/sources/vocab.ts'].map((f) => join(APP, f));
    const owners = new Set([...modules, join(APP, 'src/logic/lecture/lecture-sources-chunk.ts')]);
    // A static, non-type import of one of the three modules (resolved from the importing file) would pull it back in.
    const offenders = webSources()
      .filter((file) => !owners.has(file))
      .filter((file) => staticSpecifiers(readFileSync(file, 'utf8')).some((spec) => spec.startsWith('.') && modules.includes(`${resolve(dirname(file), spec)}.ts`)))
      .map(rel);
    expect(offenders).toEqual([]);
    // The readers of the door are the loader and the grown-up roots' own modules, never a start-bundle screen.
    const readers = webSources()
      .filter((file) => /lecture-sources-entry/.test(codeOf(file)))
      .map(rel)
      .sort();
    expect(readers).toEqual([
      'PresenterApp.tsx',
      'src/logic/lecture/quick-source.ts',
      'src/screens/app-roots.tsx',
      'src/screens/browse/BrowseItemScreen.tsx',
      'src/screens/presenter/overlays/BlankOverlay.tsx',
    ]);
    const inRoots = readers.filter((f) => f !== 'src/screens/app-roots.tsx');
    for (const file of inRoots) expect(reached(`apps/mobile/${file}`), file).toBeUndefined();
    // Nothing reads a lecture value at a module's top level: the chunk is not in when a root's module first runs.
    for (const file of inRoots) {
      const top = codeOf(join(APP, file))
        .split('\n')
        .filter((line) => /^(const|let|var)\b.*(useLectureSources|lectureSourcesNow|lectureSourcesDoor)/.test(line));
      expect(top, file).toEqual([]);
    }
  });

  it('[SB] SB-4d: the level check\'s plan parts are a chunk both doors wait for, and none of them is in the start bundle', () => {
    const chunk = 'apps/mobile/src/screens/placement/plan-parts-chunk.tsx';
    expect(graph.chunks.has(chunk)).toBe(true);
    expect(reached(chunk)).toBeUndefined();
    // The modules the level check and the reports shared (Expo hoisted them into the start bundle until now).
    for (const file of [
      'apps/mobile/src/logic/placement/plan-offer.ts',
      'apps/mobile/src/screens/placement/PlanParts.tsx',
      'apps/mobile/src/store/plan-offer-store.ts',
      'apps/mobile/src/screens/placement/use-placement-bank.ts',
      'apps/mobile/src/logic/placement/catalog.ts',
    ]) {
      expect(reached(file), file).toBeUndefined();
    }
    // The bank's loader keeps the literal `import()` of the bank chunk, so it stays in the start bundle (a chunk that holds
    // another chunk's literal is named by a hash that does not cover its content: the post-build rejects it).
    expect(graph.files.has('apps/mobile/src/content/placement-bank.ts')).toBe(true);
    expect(graph.chunks.has('apps/mobile/src/content/placement-bank-chunk.ts')).toBe(true);
    // No placement or report module is shared between two chunks any more (Expo would move it into the start bundle).
    expect([...graph.shared].filter((file) => /\/screens\/(placement|parent)\/|\/logic\/placement\/|plan-offer/.test(file))).toEqual([]);
    // The door is the start bundle's: it holds the literal import() and nothing else of the chunk.
    expect(graph.files.has('apps/mobile/src/screens/placement/plan-parts-entry.ts')).toBe(true);
    // Both doors wait for the parts with their own chunk, under one retry level (`withPlanParts`).
    for (const file of ['apps/mobile/src/screens/placement/placement-entry.tsx', 'apps/mobile/src/screens/parent/reports-entry.tsx']) {
      expect(graph.files.has(file), file).toBe(true);
      expect(codeOf(join(REPO, file)), file).toContain('withPlanParts(() => import(');
    }
    // Every importer of `usePlanParts` is inside `placement-chunk` or `reports-chunk`, never in the start bundle.
    const insideChunks = new Set([
      ...startGraph(join(APP, 'src', 'screens', 'placement', 'placement-chunk.tsx')).files.keys(),
      ...startGraph(join(APP, 'src', 'screens', 'parent', 'reports-chunk.tsx')).files.keys(),
    ]);
    const importers = webSources()
      .filter((file) => /\busePlanParts\b/.test(codeOf(file)) && !file.endsWith('plan-parts-entry.ts'))
      .map((file) => relative(REPO, file));
    expect(importers.length).toBeGreaterThan(0);
    for (const file of importers) {
      expect(insideChunks.has(file), file).toBe(true);
      expect(graph.files.has(file), file).toBe(false);
    }
  });

  it('console.ts is not in the start bundle; the twin\'s console-app.ts is', () => {
    expect(reached('packages/i18n/src/messages/en/console.ts')).toBeUndefined();
    expect(graph.files.has('packages/i18n/src/messages/en/console-app.ts')).toBe(true);
  });
});
