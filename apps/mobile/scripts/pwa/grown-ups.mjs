// Grown-up paths and the learner service worker (F-APP-001 section 3.4, A-2).
//
// app.hangulroute.com serves the learner app and, from A-3 on, the grown-up console
// under the prefixes of GROWN_UP_PREFIXES. The learner worker must never answer a
// grown-up navigation with the learner shell, and must never keep a console file in
// the learner's offline bundle. Pure and dependency-free, like scripts/audio/lib.mjs:
// the prefix list and the R-1 predicate come in as arguments (pwa-postbuild.mjs reads
// GROWN_UP_PREFIXES and isGrownUpPath from packages/content-schema through
// scripts/ts-loader.mjs), so the list exists once. Unit-tested from
// scripts/__tests__/pwa-postbuild-shell.test.mjs.

/** The offline page of grown-up paths: a dist file, precached, served when a grown-up navigation has no network. */
export const GROWN_UPS_OFFLINE_FILE = 'grown-ups-offline.html';
export const GROWN_UPS_OFFLINE_URL = `/${GROWN_UPS_OFFLINE_FILE}`;

/** Next's asset folder of the console build (A-3 copies it into dist); never precached. */
export const CONSOLE_ASSET_DIR = '_next';

/**
 * A prefix is written into the generated sw.js as RegExp source, so it must be one
 * plain lower-case segment (`/teach`): nothing that could change the pattern.
 */
const PREFIX_SHAPE = /^\/[a-z][a-z0-9-]*$/;

/** R-1: a prefix matches when followed by end of path, `/`, `?` or `.` (`/teach.html` yes, `/teacher` no). */
const BOUNDARY = '(?:$|[/?.])';

function checkedPrefixes(prefixes) {
  if (!Array.isArray(prefixes) || prefixes.length === 0) {
    throw new Error('pwa-postbuild: the grown-up prefix list is empty');
  }
  for (const prefix of prefixes) {
    if (typeof prefix !== 'string' || !PREFIX_SHAPE.test(prefix)) {
      throw new Error(`pwa-postbuild: grown-up prefix "${String(prefix)}" must be one lower-case path segment such as /teach`);
    }
  }
  return prefixes;
}

/**
 * Workbox `navigateFallbackDenylist`: one RegExp per prefix. Workbox tests each one
 * against `pathname + search`, so a grown-up navigation never receives the learner
 * shell (`/index.html`). The learner roots (`/present`, `/browse`) are not prefixes
 * and keep the fallback.
 */
export function grownUpDenylist(prefixes) {
  return checkedPrefixes(prefixes).map((prefix) => new RegExp(`^${prefix}${BOUNDARY}`));
}

/** Every prefix in one RegExp (same boundaries as the denylist). */
export function grownUpPathPattern(prefixes) {
  return new RegExp(`^(?:${checkedPrefixes(prefixes).join('|')})${BOUNDARY}`);
}

/**
 * Workbox `runtimeCaching` rule for navigations to grown-up paths: straight to the
 * network, never cached, and the precached offline page when the network fails.
 *
 * Workbox writes `urlPattern.toString()` into sw.js, so a function that closed over
 * a variable would reach the worker without it. The prefix RegExp is therefore
 * written into the function's own source text as a literal. Only navigations match:
 * a console page's RSC payload or chunk fetch is left alone and goes to the network.
 */
export function grownUpNavigationRule(prefixes) {
  const literal = String(grownUpPathPattern(prefixes));
  // eslint-disable-next-line no-new-func
  const urlPattern = new Function(`return ({ request, url }) => request.mode === 'navigate' && ${literal}.test(url.pathname);`)();
  return {
    urlPattern,
    handler: 'NetworkOnly',
    options: { precacheFallback: { fallbackURL: GROWN_UPS_OFFLINE_URL } },
  };
}

/** Workbox `globIgnores` (relative to dist): every file under a grown-up path, and the console chunks. */
export function grownUpGlobIgnores(prefixes) {
  return [
    ...checkedPrefixes(prefixes).flatMap((prefix) => {
      const bare = prefix.slice(1);
      return [bare, `${bare}.*`, `${bare}/**`];
    }),
    `${CONSOLE_ASSET_DIR}/**`,
  ];
}

const toPosix = (p) => p.split('\\').join('/');

/**
 * Precache entries that belong to the console (a grown-up path or a `_next/` file):
 * the ignore globs missed them, and they would ship in the learner's offline bundle.
 * Same shape as `precacheLeaks` (scripts/audio/lib.mjs).
 *
 * @param {readonly string[]} manifestUrls the precache manifest's urls
 * @param {(pathname: string) => boolean} isGrownUpPath the R-1 predicate of packages/content-schema
 */
export function consoleLeaks(manifestUrls, isGrownUpPath) {
  return manifestUrls
    .filter((url) => {
      const path = `/${toPosix(url).replace(/^\/+/, '').split('?')[0]}`;
      return isGrownUpPath(path) || path.startsWith(`/${CONSOLE_ASSET_DIR}/`);
    })
    .sort();
}

// --- The offline page (wireframe design/wireframes/shell/offline.md) -----------------

const OFFLINE_KEYS = ['title', 'line', 'back', 'retry'];

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/** JSON that is safe inside a `<script>` block (no `</script>`, no `<!--`). */
const scriptJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

function checkedLocales(locales) {
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error('pwa-postbuild: the offline page needs at least one locale');
  }
  for (const { locale, lang, strings } of locales) {
    if (typeof locale !== 'string' || typeof lang !== 'string' || lang === '') {
      throw new Error(`pwa-postbuild: offline page locale "${String(locale)}" has no lang`);
    }
    for (const key of OFFLINE_KEYS) {
      if (typeof strings?.[key] !== 'string' || strings[key].trim() === '') {
        throw new Error(`pwa-postbuild: console.offline.${key} is missing in "${locale}"`);
      }
    }
  }
  return locales;
}

/**
 * `dist/grown-ups-offline.html`: self-contained (inline styles from the design tokens,
 * no file, font or URL from elsewhere). The first locale is drawn in the HTML, so the
 * page reads without script; the one inline script only swaps in another shipped
 * locale picked by `navigator.languages`.
 *
 * @param {{ locales: ReadonlyArray<{ locale: string, lang: string, strings: Record<string, string> }>, tokens: object }} input
 *   `tokens` is the module `@hangul-route/design-system/tokens`.
 */
export function renderGrownUpsOffline({ locales, tokens }) {
  const [first, ...rest] = checkedLocales(locales);
  const { colors, spacing, typography, radii, touchTarget, borderWidth, layout } = tokens;
  const s = first.strings;
  const pick = Object.fromEntries(
    [first, ...rest].map(({ locale, lang, strings }) => [
      locale,
      { lang, ...Object.fromEntries(OFFLINE_KEYS.map((key) => [key, strings[key]])) },
    ]),
  );
  const px = (n) => `${n}px`;

  return `<!doctype html>
<html lang="${escapeHtml(first.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${colors.brand.primary}">
<title>${escapeHtml(s.title)}</title>
<style>
  /* F-APP-001 section 3.12: grown-up pages need the internet; learning does not. Tokens only. */
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; background: ${colors.surface.canvas}; color: ${colors.text.primary}; }
  body {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${px(spacing.xl)} ${px(layout.gutter.compact)};
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: ${px(typography.size.body)};
    line-height: ${typography.leading.normal};
  }
  main {
    width: 100%;
    max-width: ${px(layout.maxWidth.reading)};
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${px(spacing.lg)};
    text-align: center;
  }
  svg { width: ${px(spacing.jumbo)}; height: ${px(spacing.jumbo)}; color: ${colors.border.shape}; }
  h1 {
    margin: 0;
    font-size: ${px(typography.size.title)};
    line-height: ${typography.leading.tight};
    font-weight: ${typography.weight.bold};
    overflow-wrap: anywhere;
  }
  p { margin: 0; color: ${colors.text.secondary}; overflow-wrap: anywhere; }
  .actions {
    width: 100%;
    max-width: ${px(layout.pane.master)};
    display: flex;
    flex-direction: column;
    gap: ${px(spacing.md)};
    margin-top: ${px(spacing.sm)};
  }
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: ${px(touchTarget.min)};
    padding: ${px(spacing.sm)} ${px(spacing.xl)};
    border: ${px(borderWidth.base)} solid ${colors.brand.primary};
    border-radius: ${px(radii.lg)};
    font-size: ${px(typography.size.bodyLg)};
    font-weight: ${typography.weight.semibold};
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  a.primary { background: ${colors.brand.primary}; color: ${colors.text.onPrimary}; }
  a.secondary { background: ${colors.surface.paper}; color: ${colors.brand.primary}; }
  a:focus-visible { outline: ${px(borderWidth.thick)} solid ${colors.border.focus}; outline-offset: ${px(borderWidth.base)}; }
</style>
</head>
<body>
<main>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${borderWidth.base}" stroke-linecap="round" aria-hidden="true" focusable="false">
    <path d="M3.51 10.51a12 12 0 0 1 16.98 0M6.34 13.34a8 8 0 0 1 11.32 0M9.17 16.17a4 4 0 0 1 5.66 0M12 19h.01"/>
    <path d="M4 4l16 16" stroke="${colors.surface.canvas}" stroke-width="${spacing.xs}"/>
    <path d="M4 4l16 16"/>
  </svg>
  <h1 data-k="title">${escapeHtml(s.title)}</h1>
  <p data-k="line">${escapeHtml(s.line)}</p>
  <div class="actions">
    <a class="primary" href="/" data-k="back">${escapeHtml(s.back)}</a>
    <a class="secondary" href="" data-k="retry">${escapeHtml(s.retry)}</a>
  </div>
</main>
<script>
(function () {
  var m = ${scriptJson(pick)};
  var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  for (var i = 0; i < langs.length; i++) {
    var t = m[String(langs[i]).toLowerCase().split('-')[0]];
    if (!t) continue;
    document.documentElement.lang = t.lang;
    document.title = t.title;
    var nodes = document.querySelectorAll('[data-k]');
    for (var j = 0; j < nodes.length; j++) nodes[j].textContent = t[nodes[j].getAttribute('data-k')];
    return;
  }
})();
</script>
</body>
</html>
`;
}
