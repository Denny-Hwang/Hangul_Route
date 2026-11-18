import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleMsgs } from './console';
import { learner } from './learner';
import { report } from './report';
import type { en as English } from './index';

/**
 * The learner PWA's English (AMENDMENTS-FINISH-2026-11 FN-7, finding F4): `index.ts` without the public site's
 * `landing` namespace (about 35 KB), which no screen of the app reads (a test of apps/mobile holds that). Only Metro's web
 * build picks this `.web` twin, for the learner app, All lessons and the presenter; the site and the grown-up pages (Next,
 * which does not read `.web`), Node, Vite and the native app read `index.ts` with `landing`. `landing` is an empty
 * object here, so a merged locale (`getMessages('es')`, which walks the English keys) carries none of it either.
 * `console` stays: the app's grown-up screens read parts of it (the transfer consent, Remove, the level-check line).
 */
export const en = { common, a11y, learner, caregiver, console: consoleMsgs, landing: {}, report } as unknown as typeof English;
