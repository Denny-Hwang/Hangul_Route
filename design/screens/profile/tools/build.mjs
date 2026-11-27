// RF-0b: the pages of this design pass, built from frames.mjs. A design tool (not shipped, not run by CI).
//
//   node design/screens/profile/tools/build.mjs        # writes ../mock/*.html
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { helloFrame, item, MOCK, page, profileFrame } from './frames.mjs';

const COMMENT = 'Design mock (docs/specs/AMENDMENTS-ROMANIZATION-FADE.md row RF-0b), not shipped code. Built by ../tools/frames.mjs. Every English UI string is a dictionary value of packages/i18n or one of the six keys of spec 3.11; the Spanish and Korean values of those six keys are length-stress drafts of this pass, not translations (RF-2 drafts and reviews them).';

/** The sizes of the row: phones (320 x 568 the smallest), landscape phones, a tablet each way. */
export const SIZES = [
  { w: 320, h: 568, tag: '320x568' },
  { w: 360, h: 740, tag: '360x740' },
  { w: 390, h: 844, tag: '390x844' },
  { w: 844, h: 390, tag: '844x390' },
  { w: 667, h: 375, tag: '667x375' },
  { w: 768, h: 1024, tag: '768x1024' },
  { w: 1180, h: 820, tag: '1180x820' },
];
export const TEXT = [
  { ts: null, tag: 'standard' },
  { ts: 'ts-largest', tag: 'Largest (1.5)' },
  { ts: 'ts-200', tag: '200 % (2)' },
];

const sz = (tag) => SIZES.find((x) => x.tag === tag);
const P = (tag, o = {}) => ({ ...sz(tag), ...o });

export function build() {
  const out = {};

  // 1. The card's states at 360 x 740 (the wireframe's phone), English, standard text.
  const states = [
    ['A1 · As I learn checked (the default from RF-2): the hint under it; the checked label semibold', { checked: 'auto' }],
    ['A2 · Always checked (the default until RF-2; a learner who chose it)', { checked: 'always' }],
    ['A3 · Only when I tap checked', { checked: 'tap' }],
    ['A4 · keyboard / switch focus (Tab lands on the checked radio): the focus ring, border.focus thick, on the row', { checked: 'auto', focus: 'auto' }],
    ['A5 · after ArrowDown: focus and the choice move together (stored at once)', { checked: 'always', focus: 'always' }],
    ['A6 · pressed: a finger on Only when I tap (the press look: border.shape thick, 0.97); nothing is chosen until the release', { checked: 'auto', pressed: 'tap' }],
    ['A7 · a web tap focuses the row too: while pressed, the press look wins over the focus ring; after the release Only when I tap is checked and keeps the focus ring (as LessonDisplaySheet)', { checked: 'auto', pressed: 'tap', focus: 'tap' }],
    ['A8 · after the release of A7', { checked: 'tap', focus: 'tap' }],
  ];
  out['reading-card-states.html'] = page({
    title: 'Reading practice card: states (RF-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Profile · Reading practice card · the three choices and the interaction states, 360 x 740, standard text</h1>
<div class="board-row">${states.map(([l, o]) => item(l, profileFrame(P('360x740', { ...o, context: true })))).join('')}</div>
<p class="note" style="max-width: 1100px">No disabled state: the choice is always available (spec 3.10; display only, not behind the grown-up gate). Loading: the card shows the default checked until settings are read (they are read before Profile draws). Error: a stored choice this build does not know reads as the default, which is checked (spec 3.2). The dimmed cards are the unchanged neighbours (Display, Challenge); Sound and the profiles are above, scrolled away.</p></main>`,
  });

  // 2. Every size at standard text, English, As I learn checked.
  out['reading-card-sizes.html'] = page({
    title: 'Reading practice card: sizes (RF-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Reading practice card · every size, standard text, As I learn checked</h1>
<div class="board-row">${SIZES.filter((s) => s.w < s.h).map((s) => item(s.tag, profileFrame({ ...s, checked: 'auto' }))).join('')}</div>
<div class="board-row">${SIZES.filter((s) => s.w > s.h).map((s) => item(s.tag, profileFrame({ ...s, checked: 'auto' }))).join('')}</div></main>`,
  });

  // 3. Largest text and 200 % text.
  out['reading-card-text.html'] = page({
    title: 'Reading practice card: Largest and 200 % text (RF-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Reading practice card · Largest text (f = 1.5)</h1>
<div class="board-row">${['320x568', '390x844', '844x390'].map((t) => item(`${t} · Largest`, profileFrame(P(t, { ts: 'ts-largest', checked: 'auto', focus: 'auto' })))).join('')}</div>
<h1 class="board-title">Reading practice card · 200 % text (f = 2)</h1>
<div class="board-row">${['320x568', '390x844', '844x390', '667x375'].map((t) => item(`${t} · 200 %`, profileFrame(P(t, { ts: 'ts-200', checked: 'auto', focus: 'auto' })))).join('')}</div></main>`,
  });

  // 4. Spanish and Korean (string length stress).
  const loc = [];
  for (const locale of ['es', 'ko']) {
    for (const t of TEXT) loc.push(item(`${locale} · 320x568 · ${t.tag}`, profileFrame(P('320x568', { locale, ts: t.ts, checked: 'tap' }))));
    loc.push(item(`${locale} · 844x390 · 200 %`, profileFrame(P('844x390', { locale, ts: 'ts-200', checked: 'auto' }))));
  }
  out['reading-card-locales.html'] = page({
    title: 'Reading practice card: Spanish and Korean (RF-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Reading practice card · Spanish and Korean UI (the six NEW values are length-stress drafts, not translations)</h1>
<div class="board-row">${loc.join('')}</div></main>`,
  });

  // 5. The Hello step with Hoya's line: the options for the line's look, then the recommended one at every size.
  const opts = [
    ['B0 · every other run (no line): as today', 'none'],
    ['B1 · RECOMMENDED: the line as a second bubble with no figure, not live; on this run the step card draws no Hoya 120 (the bubble\'s Hoya speaks both lines), so Continue stays where it is today', 'bare'],
    ['B2 · rejected: B1 with the step\'s Hoya 120 kept (spec 3.9 as first written): Continue falls under the fold on 360 x 640 to 360 x 800', 'bare-hoya'],
    ['B3 · rejected: a second full HoyaBubble (its own Hoya 72): three tigers, the line 84 px narrower', 'figure'],
    ['B4 · rejected: one bubble, the line as its second paragraph (inside the first bubble\'s live region; as narrow as B3)', 'joined'],
  ];
  out['hello-line.html'] = page({
    title: 'Hello step with Hoya\'s reading line (RF-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Quest 11 · Hello step · the one run that shows the reading line · the line's look, 360 x 740, standard text (each frame is the window; what is under it scrolls)</h1>
<div class="board-row">${opts.map(([l, line]) => item(l, helloFrame(P('360x740', { line })))).join('')}</div>
<h1 class="board-title">The same at 320 x 568</h1>
<div class="board-row">${opts.map(([l, line]) => item(l.split(':')[0], helloFrame(P('320x568', { line })))).join('')}</div>
<h1 class="board-title">B1 (recommended) at every size, standard text</h1>
<div class="board-row">${SIZES.filter((s) => s.w < s.h && s.tag !== '360x740' && s.tag !== '320x568').map((s) => item(s.tag, helloFrame({ ...s, line: 'bare' }))).join('')}</div>
<div class="board-row">${SIZES.filter((s) => s.w > s.h).map((s) => item(s.tag, helloFrame({ ...s, line: 'bare' }))).join('')}</div></main>`,
  });

  // 6. The Hello step at Largest and 200 %, and in Spanish and Korean.
  const hl = [];
  for (const t of TEXT.slice(1)) for (const tag of ['320x568', '390x844']) hl.push(item(`en · ${tag} · ${t.tag}`, helloFrame(P(tag, { ts: t.ts, line: 'bare' }))));
  hl.push(item('en · 844x390 · 200 %', helloFrame(P('844x390', { ts: 'ts-200', line: 'bare' }))));
  const hloc = [];
  for (const locale of ['es', 'ko']) for (const t of [TEXT[0], TEXT[2]]) hloc.push(item(`${locale} · 320x568 · ${t.tag}`, helloFrame(P('320x568', { locale, ts: t.ts, line: 'bare' }))));
  out['hello-line-text.html'] = page({
    title: 'Hello step with Hoya\'s reading line: text sizes and locales (RF-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Hello step (B1) · Largest and 200 % text (the step scrolls, as it does today at these sizes; each frame is the window)</h1>
<div class="board-row">${hl.join('')}</div>
<h1 class="board-title">Hello step (B1) · Spanish and Korean (the line's value is a length-stress draft)</h1>
<div class="board-row">${hloc.join('')}</div></main>`,
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pages = build();
  for (const [name, html] of Object.entries(pages)) writeFileSync(resolve(MOCK, name), html);
  console.log('wrote', Object.keys(pages).join(', '));
}
