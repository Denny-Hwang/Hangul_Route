import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { learner } from './learner';

/**
 * English: the source locale and the type of the whole dictionary.
 * `learner` holds the learner screens (PRs 5-7a), `caregiver` the gating reasons (PR 7a) and the grown-up surfaces (PR 8a);
 * `console` and `landing` join as their surfaces migrate.
 */
export const en = { common, a11y, learner, caregiver } as const;
