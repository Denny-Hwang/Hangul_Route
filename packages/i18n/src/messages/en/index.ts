import { a11y } from './a11y';
import { common } from './common';
import { learner } from './learner';

/**
 * English: the source locale and the type of the whole dictionary.
 * `learner` holds the first-run and settings screens (PR 5); `caregiver`, `console` and `landing` join as their surfaces migrate.
 */
export const en = { common, a11y, learner } as const;
