import { UiLocaleSchema, type UiLocale } from '@hangul-route/content-schema';
import { availableLocales } from '@hangul-route/i18n';

/**
 * Web variant of `locale.ts` (Metro picks `.web.ts`, precedent `storage.web.ts`):
 * `navigator.languages`, the `?lang=` hand-off from the landing page, and
 * `<html lang>` (F-I18N-001 §3.3, §3.4). Every function is total.
 */

interface NavigatorLike {
  languages?: readonly string[];
  language?: string;
}

export function deviceLanguages(
  nav: NavigatorLike | null | undefined = (globalThis as { navigator?: NavigatorLike }).navigator,
): readonly string[] {
  try {
    if (!nav) return [];
    if (nav.languages && nav.languages.length > 0) return [...nav.languages];
    return nav.language ? [nav.language] : [];
  } catch {
    return [];
  }
}

interface HandoffDeps {
  location: { pathname: string; search: string; hash: string } | null;
  history: { replaceState: (state: unknown, unused: string, url: string) => void; state: unknown } | null;
  available: readonly UiLocale[];
}

function browserDeps(): HandoffDeps {
  const w = globalThis as { location?: HandoffDeps['location']; history?: HandoffDeps['history'] };
  return { location: w.location ?? null, history: w.history ?? null, available: availableLocales() };
}

/**
 * The landing's "Play now" link may carry `?lang=<locale>`. Returns that locale
 * when it is available (the caller decides whether it may become the device
 * choice — it never overrides a stored one) and removes the parameter from the
 * address bar either way, keeping other parameters and the hash.
 */
export function takeLangHandoff(deps: HandoffDeps = browserDeps()): UiLocale | null {
  const { location, history, available } = deps;
  if (!location) return null;
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has('lang')) return null;
    const parsed = UiLocaleSchema.safeParse(params.get('lang'));
    params.delete('lang');
    const query = params.toString();
    try {
      history?.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    } catch {
      // A history that refuses (sandboxed frame) must not lose the hand-off.
    }
    return parsed.success && available.includes(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function setDocumentLang(
  htmlLang: string,
  doc: { documentElement: { lang: string } } | null | undefined = (globalThis as { document?: { documentElement: { lang: string } } }).document,
): void {
  try {
    if (doc) doc.documentElement.lang = htmlLang;
  } catch {
    // Cosmetic; never block rendering.
  }
}
