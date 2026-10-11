/**
 * Whether romanization is visible (D2): always in `always` mode, otherwise only
 * after the learner tapped to reveal it. F-I18N-001 owns the one
 * implementation (`packages/i18n/src/romanization.ts`); it has shipped, so the
 * interim copy F-STORY-003 §3.3 allowed for is not needed.
 */
export { romanizationShown, type RomanizationMode } from '@hangul-route/i18n';
