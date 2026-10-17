import type { SpaceKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { personaHome, personaOfKind } from './personas';
import { ROUTES } from './routing';

/**
 * Where a console page's PageBack goes (AMENDMENTS-DISPLAY-NAV section 7.3, row DN-6): a link to the page above,
 * never `history.back()`, so a page opened in a new tab still goes somewhere. Pure, so every page shares one rule.
 */
export interface PageBackTarget {
  href: string;
  label: string;
}

/**
 * A space's own page goes back to its persona home, named by that home's nav label: "Back to Classes" for a class or
 * a school, "Back to Home" for a family. Before the roster names the kind, the page's prefix tells it (`/parent/space`
 * is a family's; `/teach/space` counts as a class).
 */
export function spacePageBack(kind: SpaceKind | undefined, words: Pick<Messages['console'], 'shell' | 'pageBack'>): PageBackTarget {
  const persona = personaOfKind(kind ?? 'class');
  return { href: personaHome(persona), label: words.pageBack.to(persona === 'parent' ? words.shell.nav.home : words.shell.nav.classes) };
}

/** A page of a space (plan, curriculum, settings, lecture, relink, transfers) goes back to the space, named by its own message. */
export function spaceSubPageBack(spaceId: string, kind: SpaceKind | undefined, label: string): PageBackTarget {
  return { href: ROUTES.space(spaceId, kind), label };
}
