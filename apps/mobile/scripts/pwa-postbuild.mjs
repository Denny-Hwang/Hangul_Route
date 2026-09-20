// PWA post-build (roadmap web-pwa-offline §3): runs after `expo export
// --platform web`. 1) injects manifest / meta / shell CSS / service-worker
// registration into dist/index.html, 2) generates dist/sw.js with Workbox
// precaching every exported file so the app plays offline after one visit.
// Colors here mirror app.json splash/theme (native config, not UI tokens).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateSW } from 'workbox-build';

const dist = process.argv[2] ?? 'dist';
const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  throw new Error(`${indexPath} not found — run \`expo export --platform web\` first`);
}

const head = `
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#E8743B">
  <meta name="application-name" content="Hangul Route">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Hangul Route">
  <link rel="apple-touch-icon" href="/icon-1024.png">
  <meta name="description" content="Learn the Korean alphabet with Hoya the tiger — one heritage card at a time. Works offline.">
  <style>
    /* Shell rules for a kids' app in a browser (wireframe pwa/system-banners):
       no pull-to-refresh mid-quest, no accidental text selection on tiles,
       and the trace canvas owns its touches. Pinch-zoom stays enabled. */
    html, body { overscroll-behavior: none; background: #FCF8F1; }
    body { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
    input, textarea { -webkit-user-select: text; user-select: text; }
    #trace-canvas { touch-action: none; }
  </style>`;

const sw = `
  <script>
    (function () {
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

const { count, size, warnings } = await generateSW({
  globDirectory: dist,
  globPatterns: ['**/*.{js,html,ico,png,json,webmanifest,svg,mp3,woff2}'],
  swDest: join(dist, 'sw.js'),
  navigateFallback: '/index.html',
  clientsClaim: true,
  skipWaiting: false, // the app decides when to apply an update (never mid-quest)
  cleanupOutdatedCaches: true,
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
});
for (const w of warnings) process.stdout.write(`workbox: ${w}\n`);
process.stdout.write(`pwa-postbuild: precached ${count} files (${(size / 1024 / 1024).toFixed(2)} MB)\n`);
