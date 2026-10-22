#!/usr/bin/env node
// The site's product captures (AMENDMENTS-SITE-NEWUSER §3.13, row SN-1): real screens of the learner app and the
// console, per UI locale, as content-hashed WebP files under `public/site/captures/<locale>/` and a generated manifest
// (`src/data/site-captures.generated.ts`). Made from the design tools of SN-0
// (`design/screens/site/newuser/tools/capture-app.mjs` and `capture-console.spec.ts`).
//
// Run on demand by a person (OD-SN-6: the PR that visibly changes a captured screen reruns it for that screen), never
// in CI or a build. No real account and no network: the learner bundle runs with no API, the console export with the
// reports e2e fixtures (API mocked), and only made-up first names appear (Dami; the class Sunflower with Mina, Jun,
// Ava and others).
//
//   1. node scripts/site-captures.mjs learner <messages.json> <png-dir> [en|es|ko]
//        The learner walk (setup as "Me", new to Korean, quest 1): discover, game, home, card, and with DECK set the
//        Lecture mode slide. Needs the release learner bundle served with no API:
//          SKIP_CONSOLE=1 EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:9 pnpm --filter @hangul-route/mobile build:web
//          PORT=4373 node apps/mobile/scripts/serve-dist.mjs apps/mobile/dist
//        <messages.json> is `JSON.stringify({ en, es, ko })` of `getMessages(locale)` (plain strings are all it reads).
//        Home is taken at HOME_WIDTH=430 (spec §11: at 390 the Korean greeting breaks before its comma).
//   2. The console captures (report, class-list, class-list-narrow): `scripts/site-captures/console.capture.ts`
//        (its header has the command), into the same <png-dir>.
//   3. node scripts/site-captures.mjs encode <png-dir> <webp-dir>
//        Crops (the boxes are found in the pixels, so a copy change that moves a line moves the crop) and encodes at
//        the §3.13 widths, WebP quality 72. Needs `sharp` (a dev tool, resolved from the workspace store).
//   4. node scripts/site-captures.mjs publish <webp-dir>
//        Copies `<webp-dir>/<locale>/<name>.webp` to `public/site/captures/<locale>/<name>.<hash8>.webp` (the hash is
//        the file's content hash, so `public/_headers` can mark `/site/captures/*` immutable; nothing unhashed lives
//        there), removes the old hashed files of the
//        names it publishes, and rewrites the manifest. `site-captures.test.ts` checks the result.
//
// A capture must never show a feature whose site claim is off (spec §3.13, `CAPTURE_CLAIMS` in
// `src/data/site-captures.ts`): the Learning Route (claim off) stays outside every crop, and no crop shows the level
// check's starting spot (its claim is on since 2026-10-21; a crop that showed it would list `levelCheck`).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(here, '..');
const REPO = resolve(WEB, '../..');

/** The capture names and the width each is encoded at (spec §3.13; 2x of the largest drawn size). */
export const CAPTURE_WIDTHS = {
  discover: 520,
  'discover-narrow': 400,
  home: 400,
  game: 400,
  card: 400,
  report: 600,
  'class-list': 720,
  'class-list-narrow': 600,
  'lecture-slide': 1080,
};
export const CAPTURE_NAMES = Object.keys(CAPTURE_WIDTHS);
export const CAPTURE_LOCALES = ['en', 'es', 'ko'];

/** Where the published files live, and the manifest the pages read. */
export const PUBLIC_SITE = join(WEB, 'public', 'site', 'captures');
export const MANIFEST = join(WEB, 'src', 'data', 'site-captures.generated.ts');

/**
 * The pixel size of a WebP file (RIFF header: `VP8 ` lossy, `VP8L` lossless, `VP8X` extended), so the manifest and
 * its test never need an image library.
 * @param {Buffer} buf
 * @returns {{ width: number, height: number }}
 */
export function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not a WebP file');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  throw new Error(`unknown WebP chunk ${chunk}`);
}

/** The first 8 hex characters of the file's sha256: its published name is `<name>.<hash8>.webp`. */
export function hash8(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

/** The manifest source for `entries` (`{ [locale]: { [name]: { src, width, height } } }`), sorted, stable. */
export function manifestSource(entries) {
  const lines = [
    '// Generated by `node scripts/site-captures.mjs publish` (AMENDMENTS-SITE-NEWUSER §3.13). Do not edit by hand.',
    '// Each `src` is the content-hashed file under `public/site/captures/<locale>/`; width and height are its pixels.',
    "import type { CaptureManifest } from './site-captures';",
    '',
    'export const SITE_CAPTURE_FILES: CaptureManifest = {',
  ];
  for (const locale of Object.keys(entries).sort()) {
    lines.push(`  ${locale}: {`);
    for (const name of CAPTURE_NAMES.filter((n) => entries[locale][n])) {
      const { src, width, height } = entries[locale][name];
      lines.push(`    '${name}': { src: '${src}', width: ${width}, height: ${height} },`);
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

/**
 * Publishes `<webpDir>/<locale>/<name>.webp` for every locale folder present: hashed copies under `publicDir`, the old
 * hashed files of each published name removed, and the manifest for everything now in `publicDir`.
 */
export function publish(webpDir, publicDir = PUBLIC_SITE, manifestFile = MANIFEST) {
  for (const locale of CAPTURE_LOCALES) {
    const from = join(webpDir, locale);
    if (!existsSync(from)) continue;
    const to = join(publicDir, locale);
    mkdirSync(to, { recursive: true });
    for (const name of CAPTURE_NAMES) {
      const file = join(from, `${name}.webp`);
      if (!existsSync(file)) continue;
      const buf = readFileSync(file);
      webpSize(buf); // fails on a file that is not a WebP
      for (const old of readdirSync(to)) if (new RegExp(`^${name}\\.[0-9a-f]{8}\\.webp$`).test(old)) rmSync(join(to, old));
      copyFileSync(file, join(to, `${name}.${hash8(buf)}.webp`));
    }
  }
  const entries = {};
  for (const locale of CAPTURE_LOCALES) {
    const dir = join(publicDir, locale);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      const match = /^(.+)\.[0-9a-f]{8}\.webp$/.exec(file);
      if (!match || !CAPTURE_NAMES.includes(match[1])) continue;
      const { width, height } = webpSize(readFileSync(join(dir, file)));
      (entries[locale] ??= {})[match[1]] = { src: `/site/captures/${locale}/${file}`, width, height };
    }
  }
  writeFileSync(manifestFile, manifestSource(entries));
  return entries;
}

/** The silent stand-in speech engine with one Korean voice: games show their normal sound button, nothing plays aloud. */
async function silentKoreanVoice(ctx) {
  await ctx.addInitScript(() => {
    class Utterance {
      constructor(text) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u) => setTimeout(() => (u.onstart?.(), u.onend?.()), 0),
        cancel() {},
        getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false }],
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
}

const BROWSER_LOCALE = { en: 'en-US', es: 'es-ES', ko: 'ko-KR' };
const NAME = { en: 'Dami', es: 'Dami', ko: '다미' };

/** The learner walk in one locale; every label is read from the dictionary in that locale (`M[locale]`). */
async function learner(browser, M, locale, out, app) {
  const L = M[locale].learner;
  const ctx = await browser.newContext({
    viewport: { width: Number(process.env.HOME_WIDTH ?? 390), height: 844 },
    deviceScaleFactor: 2,
    locale: BROWSER_LOCALE[locale],
    hasTouch: true,
    isMobile: true,
  });
  await silentKoreanVoice(ctx);
  const p = await ctx.newPage();
  const shot = async (name) => {
    await p.waitForTimeout(800);
    await p.screenshot({ path: join(out, `${name}.png`) });
  };
  const toastGone = async () => {
    for (let i = 0; i < 20 && (await p.evaluate(() => document.body.innerText)).includes(L.pwa.offlineReady); i += 1) await p.waitForTimeout(500);
  };
  await p.goto(`${app}/?lang=${locale}`);
  await p.getByRole('button', { name: L.welcome.cta }).click();
  await p.getByRole('radio', { name: new RegExp(`^${L.createProfile.who.self.label}\\.`) }).click();
  await p.getByRole('button', { name: L.createProfile.cta, exact: true }).click();
  await p.getByPlaceholder(L.createProfile.namePlaceholder).fill(NAME[locale]);
  await p.getByRole('button', { name: L.createProfile.cta, exact: true }).click();
  await p.getByRole('checkbox').click();
  await p.getByRole('button', { name: L.createProfile.cta, exact: true }).click();
  await p.getByTestId('placement-invite-new').click();
  await p.getByRole('button', { name: L.firstQuest.cta }).click();
  await p.getByRole('button', { name: L.quest.continue.cta, exact: true }).click();
  await toastGone();
  await shot('discover');
  while (await p.getByText(L.quest.step.discover.pill, { exact: true }).count()) {
    await p.getByRole('button', { name: L.quest.discover.continue.cta, exact: true }).click();
    await p.waitForTimeout(400);
  }
  await p.getByRole('button', { name: L.quest.launcher.game.play.cta }).click();
  await p.waitForTimeout(1500);
  await shot('game');
  await p.goto(`${app}/`);
  await p.waitForTimeout(2500);
  await toastGone();
  await shot('home');
  await p.getByText(M[locale].a11y.tabs.library, { exact: true }).last().click();
  await p.waitForTimeout(1500);
  await p.locator('[role=button]').filter({ hasText: L.library.new.pill }).first().click();
  await shot('card');
  await ctx.close();
}

/** Lecture mode on quest 1's first letter, fully revealed; `deck` is the encoded one-quest lesson (`encodeDeck`). */
async function lecture(browser, locale, out, app, deck) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: BROWSER_LOCALE[locale] });
  const p = await ctx.newPage();
  await p.goto(`${app}/present?lang=${locale}#d=${deck}`);
  await p.waitForTimeout(2500);
  await p.locator('button,[role=button]').last().click();
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i += 1) {
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(900);
  }
  await p.screenshot({ path: join(out, 'lecture-slide.png') });
  await ctx.close();
}

/** PNG -> WebP with the review round 3 crops (spec §3.13 "Crops"), one locale folder at a time. */
async function encode(srcDir, destDir) {
  const require = createRequire(join(WEB, 'package.json'));
  const sharp = require(require.resolve('sharp', { paths: [join(REPO, 'node_modules/.pnpm/node_modules')] }));
  const px = async (file) => sharp(file).raw().toBuffer({ resolveWithObject: true });
  const at = ({ data, info }, x, y) => data.slice((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  const run = (img, x, y0, test) => {
    let first = -1;
    for (let y = y0; y < img.info.height; y += 1) {
      if (test(...at(img, x, y))) {
        if (first < 0) first = y;
      } else if (first >= 0) return [first, y - 1];
    }
    return [first, img.info.height - 1];
  };
  const orange = (r, g, b) => r > 150 && g < 110 && b < 60; // brand.primary on the Start button
  const blue = (r, g, b) => r < 90 && g > 80 && b > 130; // the Hear it button
  const frame = (r, g, b) => r > 200 && g > 80 && g < 160 && b < 110; // the card's border
  mkdirSync(destDir, { recursive: true });
  const webp = (img, name) => img.resize(CAPTURE_WIDTHS[name]).webp({ quality: 72, effort: 6 }).toFile(join(destDir, `${name}.webp`));
  const src = (n) => join(srcDir, `${n}.png`);

  // home: top of the screen to 12 CSS px under the Start button (no Learning Route link, no tab bar).
  const home = await px(src('home'));
  const [, startEnd] = run(home, 110, 500, orange);
  await webp(sharp(src('home')).extract({ left: 0, top: 0, width: home.info.width, height: startEnd + 24 }), 'home');
  // discover-narrow: the title to under Hear it; discover: as captured.
  const disc = await px(src('discover'));
  const [, hearEnd] = run(disc, 268, 900, blue);
  await webp(sharp(src('discover')).extract({ left: 0, top: 230, width: disc.info.width, height: hearEnd + 28 - 230 }), 'discover-narrow');
  await webp(sharp(src('discover')), 'discover');
  // game: under the Close row to the last letter tile.
  const game = await px(src('game'));
  const bg = at(game, 10, game.info.height - 80);
  let last = 0;
  for (let y = 168; y < game.info.height - 160; y += 1)
    for (let x = 0; x < game.info.width; x += 2) {
      const [r, g, b] = at(game, x, y);
      if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 40) {
        last = y;
        break;
      }
    }
  await webp(sharp(src('game')).extract({ left: 0, top: 168, width: game.info.width, height: last + 28 - 168 }), 'game');
  // card: the card face only.
  const card = await px(src('card'));
  const cx = Math.round(card.info.width / 2);
  const [faceTop] = run(card, cx, 100, frame);
  let faceEnd = faceTop;
  for (let y = card.info.height - 1; y > faceTop; y -= 1)
    if (frame(...at(card, cx, y))) {
      faceEnd = y;
      break;
    }
  await webp(sharp(src('card')).extract({ left: 0, top: faceTop - 20, width: card.info.width, height: faceEnd + 20 - (faceTop - 20) }), 'card');
  // report: the console capture minus its top 16 px; the rest as captured.
  const rep = await sharp(src('report')).metadata();
  await webp(sharp(src('report')).extract({ left: 0, top: 16, width: rep.width, height: rep.height - 16 }), 'report');
  for (const name of ['class-list', 'class-list-narrow', 'lecture-slide']) if (existsSync(src(name))) await webp(sharp(src(name)), name);
}

async function main(argv) {
  const [command, ...args] = argv;
  if (command === 'publish' && args[0]) {
    const entries = publish(resolve(args[0]));
    for (const [locale, names] of Object.entries(entries)) process.stdout.write(`${locale}: ${Object.keys(names).join(', ')}\n`);
    return;
  }
  if (command === 'encode' && args[0] && args[1]) {
    for (const locale of CAPTURE_LOCALES) if (existsSync(join(args[0], locale))) await encode(join(args[0], locale), join(args[1], locale));
    return;
  }
  if (command === 'learner' && args[0] && args[1]) {
    const require = createRequire(join(WEB, 'package.json'));
    const { chromium } = require('@playwright/test');
    const M = JSON.parse(readFileSync(args[0], 'utf8'));
    const app = process.env.APP_URL ?? 'http://localhost:4373';
    const browser = await chromium.launch();
    for (const locale of args[2] ? [args[2]] : CAPTURE_LOCALES) {
      const out = join(args[1], locale);
      mkdirSync(out, { recursive: true });
      await learner(browser, M, locale, out, app);
      if (process.env.DECK) await lecture(browser, locale, out, app, process.env.DECK);
    }
    await browser.close();
    return;
  }
  process.stderr.write('usage: site-captures.mjs learner <messages.json> <png-dir> [locale] | encode <png-dir> <webp-dir> | publish <webp-dir>\n');
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
