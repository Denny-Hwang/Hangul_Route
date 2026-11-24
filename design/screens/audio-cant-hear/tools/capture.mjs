#!/usr/bin/env node
// CH-0b (docs/specs/AMENDMENTS-AUDIO-CANT-HEAR.md section 5): checks and shots of this design pass's mocks. A design
// tool (not shipped, not run by CI). It opens every mock page in Chromium from disk, writes the shots and exits 1
// when a check fails, so a mock change that breaks a rule is seen before the shots are committed.
//
//   node design/screens/audio-cant-hear/tools/capture.mjs            # checks and shots
//   node design/screens/audio-cant-hear/tools/capture.mjs --no-shots # checks only
//
// Playwright comes from apps/web's install (as design/screens/system/progress-read-failed/tools/capture.mjs); in a
// worktree with no install of its own, set NODE_PATH to a checkout's apps/web/node_modules.
//
// Checks (each names the rule it holds):
//   sideways  no page and no frame scrolls sideways (F-LAYOUT-001)
//   targets   every drawn button and switch is at least touchTarget.min (64) high and wide (spec 3.11)
//   danger    no drawn colour is colors.feedback.danger (anti-shame rules)
//   amber     the link, the sheets and the Sound card draw no colors.feedback.nudge or nudgeLight (spec 3.3: not a miss)
//   words     no emoji and no banned word (packages/i18n/src/banned-words.json, learner) in drawn text or names
//   one-line  every Can't hear it? sheet draws exactly one device line, every help sheet exactly one section (3.4, 3.9)
//   actions   a full sheet has Show the letters (primary) then Hear it (secondary); a guidance-only sheet has no Show
//             the letters and Hear it is primary (3.1 cue rule, 3.3)
//   dialog    role=dialog, aria-modal, the title exists and is the first focusable; the scrim is aria-hidden and not
//             focusable; the screen behind is inert (3.3, 3.7, 3.9)
//   order     the link comes after the speaker and before the answers in the reading order (3.7)
//   no-move   the link has the same box while the round holds and once it is active: it never comes in late (3.2)
//   reach     on the frames, the sheet's buttons end inside the window, and its title starts inside it (3.11)
//   whole     every device line is fully in view when the sheet opens, or its sheet shows the scroll cue (MD11)
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
const AMBER = ['rgb(242, 179, 61)', 'rgb(252, 238, 209)']; // colors.feedback.nudge, nudgeLight: read only, never drawn here

const FRAMES = ['link-hold', 'link-ready', 'letters-shown', 'sound-off', 'sheet-apple', 'sheet-android', 'sheet-computer', 'sheet-guidance', 'discover', 'voice-help-apple', 'profile-sound'];
const VIEWS = [
  { w: 360, h: 740, tag: '360x740' },
  { w: 320, h: 568, t200: true, tag: '320x568-text200' },
  { w: 1024, h: 768, tag: '1024x768' },
];
const BOARDS = ['link.html', 'sheet.html', 'help-and-setting.html', 'lengths.html', 'greyscale.html'];

const failures = [];
const fail = (rule, where, detail) => failures.push(`${rule} · ${where} · ${detail}`);

async function checks(page, where) {
  const sideways = await page.evaluate(() => {
    const doc = document.scrollingElement.scrollWidth - window.innerWidth;
    const frames = [...document.querySelectorAll('.ch-frame .scroll, .bs')].map((n) => n.scrollWidth - n.clientWidth);
    return Math.max(doc, ...frames, 0);
  });
  if (sideways > 0) fail('sideways', where, `scrolls ${sideways} px sideways`);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role="switch"], [role="button"]')]
      .filter((b) => b.getClientRects().length > 0 && !b.closest('.tiles.held'))
      .map((b) => ({ text: b.textContent.trim() || b.getAttribute('aria-label'), r: b.getBoundingClientRect() }))
      .filter((b) => b.r.height < 63.5 || b.r.width < 63.5)
      .map((b) => `"${b.text}" ${Math.round(b.r.width)} x ${Math.round(b.r.height)}`),
  );
  for (const s of small) fail('targets', where, s);

  const colours = await page.evaluate(({ danger, amber }) => {
    const drawn = (n) => {
      const cs = getComputedStyle(n);
      return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke];
    };
    const all = [...document.querySelectorAll('*')];
    const scoped = [...document.querySelectorAll('[data-ch="link"], [data-ch="sheet"], [data-ch="sound-card"]')].flatMap((r) => [r, ...r.querySelectorAll('*')]);
    return { danger: all.some((n) => drawn(n).includes(danger)), amber: scoped.some((n) => drawn(n).some((c) => amber.includes(c))) };
  }, { danger: DANGER, amber: AMBER });
  if (colours.danger) fail('danger', where, 'colors.feedback.danger is drawn');
  if (colours.amber) fail('amber', where, 'colors.feedback.nudge is drawn on the link, a sheet or the Sound card');

  for (const lang of ['en', 'es', 'ko']) {
    const text = await page.evaluate((l) => {
      const scope = [...document.querySelectorAll(`[lang="${l}"]`)].filter((n) => n !== document.documentElement && !n.closest('.tile, .kt'));
      const roots = l === 'en' ? [document.body] : scope;
      return roots
        .map((r) => {
          const c = r.cloneNode(true);
          c.querySelectorAll('.board-label, .board-title, .annot, .unchanged, .held-note, [aria-hidden="true"], script, style, [lang]:not([lang="' + l + '"])').forEach((n) => n.remove());
          const spoken = [...r.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ');
          return `${c.textContent} ${spoken}`;
        })
        .join('\n');
    }, lang);
    if (/\p{Extended_Pictographic}/u.test(text)) fail('words', `${where} ${lang}`, 'an emoji is drawn');
    for (const word of BANNED[lang]?.learner ?? []) {
      const re = lang === 'ko' ? new RegExp(word, 'u') : new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu');
      if (re.test(text)) fail('words', `${where} ${lang}`, `"${word}" is drawn`);
    }
  }

  const sheets = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ch="sheet"]')].map((s) => {
      const help = s.dataset.kind === 'voice-help';
      const id = s.getAttribute('aria-labelledby');
      const title = id ? document.getElementById(id) : null;
      const focusables = [...s.querySelectorAll('button, [tabindex]')];
      const show = s.querySelector('[data-ch="show"]');
      const hear = s.querySelector('[data-ch="hear"]');
      const host = s.closest('.ch-frame');
      const scrim = host?.querySelector('[data-ch="scrim"]');
      const behind = host?.querySelector('[data-ch="screen"]');
      return {
        help,
        guidance: s.dataset.guidance === 'yes',
        lines: s.querySelectorAll('[data-ch="line"]').length,
        sections: s.querySelectorAll('[data-ch="section"]').length,
        modal: s.getAttribute('role') === 'dialog' && s.getAttribute('aria-modal') === 'true',
        titleFirst: !!title && focusables[0] === title,
        scrimOk: !!scrim && scrim.getAttribute('aria-hidden') === 'true' && !scrim.hasAttribute('tabindex') && scrim.tagName !== 'BUTTON',
        inert: !!behind && behind.hasAttribute('inert'),
        show: show ? { primary: show.classList.contains('rn-primary'), beforeHear: !!hear && !!(show.compareDocumentPosition(hear) & Node.DOCUMENT_POSITION_FOLLOWING) } : null,
        hearPrimary: hear ? hear.classList.contains('rn-primary') : null,
      };
    }),
  );
  sheets.forEach((s, i) => {
    const w = `${where} sheet ${i + 1}`;
    if (s.help ? s.sections !== 1 : s.lines !== 1) fail('one-line', w, s.help ? `${s.sections} sections` : `${s.lines} device lines`);
    if (!s.modal) fail('dialog', w, 'not role=dialog aria-modal');
    if (!s.titleFirst) fail('dialog', w, 'the title is not the first focusable');
    if (!s.scrimOk) fail('dialog', w, 'the scrim is an accessibility element or focusable');
    if (!s.inert) fail('dialog', w, 'the screen behind is not inert');
    if (!s.help) {
      if (s.guidance && (s.show || !s.hearPrimary)) fail('actions', w, 'guidance-only sheet: Show the letters drawn or Hear it not primary');
      if (!s.guidance && (!s.show || !s.show.primary || !s.show.beforeHear || s.hearPrimary)) fail('actions', w, 'full sheet: Show the letters primary first, Hear it secondary second');
    }
  });

  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ch="screen"]')].filter((s) => s.querySelector('[data-ch="link"]') && s.querySelector('[data-ch="speaker"]')).map((s) => {
      const sp = s.querySelector('[data-ch="speaker"]');
      const ln = s.querySelector('[data-ch="link"]');
      const tl = s.querySelector('[data-ch="tiles"]');
      const after = !!(sp.compareDocumentPosition(ln) & Node.DOCUMENT_POSITION_FOLLOWING);
      const before = !tl || !!(ln.compareDocumentPosition(tl) & Node.DOCUMENT_POSITION_FOLLOWING);
      return after && before;
    }),
  );
  order.forEach((ok, i) => { if (!ok) fail('order', `${where} screen ${i + 1}`, 'the link is not between the speaker and the answers'); });
}

async function cutLines(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-ch="sheet"]')].filter((sh) => {
    if (sh.getClientRects().length === 0) return false;
    const body = sh.querySelector('.bs-body').getBoundingClientRect();
    const cut = [...sh.querySelectorAll('[data-ch="line"], [data-ch="section"]')].some((l) => l.getBoundingClientRect().bottom > body.bottom + 1);
    return cut && !sh.classList.contains('scrolls');
  }).length);
}

async function linkBox(page) {
  return page.evaluate(() => {
    const l = [...document.querySelectorAll('[data-ch="link"]')].find((n) => n.getClientRects().length > 0);
    if (!l) return null;
    const r = l.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map(Math.round).join(',');
  });
}

const browser = await chromium.launch();
try {
  for (const v of VIEWS) {
    const boxes = {};
    for (const name of FRAMES) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(join(MOCK, 'frames', `${name}.html`)).href);
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
      if (v.t200) await page.evaluate(() => document.documentElement.classList.add('t200'));
      const where = `frames/${name} @${v.tag}`;
      await checks(page, where);
      if (name === 'link-hold' || name === 'link-ready') boxes[name] = await linkBox(page);
      const reach = await page.evaluate(() => {
        const s = [...document.querySelectorAll('[data-ch="sheet"]')].find((n) => n.getClientRects().length > 0);
        if (!s) return null;
        const a = s.querySelector('.bs-actions').getBoundingClientRect();
        const t = s.querySelector('.bs-title').getBoundingClientRect();
        return { actionsOut: a.bottom - window.innerHeight, titleOut: -t.top };
      });
      if (await cutLines(page)) fail('whole', where, 'a device line is cut and the sheet shows no scroll cue');
      if (reach && (reach.actionsOut > 1 || reach.titleOut > 1)) fail('reach', where, `actions ${Math.round(reach.actionsOut)} px / title ${Math.round(reach.titleOut)} px out of the window`);
      if (SHOOT) {
        await page.screenshot({ path: join(SHOTS, `${name}-${v.tag}.png`) });
        if (v.t200 && !name.startsWith('sheet') && name !== 'voice-help-apple') {
          await page.evaluate(() => document.documentElement.classList.add('full'));
          await page.screenshot({ path: join(SHOTS, `${name}-${v.tag}-full.png`), fullPage: true });
        }
        if (v.t200 && (name.startsWith('sheet') || name === 'voice-help-apple')) {
          const scrolls = await page.evaluate(() => [...document.querySelectorAll('.bs-body')].some((b) => b.scrollHeight > b.clientHeight + 1));
          if (scrolls) {
            await page.evaluate(() => document.querySelectorAll('.bs-body').forEach((b) => { b.scrollTop = b.scrollHeight; }));
            await page.screenshot({ path: join(SHOTS, `${name}-${v.tag}-end.png`) });
          }
        }
      }
      await ctx.close();
    }
    if (boxes['link-hold'] !== boxes['link-ready']) fail('no-move', v.tag, `the link box moves: hold ${boxes['link-hold']} / ready ${boxes['link-ready']}`);
  }
  for (const file of BOARDS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(join(MOCK, file)).href);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'yes');
    await checks(page, `${file} @1280`);
    const cut = await cutLines(page);
    if (cut) fail('whole', `${file} @1280`, `${cut} sheet(s) cut a line with no scroll cue`);
    if (SHOOT) await page.screenshot({ path: join(SHOTS, `${file.replace('.html', '')}-1280.png`), fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`all checks passed (${FRAMES.length} frames x ${VIEWS.length} windows, ${BOARDS.length} boards)${SHOOT ? '; shots written' : ''}`);
