// RF-0b (docs/specs/AMENDMENTS-ROMANIZATION-FADE.md sections 3.9, 3.10): measures the Reading practice card and the Hello
// step with Hoya's line at the sizes of the row, checks every page, and takes the shots. A design tool (not shipped, not
// run by CI). Playwright comes from apps/web's install, as the other design-pass tools
// (design/screens/hangul-check/tools/measure.mjs); in a worktree with no install of its own it falls back to the main
// checkout's apps/web.
//
//   node design/screens/profile/tools/measure.mjs               # tables + checks + shots
//   node design/screens/profile/tools/measure.mjs --no-shots    # tables + checks
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, SIZES, TEXT } from './build.mjs';
import { CHOICES, helloFrame, MOCK, page, profileFrame } from './frames.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../..');
const webPkg = [join(REPO, 'apps/web/package.json'), resolve(REPO, '../../../apps/web/package.json')].find((p) => existsSync(join(dirname(p), 'node_modules/@playwright/test')));
const require = createRequire(webPkg);
const { chromium } = require('@playwright/test');
const CSS = readFileSync(join(MOCK, 'reading-practice.css'), 'utf8');
const inline = (html) => html.replace('<link rel="stylesheet" href="reading-practice.css">', `<style>${CSS}</style>`);

/** One frame alone in a page, measured inside the device box. */
async function open(browser, frameHtml, w, h, scale = 1) {
  const p = await browser.newPage({ viewport: { width: Math.max(w + 40, 400), height: h + 40 }, deviceScaleFactor: scale });
  await p.setContent(inline(page({ title: 'measure', comment: 'measure', body: frameHtml })));
  return p;
}

/** The card: its height, each radio's height, the ring against the label's first line, the hint inside its radio. */
async function measureCard(browser, o) {
  const p = await open(browser, profileFrame(o), o.w, o.h);
  const r = await p.evaluate(() => {
    const dev = document.querySelector('.device').getBoundingClientRect();
    const scr = document.querySelector('.scr');
    const card = document.querySelector('[data-part="card"]').getBoundingClientRect();
    const radios = [...document.querySelectorAll('[data-part="radio"]')].map((el) => {
      const b = el.getBoundingClientRect();
      const ring = el.querySelector('[data-part="ring"]').getBoundingClientRect();
      const label = el.querySelector('[data-part="label"]');
      const lh = parseFloat(getComputedStyle(label).lineHeight);
      const lb = label.getBoundingClientRect();
      const hint = el.querySelector('[data-part="hint"]');
      const hb = hint ? hint.getBoundingClientRect() : null;
      return {
        choice: el.dataset.choice,
        h: Math.round(b.height),
        w: Math.round(b.width),
        lines: Math.round(lb.height / lh),
        hintLines: hb ? Math.round(hb.height / parseFloat(getComputedStyle(hint).lineHeight)) : 0,
        // The ring's centre against the centre of the label's first line.
        ringOff: Math.abs((ring.top + ring.bottom) / 2 - (lb.top + lh / 2)),
        inside: (!hb || (hb.bottom <= b.bottom + 0.5 && hb.top >= b.top - 0.5)) && lb.bottom <= b.bottom + 0.5,
      };
    });
    const overflowX = scr.scrollWidth > scr.clientWidth + 0.5 || [...document.querySelectorAll('.radio-text, .card')].some((e) => e.scrollWidth > e.clientWidth + 0.5);
    // Does the whole card fit in one window (the content box under the gutters)? Profile scrolls; this says whether a
    // learner can see the three choices at once.
    const pad = parseFloat(getComputedStyle(scr).paddingTop) + parseFloat(getComputedStyle(scr).paddingBottom);
    return { cardH: Math.round(card.height), cardW: Math.round(card.width), radios, overflowX, fitsWindow: card.height <= dev.height - pad + 0.5 };
  });
  await p.close();
  return r;
}

/** The Hello step: the content height, where the line and Continue end, whether the line shows on the first screen. */
async function measureHello(browser, o) {
  const p = await open(browser, helloFrame(o), o.w, o.h);
  const r = await p.evaluate(() => {
    const dev = document.querySelector('.device').getBoundingClientRect();
    const scroll = document.querySelector('[data-part="scroll"]');
    const view = scroll.getBoundingClientRect();
    const content = document.querySelector('[data-part="content"]');
    const top = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top - dev.top) : null; };
    const bottom = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().bottom - dev.top) : null; };
    const notice = document.querySelector('[data-part="notice"]');
    const msgs = [...document.querySelectorAll('.bubble .msg')].map((m) => Math.round(m.getBoundingClientRect().width));
    return {
      viewBottom: Math.round(view.bottom - dev.top),
      contentH: Math.round(content.scrollHeight),
      viewH: Math.round(view.height),
      noticeTop: notice ? Math.round(notice.getBoundingClientRect().top - dev.top) : null,
      noticeBottom: notice ? Math.round(notice.getBoundingClientRect().bottom - dev.top) : null,
      bubble2H: document.querySelector('[data-part="bubble2"]') ? Math.round(document.querySelector('[data-part="bubble2"]').getBoundingClientRect().height) : 0,
      contBottom: bottom('[data-part="continue"]'),
      contTop: top('[data-part="continue"]'),
      msgW: msgs,
      overflowX: content.scrollWidth > content.clientWidth + 0.5,
    };
  });
  await p.close();
  r.scrolls = r.contentH > r.viewH + 0.5;
  r.noticeOnFirst = r.noticeBottom === null ? null : r.noticeBottom <= r.viewBottom;
  r.contOnFirst = r.contBottom <= r.viewBottom;
  return r;
}

/** --phones: the Hello step on common phone windows, with and without the line (open question Q5). */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href && process.argv.includes('--phones')) {
  const browser = await chromium.launch();
  const rows = ['| Window | Continue bottom / window bottom: no line (today) | the line, step Hoya kept (B2) | the line, no step Hoya (B1, recommended) |', '|---|---|---|---|'];
  for (const [w, h] of [[320, 568], [360, 640], [375, 667], [360, 740], [360, 800], [390, 844], [393, 852], [412, 915]]) {
    const a = await measureHello(browser, { w, h, line: 'none' });
    const b = await measureHello(browser, { w, h, line: 'bare-hoya' });
    const c = await measureHello(browser, { w, h, line: 'bare' });
    const cell = (r) => `${r.contBottom} / ${r.viewBottom}${r.contOnFirst ? '' : r.contTop < r.viewBottom ? ` (${r.viewBottom - r.contTop} px of it shows)` : ' (under the fold)'}`;
    rows.push(`| ${w} x ${h} | ${cell(a)} | ${cell(b)} | ${cell(c)} |`);
  }
  console.log(rows.join('\n'));
  await browser.close();
  process.exit(0);
}

const MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (MAIN) {
  const SHOTS = resolve(here, '../shots');
  const SHOOT = !process.argv.includes('--no-shots');
  const BANNED = JSON.parse(readFileSync(join(REPO, 'packages/i18n/src/banned-words.json'), 'utf8'));
  const DANGER = 'rgb(200, 75, 61)'; // colors.feedback.danger #C84B3D, read only to check it is never drawn
  const failures = [];
  const browser = await chromium.launch();
  const out = [];

  // Table 1: the card, English, As I learn checked, every size x text size.
  out.push('**Table 1: the Reading practice card (English, As I learn checked)**', '', '| Size | Text | Card (w x h) | As I learn / Always / Only when I tap (row height, label lines) | Ring off first line | Whole card in one window |', '|---|---|---|---|---|---|');
  for (const s of SIZES) {
    for (const t of TEXT) {
      if (t.ts && !['320x568', '360x740', '390x844', '844x390', '667x375'].includes(s.tag)) continue;
      const r = await measureCard(browser, { ...s, ts: t.ts, checked: 'auto' });
      if (r.overflowX) failures.push(`card sideways · ${s.tag} · ${t.tag}`);
      for (const x of r.radios) {
        if (x.h < 64) failures.push(`card target · ${s.tag} · ${t.tag} · ${x.choice} ${x.h}`);
        if (x.ringOff > 1) failures.push(`card ring · ${s.tag} · ${t.tag} · ${x.choice} off by ${x.ringOff.toFixed(1)}`);
        if (!x.inside) failures.push(`card text outside its radio · ${s.tag} · ${t.tag} · ${x.choice}`);
      }
      const rows = r.radios.map((x) => `${x.h} (${x.lines}${x.hintLines ? ` + hint ${x.hintLines}` : ''})`).join(' / ');
      out.push(`| ${s.w} x ${s.h} | ${t.tag} | ${r.cardW} x ${r.cardH} | ${rows} | ${Math.max(...r.radios.map((x) => x.ringOff)).toFixed(1)} | ${r.fitsWindow ? 'yes' : 'no (Profile scrolls)'} |`);
    }
  }

  // Table 2: Spanish and Korean at the narrowest size.
  out.push('', '**Table 2: Spanish and Korean (NEW values are length-stress drafts)**', '', '| Locale | Size | Text | Card (w x h) | Rows (height, label lines) | Whole card in one window |', '|---|---|---|---|---|---|');
  for (const locale of ['en', 'es', 'ko']) {
    for (const [tag, ts, tt] of [['320x568', null, 'standard'], ['320x568', 'ts-largest', 'Largest (1.5)'], ['320x568', 'ts-200', '200 % (2)'], ['844x390', 'ts-200', '200 % (2)']]) {
      const s = SIZES.find((x) => x.tag === tag);
      const r = await measureCard(browser, { ...s, ts, locale, checked: 'auto' });
      if (r.overflowX) failures.push(`card sideways · ${locale} · ${tag} · ${tt}`);
      for (const x of r.radios) {
        if (x.h < 64) failures.push(`card target · ${locale} · ${tag} · ${tt} · ${x.choice}`);
        if (x.ringOff > 1) failures.push(`card ring · ${locale} · ${tag} · ${tt} · ${x.choice}`);
        if (!x.inside) failures.push(`card text outside · ${locale} · ${tag} · ${tt} · ${x.choice}`);
      }
      out.push(`| ${locale} | ${s.w} x ${s.h} | ${tt} | ${r.cardW} x ${r.cardH} | ${r.radios.map((x) => `${x.h} (${x.lines}${x.hintLines ? ` + hint ${x.hintLines}` : ''})`).join(' / ')} | ${r.fitsWindow ? 'yes' : 'no'} |`);
    }
  }

  // Table 2b: does the checked label (semibold) reflow its row? Each choice checked in turn, the tight sizes.
  out.push('', '**Table 2b: row heights with each choice checked (a semibold checked label must not change any row)**', '', '| Locale | Size | Text | As I learn checked | Always checked | Only when I tap checked | Same? |', '|---|---|---|---|---|---|---|');
  for (const locale of ['en', 'es', 'ko']) {
    for (const [tag, ts, tt] of [['320x568', null, 'standard'], ['320x568', 'ts-largest', 'Largest (1.5)'], ['320x568', 'ts-200', '200 % (2)'], ['390x844', 'ts-200', '200 % (2)']]) {
      const s = SIZES.find((x) => x.tag === tag);
      const per = [];
      for (const checked of CHOICES) per.push((await measureCard(browser, { ...s, ts, locale, checked })).radios.map((x) => x.h).join(' / '));
      const same = per.every((x) => x === per[0]);
      if (!same) failures.push(`reflow · ${locale} · ${tag} · ${tt}: ${per.join(' | ')}`);
      out.push(`| ${locale} | ${s.w} x ${s.h} | ${tt} | ${per.join(' | ')} | ${same ? 'yes' : 'NO'} |`);
    }
  }

  // Contrast of the card's colours on surface.paper, computed from the token values in the stylesheet (WCAG 2.x).
  const hex = (name) => CSS.match(new RegExp(`--colors-${name}: (#[0-9A-Fa-f]{6})`))[1];
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const pairs = [['text-primary', 4.5], ['text-secondary', 4.5], ['text-muted', 4.5], ['border-focus', 3], ['border-shape', 3]];
  out.push('', `**Contrast on surface.paper:** ${pairs.map(([n, need]) => { const r = ratio(n, 'surface-paper'); if (r < need) failures.push(`contrast · ${n} ${r.toFixed(2)}`); return `${n.replace('-', '.')} ${r.toFixed(2)}:1`; }).join(', ')}`);

  // Table 3: the Hello step, the line's look options at two sizes.
  out.push('', '**Table 3: the Hello step, the line\'s look (English, standard text)**', '', '| Size | Look | Line width | Line bubble height | Content / window | Line on the first screen | Continue on the first screen |', '|---|---|---|---|---|---|---|');
  for (const tag of ['320x568', '360x740', '390x844']) {
    const s = SIZES.find((x) => x.tag === tag);
    for (const line of ['none', 'bare', 'bare-hoya', 'figure', 'joined']) {
      const r = await measureHello(browser, { ...s, line });
      out.push(`| ${s.w} x ${s.h} | ${line} | ${line === 'none' ? '-' : r.msgW[r.msgW.length - 1]} | ${r.bubble2H || '-'} | ${r.contentH} / ${r.viewH} | ${r.noticeOnFirst === null ? '-' : r.noticeOnFirst ? 'yes' : 'no'} | ${r.contOnFirst ? 'yes' : 'no (scrolls)'} |`);
    }
  }

  // Table 4: the recommended look at every size, text size and locale.
  out.push('', '**Table 4: the Hello step with the line (recommended look, no figure)**', '', '| Locale | Size | Text | Line width | Line bubble height | Content / window (no line) | Line text top-bottom / window bottom | Continue on the first screen (no line) |', '|---|---|---|---|---|---|---|---|');
  const helloRows = [];
  for (const s of SIZES) helloRows.push(['en', s, null, 'standard']);
  for (const tag of ['320x568', '390x844', '844x390']) for (const t of TEXT.slice(1)) helloRows.push(['en', SIZES.find((x) => x.tag === tag), t.ts, t.tag]);
  for (const locale of ['es', 'ko']) for (const t of [TEXT[0], TEXT[2]]) helloRows.push([locale, SIZES.find((x) => x.tag === '320x568'), t.ts, t.tag]);
  for (const [locale, s, ts, tt] of helloRows) {
    const r = await measureHello(browser, { ...s, ts, locale, line: 'bare' });
    const n = await measureHello(browser, { ...s, ts, locale, line: 'none' });
    if (r.overflowX) failures.push(`hello sideways · ${locale} · ${s.tag} · ${tt}`);
    out.push(`| ${locale} | ${s.w} x ${s.h} | ${tt} | ${r.msgW[1]} | ${r.bubble2H} | ${r.contentH} / ${r.viewH} (${n.contentH}) | ${r.noticeTop}-${r.noticeBottom} / ${r.viewBottom} | ${r.contOnFirst ? 'yes' : 'no'} (${n.contOnFirst ? 'yes' : 'no'}) |`);
  }
  const table = out.join('\n');
  console.log(table);

  // Checks on every page of ../mock (built fresh).
  const pages = build();
  for (const [name, html] of Object.entries(pages)) writeFileSync(join(MOCK, name), html);
  for (const name of Object.keys(pages)) {
    const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await p.goto(pathToFileURL(join(MOCK, name)).href);
    const res = await p.evaluate(({ danger, choices }) => {
      const devices = [...document.querySelectorAll('.device')];
      const short = [];
      const groups = [];
      for (const d of devices) {
        for (const b of d.querySelectorAll('button, [role="button"], [role="radio"]')) {
          if (b.getClientRects().length === 0) continue;
          const r = b.getBoundingClientRect();
          const visible = r.top < d.getBoundingClientRect().bottom; // a control under the fold is reached by scrolling
          if (visible && (r.height < 63.5 || r.width < 63.5)) short.push(`${b.getAttribute('aria-label') || b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        for (const g of d.querySelectorAll('[role="radiogroup"]')) {
          const radios = [...g.querySelectorAll('[role="radio"]')];
          const checked = radios.filter((x) => x.getAttribute('aria-checked') === 'true');
          const stops = radios.filter((x) => x.getAttribute('tabindex') === '0');
          const labelled = g.getAttribute('aria-labelledby') && document.getElementById(g.getAttribute('aria-labelledby'))?.textContent.trim();
          // Label in name (WCAG 2.5.3): each radio's accessible name starts with its visible label.
          const lin = radios.every((x) => x.getAttribute('aria-label') === x.querySelector('[data-part="label"]').textContent.trim());
          groups.push({ n: radios.length, checked: checked.length, stops: stops.length, same: checked[0] === stops[0], labelled: Boolean(labelled), lin, order: radios.map((x) => x.dataset.choice).join(',') === choices.join(',') });
        }
      }
      // The line is never a live region, and is never inside one.
      const liveLine = [...document.querySelectorAll('[data-notice]')].some((n) => n.closest('[aria-live]:not([aria-live="off"])'));
      const red = devices.some((d) => [d, ...d.querySelectorAll('*')].some((n) => {
        const cs = getComputedStyle(n);
        return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke, cs.outlineColor].includes(danger);
      }));
      const text = devices.map((d) => `${d.textContent} ${[...d.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ')}`).join('\n');
      return { short, groups, liveLine, red, text };
    }, { danger: DANGER, choices: CHOICES });
    for (const s of res.short) failures.push(`targets · ${name} · ${s}`);
    for (const g of res.groups) {
      if (g.n !== 3 || g.checked !== 1 || g.stops !== 1 || !g.same) failures.push(`radiogroup · ${name} · ${JSON.stringify(g)}`);
      if (!g.labelled) failures.push(`radiogroup name · ${name}`);
      if (!g.lin) failures.push(`label in name · ${name}`);
      if (!g.order) failures.push(`option order · ${name}`);
    }
    // Computed accessibility (Chromium's tree, through Playwright's aria snapshot): each group is named by its visible
    // label, each radio's computed name is exactly its visible label, its state is right, and As I learn's computed
    // description is the hint.
    const groupsLoc = p.getByRole('radiogroup');
    for (let i = 0; i < (await groupsLoc.count()); i++) {
      const g = groupsLoc.nth(i);
      const snap = await g.ariaSnapshot();
      const expected = await g.evaluate((el) => ({
        group: document.getElementById(el.getAttribute('aria-labelledby')).textContent.trim(),
        radios: [...el.querySelectorAll('[role="radio"]')].map((r) => ({ label: r.querySelector('[data-part="label"]').textContent.trim(), checked: r.getAttribute('aria-checked') === 'true', hint: r.querySelector('[data-part="hint"]')?.textContent.trim() ?? null })),
      }));
      if (!snap.startsWith(`- radiogroup "${expected.group}"`)) failures.push(`computed group name · ${name} · ${snap.split('\n')[0]}`);
      for (const r of expected.radios) {
        if (!snap.includes(`- radio "${r.label}"${r.checked ? ' [checked]' : ''}`)) failures.push(`computed radio name · ${name} · "${r.label}"`);
        if (r.hint) {
          const desc = await g.getByRole('radio', { name: r.label, exact: true }).evaluate((el) => document.getElementById(el.getAttribute('aria-describedby'))?.textContent.trim());
          if (desc !== r.hint) failures.push(`description · ${name} · "${r.label}"`);
        }
      }
    }
    if (res.liveLine) failures.push(`live · ${name} · the reading line is inside a live region`);
    if (res.red) failures.push(`danger · ${name} · colors.feedback.danger is drawn`);
    if (/\p{Extended_Pictographic}/u.test(res.text)) failures.push(`words · ${name} · an emoji is drawn`);
    for (const lang of ['en', 'es', 'ko']) {
      for (const word of BANNED[lang].learner) {
        const re = lang === 'ko' ? new RegExp(word, 'u') : new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu');
        if (re.test(res.text)) failures.push(`words · ${name} · banned word "${word}"`);
      }
    }
    // Spec 3.11: no word of loss in learner copy ("hide", "lose", "remove", "less help"), and no age framing.
    for (const word of ['hide', 'hidden', 'lose', 'remove', 'less help', 'for kids', 'ages']) {
      if (new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(res.text.replace(/scrolled[^\n]*/g, ''))) failures.push(`copy · ${name} · "${word}"`);
    }
    if (SHOOT) {
      mkdirSync(SHOTS, { recursive: true });
      await p.screenshot({ path: join(SHOTS, name.replace('.html', '.png')), fullPage: true });
    }
    await p.close();
  }

  // One shot per acceptance frame at 2x (the device only).
  if (SHOOT) {
    const shots = [
      ['card-360x740-auto', profileFrame({ w: 360, h: 740, checked: 'auto', context: true })],
      ['card-360x740-always', profileFrame({ w: 360, h: 740, checked: 'always', context: true })],
      ['card-360x740-tap', profileFrame({ w: 360, h: 740, checked: 'tap', context: true })],
      ['card-360x740-focus', profileFrame({ w: 360, h: 740, checked: 'auto', focus: 'auto', context: true })],
      ['card-360x740-pressed', profileFrame({ w: 360, h: 740, checked: 'auto', pressed: 'tap', context: true })],
      ['card-320x568', profileFrame({ w: 320, h: 568, checked: 'auto' })],
      ['card-320x568-largest', profileFrame({ w: 320, h: 568, ts: 'ts-largest', checked: 'auto' })],
      ['card-320x568-200', profileFrame({ w: 320, h: 568, ts: 'ts-200', checked: 'auto', focus: 'auto' })],
      ['card-390x844-largest', profileFrame({ w: 390, h: 844, ts: 'ts-largest', checked: 'auto' })],
      ['card-844x390', profileFrame({ w: 844, h: 390, checked: 'auto' })],
      ['card-844x390-200', profileFrame({ w: 844, h: 390, ts: 'ts-200', checked: 'auto' })],
      ['card-1180x820', profileFrame({ w: 1180, h: 820, checked: 'auto' })],
      ['card-es-320x568-200', profileFrame({ w: 320, h: 568, ts: 'ts-200', locale: 'es', checked: 'tap' })],
      ['card-ko-320x568-200', profileFrame({ w: 320, h: 568, ts: 'ts-200', locale: 'ko', checked: 'tap' })],
      ['hello-360x740', helloFrame({ w: 360, h: 740, line: 'bare' })],
      ['hello-360x740-none', helloFrame({ w: 360, h: 740, line: 'none' })],
      ['hello-360x740-hoya-kept', helloFrame({ w: 360, h: 740, line: 'bare-hoya' })],
      ['hello-390x844', helloFrame({ w: 390, h: 844, line: 'bare' })],
      ['hello-320x568', helloFrame({ w: 320, h: 568, line: 'bare' })],
      ['hello-320x568-200', helloFrame({ w: 320, h: 568, ts: 'ts-200', line: 'bare' })],
      ['hello-390x844-largest', helloFrame({ w: 390, h: 844, ts: 'ts-largest', line: 'bare' })],
      ['hello-844x390', helloFrame({ w: 844, h: 390, line: 'bare' })],
      ['hello-es-320x568', helloFrame({ w: 320, h: 568, locale: 'es', line: 'bare' })],
      ['hello-ko-320x568', helloFrame({ w: 320, h: 568, locale: 'ko', line: 'bare' })],
    ];
    for (const [name, html] of shots) {
      const w = Number(html.match(/data-w="(\d+)"/)[1]);
      const h = Number(html.match(/data-h="(\d+)"/)[1]);
      const p = await open(browser, html, w, h, 2);
      await p.locator('.device').screenshot({ path: join(SHOTS, `${name}.png`) });
      await p.close();
    }
  }
  await browser.close();
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log('\nchecks: targets, ring, sideways, reflow, contrast, radiogroup (one checked, one Tab stop, named, name = visible label, order), computed names / states / description (aria snapshot), live, danger, words, copy: all pass');
}
