import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, startGraph } from '../../test-support/start-graph';

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-2: a release build carries no e2e code. The e2e hooks and screens reach the root
 * navigator only through the generated `content/__generated__/e2e-registry.ts`, which a plain run of
 * `scripts/build-stories.mjs` (the one this test tree was generated with) writes without an import; only the fixture
 * build (`--include-fixtures`) makes it import `navigation/e2e-entry.tsx`.
 */

const graph = startGraph();
const REGISTRY = 'apps/mobile/src/content/__generated__/e2e-registry.ts';
/** A module of the e2e side by its name: `story-e2e.tsx`, `hidden-heritage-e2e-screen.tsx`, `e2e-rounds.ts`, `e2e-entry.tsx`... */
const E2E_NAME = /(^|[-./])e2e([-.]|$)/;

describe('the release start bundle has no e2e code (AMENDMENTS-START-BUNDLE-2026-11 SB-2)', () => {
  it('reaches no e2e module, only the empty registry', () => {
    const e2e = [...graph.files.keys()].filter((file) => E2E_NAME.test(file.split('/').at(-1) ?? '') && file !== REGISTRY);
    expect(e2e).toEqual([]);
    expect(graph.files.has(REGISTRY)).toBe(true);
    expect(graph.files.has('apps/mobile/src/navigation/root.tsx')).toBe(true);
  });

  it('nor what only the e2e side shared with a chunk (Trace a Word\'s block strokes)', () => {
    expect(graph.files.get('apps/mobile/src/logic/trace-word/block-strokes.ts')?.join(' -> ')).toBeUndefined();
  });

  it('the plain registry is null and imports nothing at run time', () => {
    const source = readFileSync(join(REPO, REGISTRY), 'utf8');
    expect(source).toMatch(/export const E2E_ENTRY: E2eEntry \| null = null;/);
    const imports = [...source.matchAll(/^import\s+(type\s+)?/gm)];
    expect(imports.length).toBeGreaterThan(0);
    for (const m of imports) expect(m[1]).toBe('type ');
  });

  it('the root navigator reads the registry, never an e2e module or the run-time fixture switch', () => {
    const root = readFileSync(join(REPO, 'apps/mobile/src/navigation/root.tsx'), 'utf8');
    expect(root).toMatch(/from '\.\.\/content\/__generated__\/e2e-registry'/);
    expect(root).not.toMatch(/from '\.\/[a-z-]*e2e[a-z-]*'/);
    expect(root).not.toMatch(/STORY_FIXTURES_BUILD|ClozePickE2e/);
    // The Cloze Pick door keeps its game and fallback; its e2e hook and screen live on the e2e side.
    const door = readFileSync(join(REPO, 'apps/mobile/src/screens/minigames/cloze-pick-entry.tsx'), 'utf8');
    expect(door).not.toMatch(/ClozePickE2e/);
  });
});
