// PWA post-build (roadmap web-pwa-offline §3): runs after `expo export
// --platform web`. 1) injects manifest / meta / shell CSS / service-worker
// registration into dist/index.html, 2) generates dist/sw.js with Workbox
// precaching every exported file so the app plays offline after one visit.
// Letter clips are precached; vocabulary / story / card / dialogue clips are
// runtime-cached instead (F-AUDIO-004 AD10), and the build fails if a clip
// that should be precached is missing from the manifest (§3.10).
// Grown-up paths (F-APP-001 §3.4, A-2): app.hangulroute.com also serves the grown-up
// console under GROWN_UP_PREFIXES (from A-3), so the worker never answers a grown-up
// navigation with the learner shell (denylist), sends it to the network only (with
// the precached grown-ups-offline.html when offline), and the build fails if a
// console file reaches the learner precache, by path (consoleLeaks) or by content
// (consolePages: an HTML page that loads /_next/ code, such as a Next 404.html).
// Lesson chunks (F-CURR-002 §10, CM-5): every chunk of the lesson manifest is its own precached
// web bundle carrying the manifest's hash, and none is in the start bundle; the precache report
// prints the start bundle, the chunks and the learner precache, and `--budget` (the release build,
// build:web) fails over their budget lines (pwa/lesson-chunks.mjs). Story chunks (CM-8): every story's body is
// its own chunk of scripts/build-stories.mjs, under the same checks and in the same report.
// app.json (adaptive icon) and public/manifest.webmanifest keep a copy of brand.primary: keep them equal to the token.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateSW, getManifest } from 'workbox-build';
import { AUDIO_PRECACHE_IGNORES, audioRuntimeCaching, precacheGaps, precacheLeaks } from './audio/lib.mjs';
import {
  GROWN_UPS_OFFLINE_FILE,
  assertLearnerPrecache,
  grownUpDenylist,
  grownUpGlobIgnores,
  grownUpNavigationRule,
  renderGrownUpsOffline,
} from './pwa/grown-ups.mjs';
import { assertPresenterFontPrecached, presenterFontFace } from './pwa/presenter-font.mjs';
import { WEB_JS_DIR, lessonChunkProblems, precacheBudgetProblems, precacheReport, reportLines } from './pwa/lesson-chunks.mjs';

const args = process.argv.slice(2);
const budget = args.includes('--budget');
const dist = args.find((a) => !a.startsWith('--')) ?? 'dist';

// The workspace's TypeScript sources are read at build time through
// scripts/ts-loader.mjs (precedent: scripts/i18n-status.mjs): the design tokens
// (packages/design-system) so the HTML shell and the offline page never carry their
// own palette, the grown-up prefixes and R-1 predicate (packages/content-schema) so
// the list exists once, and the offline page strings (packages/i18n, console.offline).
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
if (typeof nodeModule.register !== 'function') {
  throw new Error(`pwa-postbuild needs Node 20.6+ (module.register); this is ${process.version}`);
}
nodeModule.register(pathToFileURL(join(repo, 'scripts', 'ts-loader.mjs')));
const importSource = (path) => import(pathToFileURL(join(repo, path)).href);
const [tokens, appShell, i18n, lessonBuild, storyBuild] = await Promise.all([
  importSource('packages/design-system/src/tokens.ts'),
  importSource('packages/content-schema/src/schemas/app-shell.ts'),
  importSource('packages/i18n/src/index.ts'),
  importSource('scripts/build-lessons.mjs'),
  importSource('scripts/build-stories.mjs'),
]);
const { GROWN_UP_PREFIXES, isGrownUpPath } = appShell;
const canvas = tokens.colors.surface.canvas;
const brand = tokens.colors.brand.primary;
const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  throw new Error(`${indexPath} not found — run \`expo export --platform web\` first`);
}

const head = `
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="${brand}">
  <meta name="application-name" content="Hangul Route">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Hangul Route">
  <link rel="apple-touch-icon" href="/icon-1024.png">
  <meta name="description" content="Learn the Korean alphabet with Hoya the tiger — one heritage card at a time. Works offline.">
  <style>
    /* Shell rules for a learning app in a browser (wireframe pwa/system-banners):
       no pull-to-refresh mid-quest, no accidental text selection on tiles,
       and the trace canvas owns its touches. Pinch-zoom stays enabled. */
    html, body { overscroll-behavior: none; background: ${canvas}; }
    body { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
    input, textarea { -webkit-user-select: text; user-select: text; }
    #trace-canvas { touch-action: none; }
    /* Korean wraps at spaces, never inside a word ("호 / 야예요"), and a word longer than the line
       still breaks (F-I18N-001 PR 16): <html lang="ko"> in the Korean UI, lang="ko" on taught Korean. */
    :lang(ko) { word-break: keep-all; overflow-wrap: break-word; overflow-wrap: anywhere; }
    /* NEVER add a max-width / border rule on #root here (F-LAYOUT-001 LD3): the content width
       is capped inside Screen (design-system layout.maxWidth) so backgrounds, the tab bar,
       banners and the lecture presenter use the whole window. */${presenterFontFace(tokens.presenter.font)}
  </style>`;

const sw = `
  <script>
    (function () {
      // Chromium fires this once, early; stash it so the in-app install
      // guide (F-PWA-001) can call prompt() later from a tap.
      window.__hrInstallPrompt = null;
      window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__hrInstallPrompt = e; window.dispatchEvent(new CustomEvent('hr:install-available')); });
      // Every open tab of the app answers the stale presenter's ping (AMENDMENTS-LECTURE-V2 4.5),
      // so its Reload never lets a new worker take over while another tab still runs this build.
      // A channel never hears its own messages: the presenter pings on this same object.
      try {
        window.__hrTabs = new BroadcastChannel('hr-tabs');
        window.__hrTabs.addEventListener('message', function (e) { if (e.data && e.data.type === 'hr-tab-ping') window.__hrTabs.postMessage({ type: 'hr-tab-here' }); });
      } catch (e) { window.__hrTabs = null; }
      if (!('serviceWorker' in navigator)) return;
      // Reload only when the app explicitly applied an update — never on the
      // first install, where clientsClaim also fires controllerchange and a
      // reload would wipe an onboarding in progress.
      var applying = false;
      window.__hrApplyUpdate = function () {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.waiting) { applying = true; reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
        });
      };
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (applying) { window.location.reload(); } });
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').then(function (reg) {
          if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }
          reg.addEventListener('updatefound', function () {
            var worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', function () {
              if (worker.state !== 'installed') return;
              // First install (no controller yet) = the app is now cached for offline play.
              window.dispatchEvent(new CustomEvent(navigator.serviceWorker.controller ? 'hr:update-ready' : 'hr:offline-ready'));
            });
          });
        }).catch(function () {});
      });
    })();
  </script>`;

let html = readFileSync(indexPath, 'utf8');
// Expo's shell sets a fixed viewport; keep it but allow the safe-area env() vars.
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
html = html.replace('</head>', `${head}\n${sw}\n</head>`);
writeFileSync(indexPath, html);

// The offline page of grown-up paths (wireframe shell/offline): every shipped UI
// locale's console.offline strings, the default locale first; written before the
// glob below so it is precached.
const offlineLocales = [i18n.DEFAULT_LOCALE, ...i18n.availableLocales(false).filter((l) => l !== i18n.DEFAULT_LOCALE)].map(
  (locale) => ({ locale, lang: i18n.LOCALE_META[locale].htmlLang, strings: i18n.getMessages(locale).console.offline }),
);
writeFileSync(join(dist, GROWN_UPS_OFFLINE_FILE), renderGrownUpsOffline({ locales: offlineLocales, tokens }));

const precache = {
  globDirectory: dist,
  globPatterns: ['**/*.{js,html,ico,png,json,webmanifest,svg,mp3,woff2}'],
  // Workbox's default ignore, the clip groups served by the runtime rule below, and
  // every console file (grown-up paths and _next/): never in the learner's offline bundle.
  globIgnores: ['**/node_modules/**/*', ...AUDIO_PRECACHE_IGNORES, ...grownUpGlobIgnores(GROWN_UP_PREFIXES)],
  // 8 MiB (was 6 MiB): with the F-CURR-001 lesson cells the app bundle is about 6.6 MB, and a file over this
  // limit is silently left out of the precache, so the app would not start offline. The bundle is downloaded
  // anyway; the limit only decides whether it is kept for offline use.
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
};

const { count, size, warnings } = await generateSW({
  ...precache,
  swDest: join(dist, 'sw.js'),
  navigateFallback: '/index.html',
  // A grown-up navigation never receives the learner shell; /present and /browse keep it.
  navigateFallbackDenylist: grownUpDenylist(GROWN_UP_PREFIXES),
  clientsClaim: true,
  skipWaiting: false, // the app decides when to apply an update (never mid-quest)
  cleanupOutdatedCaches: true,
  runtimeCaching: [audioRuntimeCaching(), grownUpNavigationRule(GROWN_UP_PREFIXES)],
});
for (const w of warnings) process.stdout.write(`workbox: ${w}\n`);

// Every built clip outside the runtime groups must be in the precache, or it
// would not play offline. Workbox's glob skips dot folders, so list dist ourselves.
function builtMp3s(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.mp3')) out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out;
}
const { manifestEntries } = await getManifest(precache);
const manifestUrls = manifestEntries.map((e) => e.url);
const clips = builtMp3s(dist);
const gaps = precacheGaps(clips, manifestUrls);
const leaks = precacheLeaks(manifestUrls);
if (gaps.length > 0) throw new Error(`pwa-postbuild: clips missing from the precache: ${gaps.join(', ')}`);
if (leaks.length > 0) throw new Error(`pwa-postbuild: runtime-cached clips found in the precache: ${leaks.join(', ')}`);
// No console file by path or by content (a Next 404.html), and the offline page present.
assertLearnerPrecache(manifestUrls, isGrownUpPath, (url) => readFileSync(join(dist, url), 'utf8'));
// The lecture presenter's Hangul font works offline (F-TCH-004 §3.6, §3.8).
assertPresenterFontPrecached(manifestUrls);
// The app's own JS bundle works offline: Workbox only warns when a file is over the size limit.
const jsDir = join(dist, '_expo', 'static', 'js', 'web');
const unprecachedJs = existsSync(jsDir)
  ? readdirSync(jsDir).filter((f) => f.endsWith('.js')).map((f) => `_expo/static/js/web/${f}`).filter((url) => !manifestUrls.includes(url))
  : [];
if (unprecachedJs.length > 0) throw new Error(`pwa-postbuild: app bundles missing from the precache (over maximumFileSizeToCacheInBytes?): ${unprecachedJs.join(', ')}`);

// The lesson and story chunks (F-CURR-002 §10): the manifests the app was built from, read from content/ as
// build-lessons.mjs and build-stories.mjs read it (an e2e fixture build adds inline fixtures, never chunks).
const lessonManifest = lessonBuild.chunkManifest(lessonBuild.readCells(repo));
const storyManifest = storyBuild.readChunkManifest(repo);
const bundles = existsSync(jsDir)
  ? readdirSync(jsDir).filter((f) => f.endsWith('.js')).map((f) => ({ url: `${WEB_JS_DIR}/${f}`, text: readFileSync(join(jsDir, f), 'utf8') }))
  : [];
const chunkProblems = lessonChunkProblems({ manifest: [...lessonManifest, ...storyManifest], bundles, precached: manifestUrls });
if (chunkProblems.length > 0) throw new Error(`pwa-postbuild: lesson and story chunks:\n  ${chunkProblems.join('\n  ')}`);
const report = precacheReport({ manifest: lessonManifest, stories: storyManifest, bundles, precache: { count, size } });
for (const line of reportLines(report)) process.stdout.write(`${line}\n`);
if (budget) {
  const over = precacheBudgetProblems(report);
  if (over.length > 0) throw new Error(`pwa-postbuild: over budget:\n  ${over.join('\n  ')}`);
}

process.stdout.write(`pwa-postbuild: precached ${count} files (${(size / 1024 / 1024).toFixed(2)} MB), ${clips.length} audio clips built\n`);
