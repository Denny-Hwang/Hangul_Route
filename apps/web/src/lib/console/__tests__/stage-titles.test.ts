import { readFileSync } from 'node:fs';
import { StageKeySchema } from '@hangul-route/content-schema';
import { LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { STAGE_TITLES, stageTitleIn } from '../stage-titles';

/**
 * The seven stage titles the grown-up Learning Route names ("Stage 2 · Words"). They are content
 * (F-I18N-001 section 3.6), kept by the learner app in `apps/mobile/src/content/stages.ts`; the
 * console bundle has no copy of that file, so this test keeps the two in step: a renamed stage
 * fails here before a parent and a child read different names.
 *
 * AMENDMENTS-GROWNUP-UX section 10.3 (GX-9, GX-OD-7): in es and ko the console shows the learner app's own
 * overlay titles (`content/i18n/{es,ko}/stages.json`), so a Korean or Spanish grown-up no longer reads an English
 * title inside their own line. English stays the shipped list. No dictionary key.
 */
const MOBILE_STAGES = new URL('../../../../../mobile/src/content/stages.ts', import.meta.url);

describe('stage titles (Learning Route LR-8)', () => {
  it('names all seven stages and nothing else', () => {
    expect(Object.keys(STAGE_TITLES)).toEqual([...StageKeySchema.options]);
    for (const stage of StageKeySchema.options) expect(STAGE_TITLES[stage].trim().length).toBeGreaterThan(0);
  });

  it("matches the learner app's own stage titles, key by key", () => {
    const source = readFileSync(MOBILE_STAGES, 'utf8');
    const pairs = [...source.matchAll(/key:\s*'(stage\d)',[\s\S]*?titleEn:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
    expect(pairs).toHaveLength(7);
    expect(Object.fromEntries(pairs)).toEqual(STAGE_TITLES);
  });
});

describe('stage titles in the viewer locale (GX-9, AMENDMENTS-GROWNUP-UX section 10.3)', () => {
  it('English is the shipped list, unchanged', () => {
    for (const stage of StageKeySchema.options) expect(stageTitleIn('en')(stage)).toBe(STAGE_TITLES[stage]);
  });

  it('every locale names all seven stages', () => {
    for (const locale of LOCALES) {
      for (const stage of StageKeySchema.options) expect(stageTitleIn(locale)(stage).trim().length, `${locale} ${stage}`).toBeGreaterThan(0);
    }
  });

  // A parent's console and the child's app name a stage the same way: the learner app reads its es / ko titles from the
  // content overlay (`localizeStage`, `content/i18n/{locale}/stages.json`), and so does the console, key by key.
  it.each(['es', 'ko'] as const)("%s titles equal the learner app's overlay titles", (locale) => {
    const overlay = JSON.parse(readFileSync(new URL(`../../../../../../content/i18n/${locale}/stages.json`, import.meta.url), 'utf8')) as {
      entries: Record<string, { title?: string }>;
    };
    for (const stage of StageKeySchema.options) {
      const title = overlay.entries[`stage:${stage}`]?.title;
      expect(title, `${locale} ${stage} has an overlay title`).toBeTruthy();
      expect(stageTitleIn(locale)(stage), `${locale} ${stage}`).toBe(title);
    }
  });

  it('Korean titles carry no Latin letters (no English title left inside a Korean line)', () => {
    for (const stage of StageKeySchema.options) expect(stageTitleIn('ko')(stage)).not.toMatch(/[A-Za-z]/);
  });
});
