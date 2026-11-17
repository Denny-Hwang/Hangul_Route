// AMENDMENTS-FOLLOWUPS-2026-11 FU-4: the chunks every learner waits for before the first screen, preloaded by the HTML
// shell. The start bundle asks for the story shelf (`stories-shelf`, row CM-8b) as soon as it runs, and App asks for the
// English lesson headers (`lessons-headers-en`, row CM-40, read in every locale) once the device's data is read; before
// this, both requests began only after the 1.3 MB start bundle had downloaded and run, so a phone on a slow link waited
// one more round trip (about 0.7 s on a fast-3G-like link, docs/launch/performance-review-2026-11.md) before the first
// screen. A `<link rel="preload" as="script">` lets the browser fetch them beside the start bundle; Metro's loader then
// adds its script tag for the same URL (same origin, no crossorigin attribute) and the browser uses the preloaded
// response. A worker in control answers both from the precache, as before.
import { WEB_JS_DIR } from './lesson-chunks.mjs';

/** The chunk names the first screen waits for in every locale, in the order they are asked for. */
export const START_PRELOAD_CHUNKS = Object.freeze(['stories-shelf', 'lessons-headers-en']);

/**
 * The URL of each chunk in `names`, from the export's bundle paths (relative to dist). Throws unless each name has
 * exactly one `<name>-<md5>.js` bundle, so a renamed or split chunk fails the build instead of preloading nothing.
 * @param {readonly string[]} bundleUrls e.g. `_expo/static/js/web/stories-shelf-<md5>.js`
 * @param {readonly string[]} [names]
 * @returns {string[]} absolute URL paths, as Metro's loader asks for them
 */
export function startPreloadUrls(bundleUrls, names = START_PRELOAD_CHUNKS) {
  return names.map((name) => {
    const pattern = new RegExp(`^${WEB_JS_DIR.replace(/[/.]/g, '\\$&')}/${name}-[0-9a-f]{32}\\.js$`);
    const found = bundleUrls.filter((url) => pattern.test(url));
    if (found.length !== 1) {
      throw new Error(`pwa-postbuild: expected one ${name} bundle to preload, found ${found.length}${found.length > 0 ? `: ${found.join(', ')}` : ''}`);
    }
    return `/${found[0]}`;
  });
}

/**
 * The HTML shell with one preload link per URL, at the end of `<head>`. Throws when the page has no `</head>`.
 * @param {string} html
 * @param {readonly string[]} urls
 */
export function withStartPreloads(html, urls) {
  if (!html.includes('</head>')) throw new Error('pwa-postbuild: index.html has no </head> to add the start preloads to');
  const links = urls.map((url) => `  <link rel="preload" as="script" href="${url}">`).join('\n');
  return html.replace('</head>', `${links}\n</head>`);
}
