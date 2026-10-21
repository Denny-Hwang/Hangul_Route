// Metro config of the app (F-CURR-002 §9.1, row CM-6).
//
// The modules generated from content/ (lessons, stories, catalogue, overlays, vocabulary,
// placement) are gitignored and written by `node scripts/generate.mjs`. The turbo tasks and the
// root postinstall run it, but `expo start`, `expo export` and the Xcode "Bundle React Native code
// and images" phase (`expo export:embed`) start Metro directly. Metro loads this file in each of
// them, so the generators run first and a bundle can never carry content older than content/.
// The run takes well under a second and rewrites only a module whose bytes changed, so a running
// dev server does not reload for nothing. A content error stops the bundle with the generator's
// message.
//
// One caller writes the modules itself: the e2e fixture build (scripts/build-web-fixtures.mjs) runs
// generate.mjs, then writes the fixture stories over stories.generated.ts, and exports with
// HANGUL_ROUTE_GENERATE=off so this step does not put the release stories back. Nothing else sets it.
//
// Apart from that step this is Expo's default config, the one Metro used before this file existed.

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

if (process.env.HANGUL_ROUTE_GENERATE !== 'off') {
  execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'generate.mjs')], { stdio: 'inherit' });
}

module.exports = getDefaultConfig(__dirname);
