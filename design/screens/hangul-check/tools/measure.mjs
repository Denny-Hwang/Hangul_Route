// DC-2a (docs/specs/AMENDMENTS-STAGE1-DECODING-CHECK.md section 3.5): measures the decode round mock at the sizes of the
// row, checks every page, and takes the shots. A design tool (not shipped, not run by CI). Playwright comes from
// apps/web's install, as the other design-pass tools (design/screens/discover-trace/tools/measure.mjs); in a worktree
// with no install of its own it falls back to the main checkout's apps/web.
//
//   node design/screens/hangul-check/tools/measure.mjs --matrix   # every arrangement at every size (the search)
//   node design/screens/hangul-check/tools/measure.mjs            # the chosen arrangement per size + checks + shots
//
// For each frame it reads, inside the device box and with nothing scrolled: the header (Stop the check and the dots),
// the round's heading, the syllable panel, the four cards, This one and the help slot (Can't hear it?, or the status
// action), and whether anything runs sideways. "fits" = the syllable, the four cards and This one on screen (the learner
// reads, listens and commits without scrolling); "all" = fits and the heading, the hint or status line (where drawn)
// and the help slot on screen too.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLOSED, frame, LANDSCAPE, OPEN, page, PORTRAIT } from './frames.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../..');
const MOCK = resolve(here, '../mock');
const MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
const webPkg = [join(REPO, 'apps/web/package.json'), resolve(REPO, '../../../apps/web/package.json')].find((p) => existsSync(join(dirname(p), 'node_modules/@playwright/test')));
const require = createRequire(webPkg);
const { chromium } = require('@playwright/test');
const CSS = readFileSync(join(MOCK, 'hangul-check.css'), 'utf8');

/** The row's sizes (320 x 568, 375 x 667, 390 x 844, landscape, Largest), the spec's wide window and 200 % text. */
export const SIZES = [
  { w: 320, h: 568, tag: '320x568' },
  { w: 375, h: 667, tag: '375x667' },
  { w: 390, h: 844, tag: '390x844' },
  { w: 844, h: 390, tag: '844x390', side: true },
  { w: 667, h: 375, tag: '667x375', side: true },
  { w: 768, h: 1024, tag: '768x1024' },
  { w: 1180, h: 820, tag: '1180x820', side: true },
  { w: 390, h: 844, ts: 'ts-largest', tag: '390x844-largest' },
  { w: 375, h: 667, ts: 'ts-largest', tag: '375x667-largest' },
  { w: 320, h: 568, ts: 'ts-largest', tag: '320x568-largest' },
  { w: 390, h: 844, ts: 'ts-200', tag: '390x844-200' },
];
/** Sizes the row asks to fit (the others are recorded). */
export const ACCEPTANCE = new Set(['320x568', '375x667', '390x844', '844x390', '768x1024', '1180x820', '390x844-largest']);

/** The tallest states (spec 3.5): every one must fit in the arrangement a size takes. */
export const STATES = {
  idle: { it: OPEN, done: 0 },
  selected: { it: OPEN, done: 0, sel: 1, playing: 1 },
  missed: { it: OPEN, done: 0, wrong: [1], justMissed: true },
  right: { it: OPEN, done: 0, wrong: [1], right: true, playing: 2 },
  muted: { it: CLOSED, done: 1, text: 'muted' },
  failed: { it: CLOSED, done: 1, text: 'failed', sel: 2 },
  asked: { it: OPEN, done: 0, text: 'asked', sel: 1, playing: 1 },
};

export async function measureFrame(browser, size, opts) {
  const p = await browser.newPage({ viewport: { width: Math.max(size.w + 40, 400), height: size.h + 40 } });
  const html = page({ title: 'measure', ts: size.ts, comment: 'measure', body: frame({ w: size.w, h: size.h, ...opts }) }).replace('<link rel="stylesheet" href="hangul-check.css">', `<style>${CSS}</style>`);
  await p.setContent(html);
  const r = await p.evaluate(() => {
    const dev = document.querySelector('.device').getBoundingClientRect();
    const vis = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const inDev = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return b.top >= dev.top - 0.5 && b.bottom <= dev.bottom - 0.5 && b.left >= dev.left - 0.5 && b.right <= dev.right + 0.5 && b.height > 0;
    };
    // The screen's bottom gutter is part of the window: count the content as on screen only above the gutter.
    const scr = document.querySelector('.scr');
    const pad = parseFloat(getComputedStyle(scr).paddingBottom);
    const lowest = (els) => Math.max(...els.filter(Boolean).map((e) => e.getBoundingClientRect().bottom));
    const above = (el) => el && el.getBoundingClientRect().bottom <= dev.bottom - pad + 0.5;
    const cards = [...document.querySelectorAll('[data-part="target"]')];
    const hint = document.querySelector('.hint');
    const help = document.querySelector('[data-part="help"]');
    const pick = document.querySelector('[data-part="pick"]');
    const panel = document.querySelector('[data-part="panel"]');
    const heading = document.querySelector('.heading');
    const cardH = Math.round(Math.max(...[...document.querySelectorAll('[data-part="card"]')].map((c) => c.getBoundingClientRect().height)));
    const tooNarrow = cards.some((c) => c.scrollWidth > c.clientWidth + 0.5) || [...document.querySelectorAll('.chip')].some((c) => c.scrollWidth > c.clientWidth + 0.5);
    return {
      header: inDev(document.querySelector('.hdr')) && above(document.querySelector('.hdr')),
      heading: inDev(heading) && above(heading),
      hint: vis(hint) ? inDev(hint) && above(hint) : true,
      panel: inDev(panel) && above(panel),
      cards: cards.every((c) => inDev(c) && above(c)),
      pick: inDev(pick) && above(pick),
      help: help ? inDev(help) && above(help) : true,
      pickBottom: Math.round(pick.getBoundingClientRect().bottom - dev.top),
      helpBottom: help ? Math.round(help.getBoundingClientRect().bottom - dev.top) : null,
      cardH,
      sideways: scr.scrollWidth > scr.clientWidth + 0.5 || tooNarrow,
      slack: Math.round(dev.bottom - pad - lowest([pick, help, ...cards, document.querySelector('.pcol .acts')])),
    };
  });
  await p.close();
  r.fits = r.header && r.panel && r.cards && r.pick && !r.sideways;
  // A margin for a device font taller than Chromium's: the lowest control ends at least spacing.sm above the gutter.
  r.all = r.fits && r.heading && r.hint && r.help && r.slack >= MARGIN;
  return r;
}

/** spacing.sm: the least room left under the lowest control for the arrangement to count as fitting. */
export const MARGIN = 8;
export const ladderFor = (size) => (size.side ? LANDSCAPE : PORTRAIT);

/** The first arrangement of the ladder that holds every state with everything on screen (or null). */
export async function chooseFor(browser, size) {
  for (const arr of ladderFor(size)) {
    const rs = {};
    for (const [name, st] of Object.entries(STATES)) rs[name] = await measureFrame(browser, size, { ...st, arr });
    if (Object.values(rs).every((r) => r.all)) return { arr, rs };
  }
  return null;
}

if (MAIN && process.argv.includes('--matrix')) {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    console.log(`\n== ${size.tag}`);
    for (const arr of ladderFor(size)) {
      const per = {};
      for (const [name, st] of Object.entries(STATES)) per[name] = await measureFrame(browser, size, { ...st, arr });
      const all = Object.values(per).every((r) => r.all);
      const fits = Object.values(per).every((r) => r.fits);
      const slack = Math.min(...Object.values(per).map((r) => r.slack));
      const why = Object.entries(per).filter(([, r]) => !r.all).map(([n, r]) => `${n}:${['header', 'heading', 'hint', 'panel', 'cards', 'pick', 'help'].filter((k) => !r[k]).join('/')}${r.sideways ? '/sideways' : ''}`);
      console.log(`${arr.padEnd(11)} ${all ? 'ALL ' : fits ? 'fits' : 'no  '} slack ${String(slack).padStart(4)}  card ${per.idle.cardH}  ${why.join(' ')}`);
    }
  }
  await browser.close();
}

// ---------------------------------------------------------------------------------------------- the default run
if (MAIN && !process.argv.includes('--matrix')) {
  const { CHOSEN, build } = await import('./build.mjs');
  const SHOTS = resolve(here, '../shots');
  const SHOOT = !process.argv.includes('--no-shots');
  const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
  const DANGER = 'rgb(200, 75, 61)'; // colors.feedback.danger #C84B3D, read only to check it is never drawn
  const failures = [];
  const browser = await chromium.launch();

  // The measurement table (markdown, pasted into the note).
  const lines = ['| Size | Text | Arrangement | Card | This one bottom / help bottom / window | Least slack |', '|---|---|---|---|---|---|'];
  for (const c of SIZES) {
    const text = c.ts === 'ts-largest' ? 'Largest (1.5)' : c.ts === 'ts-200' ? '200 % (2)' : 'standard';
    const found = await chooseFor(browser, c);
    const chosen = CHOSEN.find((x) => x.tag === c.tag);
    if (chosen && found && chosen.arr !== found.arr) failures.push(`ladder · ${c.tag} · build.mjs says ${chosen.arr}, measured ${found.arr}`);
    if (!found) {
      if (ACCEPTANCE.has(c.tag)) failures.push(`fit · ${c.tag}`);
      lines.push(`| ${c.w} x ${c.h} | ${text} | none: the screen scrolls (not an acceptance size) | - | - | - |`);
      continue;
    }
    const rs = Object.values(found.rs);
    const pickB = Math.max(...rs.map((r) => r.pickBottom));
    const helpB = Math.max(...rs.map((r) => r.helpBottom ?? 0));
    lines.push(`| ${c.w} x ${c.h} | ${text} | ${found.arr} | ${found.rs.idle.cardH} | ${pickB} / ${helpB} / ${c.h} | ${Math.min(...rs.map((r) => r.slack))} |`);
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
        for (const b of d.querySelectorAll('button, [role="button"]')) {
          if (b.getClientRects().length === 0 || getComputedStyle(b).display === 'none') continue;
          const r = b.getBoundingClientRect();
          if (r.height < 63.5 || r.width < 63.5) short.push(`${b.getAttribute('aria-label') || b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      const red = devices.some((d) => [d, ...d.querySelectorAll('*')].some((n) => {
        const cs = getComputedStyle(n);
        return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke, cs.outlineColor].includes(danger);
      }));
      const sideways = devices.filter((d) => { const s = d.querySelector('.scr'); return s && s.scrollWidth > s.clientWidth + 0.5; }).length;
      // No romanization of an open decode item is drawn before the answer: every visible text node of a frame with no
      // chips and no right answer must not be a romanization of its options (the hold, spec 3.1).
      const leaks = [];
      for (const d of devices) {
        if (!d.querySelector('[data-part="panel"]') || d.querySelector('.chip') || d.querySelector('.card.correct')) continue;
        const roms = [...d.querySelectorAll('[data-part="target"]')].map((c) => c.getAttribute('data-rom')).filter(Boolean);
        const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || el.closest('.visually-hidden') || getComputedStyle(el).visibility === 'hidden' || el.getClientRects().length === 0) continue;
          if (roms.includes(n.textContent.trim())) leaks.push(n.textContent.trim());
        }
      }
      const text = devices.map((d) => `${d.textContent} ${[...d.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ')}`).join('\n');
      return { short, red, sideways, leaks, text };
    }, DANGER);
    for (const s of res.short) failures.push(`targets · ${name} · ${s}`);
    if (res.red) failures.push(`danger · ${name} · colors.feedback.danger is drawn`);
    if (res.sideways) failures.push(`sideways · ${name} · ${res.sideways} frame(s)`);
    for (const l of res.leaks) failures.push(`hold · ${name} · "${l}" is drawn before the answer`);
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

  // One shot per size at 2x (the device only): the selected state, and the missed state at the row's sizes.
  if (SHOOT) {
    for (const c of CHOSEN) {
      for (const [st, tag] of [['selected', ''], ['missed', '-missed']]) {
        if (tag && !ACCEPTANCE.has(c.tag)) continue;
        const p = await browser.newPage({ viewport: { width: c.w + 40, height: c.h + 40 }, deviceScaleFactor: 2 });
        const html = page({ title: c.tag, ts: c.ts, comment: '', body: frame({ w: c.w, h: c.h, arr: c.arr, ...STATES[st] }) }).replace('<link rel="stylesheet" href="hangul-check.css">', `<style>${CSS}</style>`);
        await p.setContent(html);
        await p.locator('.device').screenshot({ path: join(SHOTS, `size-${c.tag}${tag}.png`) });
        await p.close();
      }
    }
  }
  await browser.close();
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log('\nchecks: fit, ladder, targets, danger, sideways, hold, words: all pass');
}
