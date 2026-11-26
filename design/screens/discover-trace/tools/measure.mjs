// TC-0b (docs/specs/AMENDMENTS-STAGE1-TRACE-COVERAGE.md section 3.4): measures the trace page mock at the spec's sizes.
// A design tool (not shipped, not run by CI). Playwright comes from apps/web's install, as the other design-pass tools
// (design/screens/quest-leave-resume/tools/capture.mjs); in a worktree with no install of its own it falls back to the
// main checkout's apps/web.
//
//   node design/screens/discover-trace/tools/measure.mjs --matrix   # every arrangement at every size (the search)
//   node design/screens/discover-trace/tools/measure.mjs            # the chosen arrangement per size + checks + shots
//
// For each frame it reads, inside the device box: the canvas side and whether it is wholly on screen, Continue and
// Previous on screen, Hoya's strip on screen, every control button on screen without scrolling (TraceControls), and no
// sideways overflow. "fits" = canvas >= 160 and on screen, Continue on screen (the spec's acceptance); "all" = fits and
// the strip, the band and every control are on screen too.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { frame, page, Q1, Q7, Q8, PORTRAIT, SPEC_ONLY, LANDSCAPE } from './frames.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../..');
const MOCK = resolve(here, '../mock');
const MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
const webPkg = [join(REPO, 'apps/web/package.json'), resolve(REPO, '../../../apps/web/package.json')].find((p) => existsSync(join(dirname(p), 'node_modules/@playwright/test')));
const require = createRequire(webPkg);
const { chromium } = require('@playwright/test');
const CSS = readFileSync(join(MOCK, 'discover-trace.css'), 'utf8');

export const SIZES = [
  { w: 320, h: 568, tag: '320x568' },
  { w: 375, h: 553, tag: '375x553' },
  { w: 375, h: 667, tag: '375x667' },
  { w: 844, h: 390, tag: '844x390', side: true },
  { w: 390, h: 844, tag: '390x844' },
  { w: 768, h: 1024, tag: '768x1024' },
  { w: 1180, h: 820, tag: '1180x820', side: true },
  { w: 390, h: 844, ts: 'ts-largest', tag: '390x844-largest' },
  { w: 320, h: 568, ts: 'ts-largest', tag: '320x568-largest' },
  { w: 390, h: 844, ts: 'ts-200', tag: '390x844-200' },
  // Not in layout.spec.ts: smaller landscape phones, to check the side trigger (traceLayoutMode on the content box).
  { w: 667, h: 375, tag: '667x375', side: true },
  { w: 640, h: 360, tag: '640x360', side: true },
];

export async function measureFrame(browser, size, opts) {
  const p = await browser.newPage({ viewport: { width: Math.max(size.w + 40, 400), height: size.h + 40 } });
  const html = page({ title: 'measure', ts: size.ts, comment: 'measure', body: `<div style="padding: 0">${frame({ w: size.w, h: size.h, ...opts })}</div>` }).replace('<link rel="stylesheet" href="discover-trace.css">', `<style>${CSS}</style>`);
  await p.setContent(html);
  const r = await p.evaluate(() => {
    const dev = document.querySelector('.device').getBoundingClientRect();
    const inDev = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return b.top >= dev.top - 0.5 && b.bottom <= dev.bottom + 0.5 && b.left >= dev.left - 0.5 && b.right <= dev.right + 0.5 && b.height > 0;
    };
    const canvas = document.querySelector('.canvas');
    const cb = canvas.getBoundingClientRect();
    const controls = document.querySelector('[data-part="controls"]');
    const ctrlButtons = [...document.querySelectorAll('.controls .btn, .helpers .btn')].filter((b) => getComputedStyle(b).display !== 'none' && b.offsetParent !== null);
    const cvis = (b) => {
      const bb = b.getBoundingClientRect();
      const box = b.closest('.controls')?.getBoundingClientRect() ?? bb;
      return inDev(b) && bb.top >= box.top - 0.5 && bb.bottom <= box.bottom + 0.5;
    };
    const scr = document.querySelector('.scr');
    const band = [...document.querySelectorAll('.band .lbl, .band .chip, .band .heading, .band .final-line')].filter((e) => e.offsetParent !== null);
    const cont = document.querySelector('[data-part="continue"]');
    const sb = document.querySelector('.slot').getBoundingClientRect();
    const free = cb.top >= sb.top - 0.5 && cb.bottom <= sb.bottom + 0.5 && cb.left >= sb.left - 0.5 && cb.right <= sb.right + 0.5;
    return {
      canvas: Math.round(cb.width),
      slot: `${Math.round(sb.width)}x${Math.round(sb.height)}`,
      free,
      canvasIn: inDev(canvas),
      cont: inDev(cont),
      prev: inDev(document.querySelector('.prev')),
      contBottom: Math.round(cont.getBoundingClientRect().bottom - dev.top),
      strip: inDev(document.querySelector('.strip')),
      band: band.every(inDev),
      controls: ctrlButtons.every(cvis),
      hidden: ctrlButtons.filter((b) => !cvis(b)).map((b) => b.textContent.trim()),
      rows: new Set(ctrlButtons.filter((b) => b.closest('.controls')).map((b) => Math.round(b.getBoundingClientRect().top))).size,
      sideways: scr.scrollWidth > scr.clientWidth + 0.5,
      hdr: (() => { const h = document.querySelector('.hdr'); const m = h.querySelector('.hdr-mid'); return m ? m.scrollWidth <= m.clientWidth + 0.5 && h.getBoundingClientRect().height < 70 : true; })(),
      overflow: Math.round(Math.max(0, document.querySelector('.ds').scrollHeight - document.querySelector('.ds').clientHeight)),
    };
  });
  await p.close();
  r.fits = r.canvas >= 160 && r.canvasIn && r.free && r.hdr && r.cont && r.prev && !r.sideways;
  r.all = r.fits && r.strip && r.band && r.controls;
  return r;
}

// The states every arrangement must hold (the tallest lines and parts of spec 3.3).
export const STATES = {
  idle: { letters: Q1, at: 0, line: 'idle' },
  praise: { letters: Q1, at: 0, done: [0], ink: 'full', look: 'pass', line: 'praise', beat: true },
  keepGoing: { letters: Q1, at: 2, done: [0], ink: 'part', line: 'keepGoing' },
  status: { letters: Q1, at: 2, done: [0], line: 'status' },
  final: { letters: Q7, at: 0, line: 'idle' },
  q8vowel: { letters: Q8, at: 0, line: 'idle' },
  q8final: { letters: Q8, at: 3, done: [0, 1, 2], line: 'praise', ink: 'full', look: 'pass' },
};
/** traceSidePanelWidth (logic/trace-layout.ts) of the content width. */
export const sidePanel = (contentW) => Math.max(240, Math.min(380, Math.floor(contentW * 0.45)));
export const contentWidth = (w) => Math.min(w - 2 * (w >= 900 ? 32 : w >= 600 ? 24 : 16), 720);
export const arrangementsFor = (size) => (size.side ? LANDSCAPE : [...PORTRAIT.slice(0, 1), ...SPEC_ONLY, ...PORTRAIT.slice(1)]);
/** The ladder the app walks (the spec-only rows are measured for the record, never chosen). */
export const ladderFor = (size) => (size.side ? LANDSCAPE : PORTRAIT);
/** The pages the states belong to: the arrangement is chosen per page, so it holds for all of a page's letters. */
export const PAGES = { 'quest 1 (4 letters)': ['idle', 'praise', 'keepGoing', 'status'], 'quest 7 (2 finals)': ['final'], 'quest 8 (3 letters, a final)': ['q8vowel', 'q8final'] };

export async function measureSize(browser, size) {
  const rows = [];
  for (const arr of arrangementsFor(size)) {
    const per = {};
    for (const [name, st] of Object.entries(STATES)) {
      per[name] = await measureFrame(browser, size, { ...st, arr, sideCol: sidePanel(contentWidth(size.w)), roomy: arr === 'full' && size.h - 2 * 16 >= 700 });
    }
    const all = Object.values(per).every((r) => r.all);
    const fits = Object.values(per).every((r) => r.fits);
    const canvas = Math.min(...Object.values(per).map((r) => r.canvas));
    const why = Object.entries(per).filter(([, r]) => !r.all).map(([n, r]) => `${n}: canvas ${r.canvas} slot ${r.slot}${r.free ? "" : " (overflows its slot)"}${r.cont ? '' : ', Continue off'}${r.hidden.length ? `, hidden ${r.hidden.join('/')}` : ''}${r.strip ? '' : ', strip off'}${r.band ? '' : ', band off'}${r.hdr ? '' : ', header overflows'}${r.sideways ? ', sideways' : ''}`);
    rows.push({ arr, all, fits, canvas, why, per });
  }
  return rows;
}

if (MAIN && process.argv.includes('--matrix')) {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    const rows = await measureSize(browser, size);
    console.log(`\n== ${size.tag}`);
    for (const r of rows) console.log(`${r.arr.padEnd(10)} ${r.all ? 'ALL ' : r.fits ? 'fits' : 'no  '} min canvas ${r.canvas}  ${r.why.join(' | ')}`);
  }
  await browser.close();
}

// ---------------------------------------------------------------------------------------------- the default run
// The chosen arrangement at each size (build.mjs CHOSEN), every state; the checks on every page; the shots.
if (MAIN && !process.argv.includes('--matrix')) {
  const { CHOSEN, build } = await import('./build.mjs');
  const SHOTS = resolve(here, '../shots');
  const SHOOT = !process.argv.includes('--no-shots');
  const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
  const DANGER = 'rgb(200, 75, 61)'; // colors.feedback.danger #C84B3D, read only to check it is never drawn
  const failures = [];
  const browser = await chromium.launch();

  // The measurement table (markdown, pasted into the note): per size and page, the first arrangement of the ladder that
  // holds every state of the page with everything on screen.
  const lines = ['| Size | Text | Page | Arrangement | Canvas | Continue bottom / window |', '|---|---|---|---|---|---|'];
  for (const c of SIZES) {
    const text = c.ts === 'ts-largest' ? 'Largest (1.5)' : c.ts === 'ts-200' ? '200 % (2)' : 'standard';
    for (const [pg, names] of Object.entries(PAGES)) {
      let found = null;
      for (const arr of ladderFor(c)) {
        const rs = [];
        for (const n of names) rs.push(await measureFrame(browser, c, { ...STATES[n], arr, roomy: arr === 'full' && c.h - 32 >= 700, sideCol: sidePanel(contentWidth(c.w)) }));
        if (rs.every((r) => r.all)) { found = { arr, rs }; break; }
      }
      const acceptance = !['320x568-largest', '390x844-200', '667x375', '640x360'].includes(c.tag);
      if (!found) {
        if (acceptance) failures.push(`fit · ${c.tag} · ${pg}`);
        lines.push(`| ${c.w} x ${c.h} | ${text} | ${pg} | none (not an acceptance size): the canvas slot stays under 160 | - | - |`);
        continue;
      }
      const canv = found.rs.map((r) => r.canvas);
      lines.push(`| ${c.w} x ${c.h} | ${text} | ${pg} | ${found.arr} | ${Math.min(...canv) === Math.max(...canv) ? canv[0] : `${Math.min(...canv)}-${Math.max(...canv)}`} | ${Math.max(...found.rs.map((r) => r.contBottom))} / ${c.h} |`);
    }
  }
  console.log(lines.join('\n'));

  // Checks on every page of ../mock (built fresh).
  const pages = build();
  for (const name of Object.keys(pages)) {
    const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await p.goto(pathToFileURL(join(MOCK, name)).href);
    const res = await p.evaluate((danger) => {
      const devices = [...document.querySelectorAll('.device')];
      const short = [];
      for (const d of devices) {
        for (const b of d.querySelectorAll('button')) {
          if (b.getClientRects().length === 0 || getComputedStyle(b).display === 'none') continue;
          const r = b.getBoundingClientRect();
          if (r.height < 64 || r.width < 64) short.push(`${b.textContent.trim() || b.getAttribute('aria-label')} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      const red = devices.some((d) => [d, ...d.querySelectorAll('*')].some((n) => {
        const cs = getComputedStyle(n);
        return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke, cs.outlineColor].includes(danger);
      }));
      const sideways = devices.filter((d) => d.querySelector('.scr').scrollWidth > d.querySelector('.scr').clientWidth + 0.5).length;
      const text = devices.map((d) => `${d.textContent} ${[...d.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ')}`).join('\n');
      return { short, red, sideways, text };
    }, DANGER);
    for (const s of res.short) failures.push(`targets · ${name} · ${s}`);
    if (res.red) failures.push(`danger · ${name} · colors.feedback.danger is drawn`);
    if (res.sideways) failures.push(`sideways · ${name} · ${res.sideways} frame(s)`);
    if (/\p{Extended_Pictographic}/u.test(res.text)) failures.push(`words · ${name} · an emoji is drawn`);
    for (const word of [...BANNED.en.learner, ...BANNED.en.caregiver]) {
      if (new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(res.text)) failures.push(`words · ${name} · banned word "${word}"`);
    }
    if (SHOOT) {
      mkdirSync(SHOTS, { recursive: true });
      await p.screenshot({ path: join(SHOTS, name.replace('.html', '.png')), fullPage: true });
    }
    await p.close();
  }

  // One shot per acceptance size at 2x (the device only).
  if (SHOOT) {
    for (const c of CHOSEN) {
      const p = await browser.newPage({ viewport: { width: c.w + 40, height: c.h + 40 }, deviceScaleFactor: 2 });
      const html = page({ title: c.tag, ts: c.ts, comment: '', body: frame({ w: c.w, h: c.h, arr: c.arr, roomy: c.roomy, sideCol: sidePanel(contentWidth(c.w)), ...STATES.keepGoing }) }).replace('<link rel="stylesheet" href="discover-trace.css">', `<style>${CSS}</style>`);
      await p.setContent(html);
      await p.locator('.device').screenshot({ path: join(SHOTS, `size-${c.tag}.png`) });
      await p.close();
    }
  }
  await browser.close();
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log('\nchecks: fit, targets, danger, sideways, words: all pass');
}
