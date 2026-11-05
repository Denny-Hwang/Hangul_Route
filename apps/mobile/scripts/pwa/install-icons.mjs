// Install-only icons and the learner precache (row PWA-HEADROOM, perf(pwa)).
//
// `public/icon-1024.png` (about 363 KB, 3.4 % of the learner precache) is listed in the web manifest for the install
// dialog and the stores, which fetch it once, online, when the app is installed. No screen of the app draws it, and
// the add-to-home-screen icon of iOS is the 512 px file below (the system scales it to 180 px). It therefore does not
// need to be in the offline bundle: keeping it out frees that room in `PRECACHE_BUDGET.learnerPrecacheRaw`
// (pwa/lesson-chunks.mjs) for the lessons, which is what the ceiling is for. The ceiling itself does not move.
//
// What stays precached, so an installed app and a cold start with no network lose nothing: `icon-192.png` and
// `icon-512.png` (the two sizes Chrome's install criteria ask for, and the apple-touch icon), `favicon.ico` and the
// manifest itself. The guards below fail the build if an install-only icon reaches the precache, is drawn by a
// bundle, or if the icons the offline install needs are not precached.
// Pure, like grown-ups.mjs: pwa-postbuild.mjs feeds it the manifest, the shell HTML and the bundles.

/** The icon the touch-icon link points at: precached, so adding the app to the home screen works offline too. */
export const APPLE_TOUCH_ICON_FILE = 'icon-512.png';

/** Icon files only the install (the manifest) reads: never in the precache, never drawn by the app. Relative to dist. */
export const INSTALL_ONLY_ICONS = Object.freeze(['icon-1024.png']);

/** The sizes of the web manifest icons that must be precached (Chrome's install criteria; the largest is the touch icon). */
export const PRECACHED_ICON_SIZES = Object.freeze(['192x192', '512x512']);

const stripUrl = (url) => url.replace(/^\/+/, '').split('?')[0];

/** Workbox `globIgnores` (relative to dist): the install-only icons. */
export function installIconGlobIgnores() {
  return [...INSTALL_ONLY_ICONS];
}

/** The `href` of the shell's apple-touch-icon link, or null. */
export function appleTouchIconHref(html) {
  const link = /<link\b[^>]*\brel=["']apple-touch-icon["'][^>]*>/i.exec(html)?.[0];
  return link === undefined ? null : (/\bhref=["']([^"']+)["']/i.exec(link)?.[1] ?? null);
}

/**
 * Problems with the icons of one web build (empty = sound).
 * @param {object} input
 * @param {readonly string[]} input.manifestUrls the precache manifest's urls (relative to dist)
 * @param {string} input.html the shell, `index.html` as written by the post-build
 * @param {{ icons?: { src: string, sizes?: string }[] } | null} input.webManifest `manifest.webmanifest` parsed, or null when the export has none (a stand-in)
 * @param {{ url: string, text: string }[]} input.bundles every JS file of the web bundle folder
 * @param {(file: string) => boolean} input.exists whether a file (relative to dist) is in the export
 */
export function installIconProblems({ manifestUrls, html, webManifest, bundles, exists }) {
  const problems = [];
  const precached = new Set(manifestUrls.map(stripUrl));
  for (const file of INSTALL_ONLY_ICONS) {
    if (precached.has(file)) problems.push(`${file} is in the learner precache: it is read by the install only and belongs outside it (pwa/install-icons.mjs)`);
    for (const bundle of bundles) {
      if (bundle.text.includes(file)) problems.push(`${bundle.url} names ${file}, which is not precached: the app would not find it offline`);
    }
  }
  const touch = appleTouchIconHref(html);
  if (touch === null) problems.push('the shell has no apple-touch-icon link');
  else {
    const file = stripUrl(touch);
    if (INSTALL_ONLY_ICONS.includes(file)) problems.push(`the apple-touch-icon link points at ${file}, which is not precached: use ${APPLE_TOUCH_ICON_FILE}`);
    else if (exists(file) && !precached.has(file)) problems.push(`the apple-touch-icon file ${file} is missing from the precache`);
  }
  if (webManifest !== null) {
    const icons = Array.isArray(webManifest.icons) ? webManifest.icons : [];
    for (const icon of icons) {
      const file = stripUrl(String(icon.src));
      if (!exists(file)) problems.push(`manifest icon ${icon.src} is not in the export: the install would show no icon`);
      else if (!INSTALL_ONLY_ICONS.includes(file) && !precached.has(file)) problems.push(`manifest icon ${icon.src} is missing from the precache (only ${INSTALL_ONLY_ICONS.join(', ')} may be left out)`);
    }
    for (const sizes of PRECACHED_ICON_SIZES) {
      if (!icons.some((icon) => icon.sizes === sizes && precached.has(stripUrl(String(icon.src))))) {
        problems.push(`no precached ${sizes} manifest icon: Chrome's install criteria need the ${PRECACHED_ICON_SIZES.join(' and ')} icons offline too`);
      }
    }
    if (touch !== null && !icons.some((icon) => stripUrl(String(icon.src)) === stripUrl(touch))) {
      problems.push(`the apple-touch-icon ${touch} is not one of the manifest icons`);
    }
  }
  return problems;
}
