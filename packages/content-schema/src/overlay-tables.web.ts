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

/**
 * Lays one locale's table into `OVERLAYS`, once its chunk is in. An entity's fields merge with the ones already in: a story's scene text
 * arrives with its story chunk, its title and card text with the locale chunk, in either order (row CM-8b's overlay half).
 */
export function installContentOverlay(locale: OverlayLocale, table: Overlays[OverlayLocale]): void {
  const into = OVERLAYS[locale] as Record<string, Overlays[OverlayLocale][string]>;
  for (const [id, fields] of Object.entries(table)) into[id] = id in into ? { ...into[id], ...fields } : fields;
}
