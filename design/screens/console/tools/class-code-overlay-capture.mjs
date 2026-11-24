#!/usr/bin/env node
// CO-0 (docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md section 5): checks and shots of this design pass's mocks. A design
// tool (not shipped, not run by CI). It opens every mock page in Chromium from disk, writes the shots and exits 1 when
// a check fails, so a mock change that breaks a rule is seen before the shots are committed.
//
//   node design/screens/console/tools/class-code-overlay-capture.mjs              # checks and shots
//   node design/screens/console/tools/class-code-overlay-capture.mjs --no-shots   # checks only
//
// Playwright and jsQR come from apps/web's install (`pnpm install` and a Playwright Chromium), as
// design/screens/system/progress-read-failed/tools/capture.mjs; in a worktree with no install of its own, point
// NODE_PATH at a checkout's apps/web/node_modules.
//
// Checks (each names the rule it holds):
//   sideways   no page and no overlay scrolls sideways (F-LAYOUT-001)
//   targets    every drawn button and button-link is at least touchTarget.min (64) high (CLAUDE.md section 1)
//   danger     no drawn colour is colors.feedback.danger (anti-shame rules)
//   words      no emoji and no banned word (packages/i18n/src/banned-words.json, learner and caregiver) in drawn text
//   dialog     role=dialog, aria-modal, and every aria-labelledby / aria-describedby id exists (spec 3.3)
//   inert      the class page behind the overlay is inert (spec 3.3)
//   covered    every point of a 12 x 8 grid over the window hits the overlay: nothing of the page shows (spec 3.2)
//   no-learner the overlay's text and attribute values hold no learner name, initial, jamo or word of the page (spec 3.2)
//   one-line   the code is on one line, inside its column and the window, in Menlo and in the Courier New fallback
//   first      on landscape windows (16:9 and 4:3 projectors, and both zoomed to 150 % and 200 %) the code and the whole
//              QR are in the first screen, with no scrolling (spec 3.4)
//   qr         the QR is at least 256 px wide (or, on a short landscape window, as tall as the window allows) and reads
//              back, with jsQR, as the join link (spec 3.5)
//   print      printed (print media), the page holds no learner name, jamo or card line: only the overlay prints (3.3)
//   keyboard   on the class page mock: Enter on Show the code opens the overlay with focus on the class name and the
//              page inert; Tab stays on Close; Escape and Close close it and focus Show the code; opening closes every
//              open card (spec 3.3, 3.7)
//   folded     on the class page no card's What to revisit body is shown and no card shows jamo (spec 3.7)
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
const JSQR = require.resolve('jsqr');

const SHOOT = !process.argv.includes('--no-shots');
const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
const DANGER = 'rgb(200, 75, 61)'; // colors.feedback.danger #C84B3D, read only to check it is never drawn

// Browser zoom shrinks the window in CSS px: 1024 x 768 at 150 % is 683 x 512, 1280 x 720 at 200 % is 640 x 360.
// `qrMin`: the height-capped QR of a short landscape window (spec 3.4: 360 - gutters - Close row - gaps - 3 caption lines).
const OVERLAY = [
  { w: 1920, h: 1080, first: true },
  { w: 1280, h: 720, first: true },
  { w: 1024, h: 768, first: true },
  { w: 683, h: 512, first: true, note: '1024x768 at 150 % zoom' },
  { w: 640, h: 360, first: true, qrMin: 150, note: '1280x720 at 200 % zoom' },
  { w: 768, h: 1024 },
  { w: 360, h: 740 },
  { w: 320, h: 568, text: 2, end: true },
];
// The fallback a Windows or ChromeOS school PC draws `typography.family.mono` ('Menlo, Courier, monospace') in.
const COURIER = '.co-code { font-family: "Courier New", Courier, monospace !important; }';
const RUNS = [
  ...OVERLAY.map((v) => ({ file: 'class-code-overlay.html', ...v, overlay: true, shot: `class-code-overlay-${v.w}x${v.h}${v.text ? '-text200' : ''}` })),
  { file: 'class-code-overlay.html', w: 1280, h: 720, first: true, overlay: true, style: COURIER, shot: 'class-code-overlay-1280x720-courier' },
  { file: 'class-code-overlay.html', w: 1280, h: 720, print: true, shot: 'class-code-overlay-print' },
  { file: 'class-code-overlay-page.html', w: 1280, h: 800, keyboard: true },
  { file: 'class-code-overlay-page.html', w: 1280, h: 800, full: true, page: true, shot: 'class-code-overlay-page-1280' },
  { file: 'class-code-overlay-page.html', w: 360, h: 740, full: true, page: true, shot: 'class-code-overlay-page-360' },
  { file: 'class-code-overlay-cards.html', w: 1280, h: 800, full: true, shot: 'class-code-overlay-cards-1280' },
  { file: 'class-code-overlay-cards.html', w: 360, h: 740, full: true, shot: 'class-code-overlay-cards-360' },
];

const failures = [];
const fail = (rule, where, detail) => failures.push(`${rule} · ${where} · ${detail}`);

async function common(page, where) {
  const sideways = await page.evaluate(() => {
    const doc = document.scrollingElement.scrollWidth - window.innerWidth;
    const o = document.querySelector('.co-overlay');
    return Math.max(doc, o ? o.scrollWidth - o.clientWidth : 0);
  });
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);

  const short = await page.evaluate(() =>
    [...document.querySelectorAll('button, a.btn, a.text-link, [role="button"]')]
      .filter((b) => !b.closest('[inert]') && b.getClientRects().length > 0)
      .map((b) => ({ text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) }))
      .filter((b) => b.h < 64),
  );
  for (const b of short) fail('targets', where, `"${b.text}" is ${b.h} px high`);

  const danger = await page.evaluate((d) => [...document.querySelectorAll('*')].some((n) => {
    const cs = getComputedStyle(n);
    return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke].includes(d);
  }), DANGER);
  if (danger) fail('danger', where, 'colors.feedback.danger is drawn');

  const text = await page.evaluate(() => document.body.innerText);
  if (/\p{Extended_Pictographic}/u.test(text)) fail('words', where, 'an emoji is drawn');
  for (const word of [...BANNED.en.learner, ...BANNED.en.caregiver]) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) fail('words', where, `banned word "${word}"`);
  }
}

async function overlayChecks(page, where, run) {
  const dialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return 'no dialog';
    if (d.getAttribute('aria-modal') !== 'true') return 'not aria-modal';
    const ids = `${d.getAttribute('aria-labelledby') ?? ''} ${d.getAttribute('aria-describedby') ?? ''}`.trim().split(/\s+/);
    const missing = ids.filter((id) => !document.getElementById(id));
    return missing.length ? `missing ids ${missing.join(', ')}` : null;
  });
  if (dialog) fail('dialog', where, dialog);

  const inert = await page.evaluate(() => {
    const p = document.querySelector('[data-co="page"]');
    return !!p && p.closest('[inert]') !== null;
  });
  if (!inert) fail('inert', where, 'the class page behind is not inert');

  const uncovered = await page.evaluate(() => {
    const o = document.querySelector('.co-overlay');
    const misses = [];
    for (let i = 0; i < 12; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const x = Math.round(((i + 0.5) / 12) * window.innerWidth);
        const y = Math.round(((j + 0.5) / 8) * window.innerHeight);
        const hit = document.elementFromPoint(x, y);
        if (!hit || !o.contains(hit)) misses.push(`${x},${y}`);
      }
    }
    return misses;
  });
  if (uncovered.length) fail('covered', where, `${uncovered.length} points show the page (${uncovered.slice(0, 3).join(' ')})`);

  const leak = await page.evaluate(() => {
    const p = document.querySelector('[data-co="page"]');
    const o = document.querySelector('.co-overlay');
    const names = [...p.querySelectorAll('.student-name')].map((n) => n.textContent.trim());
    const initials = names.map((n) => `${n.charAt(0)}.`);
    const korean = [...p.querySelectorAll('[lang="ko"]')].flatMap((n) => n.textContent.split(/[\s·]+/)).filter(Boolean);
    const lines = [...p.querySelectorAll('.student .line, .fold-body')].map((n) => n.textContent.trim()).filter(Boolean);
    const attrs = [...o.querySelectorAll('*')].flatMap((n) => [...n.attributes].filter((a) => !['class', 'id', 'd', 'viewBox', 'shape-rendering', 'data-link', 'data-testid', 'data-co', 'type', 'tabindex', 'role', 'aria-modal', 'aria-hidden', 'aria-labelledby', 'aria-describedby', 'width', 'height'].includes(a.name)).map((a) => a.value));
    const shown = `${o.innerText}\n${o.textContent}\n${attrs.join('\n')}`;
    const words = shown.split(/[\s·,.:“”"()]+/).filter(Boolean);
    return [
      ...names.filter((n) => words.includes(n)).map((n) => `name ${n}`),
      ...initials.filter((n) => shown.includes(n)).map((n) => `initial ${n}`),
      ...korean.filter((k) => shown.includes(k)).map((k) => `Korean ${k}`),
      ...lines.filter((l) => shown.includes(l)).map((l) => `line "${l}"`),
    ];
  });
  for (const l of leak) fail('no-learner', where, l);

  const fit = await page.evaluate(() => {
    const code = document.querySelector('.co-code');
    const box = code.getBoundingClientRect();
    const col = code.parentElement.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(code);
    const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    return { lines, right: Math.round(range.getBoundingClientRect().right - Math.min(col.right, window.innerWidth)), fontSize: getComputedStyle(code).fontSize, bottom: box.bottom };
  });
  if (fit.lines !== 1) fail('one-line', where, `the code takes ${fit.lines} lines`);
  if (fit.right > 1) fail('one-line', where, `the code runs ${fit.right} px past its column`);

  if (run.first) {
    const out = await page.evaluate(() => {
      const qr = document.querySelector('.co-qr svg').getBoundingClientRect();
      const code = document.querySelector('.co-code').getBoundingClientRect();
      return { qr: Math.round(qr.bottom - window.innerHeight), code: Math.round(code.bottom - window.innerHeight) };
    });
    if (out.qr > 0 || out.code > 0) fail('first', where, `below the first screen: QR ${out.qr} px, code ${out.code} px`);
  }

  await page.addScriptTag({ path: JSQR });
  const qr = await page.evaluate(async () => {
    const svg = document.querySelector('.co-qr svg');
    const width = Math.round(svg.getBoundingClientRect().width);
    // Serialize with the drawn (computed) colours, so the check reads what the page paints.
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.querySelector('rect').setAttribute('fill', getComputedStyle(svg.querySelector('rect')).fill);
    clone.querySelector('path').setAttribute('fill', getComputedStyle(svg.querySelector('path')).fill);
    const side = 37 * 8;
    clone.setAttribute('width', String(side));
    clone.setAttribute('height', String(side));
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, side, side);
    const data = ctx.getImageData(0, 0, side, side);
    const read = window.jsQR(data.data, side, side);
    return { width, read: read ? read.data : null, link: svg.dataset.link };
  });
  if (qr.width < (run.qrMin ?? 256)) fail('qr', where, `the QR is ${qr.width} px wide`);
  if (qr.read !== qr.link) fail('qr', where, `the QR reads "${qr.read}", not the join link`);
  return { fontSize: fit.fontSize, qrWidth: qr.width };
}

async function pageChecks(page, where) {
  const shown = await page.evaluate(() => {
    const seen = (n) => n.checkVisibility();
    return {
      bodies: [...document.querySelectorAll('.fold-body')].filter(seen).length,
      jamo: [...document.querySelectorAll('.student [lang="ko"]')].filter(seen).length,
      toggles: document.querySelectorAll('.student .fold-toggle').length,
      withSummary: [...document.querySelectorAll('.student')].filter((s) => !s.querySelector('.reason')).length,
    };
  });
  if (shown.bodies || shown.jamo) fail('folded', where, `${shown.bodies} open bodies, ${shown.jamo} Korean runs shown on the cards`);
  if (shown.toggles !== shown.withSummary) fail('folded', where, `${shown.toggles} buttons for ${shown.withSummary} cards with a summary`);
}

/** Printed, only the overlay is on the page: no learner name, Korean of a card, or card line (spec 3.3). */
async function printChecks(page, where) {
  await page.emulateMedia({ media: 'print' });
  const leak = await page.evaluate(() => {
    const p = document.querySelector('[data-co="page"]');
    const names = [...p.querySelectorAll('.student-name')].map((n) => n.textContent.trim());
    const korean = [...p.querySelectorAll('[lang="ko"]')].flatMap((n) => n.textContent.split(/[\s·]+/)).filter(Boolean);
    const lines = [...p.querySelectorAll('.student .line')].map((n) => n.textContent.trim()).filter(Boolean);
    const printed = document.body.innerText;
    const words = printed.split(/[\s·,.:“”"()]+/).filter(Boolean);
    return {
      hits: [...names.filter((n) => words.includes(n)), ...korean.filter((k) => printed.includes(k)), ...lines.filter((l) => printed.includes(l))],
      code: printed.includes('SUN234'),
    };
  });
  for (const hit of leak.hits) fail('print', where, `prints "${hit}"`);
  if (!leak.code) fail('print', where, 'the code is not printed');
}

/** The class page mock's behaviour with the keyboard (spec 3.3, 3.7). */
async function keyboardChecks(page, where) {
  const state = () =>
    page.evaluate(() => ({
      open: !document.querySelector('.co-overlay').hidden,
      focus: document.activeElement?.dataset?.co ?? document.activeElement?.className ?? document.activeElement?.tagName,
      inert: document.querySelector('[data-co="page"]').inert,
      locked: document.documentElement.classList.contains('co-open'),
      folds: [...document.querySelectorAll('.fold-body')].filter((b) => !b.hidden).length,
    }));
  await page.locator('.fold-toggle').first().click();
  if ((await state()).folds !== 1) fail('keyboard', where, 'a card did not open');
  await page.locator('[data-co="open"]').focus();
  await page.keyboard.press('Enter');
  let s = await state();
  if (!s.open || s.focus !== 'co-name' || !s.inert || !s.locked) fail('keyboard', where, `after Enter: ${JSON.stringify(s)}`);
  if (s.folds !== 0) fail('keyboard', where, 'Show the code left a card open');
  await page.keyboard.press('Tab');
  if ((await state()).focus !== 'close') fail('keyboard', where, 'Tab did not go to Close');
  await page.keyboard.press('Tab');
  if ((await state()).focus !== 'close') fail('keyboard', where, 'Tab left Close');
  await page.keyboard.press('Escape');
  s = await state();
  if (s.open || s.focus !== 'open' || s.inert || s.locked) fail('keyboard', where, `after Escape: ${JSON.stringify(s)}`);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  s = await state();
  if (s.open || s.focus !== 'open') fail('keyboard', where, `after Close: ${JSON.stringify(s)}`);
}

const browser = await chromium.launch();
const measured = [];
try {
  for (const run of RUNS) {
    const where = `${run.file} ${run.w}x${run.h}${run.text ? ' text200' : ''}${run.print ? ' print' : ''}${run.keyboard ? ' keyboard' : ''}`;
    const context = await browser.newContext({ viewport: { width: run.w, height: run.h }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(pathToFileURL(join(MOCK, run.file)).href);
    if (run.text) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    if (run.style) await page.addStyleTag({ content: run.style });
    await page.evaluate(() => document.fonts.ready);
    if (run.print) await printChecks(page, where);
    else await common(page, where);
    if (run.overlay) measured.push({ where: `${where}${run.style ? ' Courier New' : ''}${run.note ? ` (${run.note})` : ''}`, ...(await overlayChecks(page, where, run)) });
    if (run.page) await pageChecks(page, where);
    if (run.keyboard) await keyboardChecks(page, where);
    if (SHOOT && run.shot) {
      await page.screenshot({ path: join(SHOTS, `${run.shot}.png`), fullPage: !!run.full });
      if (run.end) {
        await page.evaluate(() => {
          const o = document.querySelector('.co-overlay');
          o.scrollTop = o.scrollHeight;
        });
        await page.screenshot({ path: join(SHOTS, `${run.shot}-end.png`) });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

for (const m of measured) console.log(`measured · ${m.where} · code ${m.fontSize} · QR ${m.qrWidth} px`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ok · ${RUNS.length} renders, no finding${SHOOT ? `; shots in ${SHOTS}` : ''}`);
