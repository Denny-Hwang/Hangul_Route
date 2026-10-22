import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as index from '../__generated__/lessons-index';
import { LESSON_CELL_MODULES } from './helpers/lesson-stages';

/**
 * The lesson manifest and its chunks (F-CURR-002 §10, row CM-5): the start bundle imports only
 * the manifest; each cell's body and each locale's titles are reached through exactly one literal
 * `import()` there (Metro resolves only literals, and splits each into its own web bundle), and
 * nothing anywhere imports a chunk statically, which would pull it back into the start bundle.
 */
const SRC = new URL('../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const INDEX = 'content/__generated__/lessons-index.ts';

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'lesson-chunks') sources(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(relative(SRC, full).split('\\').join('/'));
  }
  return out;
}

describe('the lesson manifest and its chunks', () => {
  const manifest = read(INDEX);
  const cells = Object.keys(index.LESSON_CELL_CHUNKS);
  const name = (cellId: string): string => `lessons-cell-${cellId.replace(/^episode:/, '')}`;

  it('the manifest imports types only, and reaches each chunk by exactly one literal import()', () => {
    for (const line of manifest.split('\n').filter((l) => /^\s*import\s/.test(l))) expect(line, line).toMatch(/^import type /);
    expect(manifest).not.toMatch(/\brequire\(|import\(`|import\([^'")]/);
    const imports = manifest.match(/import\('[^']+'\)/g) ?? [];
    expect(imports.sort()).toEqual(
      [...cells.map((id) => `import('./lesson-chunks/${name(id)}')`), "import('./lesson-chunks/lessons-titles-es')", "import('./lesson-chunks/lessons-titles-ko')"].sort(),
    );
    expect(Object.keys(index).sort()).toEqual(['LESSON_CELL_CHUNKS', 'LESSON_EPISODES', 'LESSON_QUESTS', 'LESSON_TEACHES', 'LESSON_TITLE_CHUNKS', 'loadLessonCell', 'loadLessonTitles']);
  });

  it('no other app source names a chunk, so none can reach the start bundle', () => {
    const files = [...sources(SRC), ...['../App.tsx', '../BrowseApp.tsx', '../PresenterApp.tsx', '../index.ts']];
    // An import, export-from, import() or require of a chunk path (comments may name the folder).
    const naming = files.filter((f) => f !== INDEX && /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"][^'"]*lesson-chunks\//.test(read(f)));
    expect(naming).toEqual([]);
  });

  it('every cell of the manifest has a chunk carrying the manifest hash; the quests keep no steps in the manifest', async () => {
    expect(cells.sort()).toEqual(index.LESSON_EPISODES.map((e) => e.id).sort());
    for (const id of cells) {
      const mod = LESSON_CELL_MODULES[id];
      expect(mod?.CHUNK_HASH, id).toBe(index.LESSON_CELL_CHUNKS[id]);
      expect(Object.keys(mod ?? {}).sort()).toEqual(['CHUNK_HASH', 'LESSON_OVERLAYS', 'LESSON_SCOPES', 'LESSON_STEPS']);
      const episode = index.LESSON_EPISODES.find((e) => e.id === id);
      expect(Object.keys(mod?.LESSON_STEPS ?? {}).sort(), id).toEqual([...(episode?.questIds ?? [])].sort());
    }
    for (const quest of index.LESSON_QUESTS) expect(Object.keys(quest), quest.id).not.toContain('steps');
    expect(index.loadLessonCell('episode:stage1-letters')).toBeUndefined();
    for (const locale of ['es', 'ko'] as const) {
      const titles = await index.loadLessonTitles(locale);
      expect(titles.CHUNK_HASH).toBe(index.LESSON_TITLE_CHUNKS[locale]);
      // Titles only: every step and game gloss rides in its cell's chunk.
      for (const [id, entry] of Object.entries(titles.LESSON_TITLE_OVERLAYS)) {
        expect(id).toMatch(/^(episode|quest):/);
        for (const field of Object.keys(entry)) expect(field).not.toMatch(/^steps\./);
      }
    }
  });
});
