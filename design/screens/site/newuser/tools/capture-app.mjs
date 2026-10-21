#!/usr/bin/env node
// AMENDMENTS-SITE-NEWUSER item 7: the product captures of the mocks, taken from the real learner app and console.
// A design tool (not shipped, not run by CI). Row SN-1 turns it into `apps/web/scripts/site-captures.mjs` (spec
// section 3.13); until then this is how `captures/<locale>/*.webp` were made.
//
// 1. Learner app, release bundle with no API (every call fails fast, as offline):
//      SKIP_CONSOLE=1 EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:9 pnpm --filter @hangul-route/mobile build:web
//      PORT=4373 node apps/mobile/scripts/serve-dist.mjs apps/mobile/dist
// 2. The dictionary as JSON (functions become their source; only plain strings are read here):
//      esbuild a two-line entry that writes JSON.stringify(getMessages(l)) for en, es, ko  ->  <messages.json>
// 3. node design/screens/site/newuser/tools/capture-app.mjs <messages.json> <out-dir> [en|es|ko]
//      writes <out-dir>/<locale>/{discover,home,game,card,lecture-slide}.png (390 x 844 at 2x; the slide 1280 x 720)
// 4. Console captures (report, class list): `capture-console.spec.ts` beside this file, run from apps/web/e2e with the
//    reports e2e export (see its header). Then `encode` below turns every PNG into the WebP sizes of section 3.13.
//
// Every label is read from the dictionary in the capture's locale, so a copy change never breaks the walk, and the
// speech engine is a silent stand-in with one Korean voice (so games show their normal sound button, and nothing
// plays aloud on the machine running it).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../../..');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const [messagesFile, outDir, only] = process.argv.slice(2);
const M = messagesFile ? JSON.parse(readFileSync(messagesFile, 'utf8')) : {}; // empty when only `encode` is imported
const APP = process.env.APP_URL ?? 'http://localhost:4373';
const BROWSER_LOCALE = { en: 'en-US', es: 'es-ES', ko: 'ko-KR' };
const NAME = { en: 'Dami', es: 'Dami', ko: '다미' };
/** A one-quest lesson (`encodeDeck` of { blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] }), passed in. */
const DECK = process.env.DECK ?? '';

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

async function learner(browser, locale, out) {
  const L = M[locale].learner;
  // HOME_WIDTH=430 for the Home capture (review round 3): at 390 px the Korean greeting breaks before its comma
  // (spec section 11); at 430 it breaks after it. Every other screen is taken at 390.
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.HOME_WIDTH ?? 390), height: 844 }, deviceScaleFactor: 2, locale: BROWSER_LOCALE[locale], hasTouch: true, isMobile: true });
  await silentKoreanVoice(ctx);
  const p = await ctx.newPage();
  const shot = async (name) => {
    await p.waitForTimeout(800);
    await p.screenshot({ path: join(out, `${name}.png`) });
  };
  const toastGone = async () => {
    for (let i = 0; i < 20 && (await p.evaluate(() => document.body.innerText)).includes(L.pwa.offlineReady); i += 1) await p.waitForTimeout(500);
  };
  // Setup as "Me" (no grown-up PIN), new to Korean, then the first quest.
  await p.goto(`${APP}/?lang=${locale}`);
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
  // Discover, page 1: the letter ㅏ (a), the letter Hoya's bubble names on the home hero (FIRST_LETTER, #806).
  await shot('discover');
  while (await p.getByText(L.quest.step.discover.pill, { exact: true }).count()) {
    await p.getByRole('button', { name: L.quest.discover.continue.cta, exact: true }).click();
    await p.waitForTimeout(400);
  }
  await p.getByRole('button', { name: L.quest.launcher.game.play.cta }).click();
  await p.waitForTimeout(1500);
  await shot('game');
  await p.goto(`${APP}/`);
  await p.waitForTimeout(2500);
  await toastGone();
  await shot('home');
  const library = M[locale].a11y.tabs.library;
  await p.getByText(library, { exact: true }).last().click(); // the tab bar's label (its accessible name may carry more)
  await p.waitForTimeout(1500);
  await p.locator('[role=button]').filter({ hasText: L.library.new.pill }).first().click();
  await shot('card');
  await ctx.close();
}

async function lecture(browser, locale, out) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: BROWSER_LOCALE[locale] });
  const p = await ctx.newPage();
  await p.goto(`${APP}/present?lang=${locale}#d=${DECK}`);
  await p.waitForTimeout(2500);
  await p.locator('button,[role=button]').last().click(); // Start
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i += 1) {
    await p.keyboard.press('ArrowRight'); // title, letter, stroke guide, sound, letter name: all revealed
    await p.waitForTimeout(900);
  }
  await p.screenshot({ path: join(out, 'lecture-slide.png') });
  await ctx.close();
}

/**
 * PNG -> WebP at the widths of spec section 3.13 (2x of the largest drawn size), quality 72, with the review round 3
 * crops (spec section 3.13 "Crops"): the crop boxes are found in the pixels, so a copy change that moves a line moves
 * the crop with it.
 *   home               top of the screen to 12 CSS px under the Start button (the Learning Route link and the tab
 *                      bar stay out: `learningRoute` is off on the site); taken at HOME_WIDTH=430
 *   discover-narrow    Discover page 1 from the title to under Hear it (the hero below 45em)
 *   game               under the Close row to the last letter tile
 *   card               the card face only
 *   report             the console capture minus its top 16 px
 *   class-list(-narrow), discover, lecture-slide   as captured
 */
export async function encode(srcDir, destDir) {
  const sharp = require(require.resolve('sharp', { paths: [join(REPO, 'node_modules/.pnpm/node_modules')] }));
  const px = async (file) => sharp(file).raw().toBuffer({ resolveWithObject: true });
  const at = ({ data, info }, x, y) => data.slice((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  /** First and last row of the first run of `test` pixels in column x, from y0 down. */
  const run = (img, x, y0, test) => {
    let first = -1;
    for (let y = y0; y < img.info.height; y += 1) {
      if (test(...at(img, x, y))) { if (first < 0) first = y; }
      else if (first >= 0) return [first, y - 1];
    }
    return [first, img.info.height - 1];
  };
  const orange = (r, g, b) => r > 150 && g < 110 && b < 60; // brand.primary on the Start button
  const blue = (r, g, b) => r < 90 && g > 80 && b > 130; // the Hear it button
  const frame = (r, g, b) => r > 200 && g > 80 && g < 160 && b < 110; // the card's border
  const webp = (img, width, out) => img.resize(width).webp({ quality: 72, effort: 6 }).toFile(join(destDir, `${out}.webp`));
  const src = (n) => join(srcDir, `${n}.png`);

  const home = await px(src('home'));
  const [, startEnd] = run(home, 110, 500, orange);
  await webp(sharp(src('home')).extract({ left: 0, top: 0, width: home.info.width, height: startEnd + 24 }), 400, 'home');

  const disc = await px(src('discover'));
  const [, hearEnd] = run(disc, 268, 900, blue);
  await webp(sharp(src('discover')).extract({ left: 0, top: 230, width: disc.info.width, height: hearEnd + 28 - 230 }), 400, 'discover-narrow');
  await webp(sharp(src('discover')), 520, 'discover');

  const game = await px(src('game'));
  const bg = at(game, 10, game.info.height - 80);
  let last = 0;
  for (let y = 168; y < game.info.height - 160; y += 1)
    for (let x = 0; x < game.info.width; x += 2) {
      const [r, g, b] = at(game, x, y);
      if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 40) { last = y; break; }
    }
  await webp(sharp(src('game')).extract({ left: 0, top: 168, width: game.info.width, height: last + 28 - 168 }), 400, 'game');

  const card = await px(src('card'));
  const cx = Math.round(card.info.width / 2);
  const [faceTop] = run(card, cx, 100, frame);
  let faceEnd = faceTop; // the frame's bottom edge: the lowest frame-coloured pixel (the word above it is a similar orange)
  for (let y = card.info.height - 1; y > faceTop; y -= 1) if (frame(...at(card, cx, y))) { faceEnd = y; break; }
  await webp(sharp(src('card')).extract({ left: 0, top: faceTop - 20, width: card.info.width, height: faceEnd + 20 - (faceTop - 20) }), 400, 'card');

  const rep = await sharp(src('report')).metadata();
  await webp(sharp(src('report')).extract({ left: 0, top: 16, width: rep.width, height: rep.height - 16 }), 600, 'report');
  await webp(sharp(src('class-list')), 720, 'class-list');
  await webp(sharp(src('class-list-narrow')), 600, 'class-list-narrow');
  await webp(sharp(src('lecture-slide')), 1080, 'lecture-slide');
}

if (messagesFile && outDir) {
  const browser = await chromium.launch();
  for (const locale of only ? [only] : ['en', 'es', 'ko']) {
    const out = join(outDir, locale);
    mkdirSync(out, { recursive: true });
    await learner(browser, locale, out);
    if (DECK) await lecture(browser, locale, out);
  }
  await browser.close();
}
