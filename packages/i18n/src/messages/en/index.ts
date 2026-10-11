import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleMsgs } from './console';
import { learner } from './learner';

/**
 * English: the source locale and the type of the whole dictionary.
 * `learner` holds the learner screens (PRs 5-7a), `caregiver` the gating reasons (PR 7a) and the grown-up surfaces (PR 8a),
 * `console` the web console (PR 9: the former `COPY` plus the words its view models format); `landing` joins with its surface.
 */
export const en = { common, a11y, learner, caregiver, console: consoleMsgs } as const;
