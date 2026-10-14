import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as index from '../__generated__/lessons-index';
import { LESSON_STAGE_MODULES } from './helpers/lesson-stages';

/**
 * The lazy split of the lesson modules (F-CURR-001 §3.12, row C-2): the index is
 * imported at start and never pulls a stage module in; each stage is reached
 * through one literal `require` (Metro and Hermes resolve only literal strings),
 * never a template or computed path.
 */
const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const STAGES = [2, 3, 4, 6, 7] as const;

describe('the lesson modules are split per stage', () => {
  it('lessons-index.ts imports no lessons-stage module', () => {
    const source = read('../__generated__/lessons-index.ts');
    // No import, export-from or require names a stage module (comments may mention them).
    expect(source).not.toMatch(/(?:from|import|require)\s*\(?\s*['"][^'"]*lessons-stage/);
    expect(source).not.toMatch(/\brequire\(/);
    expect(Object.keys(index).sort()).toEqual(['LESSON_EPISODES', 'LESSON_INDEX_OVERLAYS', 'LESSON_QUESTS']);
  });

  it('lesson-modules.ts reaches each stage by exactly one literal require, and nothing else requires a stage', () => {
    const source = read('../lesson-modules.ts');
    for (const n of STAGES) {
      const literal = `require('./__generated__/lessons-stage${n}')`;
      expect(source.split(literal).length - 1, literal).toBe(1);
    }
    const requires = source.match(/\brequire\(([^)]*)\)/g) ?? [];
    expect(requires).toHaveLength(STAGES.length);
    for (const call of requires) expect(call).toMatch(/^require\('\.\/__generated__\/lessons-stage[2-467]'\)$/);
    expect(source).not.toMatch(/require\(`/);
    for (const file of ['../lessons.ts', '../episodes.ts', '../quests.ts', '../../logic/minigame-config.ts', '../../logic/content-locale.ts']) {
      expect(read(file), file).not.toMatch(/(?:from|import)\s*['"][^'"]*lessons-stage/);
    }
  });

  it('every stage module has the scopes and glosses the loader expects', () => {
    expect(Object.keys(LESSON_STAGE_MODULES).map(Number)).toEqual([...STAGES]);
    for (const mod of Object.values(LESSON_STAGE_MODULES)) {
      expect(Object.keys(mod).sort()).toEqual(['LESSON_SCOPES', 'LESSON_SCOPE_OVERLAYS']);
      expect(Object.keys(mod.LESSON_SCOPE_OVERLAYS).sort()).toEqual(['es', 'ko']);
    }
  });
});
