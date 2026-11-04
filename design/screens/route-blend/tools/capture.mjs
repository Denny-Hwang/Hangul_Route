#!/usr/bin/env node
// BL-D (docs/specs/AMENDMENTS-ROUTE-CLASS-BLEND.md section 16): shots and checks of the route-blend mocks.
// A design tool (not shipped, not run by CI). It opens every mock page in Chromium from disk, in en, es and ko, at
// 320 and 1280 px (and 320 px with the text at 200 %), writes the shots, measures assumptions c and d of the
// amendment's section 17, and checks the words. It exits 1 when a check fails, so a mock change that breaks a
// rule is seen before the shots are committed.
//
//   node design/screens/route-blend/tools/capture.mjs            # checks and shots
//   node design/screens/route-blend/tools/capture.mjs --no-shots # checks only
//
// Checks (each one names the rule it holds):
//   sideways      no page scrolls sideways at any width, language or text size (F-LAYOUT-001)
//   c-1280        the meeting block fits one 1280 x 720 screen in en, es and ko (assumption c)
//   c-320         at 320 px with 200 % text the meeting block is one vertical scroll: nothing sideways, nothing clipped,
//                 no scroll area of its own (assumption c)
//   d-320         the learner weekly plan line fits the Route card column at 320 x 568 in at most 3 lines, for 1-3
//                 practice weekday names and the collapsed forms, in en, es and ko (assumption d)
//   words         no emoji, no banned word (packages/i18n/src/banned-words.json, plus "late" and "behind"), no "lecture"
//                 in any drawn string or accessible name (aria-label, aria-labelledby: the words a screen reader says)
//   counts        no number above 3 on a learner screen, drawn or read aloud (amendment section 13)
//   one-label     no learner row shows two labels with the same words (section 7)
//   tables        every table header cell has a scope (F-PLAN-002 section 3.11)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../..');
const MOCK = resolve(here, '../mock');
const SHOTS = resolve(here, '../shots');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const SHOOT = !process.argv.includes('--no-shots');
const LANGS = ['en', 'es', 'ko'];
const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
const EXTRA_BANNED = { en: ['late', 'behind', 'lecture'], es: ['tarde', 'atrás', 'retraso'], ko: ['늦', '뒤처', '출석'] };

/** Pages, their audience (learner pages carry the count rule) and the states shot besides the default. */
const PAGES = [
  { file: 'wizard-meeting.html', learner: false, states: ['', 'state=change', 'state=split', 'state=zero', 'state=every'], text200: true },
  { file: 'wizard-preview.html', learner: false, states: ['', 'mode=split'], text200: false },
  { file: 'readout.html', learner: false, states: [''], text200: false },
  { file: 'route-line.html', learner: true, states: [''], text200: true },
  { file: 'route-line-board.html', learner: true, states: [''], text200: false },
  { file: 'learner-home.html', learner: true, states: ['', 'day=practice'], text200: true },
  { file: 'profile.html', learner: true, states: ['', 'who=child'], text200: true },
  { file: 'parent.html', learner: false, states: [''], text200: false },
];

/** Assumption d: class days x practice days (JS weekday numbers, 0 = Sunday), 1-3 names and the collapsed forms. */
const LINE_CASES = [
  { name: '1 class, 1 practice', cls: [2], practice: [3] },
  { name: '1 class, 2 practice', cls: [2], practice: [3, 6] },
  { name: '1 class, 3 practice', cls: [2], practice: [3, 5, 0] },
  { name: '2 classes, 3 practice', cls: [1, 4], practice: [2, 5, 6] },
  { name: '2 classes, 3 practice (longest es/ko names)', cls: [3, 6], practice: [4, 0, 1] },
  { name: '1 class, 5 practice (most days)', cls: [2], practice: [3, 4, 5, 6, 0] },
  { name: '1 class, 6 practice on every non-class day (every day)', cls: [2], practice: [3, 4, 5, 6, 0, 1] },
  { name: '2 classes, 4 practice, Sunday free (most days)', cls: [1, 4], practice: [2, 3, 5, 6] },
  { name: '2 classes, 6 practice incl. a class day (every day, longest es/ko names)', cls: [3, 6], practice: [0, 1, 2, 4, 5, 6] },
  { name: '1 class, 6 practice incl. the class day, Wednesday free (every day except, longest es/ko names)', cls: [6], practice: [6, 0, 1, 2, 4, 5] },
  { name: '1 class, 7 practice (every day)', cls: [2], practice: [3, 4, 5, 6, 0, 1, 2] },
  { name: '1 class, 6 practice incl. the class day (every day except)', cls: [2], practice: [2, 3, 4, 5, 6, 0] },
  { name: '2 classes, 5 practice on every non-class day (every day)', cls: [1, 4], practice: [2, 3, 5, 6, 0] },
];

/**
 * The class part has no collapse rule in section 7 (up to 5 names). Measured and recorded, not failed: a finding
 * for BL-7 (README finding 10).
 */
const CLASS_PART_CASES = [
  { name: '3 classes, 3 practice', cls: [1, 3, 5], practice: [2, 4, 6] },
  { name: '3 classes (longest es/ko names), 3 practice', cls: [3, 6, 0], practice: [1, 2, 4] },
  { name: '5 classes, 2 practice', cls: [1, 2, 3, 4, 5], practice: [6, 0] },
  { name: '4 classes, 3 practice', cls: [1, 2, 4, 5], practice: [3, 6, 0] },
];

const failures = [];
const results = { c: [], d: [], dClassPart: [] };
const fail = (rule, where, detail) => failures.push(`${rule} · ${where} · ${detail}`);

const url = (file, query) => `${pathToFileURL(join(MOCK, file)).href}?${query}`;

async function open(browser, width, height, scale, file, query) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(url(file, query));
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
  return { ctx, page };
}

/** The visible text of the page, without the design-board notes. */
const visibleText = (page) =>
  page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('.board-label, .board-title, .board-note, [aria-hidden="true"], [data-choice], script, style, [hidden]').forEach((n) => n.remove());
    return clone.innerText;
  });

/** The accessible names a screen reader says (aria-label, aria-labelledby), without the choice controls. */
const spokenText = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[aria-label], [aria-labelledby]')]
      .filter((n) => !n.closest('[data-choice], [hidden], .board-label, .board-title, .board-note'))
      .map((n) => n.getAttribute('aria-label') ?? (n.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '))
      .join('\n'),
  );

async function checkPage(page, where, learner, lang) {
  const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);
  const text = `${await visibleText(page)}\n${await spokenText(page)}`;
  if (/\p{Extended_Pictographic}/u.test(text)) fail('words', where, 'an emoji is drawn');
  const banned = [...(BANNED[lang]?.learner ?? []), ...(BANNED[lang]?.caregiver ?? []), ...EXTRA_BANNED[lang]];
  for (const word of banned) {
    const re = lang === 'ko' ? new RegExp(word, 'u') : new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu');
    if (re.test(text)) fail('words', where, `"${word}" is drawn`);
  }
  if (learner) {
    for (const n of text.match(/\d+/g) ?? []) if (Number(n) > 3) fail('counts', where, `the number ${n} is on a learner screen`);
    const dupes = await page.evaluate(() =>
      [...document.querySelectorAll('[data-row]')].flatMap((row) => {
        const labels = [...row.querySelectorAll('[data-label]')].map((n) => n.textContent.trim());
        return labels.filter((l, i) => labels.indexOf(l) !== i).map((l) => `${row.dataset.row}: ${l}`);
      }),
    );
    for (const d of dupes) fail('one-label', where, d);
  }
  const noScope = await page.evaluate(() => [...document.querySelectorAll('th:not([scope])')].length);
  if (noScope > 0) fail('tables', where, `${noScope} header cells without scope`);
}

async function shot(page, name) {
  if (!SHOOT) return;
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      for (const lang of LANGS) {
        for (const state of p.states) {
          const tag = state === '' ? '' : `-${state.replace(/[=&]/g, '-')}`;
          const base = p.file.replace(/\.html$/, '');
          const runs = [
            { w: 320, h: 568, scale: 2, text: '', suffix: '320' },
            { w: 1280, h: 720, scale: 1, text: '', suffix: '1280' },
            ...(p.text200 && state === '' ? [{ w: 320, h: 568, scale: 2, text: 'text=200', suffix: '320-text200' }] : []),
          ];
          for (const r of runs) {
            const query = [`lang=${lang}`, state, r.text].filter(Boolean).join('&');
            const where = `${p.file}?${query} @${r.w}`;
            const { ctx, page } = await open(browser, r.w, r.h, r.scale, p.file, query);
            await checkPage(page, where, p.learner, lang);
            if (p.file === 'wizard-meeting.html') await meetingFit(page, where, lang, state, r);
            // Shots: every state in every language at 320; only the default state wide (the checks still run on all).
            if (r.w === 320 || state === '') await shot(page, `${base}${tag}-${lang}-${r.suffix}`);
            await ctx.close();
          }
        }
      }
    }
    await planLineFit(browser);
  } finally {
    await browser.close();
  }
  writeFileSync(join(SHOTS, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`All checks passed. Assumption c: ${results.c.length} measures; assumption d: ${results.d.length} measures.`);
}

/** Assumption c: one 1280 x 720 screen; one scroll at 320 with 200 % text. */
async function meetingFit(page, where, lang, state, r) {
  const m = await page.evaluate(() => {
    const block = document.getElementById('meeting');
    const box = block.getBoundingClientRect();
    const inner = [...block.querySelectorAll('*')];
    const clipped = inner.filter((n) => {
      const b = n.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 0.5 || n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible');
    }).length;
    const scrollers = inner.filter((n) => ['auto', 'scroll'].includes(getComputedStyle(n).overflowY)).length;
    // The stricter reading of "one scroll" (README, open point): how far down the block the decisions end (the
    // mode cards, else the practice row) measured from the block's top.
    const mode = document.getElementById('mode');
    const last = mode && !mode.hidden ? mode : document.getElementById('practice-inline');
    const decisionsEnd = Math.round(last.getBoundingClientRect().bottom - box.top);
    return { top: Math.round(box.top + window.scrollY), height: Math.round(box.height), clipped, scrollers, decisionsEnd };
  });
  results.c.push({ lang, state: state || 'default', width: r.w, text: r.text || '100', ...m, screens: +(m.height / r.h).toFixed(2), decisionsScreens: +(m.decisionsEnd / r.h).toFixed(2) });
  if (r.w === 1280 && m.height > r.h) fail('c-1280', where, `the meeting block is ${m.height} px, taller than ${r.h}`);
  if (r.w === 1280 && state === '' && m.top + m.height > r.h) fail('c-1280', where, `the block ends at ${m.top + m.height} px, below the first ${r.h} px screen`);
  if (m.clipped > 0) fail('c-320', where, `${m.clipped} elements are clipped or overflow`);
  if (m.scrollers > 0) fail('c-320', where, `${m.scrollers} scroll areas inside the block`);
}

/** Assumption d: the weekly plan line at 320 x 568, in at most 3 lines, inside the card column. */
async function planLineFit(browser) {
  for (const lang of LANGS) {
    for (const c of LINE_CASES) {
      const query = `lang=${lang}&class=${c.cls.join(',')}&practice=${c.practice.join(',')}`;
      const where = `route-line.html?${query} @320`;
      const { ctx, page } = await open(browser, 320, 568, 2, 'route-line.html', query);
      await checkPage(page, where, true, lang);
      const m = await page.evaluate(() => {
        const line = document.getElementById('plan-line');
        const card = document.getElementById('route-card').getBoundingClientRect();
        const b = line.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(line).lineHeight);
        return { text: line.textContent, lines: Math.round(b.height / lh), left: b.left - card.left, right: card.right - b.right, bottom: Math.round(b.bottom) };
      });
      results.d.push({ lang, case: c.name, ...m });
      if (m.lines > 3) fail('d-320', where, `${m.lines} lines: "${m.text}"`);
      if (m.left < -0.5 || m.right < -0.5) fail('d-320', where, 'the line is wider than the card column');
      await ctx.close();
    }
    for (const c of CLASS_PART_CASES) {
      const query = `lang=${lang}&class=${c.cls.join(',')}&practice=${c.practice.join(',')}`;
      const { ctx, page } = await open(browser, 320, 568, 2, 'route-line.html', query);
      await checkPage(page, `route-line.html?${query} @320`, true, lang);
      const m = await page.evaluate(() => {
        const line = document.getElementById('plan-line');
        const b = line.getBoundingClientRect();
        return { text: line.textContent, lines: Math.round(b.height / parseFloat(getComputedStyle(line).lineHeight)) };
      });
      results.dClassPart.push({ lang, case: c.name, ...m });
      await ctx.close();
    }
  }
}

await main();
