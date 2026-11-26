// TC-0b: the pages of this design pass, built from frames.mjs. A design tool (not shipped, not run by CI).
//
//   node design/screens/discover-trace/tools/build.mjs       # writes ../mock/*.html
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { frame, item, MOCK, page, Q1, Q7, Q8 } from './frames.mjs';

/** The arrangement the measured ladder picks at each size (tools/measure.mjs --matrix, recorded in the note). */
export const CHOSEN = [
  { w: 320, h: 568, arr: 'short', tag: '320x568' },
  { w: 375, h: 553, arr: 'short-b', tag: '375x553' },
  { w: 375, h: 667, arr: 'compact', tag: '375x667' },
  { w: 844, h: 390, arr: 'side-short', tag: '844x390', side: true },
  { w: 390, h: 844, arr: 'full', roomy: true, tag: '390x844' },
  { w: 768, h: 1024, arr: 'full', roomy: true, tag: '768x1024' },
  { w: 1180, h: 820, arr: 'side', tag: '1180x820', side: true },
  { w: 390, h: 844, arr: 'beside', ts: 'ts-largest', tag: '390x844-largest' },
  { w: 390, h: 844, arr: 'short', ts: 'ts-200', tag: '390x844-200' },
];
const panel = (w) => Math.max(240, Math.min(380, Math.floor(Math.min(w - 2 * (w >= 900 ? 32 : w >= 600 ? 24 : 16), 720) * 0.45)));

const ARR_LABEL = {
  full: 'full (spec rules 1-4)',
  beside: 'beside: fallback (a) + Hear it and Show me beside the canvas',
  compact: 'compact: beside + no step title',
  short: 'short: compact + step dots in the header, no page row, md pinned row',
  'short-b': 'short-b: short without the chips (fallback b)',
  side: 'side (spec rule 5)',
  'side-short': 'side-short: rule 5 + step dots in the header, no title, pinned row in the column',
  'side-short-b': 'side-short + no chips (fallback b)',
};

const IDLE = { letters: Q1, at: 0, line: 'idle' };
const Q8_IDLE = { letters: Q8, at: 1, done: [0], line: 'idle' };
const COMMENT = 'Design mock (docs/specs/AMENDMENTS-STAGE1-TRACE-COVERAGE.md row TC-0b), not shipped code. Built by ../tools/frames.mjs. Every UI string is an English dictionary value of packages/i18n or one of the new keys of the spec section 3.6.';

export function build() {
  const out = {};
  const sizeItem = (c, st = IDLE, note = '') =>
    item(`${c.tag} · ${ARR_LABEL[c.arr]}`, frame({ w: c.w, h: c.h, arr: c.arr, roomy: c.roomy, sideCol: panel(c.w), ...st }), note);

  // 1. Every acceptance size at standard text, quest 1's first letter.
  const std = CHOSEN.filter((c) => !c.ts);
  out['trace-new-letters-sizes.html'] = page({
    title: 'Trace the new letters: sizes (TC-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Trace the new letters · the arrangement each size takes (spec 3.4; measured in ../trace-new-letters.md)</h1>
<div class="board-row">${std.filter((c) => !c.side).map((c) => sizeItem(c)).join('')}</div>
<div class="board-row">${std.filter((c) => c.side).map((c) => sizeItem(c)).join('')}</div>
<h1 class="board-title">The arrangement is chosen per page: quest 8's page (ㅑ ㅕ ㅍ, final ㅇ) keeps a final's line for every letter</h1>
<div class="board-row">${sizeItem({ w: 375, h: 667, arr: 'short', tag: '375x667 · quest 8' }, Q8_IDLE)}${sizeItem({ w: 390, h: 844, arr: 'full', roomy: true, tag: '390x844 · quest 8' }, Q8_IDLE)}${sizeItem({ w: 844, h: 390, arr: 'side-short-b', tag: '844x390 · quest 8' }, Q8_IDLE)}</div></main>`,
  });

  // 2. The states of spec 3.3 at 390 x 844 (full) and at 320 x 568 (short).
  const at = (w, h, arr, roomy, st) => frame({ w, h, arr, roomy, ...st });
  const S = [
    ['T1 · opens: ㅏ shown, nothing drawn, nothing plays', { letters: Q1, at: 0, line: 'idle' }],
    ['T2 · ㅏ finished (1.5 s after the lift): success look, praise, chip filled; 1.1 s beat: no ink, Next letter off', { letters: Q1, at: 0, done: [0], ink: 'full', look: 'pass', line: 'praise', beat: true }],
    ['T3 · after the beat: ㅓ on an empty canvas, idle line', { letters: Q1, at: 1, done: [0], line: 'idle' }],
    ['T4 · ㄱ, unfinished ink, 3 s with no touch: keep going (ㅓ was passed with Next letter: its chip stays plain)', { letters: Q1, at: 2, done: [0], ink: 'part', line: 'keepGoing' }],
    ['T5 · Show me on ㄱ (untaught): the ghost steps aside, the letter fades in whole; "Shape guide"; the reduced-motion still is the same picture', { letters: Q1, at: 2, done: [0], hint: true, line: 'shapeGuide' }],
    ['T6 · last letter ㄴ finished: the praise stays, no Next letter; Clear lets the learner trace it again', { letters: Q1, at: 3, done: [0, 2, 3], ink: 'full', look: 'pass', line: 'praise' }],
    ['T7 · last letter, unfinished ink after 3 s: the line names Continue', { letters: Q1, at: 3, done: [0, 2], ink: 'part', line: 'keepGoingLast' }],
    ['T8 · a final (quest 7, final ㄴ): "Trace the final n" and the batchim line', { letters: Q7, at: 0, line: 'idle' }],
    ['T9 · Hear it could not sound (sound off): the status row takes the strip\'s place, same height', { letters: Q1, at: 2, done: [0], line: 'status' }],
    ['T10 · keyboard / switch focus on Next letter (border.focus ring)', { letters: Q1, at: 1, done: [0], line: 'idle', focus: 'next' }],
  ];
  out['trace-new-letters-states.html'] = page({
    title: 'Trace the new letters: states (TC-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Trace the new letters · states (spec 3.3) at 390 x 844 (full)</h1>
<div class="board-row">${S.map(([label, st]) => item(label, at(390, 844, 'full', true, st))).join('')}</div>
<h1 class="board-title">The same states at 320 x 568 (short)</h1>
<div class="board-row">${S.filter((_, i) => [1, 3, 4, 5, 7, 8].includes(i)).map(([label, st]) => item(label.split(':')[0], at(320, 568, 'short', false, st))).join('')}</div></main>`,
  });

  // 3. Largest text (the app's text size step, f = 1.5) on 390 x 844: the acceptance size; 320 x 568 for reference.
  const lg = CHOSEN.find((c) => c.tag === '390x844-largest');
  out['trace-new-letters-largest.html'] = page({
    title: 'Trace the new letters: Largest text (TC-0b) - design mock',
    ts: 'ts-largest',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Trace the new letters · Largest text (text-size step largest, f = 1.5)</h1>
<div class="board-row">${sizeItem(lg)}${sizeItem(lg, S[1][1])}${sizeItem(lg, S[7][1])}${sizeItem(lg, S[8][1])}
${item('320x568 · Largest · short (not an acceptance size): does not fit, see the note', frame({ w: 320, h: 568, arr: 'short', ...IDLE }), 'Not an acceptance size (spec 3.4 asks for Largest on 390 x 844 only). Even the short arrangement leaves a canvas slot of about 65: the heading, the strip and every button label grow with the text, and Previous and Continue no longer share a line. Drawn here as the open item it is: the 160 canvas runs over the strip. Left to TC-1b\'s text-size-fit run.')}</div></main>`,
  });

  // 4. 200 % text (f = 2) on 390 x 844, the stress case.
  const t2 = CHOSEN.find((c) => c.tag === '390x844-200');
  out['trace-new-letters-200.html'] = page({
    title: 'Trace the new letters: 200 % text (TC-0b) - design mock',
    ts: 'ts-200',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Trace the new letters · 200 % text (f = 2: the Largest step on top of a 133 % system size, or a browser at 200 %)</h1>
<div class="board-row">${sizeItem(t2)}${sizeItem(t2, S[1][1])}${sizeItem(t2, S[3][1])}</div></main>`,
  });

  // 5. The spec as written (rules 1-5 and its fallbacks a, b) at the sizes where it does not fit.
  const fail = [
    { w: 320, h: 568, arr: 'spec-b', tag: '320x568 · rules 1-4 + fallback b' },
    { w: 375, h: 667, arr: 'spec-b', tag: '375x667 · rules 1-4 + fallback b' },
    { w: 844, h: 390, arr: 'side', tag: '844x390 · rule 5' },
  ];
  out['trace-new-letters-spec-only.html'] = page({
    title: 'Trace the new letters: the spec rules alone (TC-0b) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">The spec's rules 1-5 with its fallbacks (a) and (b) alone: where they do not fit (why the ladder in the note adds steps)</h1>
<div class="board-row">${fail.map((c) => item(c.tag, frame({ w: c.w, h: c.h, arr: c.arr, sideCol: panel(c.w), ...IDLE }), 'The canvas keeps its floor of 160 and runs over the strip and the controls; the controls (a scroll view) shrink to nothing.')).join('')}</div></main>`,
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pages = build();
  for (const [name, html] of Object.entries(pages)) writeFileSync(resolve(MOCK, name), html);
  console.log('wrote', Object.keys(pages).join(', '));
}
