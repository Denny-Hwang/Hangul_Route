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
// 200 % text: the root font size doubles (every reading size is in rem) and --text-f is 2, so large type (title,
// display, hero: the jamo on a tile) grows by 1 + (f - 1) / 2, as the app's text size engine does.
//
// Checks (each names the rule it holds):
//   literals    answer-feedback.css has no colour literal and no bare px value outside its constants block and media
//               queries (CLAUDE.md section 4: tokens only; tokens.css is generated from tokens.ts)
//   sideways    no page scrolls sideways (F-LAYOUT-001)
//   targets     every drawn answer, button, switch and radio is at least touchTarget.min (64) high (CLAUDE.md section 1)
//   danger      no drawn colour is colors.feedback.danger (CLAUDE.md anti-shame rules)
//   no-x        no `close` glyph is drawn, and no mark is anything but check, replay or dash (spec 3.1)
//   words       no emoji and no banned word (packages/i18n/src/banned-words.json) in drawn text or accessible names
//   mark-size   every mark is at least 20 (spec 3.1 "Size", the minimum this pass sets)
//   mark-clear  no mark overlaps any text of its answer, at any window and at 200 % text (spec 3.1 "Placement")
//   corner      every corner mark's box lies inside its answer's rounded inner corner (review round 1, charter M2)
//   overlap     no mark or disc overlaps another answer (owner Q5: the straddling disc)
//   scene       every Hidden Heritage disc lies whole inside its scene, which clips (review round 1, code M1)
//   reflow      a ChoiceCard row is as high answered as not answered: the mark column is kept (charter M6)
//   mark-hidden every mark is aria-hidden (spec 3.1 "Decorative")
//   contrast    every mark is at least 3:1 on the fill right behind it (spec 3.1 "Contrast", WCAG 1.4.11); the
//               Display switch's off track is at least 3:1 on the sheet (charter M7)
//   cue         every right, miss and tried answer carries a mark (a tried one on its disc, owner Q5); every look-here
//               a dashed ring; a pick a solid ring (spec 3.1 "Greyscale", charter M3)
//   locked      no answered option is disabled (spec 3.1 "Locked is not disabled")
//   reserved    the Build a Letter shape picture's place is under the slots and the same height in every frame (owner Q2)
//   body-floor  the Display row's help line is at least the 18 body floor at standard text (charter minor 13)
//   said        no announcer line holds taught-Korean Hangul (spec 3.2, OD-AF5 (a))
//   next        every Next is the one focused control of its frame (OD-AF9 (b): Next takes focus)
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

async function check(page, where, standardText) {
  const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);

  const results = await page.evaluate((standard) => {
    const out = [];
    const push = (rule, detail) => out.push({ rule, detail });
    const label = (n) => (n.getAttribute('aria-label') || n.textContent || '').trim().slice(0, 40);
    const shown = (n) => n.getClientRects().length > 0;
    const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

    // targets
    for (const n of document.querySelectorAll('.screen button, .screen [role="button"], .screen [role="switch"], .screen label.opt, .spec-specimen button')) {
      if (!shown(n)) continue; // not rendered at this window (GameColumns' other feedback slot)
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
        const v = parse(getComputedStyle(e).backgroundColor);
        if (v.length === 3 || (v.length === 4 && v[3] > 0.99)) return v.slice(0, 3);
      }
      return [255, 255, 255];
    };
    /** Is point (x, y) inside the element's padding box with its inner rounded corners (0.5 px of grace)? */
    const insideRounded = (el, x, y) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const bw = parseFloat(cs.borderTopWidth);
      const box = { left: r.left + bw, top: r.top + bw, right: r.right - bw, bottom: r.bottom - bw };
      const rad = Math.max(0, parseFloat(cs.borderTopRightRadius) - bw);
      if (x < box.left - 0.5 || x > box.right + 0.5 || y < box.top - 0.5 || y > box.bottom + 0.5) return false;
      const cx = x > box.right - rad ? box.right - rad : x < box.left + rad ? box.left + rad : null;
      const cy = y < box.top + rad ? box.top + rad : y > box.bottom - rad ? box.bottom - rad : null;
      if (cx === null || cy === null) return true;
      return Math.hypot(x - cx, y - cy) <= rad + 0.5;
    };
    const answers = [...document.querySelectorAll('.mk-host, .screen button, .spec-specimen button')].filter(shown);

    for (const m of document.querySelectorAll('.mark')) {
      if (m.closest('.size-box') || !shown(m)) continue;
      const svg = m.querySelector('svg');
      const r = svg.getBoundingClientRect();
      const box = m.getBoundingClientRect();
      const disc = m.classList.contains('mark-disc');
      if (r.width < 19.5) push('mark-size', `a ${svg.dataset.icon} mark is ${r.width} px`);
      if (m.getAttribute('aria-hidden') !== 'true') push('mark-hidden', `a ${svg.dataset.icon} mark is not aria-hidden`);
      const c = ratio(parse(getComputedStyle(svg).color), bgOf(m));
      if (c < 3) push('contrast', `a ${svg.dataset.icon} mark is ${c.toFixed(2)}:1 on its fill`);
      const host = m.closest('.mk-host');
      if (!host) continue;
      // corner: a corner mark (not a disc, which straddles by design) sits inside the rounded inner corner
      if (m.classList.contains('mark-corner') && !disc) {
        const pts = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]];
        if (!pts.every(([x, y]) => insideRounded(host, x, y))) push('corner', `a ${svg.dataset.icon} mark leaves the rounded corner of "${label(host)}"`);
      }
      // mark-clear: no text of its own answer under the mark (or its disc)
      const owner = host.closest('button') ?? host;
      const walker = document.createTreeWalker(owner, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim() || m.contains(t)) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const tr of range.getClientRects()) {
          if (area(box, tr) > 0.25) push('mark-clear', `a ${svg.dataset.icon} mark covers "${t.textContent.trim().slice(0, 20)}" (${label(owner)})`);
        }
      }
      // overlap: no other answer under the mark
      for (const a of answers) {
        if (a.contains(m) || m.contains(a) || a.contains(owner) || owner.contains(a)) continue;
        if (area(box, a.getBoundingClientRect()) > 0.5) push('overlap', `a ${svg.dataset.icon} mark of "${label(owner)}" overlaps "${label(a)}"`);
      }
      // scene: a disc in a clipping scene is whole inside it
      const scene = m.closest('.scene');
      if (scene && disc) {
        const s = scene.getBoundingClientRect();
        const bw = parseFloat(getComputedStyle(scene).borderTopWidth);
        if (box.left < s.left + bw - 0.5 || box.top < s.top + bw - 0.5 || box.right > s.right - bw + 0.5 || box.bottom > s.bottom - bw + 0.5) push('scene', `a ${svg.dataset.icon} disc is cut by the scene's edge (${label(owner)})`);
      }
    }

    // reflow: an answered ChoiceCard is as high as the same card not answered (its mark column is kept)
    for (const n of document.querySelectorAll('.cc')) {
      if (!shown(n)) continue;
      if (!n.querySelector(':scope > .mark, :scope > .mark-slot')) push('reflow', `a ChoiceCard keeps no mark column (${label(n)})`);
      const m = n.querySelector(':scope > .mark');
      if (!m) continue;
      const clone = n.cloneNode(true);
      const slot = document.createElement('span');
      slot.className = 'mark-slot';
      clone.querySelector(':scope > .mark').replaceWith(slot);
      clone.className = 'cc cc-idle mk-host';
      clone.style.width = `${n.getBoundingClientRect().width}px`;
      n.parentElement.insertBefore(clone, n.nextSibling);
      const dh = Math.abs(clone.getBoundingClientRect().height - n.getBoundingClientRect().height);
      clone.remove();
      if (dh > 0.5) push('reflow', `"${label(n)}" changes height by ${dh.toFixed(1)} px when answered`);
    }

    // cue and locked
    for (const n of document.querySelectorAll('[data-state]')) {
      if (!shown(n)) continue;
      const s = n.dataset.state;
      const cs = getComputedStyle(n);
      if (['correct', 'wrong', 'tried'].includes(s) && !n.querySelector('.mark')) push('cue', `${s} with no mark (${label(n)})`);
      if (s === 'tried' && !n.querySelector('.mark-disc')) push('cue', `a tried mark not on its disc (${label(n)})`);
      if (s === 'hint' && cs.outlineStyle !== 'dashed' && cs.borderTopStyle !== 'dashed') push('cue', `look-here with no dashed ring (${label(n)})`);
      if (s === 'picked' && cs.boxShadow === 'none') push('cue', `a pick with no ring (${label(n)})`);
      if (['correct', 'wrong'].includes(s) && (n.hasAttribute('disabled') || n.getAttribute('aria-disabled') === 'true')) push('locked', `an answered option is disabled (${label(n)})`);
    }
    for (const n of document.querySelectorAll('.cm-picked')) {
      if (getComputedStyle(n).boxShadow === 'none') push('cue', 'a picked card has no ring');
    }

    // reserved: the shape picture's place directly under the slots, one height on the page
    const places = [...document.querySelectorAll('.shape-place')];
    for (const p of places) if (!p.previousElementSibling?.classList.contains('slots')) push('reserved', 'the shape picture is not directly under the slots');
    const heights = new Set(places.map((p) => Math.round(p.getBoundingClientRect().height)));
    if (heights.size > 1) push('reserved', `the shape picture's place changes height: ${[...heights].join(', ')}`);

    // Display row: the off track, and the help line's size
    for (const row of document.querySelectorAll('.sr-row:not(.sr-on)')) {
      const c = ratio(parse(getComputedStyle(row.querySelector('.track')).backgroundColor), bgOf(row));
      if (c < 3) push('contrast', `the switch's off track is ${c.toFixed(2)}:1`);
    }
    if (standard) {
      for (const h of document.querySelectorAll('.sr-help')) {
        const px = parseFloat(getComputedStyle(h).fontSize);
        if (px < 18) push('body-floor', `the help line is ${px} px`);
      }
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
  }, standardText);
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
      await page.addStyleTag({ content: `:root { --fold: ${win.h}px;${win.text ? ` --text-f: ${win.text};` : ''} }${win.text ? ` html { font-size: ${win.text * 100}%; }` : ''}` });
      const where = `${file} @${win.tag}`;
      await check(page, where, !win.text);
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
