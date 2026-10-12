import type { StageKey } from '@hangul-route/content-schema';

/**
 * The seven stage titles, which are content (F-I18N-001 section 3.6: like a quest title, a stage
 * title is not a dictionary string). The learner app keeps them in `apps/mobile/src/content/stages.ts`
 * (`titleEn`); the console bundle has no copy of that file, so the grown-up Learning Route
 * (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.1, LR-8) reads them here, and `stage-titles.test.ts`
 * fails when the two lists drift apart.
 */
export const STAGE_TITLES: Readonly<Record<StageKey, string>> = {
  stage1: 'Hangul',
  stage2: 'Words',
  stage3: 'Sentences',
  stage4: 'Dialogue',
  stage5: 'Stories',
  stage6: 'Real-use',
  stage7: 'Self-expression',
};

export const stageTitle = (stage: StageKey): string => STAGE_TITLES[stage];
