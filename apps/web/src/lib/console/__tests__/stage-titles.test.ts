import { readFileSync } from 'node:fs';
import { StageKeySchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { STAGE_TITLES, stageTitle } from '../stage-titles';

/**
 * The seven stage titles the grown-up Learning Route names ("Stage 2 · Words"). They are content
 * (F-I18N-001 section 3.6), kept by the learner app in `apps/mobile/src/content/stages.ts`; the
 * console bundle has no copy of that file, so this test keeps the two in step: a renamed stage
 * fails here before a parent and a child read different names.
 */
const MOBILE_STAGES = new URL('../../../../../mobile/src/content/stages.ts', import.meta.url);

describe('stage titles (Learning Route LR-8)', () => {
  it('names all seven stages and nothing else', () => {
    expect(Object.keys(STAGE_TITLES)).toEqual([...StageKeySchema.options]);
    for (const stage of StageKeySchema.options) expect(stageTitle(stage).trim().length).toBeGreaterThan(0);
  });

  it("matches the learner app's own stage titles, key by key", () => {
    const source = readFileSync(MOBILE_STAGES, 'utf8');
    const pairs = [...source.matchAll(/key:\s*'(stage\d)',[\s\S]*?titleEn:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
    expect(pairs).toHaveLength(7);
    expect(Object.fromEntries(pairs)).toEqual(STAGE_TITLES);
  });
});
