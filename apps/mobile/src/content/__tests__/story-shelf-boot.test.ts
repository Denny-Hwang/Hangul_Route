import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The story shelf before the app (F-CURR-002 §10, row CM-8b). On the web the shelf is a chunk that `index.ts` loads
 * before the app's modules run: `content/stories.ts` reads it when it first runs, and on the web reading it before
 * it is in throws. So nothing `index.ts` imports statically, however indirectly, may reach the modules that read the
 * stories; the app's roots are reached through a `require()` inside the function the shelf gate calls. This walks
 * the web build's static imports (a `.web.ts` twin wins, as in Metro's web build; type imports, `import()` and
 * `require()` are not followed: they run later or never).
 */
const APP = join(__dirname, '..', '..', '..');
const SRC = join(APP, 'src');

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function resolveWeb(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.web.tsx`, `${base}.web.ts`, `${base}.tsx`, `${base}.ts`, join(base, 'index.web.ts'), join(base, 'index.ts'), join(base, 'index.tsx'), base]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every app module the web start runs before the shelf gate's callback, with the chain that reaches it. */
export function webStartGraph(entry: string): Map<string, string[]> {
  const chains = new Map<string, string[]>();
  const queue: [string, string[]][] = [[entry, [entry]]];
  while (queue.length > 0) {
    const [file, chain] = queue.shift() as [string, string[]];
    if (chains.has(file)) continue;
    chains.set(file, chain);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const specifier = match[1] as string;
      if (!specifier.startsWith('.')) continue;
      const target = resolveWeb(file, specifier);
      if (target !== null) queue.push([target, [...chain, target]]);
    }
  }
  return chains;
}

const rel = (file: string): string => relative(APP, file).split('\\').join('/');

describe('the web start runs nothing that reads the stories before the shelf is in (row CM-8b)', () => {
  const graph = webStartGraph(join(APP, 'index.ts'));

  it('index.ts reaches the boot step, the shelf gate and the web shelf reader, but not the stories, the story cards or any root', () => {
    const files = [...graph.keys()].map(rel);
    // The boot step still runs at start, before anything mounts (F-APP-001 sections 3.4 and 3.9).
    expect(files).toContain('src/platform/app-root.web.ts');
    expect(files).toContain('src/screens/story-shelf-gate.tsx');
    expect(files).toContain('src/content/story-shelf.web.ts');
    const readers = ['src/content/stories.ts', 'src/content/story-cards.ts', 'src/content/episodes.ts', 'src/content/quests.ts', 'src/screens/app-roots.tsx', 'App.tsx'];
    const hits = [...graph].filter(([file]) => readers.includes(rel(file))).map(([, chain]) => chain.map(rel).join(' -> '));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('the roots are reached only through the require() the gate calls, and they do read the stories', () => {
    const index = readFileSync(join(APP, 'index.ts'), 'utf8');
    expect(index).toMatch(/withStoryShelf\(\(\) => \(require\('\.\/src\/screens\/app-roots'\)/);
    expect(index).not.toMatch(/^import .*(App|app-roots|lesson-content)['"]/m);
    const roots = [...webStartGraph(join(SRC, 'screens', 'app-roots.tsx')).keys()].map(rel);
    expect(roots).toContain('src/content/stories.ts');
    expect(roots).toContain('App.tsx');
  });

  it('the walk follows static imports only: type imports, import() and require() are left alone', () => {
    const gate = [...webStartGraph(join(SRC, 'screens', 'story-shelf-gate.tsx')).keys()].map(rel);
    // story-shelf.web.ts imports the chunk store's types only, and the index reaches the shelf through import().
    expect(gate).toContain('src/content/__generated__/stories-index.ts');
    expect(gate).not.toContain('src/content/__generated__/stories-shelf.ts');
    expect(gate).not.toContain('src/logic/story/story-chunk-store.ts');
  });
});
