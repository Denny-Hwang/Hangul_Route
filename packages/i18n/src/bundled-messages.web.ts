import type { DeepPartial, Messages } from './types';

/**
 * The learner PWA's twin of `bundled-messages.ts` (Metro's web build picks `.web.ts`; the site's Next build,
 * Node, Vite and the native app never do): no es / ko overlay in the start bundle. The app loads the active
 * locale's overlay as a precached chunk and hands it to `registerMessageOverlay` before that locale applies
 * (`apps/mobile/src/content/locale-packs.ts`, F-CURR-002 §10), so until then `getMessages('es')` is English.
 */
export const BUNDLED_MESSAGE_OVERLAYS: Readonly<Partial<Record<'es' | 'ko', DeepPartial<Messages>>>> = {};
