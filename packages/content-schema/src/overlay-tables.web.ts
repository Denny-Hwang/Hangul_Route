/**
 * The learner PWA's twin of `overlay-tables.ts` (Metro's web build picks `.web.ts`; the site's Next build,
 * Node, Vite and the native app never do). The start bundle carries no es / ko content text: `OVERLAYS`
 * starts empty and the app fills it with the active locale's table, a precached chunk of its own
 * (`@hangul-route/content-schema/overlays-<locale>`), before that locale applies
 * (`apps/mobile/src/content/locale-packs.ts`, F-CURR-002 §10). Every reader passes `OVERLAYS` to
 * `localize` at the time of the call, so it reads what is in by then.
 */
import type { OverlayLocale, Overlays } from './schemas/locale-overlay';

export const OVERLAYS: Overlays = { es: {}, ko: {} };

/** Lays one locale's table into `OVERLAYS`, once its chunk is in. */
export function installContentOverlay(locale: OverlayLocale, table: Overlays[OverlayLocale]): void {
  Object.assign(OVERLAYS[locale], table);
}
