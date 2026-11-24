#!/usr/bin/env node
// F-A11Y-001 row AF-0b (docs/specs/F-A11Y-001-answer-feedback-and-announcements.md section 5): checks and shots of this
// design pass's mocks. A design tool (not shipped, not run by CI). It opens every mock page in Chromium from disk at
// three windows (360 x 740; 320 x 568 with 200 % text; a 1024 x 768 tablet), checks it, and writes a colour and a
// greyscale shot of each. It exits 1 when a check fails, so a mock change that breaks a rule is seen before the shots
// are committed.
//
//   node design/components/AnswerFeedback/tools/capture.mjs            # checks and shots
//   node design/components/AnswerFeedback/tools/capture.mjs --no-shots # checks only
//
// Playwright comes from apps/web's install (`pnpm install` and a Playwright Chromium), as the other design passes'
// capture tools; in a worktree with no install of its own, point NODE_PATH at a checkout's apps/web/node_modules.
//
// Checks (each names the rule it holds):
//   literals   answer-feedback.css has no colour literal and no bare px value outside its constants block and media
//              queries (CLAUDE.md section 4: tokens only; tokens.css is generated from tokens.ts)
//   sideways   no page scrolls sideways (F-LAYOUT-001)
//   targets    every drawn answer, button, switch and radio is at least touchTarget.min (64) high (CLAUDE.md section 1)
//   danger     no drawn colour is colors.feedback.danger (CLAUDE.md anti-shame rules)
//   no-x       no `close` glyph is drawn, and no mark is anything but check, replay or dash (spec 3.1)
//   words      no emoji and no banned word (packages/i18n/src/banned-words.json) in drawn text or accessible names
//   mark-size  every mark is at least 20 (spec 3.1 "Size", the minimum this pass sets)
//   mark-clear no mark overlaps any text of its answer, at any window and at 200 % text (spec 3.1 "Placement")
//   mark-hidden every mark is aria-hidden (spec 3.1 "Decorative")
//   contrast   every mark is at least 3:1 on the fill right behind it (spec 3.1 "Contrast", WCAG 1.4.11)
//   cue        every right, miss and tried answer carries a mark; every look-here a thick or dashed ring; a picked
//              Card Match card its ring: a second cue besides colour (spec 3.1 "Greyscale", 3.8)
//   locked     no answered option is disabled (spec 3.1 "Locked is not disabled")
//   said       no announcer line holds taught-Korean Hangul (spec 3.2, OD-AF5 (a))
//   next       every Next is the one focused control of its frame (OD-AF9 (b): Next takes focus)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../..');
const MOCK = resolve(here, '../mock');
const SHOTS = resolve(here, '../shots');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const SHOOT = !process.argv.includes('--no-shots');
const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
const DANGER = 'rgb(200, 75, 61)'; // colors.feedback.danger #C84B3D, read only to check it is never drawn

const PAGES = ['states', 'quiz', 'pairs', 'boards', 'display'].map((p) => `answer-feedback-${p}.html`);
const WINDOWS = [
  { w: 360, h: 740, tag: '360' },
  { w: 320, h: 568, text: 2, tag: '320-text200' },
  { w: 1024, h: 768, tag: '1024' },
];

const failures = [];
const fail = (rule, where, detail) => failures.push(`${rule} · ${where} · ${detail}`);

// ---------------------------------------------------------------------------------------------- literals (static)
{
  const css = readFileSync(join(MOCK, 'answer-feedback.css'), 'utf8');
  const body = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/:root\s*\{[^}]*\}/, '') // the constants block (the first :root)
    .replace(/@media[^{]*\{/g, '{');
  if (/#[0-9a-fA-F]{3,8}\b/.test(body) || /\brgba?\(/.test(body) || /\bhsla?\(/.test(body)) fail('literals', 'answer-feedback.css', 'a colour literal');
  const px = body.match(/(?<![\w-])\d*\.?\d+px\b/g);
  if (px) fail('literals', 'answer-feedback.css', `bare px values: ${[...new Set(px)].join(', ')}`);
}

async function check(page, where) {
  const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);

  const results = await page.evaluate(() => {
    const out = [];
    const push = (rule, detail) => out.push({ rule, detail });
    const label = (n) => (n.getAttribute('aria-label') || n.textContent || '').trim().slice(0, 40);

    // targets
    for (const n of document.querySelectorAll('.screen button, .screen [role="button"], .screen [role="switch"], .screen label.opt, .spec-specimen button')) {
      if (n.getClientRects().length === 0) continue; // not rendered at this window (GameColumns' other feedback slot)
      const h = n.getBoundingClientRect().height;
      if (h < 63.5) push('targets', `"${label(n)}" is ${h.toFixed(1)} px high`);
    }
    // danger
    const danger = [...document.querySelectorAll('*')].some((n) => {
      const cs = getComputedStyle(n);
      return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.fill, cs.stroke, cs.outlineColor].includes('rgb(200, 75, 61)');
    });
    if (danger) push('danger', 'colors.feedback.danger is drawn');
    // no-x
    if (document.querySelector('[data-icon="close"]')) push('no-x', 'a close (X) glyph is drawn');
    for (const m of document.querySelectorAll('.mark svg')) {
      if (!['check', 'replay', 'dash'].includes(m.dataset.icon)) push('no-x', `a mark is ${m.dataset.icon}`);
    }

    // marks
    const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const bgOf = (n) => {
      for (let e = n; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        const v = parse(c);
        if (v.length === 3 || (v.length === 4 && v[3] > 0.99)) return v.slice(0, 3);
      }
      return [255, 255, 255];
    };
    for (const m of document.querySelectorAll('.mark')) {
      if (m.closest('.size-box') || m.getClientRects().length === 0) continue;
      const svg = m.querySelector('svg');
      const r = svg.getBoundingClientRect();
      if (r.width < 19.5) push('mark-size', `a ${svg.dataset.icon} mark is ${r.width} px`);
      if (m.getAttribute('aria-hidden') !== 'true') push('mark-hidden', `a ${svg.dataset.icon} mark is not aria-hidden`);
      const c = ratio(parse(getComputedStyle(svg).color), bgOf(m));
      if (c < 3) push('contrast', `a ${svg.dataset.icon} mark is ${c.toFixed(2)}:1 on its fill`);
      const host = m.closest('.mk-host');
      if (!host) continue;
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim() || m.contains(t)) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const tr of range.getClientRects()) {
          const ix = Math.min(r.right, tr.right) - Math.max(r.left, tr.left);
          const iy = Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top);
          if (ix > 0.5 && iy > 0.5) push('mark-clear', `a ${svg.dataset.icon} mark covers "${t.textContent.trim().slice(0, 20)}" (${label(host)})`);
        }
      }
    }
    // cue
    for (const n of document.querySelectorAll('[data-state]')) {
      const s = n.dataset.state;
      if (['correct', 'wrong', 'tried'].includes(s) && !n.querySelector('.mark')) push('cue', `${s} with no mark (${label(n)})`);
      if (s === 'hint') {
        const cs = getComputedStyle(n);
        if (!(parseFloat(cs.borderTopWidth) >= 3 || cs.borderTopStyle === 'dashed')) push('cue', `look-here with no ring (${label(n)})`);
      }
      if (['correct', 'wrong'].includes(s) && (n.hasAttribute('disabled') || n.getAttribute('aria-disabled') === 'true')) push('locked', `an answered option is disabled (${label(n)})`);
    }
    for (const n of document.querySelectorAll('.cm-picked')) {
      if (getComputedStyle(n).boxShadow === 'none') push('cue', 'a picked card has no ring');
    }
    // said
    for (const q of document.querySelectorAll('.said q')) {
      if (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(q.textContent)) push('said', `Hangul in "${q.textContent}"`);
    }
    // next
    for (const f of document.querySelectorAll('.screen')) {
      const nexts = f.querySelectorAll('.next-btn');
      if (nexts.length === 0) continue;
      const focused = f.querySelectorAll('[data-focused="true"]');
      if (nexts.length !== 1 || focused.length !== 1 || focused[0] !== nexts[0]) push('next', `frame ${f.dataset.frame}: Next is not the one focused control`);
    }
    return out;
  });
  for (const r of results) fail(r.rule, where, r.detail);

  const text = await page.evaluate(() => {
    const c = document.body.cloneNode(true);
    c.querySelectorAll('[aria-hidden="true"], script, style, code, [lang="ko"], [lang="es"]').forEach((n) => n.remove());
    const spoken = [...document.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ');
    return `${c.textContent} ${spoken}`;
  });
  if (/\p{Extended_Pictographic}/u.test(text)) fail('words', where, 'an emoji is drawn');
  for (const word of [...BANNED.en.learner, ...BANNED.en.caregiver]) {
    if (new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(text)) fail('words', where, `"${word}" is drawn`);
  }
}

const browser = await chromium.launch();
try {
  for (const file of PAGES) {
    for (const win of WINDOWS) {
      const ctx = await browser.newContext({ viewport: { width: win.w, height: win.h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(join(MOCK, file)).href);
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
      await page.addStyleTag({ content: `:root { --fold: ${win.h}px; }${win.text ? ` html { font-size: ${win.text * 100}%; }` : ''}` });
      const where = `${file} @${win.tag}`;
      await check(page, where);
      if (SHOOT) {
        const base = join(SHOTS, `${file.replace('.html', '')}-${win.tag}`);
        await page.screenshot({ path: `${base}.png`, fullPage: true });
        await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
        await page.screenshot({ path: `${base}-grey.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`all checks passed${SHOOT ? '; shots written' : ''}`);
