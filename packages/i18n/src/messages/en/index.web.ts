import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleApp } from './console-app';
import { learner } from './learner';
import { report } from './report';
import type { en as English } from './index';

/**
 * The learner PWA's English (AMENDMENTS-FINISH-2026-11 FN-7, finding F4): `index.ts` without the public site's
 * `landing` namespace (about 35 KB), which no screen of the app reads (a test of apps/mobile holds that). Only Metro's web
 * build picks this `.web` twin, for the learner app, All lessons and the presenter; the site and the grown-up pages (Next,
 * which does not read `.web`), Node, Vite and the native app read `index.ts` with `landing`. `landing` is an empty
 * object here, so a merged locale (`getMessages('es')`, which walks the English keys) carries none of it either.
 * `console` is `console-app.ts` (AMENDMENTS-START-BUNDLE-2026-11 SB-1): only the six subtrees a web source of the app
 * reads (the transfer consent, Remove, the level-check line, the grown-up home rows), same paths and values as
 * `console.ts`, which the web build then never bundles (about 75 KB); the rest of `console` is read by `.native` screens.
 */
export const en = { common, a11y, learner, caregiver, console: consoleApp, landing: {}, report } as unknown as typeof English;
