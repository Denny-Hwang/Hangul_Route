import type { DeepPartial, Messages } from './types';

/**
 * The browser twin of `bundled-messages.ts`: no es / ko overlay in the start bundle. Metro's web build of the
 * learner PWA picks it (`.web.ts`), and so does Next's client build of the grown-up pages (`apps/web`
 * `next.config.js`, AMENDMENTS-FINISH-2026-11 FN-6); Next's server build, Node, Vite and the native app never do.
 * The app loads the active locale's overlay as a chunk and hands it to `registerMessageOverlay` before that
 * locale applies (`apps/mobile/src/content/locale-packs.ts`, F-CURR-002 §10; `apps/web/src/lib/i18n/message-overlays.ts`),
 * so until then `getMessages('es')` is English.
 */
export const BUNDLED_MESSAGE_OVERLAYS: Readonly<Partial<Record<'es' | 'ko', DeepPartial<Messages>>>> = {};
