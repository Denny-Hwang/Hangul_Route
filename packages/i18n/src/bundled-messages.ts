import { es } from './messages/es/index';
import { ko } from './messages/ko';
import type { DeepPartial, Messages } from './types';

/**
 * The es / ko message overlays a build carries from the start (`resolve.ts` reads them). Every consumer
 * but two takes both here: the site's static HTML (Next's server build), the Worker, the scripts, every
 * test and the native app.
 *
 * The exceptions read `bundled-messages.web.ts`, which carries none, and load the active locale's overlay
 * as a chunk of its own (`registerMessageOverlay`), so a reader of English does not download every Spanish
 * and Korean string before the first screen:
 * - the learner PWA (Metro's web build, `apps/mobile`): Metro picks the `.web.ts` twin, and the app loads a
 *   precached locale chunk (`apps/mobile/src/content/locale-packs.ts`, F-CURR-002 §10);
 * - the grown-up pages in the browser (Next's client build, `apps/web`): `next.config.js` points this import
 *   at the twin, and `apps/web/src/lib/i18n/message-overlays.ts` loads the language shown
 *   (AMENDMENTS-FINISH-2026-11 FN-6).
 */
export const BUNDLED_MESSAGE_OVERLAYS: Readonly<Partial<Record<'es' | 'ko', DeepPartial<Messages>>>> = { es, ko };
