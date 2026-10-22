#!/usr/bin/env node
// AMENDMENTS-GUEST-FIRST-LESSON design row GU-0b: the site mocks of the guest start (spec section 13.2) built from the
// real static export, as design/screens/site/newuser/tools/build-mocks.mjs does for the new-visitor pass.
//
// Not shipped code, and not run by CI: a design tool, kept so the mocks can be rebuilt after the export changes.
//
//   CONSOLE_ORIGIN=false pnpm --filter @hangul-route/web build          # the export the design starts from (origin/main)
//   PORT=4317 node apps/web/e2e/serve-out.mjs apps/web/out              # serve it as the Worker does
//   node design/screens/site/guest/tools/build-guest-mocks.mjs http://localhost:4317
//
// Each page loads in Chromium with the `guestLesson` claim's copy applied on top of the shipped page (`levelCheck` on,
// as shipped): the hero line under the facts line, How it works steps 1 and 3, the /learners level answer and the
// Start learning links with `try=1`. The result is saved with its stylesheets inlined and its scripts removed, so a
// mock opens from disk with no server; the captures point at the identical files of ../newuser/captures. Shots and
// measurements are taken from the saved files (file://), so what is measured is exactly what is committed. The same
// pages without the patch are measured too (`off`), so every number has its shipped baseline beside it.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GUEST = resolve(here, '..');
const REPO = resolve(GUEST, '../../../..');
const NEWUSER_CAPTURES = resolve(GUEST, '../newuser/captures');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');
const sharp = require(require.resolve('sharp', { paths: [join(REPO, 'node_modules/.pnpm/node_modules')] }));

const BASE = process.argv[2] ?? 'http://localhost:4317';
const LOCALES = ['en', 'es', 'ko'];

/**
 * The spec's section 16.4 rows, word for word, plus the one row this design pass adds (`how.steps.start.guestTitle`,
 * NEW-0b) and the quote marks the pass gives the FAQ answer (the shipped `faq.level.a` quotes its button name).
 */
const STRINGS = {
  en: {
    heroGuest: 'Start your first quest right away. Add a name at the end.',
    guestTitle: 'Start right away',
    guestLevelBody: 'Play your first quest. Check your level after.',
    collectGuestBody: 'Earn Korean culture cards. Add a name, and your progress is saved and backed up.',
    faqGuestA: 'No. Play the first quest, add a name, then tap “Take the level check” on Home. Hoya suggests where to begin.',
  },
  es: {
    heroGuest: 'Empieza tu primera misión ya. Añade un nombre al final.',
    guestTitle: 'Empieza ya',
    guestLevelBody: 'Juega tu primera misión. Después comprueba tu nivel.',
    collectGuestBody: 'Gana tarjetas de cultura coreana. Añade un nombre y tu progreso se guarda y se respalda.',
    faqGuestA: 'No. Juega la primera misión, añade un nombre y luego toca «Hacer la prueba de nivel» en Inicio. Hoya te sugiere por dónde empezar.',
  },
  ko: {
    heroGuest: '첫 퀘스트를 바로 시작해요. 이름은 끝나고 넣어요.',
    guestTitle: '바로 시작하기',
    guestLevelBody: '첫 퀘스트를 해요. 수준 확인은 그다음에 해요.',
    collectGuestBody: '한국 문화 카드를 받아요. 이름을 넣으면 진도가 저장되고 백업돼요.',
    faqGuestA: '아니요. 첫 퀘스트를 하고 이름을 넣은 다음, 홈에서 ‘수준 확인하기’를 눌러요. 호야가 어디서 시작할지 알려 줘요.',
  },
};
/** The shipped /learners level question per locale (`landing.persona.learners.faq.level.q`), to find its answer. */
const LEVEL_Q = {
  en: 'I already know some Hangul. Do I have to start at the beginning?',
  es: 'Ya sé algo de hangul. ¿Tengo que empezar desde el principio?',
  ko: '한글을 조금 알아요. 처음부터 시작해야 하나요?',
};

/** Runs in the page: the `guestLesson` claim's copy on the shipped page. Site custom properties only. */
function patch([pageId, s, levelQ]) {
  for (const a of document.querySelectorAll('a[href^="https://app.hangulroute.com"]')) {
    const u = new URL(a.getAttribute('href'));
    u.searchParams.set('try', '1');
    a.setAttribute('href', u.toString());
  }
  if (pageId === 'home') {
    const facts = document.querySelector('.hr-site-hero .hr-site-actions + p');
    const line = document.createElement('p');
    line.className = 'gu-hero-guest';
    line.textContent = s.heroGuest;
    line.setAttribute('style', 'margin:var(--hr-site-sm) 0 0;font-size:var(--hr-site-size-body);color:var(--hr-site-text-secondary);max-width:34em');
    facts.after(line);
    const steps = document.querySelectorAll('.hr-site-steps > li');
    const parts = (li) => li.querySelectorAll(':scope > span:last-child > span');
    const [t1, b1] = parts(steps[0]);
    t1.textContent = s.guestTitle;
    b1.textContent = s.guestLevelBody;
    parts(steps[2])[1].textContent = s.collectGuestBody;
  }
  if (pageId === 'learners') {
    for (const d of document.querySelectorAll('details.hr-site-fold')) {
      if (d.querySelector('.hr-site-fold-q')?.textContent.trim() === levelQ) d.querySelector(':scope > div > p').textContent = s.faqGuestA;
    }
  }
}

const url = (locale, page) => `${BASE}${locale === 'en' ? '' : `/${locale}`}${page === 'home' ? (locale === 'en' ? '/' : '') : '/learners'}`;

async function build(browser, locale, pageId, guest) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(url(locale, pageId), { waitUntil: 'networkidle' });
  if (guest) await page.evaluate(patch, [pageId, STRINGS[locale], LEVEL_Q[locale]]);
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
  // The export's hashed capture names are the same files as ../newuser/captures (checked below), so the mock links there.
  return html.replace(/\/site\/captures\/(en|es|ko)\/([a-z-]+)\.[0-9a-f]{8}\.webp/g, '../../../newuser/captures/$1/$2.webp');
}

async function measure(browser, file, width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href);
  if (opts.text200) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
  }
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => {
    const bottom = (sel) => {
      const n = document.querySelector(sel);
      return n ? Math.round(n.getBoundingClientRect().bottom + window.scrollY) : null;
    };
    const links = [...document.querySelectorAll('.hr-site-hero-links a')].map((a) => Math.round(a.getBoundingClientRect().bottom + window.scrollY));
    const small = [];
    for (const n of document.querySelectorAll('main a, main button, main summary, header a, header summary')) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(n).visibility === 'hidden') continue;
      if (r.width < 63.5 || r.height < 63.5) small.push(`${(n.textContent || '').trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return {
      height: document.documentElement.scrollHeight,
      sideways: document.documentElement.scrollWidth > window.innerWidth,
      words: document.body.innerText.split(/\s+/).filter(Boolean).length,
      header: bottom('.hr-site-header'),
      brand: bottom('.hr-site-brand'),
      h1: bottom('h1'),
      lead: bottom('.hr-site-lead'),
      start: bottom('.hr-site-hero .hr-site-primary'),
      facts: bottom('.hr-site-hero .hr-site-actions + p'),
      guestLine: bottom('.gu-hero-guest'),
      grownUpLinks: links.length ? Math.max(...links) : null,
      tryLinks: [...document.querySelectorAll('a[href^="https://app.hangulroute.com"]')].every((a) => a.href.includes('try=1')),
      small,
    };
  });
  await ctx.close();
  return m;
}

async function shot(browser, file, out, width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(200);
  if (opts.faq) {
    // The level answer, opened as a reader would (the mock keeps every fold closed, as shipped), with its section.
    const fold = page.locator('details.hr-site-fold', { hasText: opts.faq });
    await fold.locator('summary').click();
    await page.waitForTimeout(150);
    await fold.locator('xpath=ancestor::section[1]').screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: opts.full ?? true });
  }
  await ctx.close();
}

// The captures the mocks link to must be the export's own files.
for (const loc of LOCALES) {
  for (const f of readdirSync(join(REPO, 'apps/web/out/site/captures', loc))) {
    const name = f.replace(/\.[0-9a-f]{8}\.webp$/, '.webp');
    const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
    if (hash(join(REPO, 'apps/web/out/site/captures', loc, f)) !== hash(join(NEWUSER_CAPTURES, loc, name))) throw new Error(`capture differs: ${loc}/${f}`);
  }
}

const browser = await chromium.launch();
const report = {};
mkdirSync(join(GUEST, 'shots'), { recursive: true });
for (const locale of LOCALES) {
  mkdirSync(join(GUEST, 'mock', locale), { recursive: true });
  for (const pageId of ['home', 'learners']) {
    const file = join(GUEST, 'mock', locale, `${pageId}.html`);
    writeFileSync(file, await build(browser, locale, pageId, true));
    // The shipped page (claim off), measured beside it and then deleted: it is the baseline, not a mock.
    const offFile = join(GUEST, 'mock', locale, `.${pageId}-off.html`);
    writeFileSync(offFile, await build(browser, locale, pageId, false));
    const r = (report[`${locale}/${pageId}`] = { on: {}, off: {} });
    for (const [tag, w, h, o] of [['320x568', 320, 568], ['375x812', 375, 812], ['768x1024', 768, 1024], ['1280x800', 1280, 800], ['1920x1080', 1920, 1080], ['320-text200', 320, 568, { text200: true }]]) {
      r.on[tag] = await measure(browser, file, w, h, o);
      r.off[tag] = await measure(browser, offFile, w, h, o);
    }
    unlinkSync(offFile);
    if (pageId === 'home') {
      await shot(browser, file, join(GUEST, 'shots', `home-${locale}-320-first.png`), 320, 568, { full: false });
      await shot(browser, file, join(GUEST, 'shots', `home-${locale}-375-first.png`), 375, 812, { full: false });
      await shot(browser, file, join(GUEST, 'shots', `home-${locale}-375.png`), 375, 812);
      await shot(browser, file, join(GUEST, 'shots', `home-${locale}-1920.png`), 1920, 1080);
    } else {
      await shot(browser, file, join(GUEST, 'shots', `learners-${locale}-375.png`), 375, 812);
      await shot(browser, file, join(GUEST, 'shots', `learners-${locale}-1920.png`), 1920, 1080);
      await shot(browser, file, join(GUEST, 'shots', `learners-${locale}-375-faq-level.png`), 375, 812, { faq: LEVEL_Q[locale] });
      await shot(browser, file, join(GUEST, 'shots', `learners-${locale}-1920-faq-level.png`), 1920, 1080, { faq: LEVEL_Q[locale] });
    }
    const a = r.on['320x568'];
    const b = r.on['375x812'];
    console.log(locale, pageId, JSON.stringify({ first320: { start: a.start, guest: a.guestLine }, first375: { links: b.grownUpLinks, brand: b.brand, guest: b.guestLine }, h375: [r.off['375x812'].height, b.height], words: [r.off['375x812'].words, b.words], try: b.tryLinks }));
  }
}
await browser.close();
writeFileSync(join(GUEST, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);

// Palette PNGs keep the shots small enough to review in the PR (about a third of the size, no visible change).
for (const f of readdirSync(join(GUEST, 'shots')).filter((n) => n.endsWith('.png'))) {
  const p = join(GUEST, 'shots', f);
  const buf = await sharp(p).png({ palette: true, quality: 85, effort: 8 }).toBuffer();
  if (buf.length < statSync(p).size) writeFileSync(p, buf);
}
