import type { StageKey } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * The seven stage titles. The learner app keeps them in `apps/mobile/src/content/stages.ts` (`titleEn`); the console
 * bundle has no copy of that file, so the grown-up Learning Route (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.1, LR-8)
 * reads them from the dictionary, and `stage-titles.test.ts` fails when the English list and the learner app's drift
 * apart.
 *
 * AMENDMENTS-GROWNUP-UX section 10.3 (GX-9, GX-OD-7): the titles live in `console.stageTitles`, so a Korean or Spanish
 * grown-up reads "4단계 · 대화" or "Etapa 4 · Diálogo", not an English title inside their own line. Every console view
 * takes `stageTitleIn(locale)` with the locale it renders in; there is no locale-blind getter left to pass by mistake.
 */
export const STAGE_TITLES: Readonly<Record<StageKey, string>> = getMessages('en').console.stageTitles;

/** The stage title getter for one console locale, the `stageTitle` every console view model takes. */
export const stageTitleIn =
  (locale: UiLocale) =>
  (stage: StageKey): string =>
    getMessages(locale).console.stageTitles[stage];
