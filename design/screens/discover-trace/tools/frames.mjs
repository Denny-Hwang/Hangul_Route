// TC-0b (docs/specs/AMENDMENTS-STAGE1-TRACE-COVERAGE.md section 3.4): the frame builder of this design pass. A design
// tool (not shipped, not run by CI). It writes the static pages under ../mock from one description of the page, so the
// board, the size pages and the measuring tool (measure.mjs) draw exactly the same markup.
//
//   node design/screens/discover-trace/tools/build.mjs       # writes ../mock/*.html (the pages are in build.mjs)
//
// Every UI string is an English dictionary value of packages/i18n (existing keys) or one of the six new keys of the
// spec's section 3.6; taught Korean (the glyphs) always comes with its romanization in the heading.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const MOCK = resolve(here, '../mock');

// ---------------------------------------------------------------------------------------------- strings (en)
export const S = {
  close: 'Close', // ScreenHeader close
  display: 'Display', // the Aa control's accessible name
  stepPill: (n, m) => `${n} / ${m}`, // learner.quest.progress
  title: 'Trace the new letters', // NEW learner.quest.discover.write.title
  pageLabel: (p, c) => `Page ${p} of ${c}`, // learner.quest.discover.pageLabel
  heading: (r) => `Trace the letter ${r}`, // learner.minigame.trace.heading
  headingFinal: (r) => `Trace the final ${r}`, // learner.minigame.trace.headingFinal
  batchimLine: 'Sits at the bottom of the block', // learner.quest.discover.batchimLine
  idle: 'Trace each line slowly.', // NEW learner.quest.discover.write.idle
  keepGoing: 'Keep going, or tap Next letter.', // NEW .write.keepGoing
  keepGoingLast: 'Keep going, or tap Continue.', // NEW .write.keepGoingLast
  praise: 'Beautiful! That looks like the letter.', // learner.minigame.trace.pass.clean
  shapeGuide: 'Shape guide', // learner.minigame.trace.shapeGuide
  hearIt: 'Hear it', // learner.quest.discover.hearIt.cta
  showMe: 'Show me', // learner.minigame.trace.showMe.cta
  clear: 'Clear', // learner.minigame.trace.clear.cta
  next: 'Next letter', // NEW learner.quest.discover.write.next.cta
  previous: 'Previous', // learner.quest.previous.cta
  cont: 'Continue', // learner.quest.discover.continue.cta
  progress: (t, n) => `${t} of ${n} letters traced`, // NEW a11y.discoverWriteProgress
  a11yHeading: (r) => `Trace the letter ${r}`, // a11y.minigame.traceLetter (romanization through a11yRomanization)
  a11yHeadingFinal: (r) => `Trace the final ${r}`, // a11y.minigame.traceFinal
  a11yCanvas: (r) => `Draw the letter ${r} with your finger`, // a11y.minigame.traceCanvas
  a11yLetter: (r) => `Korean letter ${r}`, // a11y.discoverLetter (no sound hint)
  a11yFinal: (r) => `Korean final consonant ${r}`, // a11y.discoverFinal
  soundIsOff: 'Sound is off.', // learner.audio.soundIsOff
  turnOn: 'Turn sound on', // learner.audio.action.turn_on.cta
};

// ---------------------------------------------------------------------------------------------- letters
// Stroke skeletons of apps/mobile/src/content/jamo-strokes.ts on this commit (viewBox 200): the form shown first.
const L = {
  a: { glyph: 'ㅏ', rom: 'a', a11y: 'a', strokes: [[[80, 30], [80, 170]], [[80, 100], [140, 100]]] },
  eo: { glyph: 'ㅓ', rom: 'eo', a11y: 'eo', strokes: [[[60, 100], [120, 100]], [[120, 30], [120, 170]]] },
  g: { glyph: 'ㄱ', rom: 'g/k', a11y: 'g or k', strokes: [[[40, 50], [160, 50], [160, 150]]] },
  n: { glyph: 'ㄴ', rom: 'n', a11y: 'n', strokes: [[[50, 40], [50, 150], [160, 150]]] },
  nF: { glyph: 'ㄴ', rom: 'n', a11y: 'n', final: true, strokes: [[[50, 40], [50, 150], [160, 150]]] },
  ya: { glyph: 'ㅑ', rom: 'ya', a11y: 'ya', strokes: [[[80, 30], [80, 170]], [[80, 80], [140, 80]], [[80, 120], [140, 120]]] },
  yeo: { glyph: 'ㅕ', rom: 'yeo', a11y: 'yeo', strokes: [[[60, 80], [120, 80]], [[60, 120], [120, 120]], [[120, 30], [120, 170]]] },
  p: { glyph: 'ㅍ', rom: 'p', a11y: 'p', strokes: [[[40, 50], [160, 50]], [[70, 50], [70, 150]], [[130, 50], [130, 150]], [[40, 150], [160, 150]]] },
  ngF: { glyph: 'ㅇ', rom: 'ng', a11y: 'ng', final: true, strokes: [Array.from({ length: 25 }, (_, i) => [Math.round((100 - 57.5 * Math.sin((2 * Math.PI * (i % 24)) / 24)) * 10) / 10, Math.round((95 - 57.5 * Math.cos((2 * Math.PI * (i % 24)) / 24)) * 10) / 10])] },
  lF: { glyph: 'ㄹ', rom: 'l', a11y: 'l', final: true, strokes: [[[40, 40], [160, 40], [160, 95]], [[40, 95], [160, 95]], [[40, 95], [40, 150], [160, 150]]] },
};
export const Q1 = [L.a, L.eo, L.g, L.n];
export const Q7 = [L.nF, L.lF];
export const Q8 = [L.ya, L.yeo, L.p, L.ngF];
const d = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
// A learner's ink: the skeleton with a small human wobble (the drawings are illustrations; nothing here is scored).
const wobble = (pts, k) => pts.map(([x, y], i) => [x + ((i + k) % 2 ? 1.5 : -1), y + ((i + k) % 3) - 1]);

// ---------------------------------------------------------------------------------------------- icons
// Glyph geometry of packages/design-system/src/components/Icon/glyphs.ts (24 grid).
const ICON = {
  close: '<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round"/>',
  speaker: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" style="fill: currentColor"/><path d="M16.5 9 Q18.5 12 16.5 15 M19 7 Q22 12 19 17" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"/>',
  speakerOff: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" style="fill: currentColor"/><path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round"/>',
  check: '<path d="M5 12.5 L10 17.5 L19 6.5" style="fill: none; stroke: var(--colors-surface-paper); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round"/>',
};
const icon = (name, size = 24) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

// Hoya (packages/design-system Hoya.tsx geometry, as design/screens/minigame-writing/mock/trace-stroke-states.html).
const HOYA_BODY = '<circle cx="64" cy="64" r="44" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="98" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><circle cx="98" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><path d="M26 54 Q30 58 26 62 M24 70 Q29 73 25 78 M28 84 Q33 86 30 90 M102 54 Q98 58 102 62 M104 70 Q99 73 103 78 M100 84 Q95 86 98 90 M64 24 Q66 30 64 36" style="fill: none; stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round"/><ellipse cx="64" cy="84" rx="26" ry="16" style="fill: var(--colors-hoya-belly)"/>';
const HOYA = {
  idle: `<ellipse cx="64" cy="116" rx="38" ry="5" style="fill: var(--colors-hoya-furDark); opacity: 0.18"/>${HOYA_BODY}<ellipse cx="50" cy="72" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><ellipse cx="78" cy="72" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><circle cx="51.2" cy="70.7" r="0.9" style="fill: var(--colors-surface-paper)"/><circle cx="79.2" cy="70.7" r="0.9" style="fill: var(--colors-surface-paper)"/><circle cx="42" cy="84" r="5" style="fill: var(--colors-hoya-cheek); opacity: 0.6"/><circle cx="86" cy="84" r="5" style="fill: var(--colors-hoya-cheek); opacity: 0.6"/><path d="M58 84 H70 L64 90 Z" style="fill: var(--colors-hoya-nose)"/><path d="M50 92 Q60 100 70 92" style="stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round; fill: none"/>`,
  cheering: `<ellipse cx="64" cy="116" rx="38" ry="5" style="fill: var(--colors-hoya-furDark); opacity: 0.18"/><path d="M22 78 Q14 60 8 46 M106 78 Q114 60 120 46" style="stroke: var(--colors-hoya-fur); stroke-width: 10; stroke-linecap: round; fill: none"/><circle cx="8" cy="46" r="7" style="fill: var(--colors-hoya-fur)"/><circle cx="120" cy="46" r="7" style="fill: var(--colors-hoya-fur)"/>${HOYA_BODY}<ellipse cx="50" cy="70" rx="4" ry="1.6" style="fill: var(--colors-hoya-stripes)"/><ellipse cx="78" cy="70" rx="4" ry="1.6" style="fill: var(--colors-hoya-stripes)"/><circle cx="42" cy="84" r="5" style="fill: var(--colors-hoya-cheek); opacity: 0.6"/><circle cx="86" cy="84" r="5" style="fill: var(--colors-hoya-cheek); opacity: 0.6"/><path d="M58 84 H70 L64 90 Z" style="fill: var(--colors-hoya-nose)"/><path d="M44 92 Q60 110 76 92 Q60 100 44 92 Z" style="fill: var(--colors-hoya-cheek); stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round"/>`,
};
const hoya = (pose) => `<svg class="hoya" width="40" height="40" viewBox="0 0 128 128" aria-hidden="true" focusable="false" data-pose="${pose}">${HOYA[pose]}</svg>`;


// ---------------------------------------------------------------------------------------------- the page
/** The portrait ladder: full (spec rules 1-4), beside (fallback a + Hear it and Show me beside the canvas), compact
 * (beside, no step title), short (compact + the step dots in the header, no page row, tighter gaps, md pinned row),
 * short-b (short without the chips: fallback b). 'spec-a' and 'spec-b' are the spec's own fallbacks on the full
 * arrangement, measured to show where they fall short (never chosen). */
export const PORTRAIT = ['full', 'beside', 'compact', 'short', 'short-b'];
export const SPEC_ONLY = ['spec-a', 'spec-b'];
/** Landscape: side (rule 5), side-short (a short window), side-short-b (side-short without the chips: fallback b). */
export const LANDSCAPE = ['side', 'side-short', 'side-short-b'];

/**
 * One device frame of the trace page.
 * @param {object} o
 *   w, h            window size
 *   arr             'full' | 'compact' | 'short' | 'side' | 'side-short'
 *   roomy           Hoya's figure in the strip (full, on a tall window, as Trace Stroke's roomy mode)
 *   letters, at     the page's letters and the one shown
 *   done            indexes of letters traced to the end on this visit (chips filled)
 *   ink             'none' | 'part' | 'full' (the learner's drawing on the canvas)
 *   look            'idle' | 'pass' (the canvas look)
 *   line            'idle' | 'praise' | 'keepGoing' | 'keepGoingLast' | 'shapeGuide' | 'status'
 *   hint            Show me's untaught shape reveal (ghost aside, the letter in the hint look, as a still)
 *   beat            the 1.1 s advance beat after a finish (Next letter off, no ink taken)
 *   focus           'next' | 'continue': the control drawn with the keyboard / switch focus ring
 *   sideCol         the right column's width in the side arrangements (px)
 */
export function frame(o) {
  const arr0 = o.arr ?? 'full';
  // 'beside' is compact with the step title still drawn; 'spec-a' / 'spec-b' are full with the spec's fallback a / b.
  const arr = arr0 === 'beside' ? 'compact' : arr0 === 'spec-a' || arr0 === 'spec-b' ? 'full' : arr0 === 'side-short-b' ? 'side-short' : arr0 === 'short-b' ? 'short' : arr0;
  const side = arr === 'side' || arr === 'side-short';
  const short = arr === 'short' || arr === 'side-short';
  const letters = o.letters ?? Q1;
  const at = o.at ?? 0;
  const done = new Set(o.done ?? []);
  const cur = letters[at];
  const last = at === letters.length - 1;
  const pages = o.pages ?? 3;

  // ---- QuestPlayerView's chrome: the header, the step dots, the title slot (the step pill is hidden on this page).
  const stepDots = `<div class="dots" role="progressbar" aria-label="Quest steps" aria-valuemin="0" aria-valuemax="6" aria-valuenow="2" aria-valuetext="Step 2 of 6"><i class="on"></i><i class="on"></i><i></i><i></i><i></i><i></i></div>`;
  const stepPill = `<span class="pill" aria-hidden="true">${S.stepPill(2, 6)}</span>`;
  const close = `<button class="hdr-close" type="button">${icon('close')}<span>${S.close}</span></button>`;
  const aa = `<button class="hdr-aa" type="button" aria-label="${S.display}">Aa</button>`;
  const dotsInHeader = short; // the short arrangements: the step dots ride in the header (Trace Stroke's DN-4 rule)
  const header = `<div class="hdr">${close}${dotsInHeader ? `<div class="hdr-mid">${stepDots}${arr === 'side-short' ? stepPill : ''}</div>` : '<div class="hdr-fill"></div>'}${aa}</div>`;
  const showTitle = arr === 'full' || arr === 'side' || arr0 === 'beside';
  const chrome = `${header}${dotsInHeader ? '' : `<div class="stepbar">${stepDots}${stepPill}</div>`}<div class="gap-lg"></div>${showTitle ? `<h1 class="step-title">${S.title}</h1><div class="gap-lg"></div>` : ''}`;

  // ---- The band: the page row, the chips, the heading (and a final's line).
  const showChips = !(arr0 === 'short-b' || arr0 === 'spec-b' || arr0 === 'side-short-b');
  const summary = S.progress(done.size, letters.length);
  const pageDots = `<div class="dots" role="progressbar" aria-label="Pages" aria-valuemin="0" aria-valuemax="${pages}" aria-valuenow="${pages}" aria-valuetext="${S.pageLabel(pages, pages)}">${'<i class="on"></i>'.repeat(pages)}</div>`;
  const chips = `<div class="chips" data-part="chips"><span class="visually-hidden">${summary}</span>${letters
    .map((l, i) => `<span class="chip${i === at ? ' now' : ''}${done.has(i) ? ' done' : ''}${done.has(i) && o.just === i ? ' just' : ''}" aria-hidden="true">${l.glyph}${done.has(i) ? `<span class="mark">${icon('check', 12)}</span>` : ''}</span>`)
    .join('')}</div>`;
  const headText = cur.final ? S.headingFinal(cur.rom) : S.heading(cur.rom);
  // With no chips drawn, their summary moves into the heading's accessible text (spec 3.4 fallback b).
  const headA11y = (cur.final ? S.a11yHeadingFinal(cur.a11y) : S.a11yHeading(cur.a11y)) + (showChips ? '' : `. ${summary}`);
  // The heading holds the room of the page's longest heading (invisible copies under it), and a page with a final keeps
  // the final's line for every letter, so the band, and so the canvas, keep one size across the page's letters.
  const headSizers = letters.map((l) => `<span class="sizer" aria-hidden="true">${l.final ? S.headingFinal(l.rom) : S.heading(l.rom)}</span>`).join('');
  // tabindex -1: focus goes to the heading by script after Next letter (and after the advance when focus was in the pad),
  // as Trace Stroke's heading after Next; it is not a Tab stop.
  const heading = `<h2 class="heading" tabindex="-1" aria-label="${headA11y}">${headSizers}<span aria-hidden="true">${headText}</span></h2>`;
  const pageHasFinal = letters.some((l) => l.final);
  const finalLine = cur.final ? `<p class="final-line">${S.batchimLine}</p>` : pageHasFinal ? `<p class="final-line sizer" aria-hidden="true">${S.batchimLine}</p>` : '';
  // Where the page row is not drawn, its label stays for screen readers (visually hidden, before the heading).
  const pageRow = arr === 'short' || arr === 'side-short' ? `<span class="visually-hidden">${S.pageLabel(pages, pages)}</span>` : `<div class="pagerow"><span class="lbl">${S.pageLabel(pages, pages)}</span>${pageDots}</div>`;
  // full: the chips have their own row above the heading (rule 2); compact and the side ones: at the heading's line end.
  const chipsOwnRow = arr0 === 'full';
  const band = `<div class="band">${pageRow}${chipsOwnRow ? chips : ''}<div class="headrow">${heading}${!chipsOwnRow && showChips ? chips : ''}${finalLine}</div></div>`;

  // ---- The canvas: the ghost (hidden while the untaught shape reveal is up), the ink, the reveal.
  const ghost = o.hint ? '' : cur.strokes.map((s) => `<path class="ghost" d="${d(s)}"/>`).join('');
  const inkStrokes = o.ink === 'full' ? cur.strokes : o.ink === 'part' ? (cur.strokes.length > 1 ? cur.strokes.slice(0, -1) : [cur.strokes[0].slice(0, 2)]) : [];
  const ink = inkStrokes.map((s, k) => `<path class="ink" d="${d(wobble(s, k))}"/>`).join('');
  const reveal = o.hint ? `<g class="reveal">${cur.strokes.map((s) => `<path d="${d(s)}"/>`).join('')}</g>` : '';
  const hintLabel = o.hint ? ` aria-label="${cur.a11y}, ${S.shapeGuide.toLowerCase()}."` : ` aria-label="${S.a11yCanvas(cur.a11y)}"`;
  const canvas = `<div class="canvas${o.look === 'pass' ? ' pass' : ''}" id="trace-canvas" role="img"${hintLabel}><svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${ghost}${ink}${reveal}</svg></div>`;

  // ---- Hoya's strip: the line shown, and invisible copies of the strip's other lines that hold its height.
  const LINES = { idle: S.idle, praise: S.praise, keepGoing: last ? S.keepGoingLast : S.keepGoing, keepGoingLast: S.keepGoingLast, shapeGuide: S.shapeGuide };
  const line = o.line ?? 'idle';
  const pose = line === 'praise' ? 'cheering' : 'idle';
  const sizers = [S.praise, last ? S.keepGoingLast : S.keepGoing, S.idle].map((t) => `<span class="sizer" aria-hidden="true">${t}</span>`).join('');
  // As TraceFeedback: one polite region, always mounted, holds only the lines that are said (praise, keep going); the
  // idle line and "Shape guide" sit beside it, unannounced; the sizer copies are outside both and hidden.
  const said = line === 'praise' || line === 'keepGoing' || line === 'keepGoingLast';
  const strip =
    line === 'status'
      ? `<div class="strip status" data-part="strip"><div class="row" aria-live="polite"><span class="detail">${S.soundIsOff}</span><button class="btn btn-secondary btn-sm" type="button">${S.turnOn}</button></div></div>`
      : `<div class="strip${line === 'praise' ? ' cheering' : ''}" data-part="strip">${hoya(pose)}<div class="lines">${sizers}<div class="live" aria-live="polite">${said ? LINES[line] : ''}</div>${said ? '' : `<span>${LINES[line]}</span>`}</div></div>`;

  // ---- The buttons.
  const hasInk = o.ink && o.ink !== 'none';
  const btn = (cls, label, extra = '') => `<button class="btn ${cls}" type="button"${extra}>${label}</button>`;
  const hear = btn('btn-secondary btn-sm', `${icon('speaker')}<span>${S.hearIt}</span>`, ` aria-label="${S.hearIt}. ${cur.final ? S.a11yFinal(cur.a11y) : S.a11yLetter(cur.a11y)}"`);
  const showMe = (cls = '') => btn(`btn-secondary btn-sm${cls}`, S.showMe, o.hint ? ' aria-disabled="true"' : '');
  const clear = (cls = '') => btn(`btn-ghost btn-sm${cls}`, S.clear, hasInk && !o.beat ? '' : ' aria-disabled="true"');
  // On the last letter Next letter is gone, but its place in the row is kept (empty, not focusable, not read), so the
  // row and the canvas keep their size when the last letter comes up.
  const next = last ? `<span class="btn btn-ghost btn-sm slot-keep" aria-hidden="true">${S.next}</span>` : btn(`btn-ghost btn-sm${o.focus === 'next' ? ' is-focus' : ''}`, S.next, o.beat ? ' aria-disabled="true"' : '');
  // Hear it and Show me (taps that change nothing) beside the canvas in compact and short; Clear and Next letter stay in
  // the row under the strip, away from the canvas edge, so a stroke that runs off the canvas cannot wipe the ink.
  const besideCanvas = arr === 'compact' || arr === 'short';
  const helpers = besideCanvas ? `<div class="helpers">${hear}${showMe()}</div>` : '';
  const row = besideCanvas ? `${clear()}${next}` : `${hear}${showMe()}${clear()}${next}`;
  const controls = `<div class="controls" data-part="controls"><div class="ctrlrow">${row}</div></div>`;

  const pinned = `<div class="pinned"><div class="actions"><button class="btn btn-secondary btn-lg prev" type="button">${S.previous}</button><button class="btn btn-primary btn-lg main${o.focus === 'continue' ? ' is-focus' : ''}" type="button" data-part="continue">${S.cont}</button></div><div class="pinned-gap"></div></div>`;

  let ds;
  if (side) {
    const col = `<div class="side-col">${band}${strip}${controls}${arr === 'side-short' ? pinned : ''}</div>`;
    // The column comes first in reading order (heading before canvas); CSS draws the canvas on the left.
    const box = `<div class="sidebox">${col}<div class="tp" data-part="tp"><div class="work"><div class="slot">${canvas}</div></div></div></div>`;
    ds = `<div class="ds">${box}${arr === 'side' ? pinned : ''}</div>`;
  } else {
    ds = `<div class="ds"><div class="tp" data-part="tp">${band}<div class="work"><div class="slot">${canvas}</div>${helpers}</div>${strip}${controls}</div>${pinned}</div>`;
  }
  const style = side ? ` style="--side-min: ${o.sideCol ?? 358}px"` : '';
  return `<div class="device" style="width: ${o.w}px; height: ${o.h}px" data-w="${o.w}" data-h="${o.h}"><div class="scr a-${arr}${arr0 !== arr ? ` a-${arr0}` : ''}${o.roomy ? ' roomy' : ''}"${style}>${chrome}${ds}</div></div>`;
}

export function page({ title, ts, body, comment }) {
  return `<!doctype html>
<html lang="en"${ts ? ` class="${ts}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="discover-trace.css">
</head>
<body>
<!-- ${comment} -->
${body}
</body>
</html>
`;
}

export const item = (label, frameHtml, note) => `<div class="board-item"><p class="board-label">${label}</p>${frameHtml}${note ? `<p class="note">${note}</p>` : ''}</div>`;
