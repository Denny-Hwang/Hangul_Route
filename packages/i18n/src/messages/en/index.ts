import { a11y } from './a11y';
import { common } from './common';

/**
 * English: the source locale and the type of the whole dictionary.
 * `learner`, `caregiver`, `console` and `landing` join as their surfaces migrate (F-I18N-001 PR 5+).
 */
export const en = { common, a11y } as const;
