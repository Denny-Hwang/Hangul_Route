#!/usr/bin/env node
// AMENDMENTS-SITE-NEWUSER design mocks: builds design/screens/site/newuser/mock/<locale>/<page>.html from the real
// static export and renders the shots and measurements the spec's budgets (section 3.11) are checked against.
//
// Not shipped code, and not run by CI: a design tool, kept so the mocks can be rebuilt after the export changes.
//
//   CONSOLE_ORIGIN=false pnpm --filter @hangul-route/web build          # the export the design starts from
//     (this pass: origin/main 619f4ae2b with #806 site facts and #807 /learners in the UI language merged locally,
//      so the mocks carry the copy those rows ship; neither is changed here)
//   PORT=4291 node apps/web/e2e/serve-out.mjs out                       # (from apps/web) serve it as the Worker does
//   node design/screens/site/newuser/tools/build-mocks.mjs http://localhost:4291
//
// Each page loads in Chromium, `mock/strings.js` and `mock/patch.js` turn it into the new design, and the result is
// saved with its stylesheets inlined and its scripts removed, so a mock opens from disk with no server. Shots are then
// taken from the saved files (file://), so what is measured is exactly what is committed.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NEWUSER = resolve(here, '..');
const REPO = resolve(NEWUSER, '../../../..');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const BASE = process.argv[2] ?? 'http://localhost:4291';
const LOCALES = ['en', 'es', 'ko'];
const PAGES = [
  { id: 'home', path: '/' },
  { id: 'learners', path: '/learners' },
  { id: 'parents', path: '/parents' },
  { id: 'teachers', path: '/teachers' },
  { id: 'about', path: '/about' },
  { id: '404', path: '404' },
];
const PRIMARY = { home: '.hr-site-hero .hr-site-primary', learners: 'main .hr-site-primary', parents: 'main .hr-site-primary', teachers: 'main .hr-site-primary', about: 'main .hr-site-primary', '404': 'main .hr-site-primary' };
const strings = readFileSync(join(NEWUSER, 'mock/strings.js'), 'utf8');
const patch = readFileSync(join(NEWUSER, 'mock/patch.js'), 'utf8');

/** Unchanged strings the patch reads from the dictionary (passed in, never retyped). */
const UNCHANGED = {
  en: { home404: 'Go to the home page', banner: { label: 'Sugerencia de idioma', text: 'Ver en español', dismiss: 'Cerrar', close: '×' } },
  es: { home404: 'Ir a la página de inicio' },
  ko: { home404: '홈으로 가기' },
};

const url = (locale, p) => {
  const pre = locale === 'en' ? '' : `/${locale}`;
  if (p === '404' || p === '/') return `${BASE}${pre || '/'}`;
  return `${BASE}${pre}${p}`;
};

async function build(browser, locale, pg, variant = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.route('**/sn-captures/**', (route) => {
    const file = join(NEWUSER, 'captures', new URL(route.request().url()).pathname.replace(/^\/sn-captures\//, ''));
    return route.fulfill({ path: file, contentType: 'image/webp' });
  });
  await page.goto(url(locale, pg.path), { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: strings });
  await page.evaluate(
    ([pageId, loc, v, extra]) => {
      window.SN_PAGE = { page: pageId, locale: loc, captures: `/sn-captures/${loc}`, ...v };
      window.SN_404_HOME = extra.home404;
    },
    [pg.path, locale, { ...variant, bannerOffer: UNCHANGED.en.banner }, UNCHANGED[locale]],
  );
  await page.addScriptTag({ content: patch });
  await page.waitForLoadState('networkidle');
  const html = await page.evaluate(async () => {
    for (const link of [...document.querySelectorAll('link[rel="stylesheet"]')]) {
      const css = await (await fetch(link.href)).text();
      const style = document.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
    }
    for (const n of [...document.querySelectorAll('script, link[rel="preload"], link[as="script"], next-route-announcer')]) n.remove();
    return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
  });
  await ctx.close();
  return html.replaceAll('/sn-captures/', '../../captures/');
}

async function measure(browser, file, pageId, width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href);
  if (opts.text200) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
  }
  if (opts.openLang) await page.locator('.sn-lang > summary').click();
  await page.waitForTimeout(150);
  const m = await page.evaluate((sel) => {
    const words = document.body.innerText.split(/\s+/).filter(Boolean).length;
    const header = document.querySelector('.hr-site-header')?.getBoundingClientRect();
    const primary = document.querySelector(sel)?.getBoundingClientRect();
    const small = [];
    for (const n of document.querySelectorAll('a, button, summary, input')) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden') continue;
      if (r.width < 63.5 || r.height < 63.5) small.push(`${n.tagName.toLowerCase()} ${(n.getAttribute('href') || n.getAttribute('type') || n.textContent || '').trim().slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return {
      height: document.documentElement.scrollHeight,
      sideways:
        document.documentElement.scrollWidth > window.innerWidth ||
        [...document.querySelectorAll('.sn-lang-menu a, header a, header summary')].some((n) => {
          const r = n.getBoundingClientRect();
          return n.checkVisibility() && r.width > 0 && (r.left < -0.5 || r.right > window.innerWidth + 0.5);
        }),
      words,
      header: header ? Math.round(header.height) : null,
      primaryBottom: primary ? Math.round(primary.bottom) : null,
      small,
    };
  }, PRIMARY[pageId]);
  await ctx.close();
  return m;
}

async function shot(browser, file, out, width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US', deviceScaleFactor: opts.scale ?? 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href);
  if (opts.text200) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    if (opts.full !== false) {
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(h, 4000) });
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    }
  }
  if (opts.openLang) await page.locator('.sn-lang > summary').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, fullPage: opts.full ?? true, clip: opts.clip });
  await ctx.close();
}

const browser = await chromium.launch();
const report = {};
for (const locale of LOCALES) {
  mkdirSync(join(NEWUSER, 'mock', locale), { recursive: true });
  for (const pg of PAGES) {
    const html = await build(browser, locale, pg);
    const file = join(NEWUSER, 'mock', locale, `${pg.id}.html`);
    writeFileSync(file, html);
    const r = (report[`${locale}/${pg.id}`] = {});
    r.phone = await measure(browser, file, pg.id, 375, 812);
    r.wide = await measure(browser, file, pg.id, 1280, 800);
    r.first320 = await measure(browser, file, pg.id, 320, 568);
    r.text200at320 = await measure(browser, file, pg.id, 320, 568, { text200: true });
    r.text200at720 = await measure(browser, file, pg.id, 720, 800, { text200: true });
    r.langOpen320text200 = await measure(browser, file, pg.id, 320, 568, { text200: true, openLang: true });
    const imgs = [...html.matchAll(/\.\.\/\.\.\/captures\/(\w+)\/([\w-]+\.webp)/g)].map((m) => join(NEWUSER, 'captures', m[1], m[2]));
    r.imageKB = Math.round([...new Set(imgs)].reduce((sum, f) => sum + statSync(f).size, 0) / 102.4) / 10;
    await shot(browser, file, join(NEWUSER, 'shots', `${pg.id}-${locale}-375.png`), 375, 812);
    await shot(browser, file, join(NEWUSER, 'shots', `${pg.id}-${locale}-1280.png`), 1280, 800);
    console.log(locale, pg.id, JSON.stringify({ phone: r.phone.height, wide: r.wide.height, words: r.phone.words, first: r.first320.primaryBottom, header320: r.first320.header, img: r.imageKB }));
  }
  // States: the header at 320 px, the language menu open, 200 % text at 320 px.
  const home = join(NEWUSER, 'mock', locale, 'home.html');
  await shot(browser, home, join(NEWUSER, 'shots', `home-${locale}-320-first.png`), 320, 568, { full: false });
  await shot(browser, home, join(NEWUSER, 'shots', `header-${locale}-375-lang-open.png`), 375, 420, { full: false, openLang: true });
  await shot(browser, home, join(NEWUSER, 'shots', `header-${locale}-1280-lang-open.png`), 1280, 420, { full: false, openLang: true });
  await shot(browser, home, join(NEWUSER, 'shots', `home-${locale}-320-text200.png`), 320, 568, { text200: true, full: false });
  await shot(browser, home, join(NEWUSER, 'shots', `header-${locale}-320-text200-lang-open.png`), 320, 568, { text200: true, openLang: true, full: false });
  const parents = join(NEWUSER, 'mock', locale, 'parents.html');
  await shot(browser, parents, join(NEWUSER, 'shots', `parents-${locale}-320-first.png`), 320, 568, { full: false });
}
// The locale banner on an English page other than `/` (section 3.2): /parents, browser preferring Spanish.
{
  const html = await build(browser, 'en', { id: 'parents', path: '/parents' }, { banner: true });
  const file = join(NEWUSER, 'mock', 'en', 'parents-banner.html');
  writeFileSync(file, html);
  await shot(browser, file, join(NEWUSER, 'shots', 'parents-en-375-banner.png'), 375, 812, { full: false });
}
await browser.close();
writeFileSync(join(NEWUSER, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);

// Palette PNGs keep the shots small enough to review in the PR (about a third of the size, no visible change).
const sharp = require(require.resolve('sharp', { paths: [join(REPO, 'node_modules/.pnpm/node_modules')] }));
for (const f of readdirSync(join(NEWUSER, 'shots')).filter((n) => n.endsWith('.png'))) {
  const p = join(NEWUSER, 'shots', f);
  const buf = await sharp(p).png({ palette: true, quality: 85, effort: 8 }).toBuffer();
  if (buf.length < statSync(p).size) writeFileSync(p, buf);
}
