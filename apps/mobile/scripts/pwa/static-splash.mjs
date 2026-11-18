// AMENDMENTS-FINISH-2026-11 FN-2 (finding F7 of docs/launch/performance-review-2026-11.md): a static splash in the HTML
// shell. Before this, the page had the canvas colour and nothing else until the 1.3 MB gzip start bundle had downloaded
// and run (first paint at about 9.9 s on the speed review's mobile profile). The shell now paints the brand mark, the app
// name and one "Loading" line with the HTML itself (design/screens/static-splash/, wireframe pwa/static-splash):
// - no script is needed to paint it; a tiny inline script right after it only swaps the line into the language this
//   device chose before (the grown-up pages' synchronous mirror of the device record, UI_LOCALE_MIRROR_KEY), else the
//   browser's first shipped language, else English (the HTML's own text), and sets <html lang> to match;
// - every colour, size and duration is a design token, read from the tokens module at build time (no literal here);
// - the line breathes only under `prefers-reduced-motion: no-preference`;
// - the app removes it in the layout effect of its first commit (src/platform/static-splash.web.ts, all three roots:
//   the learner app, the presenter and All lessons share this index.html through the single-page fallback).

/** The element id the app removes (`STATIC_SPLASH_ID` in src/platform/static-splash.web.ts). */
export const STATIC_SPLASH_ID = 'hr-splash';

/** The breathing floor: the lowest opacity that keeps `text.secondary` on `surface.canvas` over 4.5:1 (4.7:1, mock S4). */
export const SPLASH_BREATHE_FLOOR = 0.8;

/** The root size the token px values are divided by, so a browser text size enlarges the splash (the site mock's rem). */
const ROOT_PX = 16;

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
/** JSON that is safe inside a `<script>` block (no `</script>`, no `<!--`). */
const scriptJson = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * The splash's style, markup and language script.
 * @param {{
 *   tokens: { colors: any, spacing: any, radii: any, typography: any, motion: any },
 *   brand: { name: string, mark: string },
 *   locales: readonly { locale: string, lang: string, loading: string }[],
 *   mirrorKey: string,
 * }} input `locales`: the shipped UI locales, the default (English) first: the HTML's own text.
 */
export function staticSplash({ tokens, brand, locales, mirrorKey }) {
  if (locales.length === 0) throw new Error('pwa-postbuild: the static splash needs at least one locale');
  for (const { locale, lang, loading } of locales) {
    if (!/^[a-z]{2,3}$/.test(locale) || !lang || typeof loading !== 'string' || loading.trim() === '') {
      throw new Error(`pwa-postbuild: the static splash has no Loading line for locale ${JSON.stringify(locale)}`);
    }
  }
  if (!brand?.name || !brand?.mark) throw new Error('pwa-postbuild: the static splash needs the brand name and mark');
  const { colors, spacing, radii, typography, motion } = tokens;
  const rem = (px) => `${px / ROOT_PX}rem`;
  const px = (n) => `${n}px`;
  const [first] = locales;
  const style = `
  <style id="${STATIC_SPLASH_ID}-style">
    /* FN-2 static splash (scripts/pwa/static-splash.mjs, design/screens/static-splash): tokens only. The app removes
       #${STATIC_SPLASH_ID} on its first frame. */
    #${STATIC_SPLASH_ID} {
      position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: ${px(spacing.lg)};
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      background: ${colors.surface.canvas}; color: ${colors.text.primary};
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: ${typography.leading.normal};
      text-align: center;
    }
    #${STATIC_SPLASH_ID} .hr-splash-mark {
      display: flex; align-items: center; justify-content: center; width: ${rem(spacing.jumbo)}; height: ${rem(spacing.jumbo)};
      border-radius: ${px(radii.circle)}; background: ${colors.brand.primary}; color: ${colors.text.inverse};
      font-size: ${rem(typography.size.prompt)}; font-weight: ${typography.weight.bold}; white-space: nowrap;
    }
    #${STATIC_SPLASH_ID} p { margin: 0; padding: 0 ${px(spacing.xl)}; overflow-wrap: anywhere; }
    #${STATIC_SPLASH_ID} .hr-splash-name { font-size: ${rem(typography.size.title)}; font-weight: ${typography.weight.bold}; }
    #${STATIC_SPLASH_ID} .hr-splash-line { font-size: ${rem(typography.size.body)}; color: ${colors.text.secondary}; }
    @media (prefers-reduced-motion: no-preference) {
      #${STATIC_SPLASH_ID} .hr-splash-line {
        animation: hr-splash-breathe ${motion.duration.celebration * 2}ms ${motion.easing.standard} infinite alternate;
      }
    }
    @keyframes hr-splash-breathe { from { opacity: 1; } to { opacity: ${SPLASH_BREATHE_FLOOR}; } }
  </style>`;
  const lines = Object.fromEntries(locales.map(({ locale, lang, loading }) => [locale, { lang, loading }]));
  // ES5 and wrapped in try: it runs on every browser the app supports, before the app, and must never stop the parser.
  const script = `<script>
      (function () {
        try {
          var m = ${scriptJson(lines)};
          var pick = null;
          try { var stored = window.localStorage.getItem(${scriptJson(`hr:${mirrorKey}`)}); if (stored && m[stored]) pick = stored; } catch (e) {}
          if (!pick) {
            var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
            for (var i = 0; i < langs.length && !pick; i++) {
              var primary = String(langs[i]).split(/[-_]/)[0].toLowerCase();
              if (m[primary]) pick = primary;
            }
          }
          if (!pick || pick === ${scriptJson(first.locale)}) return;
          document.getElementById(${scriptJson(`${STATIC_SPLASH_ID}-line`)}).textContent = m[pick].loading;
          document.documentElement.lang = m[pick].lang;
        } catch (e) {}
      })();
    </script>`;
  const markup = `<div id="${STATIC_SPLASH_ID}">
      <div class="hr-splash-mark" aria-hidden="true">${escapeHtml(brand.mark)}</div>
      <p class="hr-splash-name">${escapeHtml(brand.name)}</p>
      <p class="hr-splash-line" id="${STATIC_SPLASH_ID}-line">${escapeHtml(first.loading)}</p>
    </div>
    ${script}
    `;
  return { style, markup };
}

/**
 * The HTML shell with the splash: its style at the end of `<head>`, its markup and script right before the app's root
 * element (so it paints before the start bundle, which is a deferred script after the root). A page that has a splash
 * already (the post-build run again on the same export) is returned as it is. Throws when the page has no `</head>` or
 * no `<div id="root">`.
 * @param {string} html
 * @param {{ style: string, markup: string }} splash
 */
export function withStaticSplash(html, splash) {
  if (html.includes(`<div id="${STATIC_SPLASH_ID}">`)) return html;
  if (!html.includes('</head>')) throw new Error('pwa-postbuild: index.html has no </head> for the static splash');
  const root = /<div id="root"><\/div>/;
  if (!root.test(html)) throw new Error('pwa-postbuild: index.html has no <div id="root"></div> for the static splash');
  return html.replace('</head>', `${splash.style}\n</head>`).replace(root, (div) => `${splash.markup}${div}`);
}
