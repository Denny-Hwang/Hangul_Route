#!/usr/bin/env node
// LR-0b (docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md section 5): checks and shots of this design pass's mocks. A design
// tool (not shipped, not run by CI). It opens every mock page in Chromium from disk, writes the shots and exits 1 when
// a check fails, so a mock change that breaks a rule is seen before the shots are committed.
//
//   node design/screens/quest-leave-resume/tools/capture.mjs              # checks and shots
//   node design/screens/quest-leave-resume/tools/capture.mjs --no-shots   # checks only
//
// Playwright comes from apps/web's install (`pnpm install` and a Playwright Chromium), as
// design/screens/system/progress-read-failed/tools/capture.mjs; in a worktree with no install of its own, point
// NODE_PATH at a checkout's apps/web/node_modules.
//
// Checks (each names the rule it holds):
//   sideways   no page scrolls sideways (F-LAYOUT-001)
//   targets    every drawn button, link and switch is at least touchTarget.min (64) high (CLAUDE.md section 1)
//   danger     no drawn colour is colors.feedback.danger (anti-shame rules)
//   words      no emoji and no banned word (packages/i18n/src/banned-words.json, learner and caregiver) in drawn text
//              or accessible names (board labels and annotations are not drawn UI and are skipped)
//   no-count   no percent and no "n of m" on the check and save-failed frames (the review-copy rule, spec 3.7)
//   sheet      every drawn sheet is role=alertdialog, aria-modal, named and described by ids that exist, its first
//              button is the one focused (the safe choice), and the screen behind it is inert
//   in-view    with the body scrolled to its end, the still-stuck line is in view (README D4); on the save-failed frames Try again ends inside the window at every size (the pinned footer, spec 3.5);
//              on the frame pages the sheet's last button can be reached (inside the window, or inside the sheet's
//              own scroll)
//   button     on the Home frames the hero button's top is the same with and without the resume parts (spec 3.2: the
//              caption and link come in under it, so it never moves)
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
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

// The four sizes of every single-frame page: two phones, a small phone at 200 % text, and a tablet in landscape.
const VIEWPORTS = [
  { w: 360, h: 740, tag: '360x740' },
  { w: 390, h: 844, tag: '390x844' },
  { w: 320, h: 568, text: 2, tag: '320x568-text200' },
  { w: 1024, h: 768, tag: '1024x768' },
];
const FRAMES = readdirSync(join(MOCK, 'frames')).filter((f) => f.endsWith('.html')).sort();
const BOARDS = ['home-resume.html', 'check-resume.html', 'save-failed.html', 'keep-playing.html', 'greyscale.html'];

const failures = [];
const fail = (rule, where, detail) => failures.push(`${rule} · ${where} · ${detail}`);

async function common(page, where) {
  const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);

  const short = await page.evaluate(() =>
    [...document.querySelectorAll('button, a, [role="button"], [role="switch"]')]
      .filter((b) => !b.closest('.board-label, .board-title, .annot, .unchanged') && b.getClientRects().length > 0)
      .map((b) => ({ text: b.textContent.trim() || b.getAttribute('aria-label'), h: Math.round(b.getBoundingClientRect().height) }))
      .filter((b) => b.h < 64),
  );
  for (const b of short) fail('targets', where, `"${b.text}" is ${b.h} px high`);

  const danger = await page.evaluate((d) =>
    [...document.querySelectorAll('*')].some((n) => {
      const cs = getComputedStyle(n);
      return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke, cs.outlineColor].includes(d);
    }), DANGER);
  if (danger) fail('danger', where, 'colors.feedback.danger is drawn');

  const text = await page.evaluate(() => {
    const roots = [...document.querySelectorAll('.qlr-frame, .sample')];
    return roots
      .map((r) => {
        const c = r.cloneNode(true);
        c.querySelectorAll('.unchanged, [aria-hidden="true"], script, style').forEach((n) => n.remove());
        const spoken = [...r.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ');
        return `${c.textContent} ${spoken}`;
      })
      .join('\n');
  });
  if (/\p{Extended_Pictographic}/u.test(text)) fail('words', where, 'an emoji is drawn');
  for (const word of [...BANNED.en.learner, ...BANNED.en.caregiver]) {
    if (new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(text)) fail('words', where, `banned word "${word}"`);
  }
  return text;
}

async function sheets(page, where) {
  const found = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet')].map((s) => {
      const ids = `${s.getAttribute('aria-labelledby') ?? ''} ${s.getAttribute('aria-describedby') ?? ''}`.trim().split(/\s+/);
      const btns = [...s.querySelectorAll('button')];
      const host = s.closest('.frame-host, .qlr-frame');
      const behind = host?.querySelector('.qlr-behind');
      return {
        role: s.getAttribute('role'),
        modal: s.getAttribute('aria-modal'),
        missing: ids.filter((id) => !document.getElementById(id)),
        rings: btns.filter((b) => b.classList.contains('focus-ring')).length,
        first: btns[0]?.classList.contains('focus-ring') ?? false,
        inert: !!behind && behind.hasAttribute('inert'),
      };
    }),
  );
  found.forEach((s, i) => {
    const at = `${where} sheet ${i + 1}`;
    if (s.role !== 'alertdialog' || s.modal !== 'true') fail('sheet', at, 'not a modal alertdialog');
    if (s.missing.length) fail('sheet', at, `missing ids ${s.missing.join(', ')}`);
    if (s.rings !== 1 || !s.first) fail('sheet', at, 'the safe choice is not the one focused button');
    if (!s.inert) fail('sheet', at, 'the screen behind is not inert');
  });
}

async function frameChecks(page, where, file, text) {
  if (/^(check|stage-check|save-failed|result)/.test(file)) {
    if (/%|\b\d+\s+(of|\/)\s+\d+\b/.test(text)) fail('no-count', where, 'a percent or an "n of m" is drawn');
  }
  if (file === 'save-failed-stuck') {
    // README D4: when the still-stuck line fills, the body scrolls to its end, so the line is in view above the footer.
    const out = await page.evaluate(() => {
      const body = document.querySelector('.qlr-failed-body');
      body.scrollTop = body.scrollHeight;
      return Math.round(document.querySelector('.qlr-stuck').getBoundingClientRect().bottom - body.getBoundingClientRect().bottom);
    });
    if (out > 1) fail('in-view', where, `the still-stuck line is ${out} px below the scrolled body`);
  }
  if (file.startsWith('save-failed')) {
    const out = await page.evaluate(() => {
      const b = document.querySelector('.qlr-foot .rn-btn').getBoundingClientRect();
      return Math.round(b.bottom - window.innerHeight);
    });
    if (out > 0) fail('in-view', where, `Try again ends ${out} px below the window`);
  }
  const unreachable = await page.evaluate(() => {
    const s = document.querySelector('.sheet');
    if (!s) return null;
    s.scrollTop = s.scrollHeight;
    const last = [...s.querySelectorAll('button')].pop().getBoundingClientRect();
    return last.bottom > window.innerHeight + 1 ? Math.round(last.bottom - window.innerHeight) : null;
  });
  if (unreachable !== null) fail('in-view', where, `the sheet's last button is ${unreachable} px out of reach`);
}

const browser = await chromium.launch();
const heroTop = {};
try {
  for (const file of FRAMES) {
    for (const v of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(join(MOCK, 'frames', file)).href);
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
      if (v.text) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const name = file.replace('.html', '');
      const where = `${name} ${v.tag}`;
      const text = await common(page, where);
      await sheets(page, where);
      await frameChecks(page, where, name, text);
      if (name === 'home-resume' || name === 'home-plain') {
        heroTop[`${name} ${v.tag}`] = await page.evaluate(() => Math.round(document.querySelector('.qlr-hero .rn-hero').getBoundingClientRect().top));
      }
      if (SHOOT) {
        await page.screenshot({ path: join(SHOTS, `${name}-${v.tag}.png`) });
        // At 200 % text, also the whole page, so what is below the first screen is seen.
        if (v.text) await page.screenshot({ path: join(SHOTS, `${name}-${v.tag}-full.png`), fullPage: true });
      }
      await ctx.close();
    }
  }
  for (const v of VIEWPORTS) {
    const a = heroTop[`home-resume ${v.tag}`];
    const b = heroTop[`home-plain ${v.tag}`];
    if (a !== b) fail('button', v.tag, `the hero button is at ${a} with the resume parts and ${b} without`);
  }
  for (const file of BOARDS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(join(MOCK, file)).href);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
    const where = `${file} 1280`;
    await common(page, where);
    await sheets(page, where);
    if (SHOOT) await page.screenshot({ path: join(SHOTS, `board-${file.replace('.html', '')}-1280.png`), fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`all checks passed (${FRAMES.length} frames x ${VIEWPORTS.length} sizes, ${BOARDS.length} boards)${SHOOT ? '; shots written' : ''}`);
