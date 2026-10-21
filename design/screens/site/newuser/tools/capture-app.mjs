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
const M = JSON.parse(readFileSync(messagesFile, 'utf8'));
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: BROWSER_LOCALE[locale], hasTouch: true, isMobile: true });
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
  await p.getByRole('tab', { name: library, exact: true }).or(p.getByRole('button', { name: library, exact: true })).first().click();
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

/** PNG -> WebP at the widths of spec section 3.13 (2x of the largest drawn size), quality 72. */
export async function encode(srcDir, destDir) {
  const sharp = require(require.resolve('sharp', { paths: [join(REPO, 'node_modules/.pnpm/node_modules')] }));
  const sizes = { discover: 520, home: 400, game: 400, card: 400, report: 600, 'class-list': 720, 'lecture-slide': 1080 };
  for (const [name, width] of Object.entries(sizes)) await sharp(join(srcDir, `${name}.png`)).resize(width).webp({ quality: 72, effort: 6 }).toFile(join(destDir, `${name}.webp`));
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
