import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleMsgs } from './console';
import { landing } from './landing';
import { learner } from './learner';
import { report } from './report';

/**
 * English: the source locale and the type of the whole dictionary.
 * `learner` holds the learner screens (PRs 5-7b, plus the PWA banners and crash screen in 8b), `caregiver` the gating
 * reasons (PR 7a) and the grown-up surfaces (PRs 8a-8b), `console` the web console (PR 9: the former `COPY` plus the
 * words its view models format), `landing` the public site: metadata, landing, about, legal, launch-news form (PR 11a),
 * `report` the progress reports on the console and in the app (F-REPORT-001 RP-6).
 */
export const en = { common, a11y, learner, caregiver, console: consoleMsgs, landing, report } as const;
