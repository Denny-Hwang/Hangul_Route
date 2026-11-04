import type { StageKey } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { CATALOGUE_TITLES } from '@/data/catalogue-titles.generated';

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

/**
 * The stage title getter for one console locale, the `stageTitle` every console view model takes
 * (AMENDMENTS-GROWNUP-UX section 10.3, GX-9). The es and ko titles are the ones the learner app already
 * shows: the content overlays' `stage:stageN` title (`content/i18n/<locale>/stages.json`), kept in the
 * generated `CATALOGUE_TITLES` (`scripts/build-lecture-catalogue.mjs`), so a grown-up's console and a
 * child's app name a stage the same way ("Etapa 4 · Diálogo"). A locale with no overlay title falls back to
 * the English title. No dictionary key and no new translation.
 */
export const stageTitleIn =
  (locale: UiLocale) =>
  (stage: StageKey): string =>
    (locale === 'en' ? undefined : CATALOGUE_TITLES[locale]?.[`stage:${stage}`]) ?? STAGE_TITLES[stage];
