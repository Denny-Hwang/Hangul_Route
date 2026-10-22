#!/usr/bin/env node
// AMENDMENTS-SITE-NEWUSER item 8: the head assets the spec proposes, drawn for review (not shipped files).
//
//   node design/screens/site/newuser/tools/build-head.mjs      (after build-mocks.mjs, which writes mock/en/home.html)
//
// - head/icon-32.png, head/icon-48.png, head/apple-icon-180.png: apps/mobile/public/icon-1024.png scaled down (SN-2
//   ships them as apps/web/src/app/icon.png and apple-icon.png, Next's file convention, so every page gets them).
// - head/og-<locale>.png: 1200 x 630, Hoya waving and the brand with the locale's tagline (`landing.meta.tagline`),
//   per locale because it holds words. Colours are tokens (values copied with their token names below).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NEWUSER = resolve(here, '..');
const REPO = resolve(NEWUSER, '../../../..');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');
const sharp = require(require.resolve('sharp', { paths: [join(REPO, 'node_modules/.pnpm/node_modules')] }));

const OUT = join(NEWUSER, 'head');
mkdirSync(OUT, { recursive: true });
const icon = join(REPO, 'apps/mobile/public/icon-1024.png');
for (const [name, size] of [['icon-32.png', 32], ['icon-48.png', 48], ['apple-icon-180.png', 180]]) {
  await sharp(icon).resize(size, size).png({ palette: true }).toFile(join(OUT, name));
}

const home = readFileSync(join(NEWUSER, 'mock/en/home.html'), 'utf8');
const hoya = /<span class="sn-art-hoya"[^>]*>(<svg[\s\S]*?<\/svg>)<\/span>/.exec(home)?.[1] ?? '';
const TAGLINE = { en: 'Learn Hangul from zero, at any age.', es: 'Aprende hangul desde cero, a cualquier edad.', ko: '나이와 상관없이, 한글을 처음부터 배워요.' };
const LANG = { en: 'en', es: 'es', ko: 'ko' };

const page = (locale) => `<!DOCTYPE html><html lang="${LANG[locale]}"><head><meta charset="utf-8"><style>
  :root {
    --canvas: #FCF8F1;        /* colors.surface.canvas */
    --brand: #B24915;         /* colors.brand.primary */
    --brand-light: #FAD9C6;   /* colors.brand.primaryLight */
    --text: #2A1F14;          /* colors.text.primary */
    --text-secondary: #5C4A36;/* colors.text.secondary */
    --on-primary: #FFFFFF;    /* colors.text.onPrimary */
  }
  html, body { margin: 0; width: 1200px; height: 630px; background: var(--canvas); color: var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  .og { display: grid; grid-template-columns: 500px 1fr; align-items: center; height: 630px; padding: 0 64px 0 48px; box-sizing: border-box; gap: 48px; }
  .art { width: 500px; height: 500px; border-radius: 9999px; background: var(--brand-light); display: flex; align-items: center; justify-content: center; }
  .art svg { width: 78%; height: 78%; }
  .brand { display: flex; align-items: center; gap: 16px; font-weight: 700; font-size: 56px; letter-spacing: -0.4px; }
  .mark { width: 72px; height: 72px; border-radius: 9999px; background: var(--brand); color: var(--on-primary); display: flex; align-items: center; justify-content: center; font-size: 30px; }
  .tag { margin: 28px 0 0; font-size: 44px; line-height: 1.15; font-weight: 700; word-break: keep-all; overflow-wrap: anywhere; }
  .host { margin: 28px 0 0; font-size: 26px; color: var(--text-secondary); font-weight: 600; }
</style></head><body><div class="og"><div class="art">${hoya}</div><div>
  <div class="brand"><span class="mark">HR</span><span>Hangul Route</span></div>
  <p class="tag">${TAGLINE[locale]}</p>
  <p class="host">hangulroute.com</p>
</div></div></body></html>`;

const browser = await chromium.launch();
for (const locale of ['en', 'es', 'ko']) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const p = await ctx.newPage();
  await p.setContent(page(locale));
  const png = await p.screenshot({ type: 'png' });
  const file = join(OUT, `og-${locale}.png`);
  await sharp(png).png({ palette: true, quality: 90 }).toFile(file);
  console.log(file, `${(statSync(file).size / 1024).toFixed(1)} KB`);
  await ctx.close();
}
await browser.close();
