#!/usr/bin/env node
// DP-0b (docs/specs/AMENDMENTS-DURABLE-PROGRESS.md section 5): shots and checks of this design pass's mocks. A design
// tool (not shipped, not run by CI). It opens every mock page in Chromium from disk, writes the shots and exits 1
// when a check fails, so a mock change that breaks a rule is seen before the shots are committed.
//
//   node design/screens/system/progress-read-failed/tools/capture.mjs            # checks and shots
//   node design/screens/system/progress-read-failed/tools/capture.mjs --no-shots # checks only
//
// Playwright comes from apps/web (as route-blend/tools/capture.mjs); set NODE_PATH to a checkout's
// apps/web/node_modules when this worktree has no install.
//
// Checks (each one names the rule it holds):
//   sideways   no page scrolls sideways (F-LAYOUT-001)
//   targets    every drawn button is at least touchTarget.min (64) high (CLAUDE.md section 1, component-skill)
//   danger     no drawn colour is colors.feedback.danger (anti-shame rules; wireframe Rules)
//   words      no emoji and no banned word (packages/i18n/src/banned-words.json) in drawn text or accessible names
//   in-view    in every fixed 320 x 568 frame the footer ends inside the frame and, with the body scrolled to its end,
//              the still-stuck line is in view (spec 3.5; README D3)
//   focus      every drawn sheet has exactly one focused-looking button, and it is the first (Not now)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../../..');
const MOCK = resolve(here, '../mock');
const SHOTS = resolve(here, '../shots');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const SHOOT = !process.argv.includes('--no-shots');
const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
const DANGER = 'rgb(200, 75, 61)'; // colors.feedback.danger #C84B3D, read only to check it is never drawn

const SHOTS_OF = [
  { file: 'screen.html', widths: [1280, 390] },
  { file: 'sheet.html', widths: [1280, 390] },
  { file: 'save-lines.html', widths: [1280, 390] },
  { file: 'lengths.html', widths: [1280, 320] },
];

const failures = [];
const fail = (rule, where, detail) => failures.push(`${rule} · ${where} · ${detail}`);

async function check(page, where) {
  // D3: once the still-stuck line fills, the body scrolls to its end, so the line is in view above the pinned footer.
  await page.evaluate(() => document.querySelectorAll('.prf-screen.fixed .prf-body').forEach((b) => { b.scrollTop = b.scrollHeight; }));
  const outside = await page.evaluate(() =>
    [...document.querySelectorAll('.prf-screen.fixed')].map((f) => {
      const frame = f.getBoundingClientRect();
      const foot = f.querySelector('.prf-foot').getBoundingClientRect();
      const stuck = f.querySelector('.prf-stuck').getBoundingClientRect();
      const body = f.querySelector('.prf-body').getBoundingClientRect();
      return { lang: f.lang, footOut: foot.bottom - frame.bottom, stuckOut: stuck.bottom - body.bottom };
    }).filter((r) => r.footOut > 1 || r.stuckOut > 1),
  );
  for (const o of outside) fail('in-view', `${where} ${o.lang}`, `footer ${o.footOut} px / still-stuck line ${o.stuckOut} px out of view`);
  const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);

  const short = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role="button"]')]
      .filter((b) => !b.closest('.board-label, .board-title, .annot, .unchanged'))
      .map((b) => ({ text: b.textContent.trim(), h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 64),
  );
  for (const b of short) fail('targets', where, `"${b.text}" is ${b.h} px high`);

  const danger = await page.evaluate((d) =>
    [...document.querySelectorAll('*')].some((n) => {
      const cs = getComputedStyle(n);
      return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.fill, cs.stroke].includes(d);
    }), DANGER);
  if (danger) fail('danger', where, 'colors.feedback.danger is drawn');

  for (const lang of ['en', 'es', 'ko']) {
    const text = await page.evaluate((l) => {
      const scope = [...document.querySelectorAll(`[lang="${l}"]`)].filter((n) => n !== document.documentElement);
      const roots = scope.length > 0 ? scope : l === 'en' ? [document.body] : [];
      return roots
        .map((r) => {
          const c = r.cloneNode(true);
          c.querySelectorAll('.board-label, .board-title, .annot, .unchanged, .draft, [aria-hidden="true"], script, style').forEach((n) => n.remove());
          const spoken = [...r.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ');
          return `${c.textContent} ${spoken}`;
        })
        .join('\n');
    }, lang);
    if (/\p{Extended_Pictographic}/u.test(text)) fail('words', `${where} ${lang}`, 'an emoji is drawn');
    for (const word of [...BANNED[lang].learner, ...BANNED[lang].caregiver]) {
      const re = lang === 'ko' ? new RegExp(word, 'u') : new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu');
      if (re.test(text)) fail('words', `${where} ${lang}`, `"${word}" is drawn`);
    }
  }

  const focus = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet')].map((s) => {
      const btns = [...s.querySelectorAll('button')];
      return { rings: btns.filter((b) => b.classList.contains('focus-ring')).length, first: btns[0]?.classList.contains('focus-ring') };
    }),
  );
  focus.forEach((f, i) => {
    if (f.rings !== 1 || !f.first) fail('focus', where, `sheet ${i + 1}: the safe choice is not the one focused button`);
  });
}

const browser = await chromium.launch();
try {
  for (const { file, widths } of SHOTS_OF) {
    for (const width of widths) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(join(MOCK, file)).href);
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
      const where = `${file} @${width}`;
      await check(page, where);
      if (SHOOT) await page.screenshot({ path: join(SHOTS, `${file.replace('.html', '')}-${width}.png`), fullPage: true });
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
