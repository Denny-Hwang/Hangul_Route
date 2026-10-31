import { readFileSync } from 'node:fs';
import { StageKeySchema } from '@hangul-route/content-schema';
import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { STAGE_TITLES, stageTitleIn } from '../stage-titles';

/**
 * The seven stage titles the grown-up Learning Route names ("Stage 2 · Words"). They are content
 * (F-I18N-001 section 3.6), kept by the learner app in `apps/mobile/src/content/stages.ts`; the
 * console bundle has no copy of that file, so this test keeps the two in step: a renamed stage
 * fails here before a parent and a child read different names.
 *
 * AMENDMENTS-GROWNUP-UX section 10.3 (GX-9, GX-OD-7): the console reads them from
 * `console.stageTitles` in the viewer's locale, so a Korean or Spanish grown-up no longer reads
 * "4단계 · Dialogue". English stays the shipped list.
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
  it('English is the shipped list, unchanged, and is what the dictionary holds', () => {
    expect(getMessages('en').console.stageTitles).toEqual(STAGE_TITLES);
    for (const stage of StageKeySchema.options) expect(stageTitleIn('en')(stage)).toBe(STAGE_TITLES[stage]);
  });

  it('every locale names all seven stages', () => {
    for (const locale of LOCALES) {
      const titles = getMessages(locale).console.stageTitles;
      expect(Object.keys(titles), locale).toEqual([...StageKeySchema.options]);
      for (const stage of StageKeySchema.options) expect(stageTitleIn(locale)(stage).trim().length, `${locale} ${stage}`).toBeGreaterThan(0);
    }
  });

  it('Korean and Spanish carry the section 10.3 titles', () => {
    expect(getMessages('ko').console.stageTitles).toEqual({
      stage1: '한글',
      stage2: '낱말',
      stage3: '문장',
      stage4: '대화',
      stage5: '이야기',
      stage6: '실생활',
      stage7: '내 말로',
    });
    expect(getMessages('es').console.stageTitles).toEqual({
      stage1: 'Hangul',
      stage2: 'Palabras',
      stage3: 'Oraciones',
      stage4: 'Diálogo',
      stage5: 'Cuentos',
      stage6: 'Vida real',
      stage7: 'Con tus palabras',
    });
  });

  it('Korean titles carry no Latin letters (no English title left inside a Korean line)', () => {
    for (const stage of StageKeySchema.options) expect(stageTitleIn('ko')(stage)).not.toMatch(/[A-Za-z]/);
  });

  it('the Korean "now" line reads with every title, the particle never on the title', () => {
    const now = getMessages('ko').console.learningRoute.now;
    for (const stage of StageKeySchema.options) {
      const line = now('미나', 4, stageTitleIn('ko')(stage));
      expect(line).toBe(`미나의 현재 단계: 4단계 · ${stageTitleIn('ko')(stage)}`);
    }
  });
});
