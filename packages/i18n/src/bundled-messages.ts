import { es } from './messages/es/index';
import { ko } from './messages/ko';
import type { DeepPartial, Messages } from './types';

/**
 * The es / ko message overlays a build carries from the start (`resolve.ts` reads them). Every consumer
 * but one takes both here: the site, the Worker, the scripts, every test and the native app.
 *
 * The one exception is the learner PWA (Metro's web build, `apps/mobile`): Metro resolves this import to
 * `bundled-messages.web.ts`, which carries none, and the app loads the active locale's overlay as a
 * precached chunk of its own (`registerMessageOverlay`; `apps/mobile/src/content/locale-packs.ts`,
 * F-CURR-002 §10), so a learner who reads English does not download every Spanish and Korean string
 * before the first screen.
 */
export const BUNDLED_MESSAGE_OVERLAYS: Readonly<Partial<Record<'es' | 'ko', DeepPartial<Messages>>>> = { es, ko };
