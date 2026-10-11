import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { learner } from './learner';

/**
 * English: the source locale and the type of the whole dictionary.
 * `learner` holds the first-run, settings and learner screens; `caregiver` starts with the gating reasons (PR 7a);
 * `console` and `landing` join as their surfaces migrate.
 */
export const en = { common, a11y, learner, caregiver } as const;
