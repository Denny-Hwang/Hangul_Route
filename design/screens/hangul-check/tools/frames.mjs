// DC-2a (docs/specs/AMENDMENTS-STAGE1-DECODING-CHECK.md sections 3.4, 3.5): the frame builder of this design pass. A
// design tool (not shipped, not run by CI). It writes the static pages under ../mock from one description of each
// screen, so the boards, the size pages and the measuring tool (measure.mjs) draw exactly the same markup.
//
//   node design/screens/hangul-check/tools/build.mjs       # writes ../mock/*.html (the pages are in build.mjs)
//
// Every UI string is an English dictionary value of packages/i18n (existing keys) or one of the keys this pass proposes
// for row DC-2d (marked NEW; ../README.md "Strings"). Taught Korean (the syllables) is drawn as KoreanText draws it.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOYA } from './hoya-figure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const MOCK = resolve(here, '../mock');

// ---------------------------------------------------------------------------------------------- strings (en)
export const S = {
  stop: 'Stop the check', // learner.stageReview.leave.close (the header's close; its accessible name)
  heading: 'Read it. Which sound is it?', // NEW learner.stageReview.decode.heading (spec 3.5)
  hint: 'Tap a sound to hear it. Then tap This one.', // NEW learner.stageReview.decode.hint (proposed by DC-2a)
  sound: (n) => `Sound ${n}`, // NEW learner.stageReview.decode.sound (spec 3.5)
  pick: 'This one', // NEW learner.stageReview.decode.pick.cta (spec 3.5)
  cantHear: "Can't hear it?", // learner.audio.cantHear.cta
  lineApple: 'Turn off silent mode. Then turn the volume up.', // learner.audio.cantHear.lines.apple
  showLetters: 'Show the letters', // learner.audio.cantHear.showLetters.cta
  hearIt: 'Hear it', // learner.audio.hearIt.cta
  closeSheet: 'Close', // common.buttons.close
  soundIsOff: 'Sound is off.', // learner.audio.soundIsOff
  turnOn: 'Turn sound on', // learner.audio.action.turn_on.cta
  didNotPlay: 'The sound did not play.', // learner.audio.didNotPlay
  tryAgain: 'Try again', // learner.audio.action.try_again.cta
  // Listen & Pick (review host) and the pause, for the part board
  listenHeading: 'Listen, then pick', // learner.minigame.listenPick.heading
  hearAgain: 'Hear it again', // learner.minigame.listenPick.hearAgain.cta
  pauseFirst: 'Nice work! Ready for more?', // learner.stageReview.pause.first (changed by DC-2d, spec 3.8)
  keepGoing: 'Keep going', // learner.stageReview.pause.keepGoing.cta
  // read aloud, never drawn
  a11yRound: (n, total, prompt) => `Question ${n} of ${total}. ${prompt}`, // a11y.answer.round
  a11ySound: (n, t) => `Sound ${n} of ${t}`, // NEW a11y.minigame.soundOption (spec 3.5)
  a11ySoundText: (n, t, r) => `Sound ${n} of ${t}: ${r}`, // NEW a11y.minigame.soundOptionText (chips shown; DC-2a)
  a11ySelected: (l) => `Selected: ${l}`, // a11y.minigame.option.selected
  a11yWrong: (l) => `Not this one: ${l}`, // a11y.minigame.option.wrong
  a11yRight: (l) => `Right answer: ${l}`, // a11y.minigame.option.correct
  a11yPick: (n) => `This one: Sound ${n}`, // NEW a11y.minigame.pickSound (amended by DC-2a: label in name)
  annMiss: (item) => `Not this one: ${item}. Try another.`, // a11y.answer.miss
  annRight: (item) => `Right answer: ${item}.`, // a11y.answer.right
  a11yHearAgain: 'Play the sound again', // a11y.minigame.hearAgain
  progress: 'Progress', // a11y.progress.name
  progressValue: (d, t) => `${d} of ${t}`, // a11y.progress.value
};

// ---------------------------------------------------------------------------------------------- items
// Illustrative decode items in the balanced sets of spec 3.4 (OD-DC5 (a)); row DC-2b authors the real pool. No target
// is a block a Stage 1 quest shows (곰, a Stage 1 word, is only an option), and no option is a carrier, a Decoding
// Sprint probe block or a Hangul Check word block. The two targets have different initials (spec 3.4 step 1). 그 is in
// the sprint's drill pool (preferred out, not excluded); 둠 and 독 have no clip yet (DC-2c). Option order is the order
// drawn (Sound 1..4).
/** Open target 그 in the 2 x 2 set {CV, C'V, CV', C'V'} = 그 드 거 더 (initial g-d, vowel eu-eo). */
export const OPEN = { target: '그', rom: 'geu', answer: 2, options: [{ ko: '거', rom: 'geo' }, { ko: '드', rom: 'deu' }, { ko: '그', rom: 'geu' }, { ko: '더', rom: 'deo' }] };
/** Closed target 둠 in {CVF, C'V'F, C'VF', CV'F'} = 둠 곰 국 독 (initial d-g, vowel u-o, final m-k). */
export const CLOSED = { target: '둠', rom: 'dum', answer: 2, options: [{ ko: '곰', rom: 'gom' }, { ko: '국', rom: 'guk' }, { ko: '둠', rom: 'dum' }, { ko: '독', rom: 'dok' }] };

// ---------------------------------------------------------------------------------------------- icons
// Glyph geometry of packages/design-system/src/components/Icon/glyphs.ts (24 grid).
const ICON = {
  close: '<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round"/>',
  speaker: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" style="fill: currentColor"/><path d="M16.5 9 Q18.5 12 16.5 15 M19 7 Q22 12 19 17" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"/>',
  check: '<path d="M5 12.5 L10 17.5 L19 6.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round"/>',
  replay: '<path d="M19.5 12 A7.5 7.5 0 1 1 12 4.5" style="fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round"/><path d="M12 1 L17 4.5 L12 8 Z" style="fill: currentColor"/>',
};
export const icon = (name, size = 24) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;
/** A screen-reader focus-order badge (board annotation, not UI). */
const badge = (n) => `<span class="anno" aria-hidden="true">${n}</span>`;
const hoya = (pose, cls = 'hoya') => `<svg class="${cls}" viewBox="0 0 128 128" aria-hidden="true" focusable="false" data-pose="${pose}">${HOYA[pose]}</svg>`;

// A neutral picture placeholder for the word round (the theme pictures are F-QUEST-002's art; not redrawn here).
const picArt = (k) => `<svg class="pic-art" viewBox="0 0 96 80" aria-hidden="true" focusable="false"><rect x="4" y="4" width="88" height="72" rx="12" style="fill: var(--colors-surface-sunken); stroke: var(--colors-border-subtle); stroke-width: 2"/><circle cx="${28 + k * 10}" cy="30" r="10" style="fill: var(--colors-border-strong)"/><path d="M12 68 L40 40 L58 58 L70 46 L86 68 Z" style="fill: var(--colors-border-strong)"/></svg>`;

// ---------------------------------------------------------------------------------------------- shared chrome
/** The header: Stop the check, then the part's 7 dots (fill-only; one Progress for every segment of the part). */
export function header(done, total = 7, focus = false, hoyaPose = null, anno = false) {
  const dots = `<div class="dots" role="progressbar" aria-label="${S.progress}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-valuetext="${S.progressValue(done, total)}">${anno ? badge(2) : ''}${Array.from({ length: total }, (_, i) => `<i${i < done ? ' class="on"' : ''}></i>`).join('')}</div>`;
  return `<div class="hdr"><button class="hdr-close${focus ? ' is-focus' : ''}" type="button" aria-label="${S.stop}">${anno ? badge(1) : ''}${icon('close')}</button>${dots}${hoyaPose ? hoya(hoyaPose, 'hoya hdr-hoya') : ''}</div>`;
}

export function page({ title, ts, body, comment }) {
  return `<!doctype html>
<html lang="en"${ts ? ` class="${ts}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="hangul-check.css">
</head>
<body>
<!-- ${comment} -->
${body}
</body>
</html>
`;
}

export const item = (label, frameHtml, note) => `<div class="board-item"><p class="board-label">${label}</p>${frameHtml}${note ? `<p class="note">${note}</p>` : ''}</div>`;

// ---------------------------------------------------------------------------------------------- the decode round
/** Portrait ladder (../README.md "Arrangements") and the landscape ones. */
export const PORTRAIT = ['full', 'compact', 'tight', 'tight-row'];
export const LANDSCAPE = ['side', 'side-tight'];

/**
 * One device frame of the decode round (spec 3.5, wireframe B2).
 * @param {object} o
 *   w, h        window size
 *   arr         'full' | 'compact' | 'tight' | 'side' | 'side-tight'
 *   it          OPEN | CLOSED (the item)
 *   n           the item's place in the part (1-based; the round's spoken heading), done = dots filled before it
 *   sel         index selected (not committed) or null
 *   playing     index whose clip is playing or null
 *   wrong       indexes committed wrong (amber, locked)
 *   right       true once the right card is committed (the round resolved)
 *   text        null | 'muted' | 'failed' | 'asked': the Latin chips show (no sound / Show the letters)
 *   sheet       the Can't hear it? sheet is open
 *   focus       'card:<i>' | 'pick' | 'close' (the keyboard / switch focus ring)
 *   pressed     index under a finger (press look)
 *   anno        draw the screen-reader focus order badges (board annotation)
 */
export function frame(o) {
  const it = o.it ?? OPEN;
  const arr = o.arr ?? 'full';
  const side = arr === 'side' || arr === 'side-tight';
  const wrong = new Set(o.wrong ?? []);
  const resolved = o.right === true;
  const done = (o.done ?? 0) + (resolved ? 1 : 0);
  const n = o.n ?? (o.done ?? 0) + 1;
  const chips = o.text !== null && o.text !== undefined;
  const pose = resolved ? 'cheering' : wrong.size > 0 ? 'thinking' : 'idle';
  const sel = resolved ? null : o.sel ?? null;
  const N = it.options.length;

  // ---- The round's header node: heading and hint (drawn, or kept for the spoken heading in the tight arrangements),
  // and the syllable's romanization read as a sound value, as Listen & Pick's text-prompt label (§3.1: names unchanged).
  const status = o.text === 'muted' ? S.soundIsOff : o.text === 'failed' ? S.didNotPlay : null;
  const hintLine = status ?? S.hint;
  const spoken = S.a11yRound(n, 7, `${S.heading} ${hintLine} ${it.rom}`);
  const hintEl = `<p class="hint${status ? ' status' : ''}" aria-hidden="true">${hintLine}</p>`;
  const rhead = `<div class="rhead" role="heading" aria-level="2" tabindex="-1" aria-label="${spoken}" data-part="rhead">${o.anno ? badge(3) : ''}<h2 class="heading" aria-hidden="true">${S.heading}</h2>${hintEl}</div>`;

  // ---- The syllable panel (the Hangul only; the romanization line held until the right commit).
  // tight-row: Hoya moves to the header's end (the panel is narrow beside the heading).
  const row = arr === 'tight-row';
  const panel = `<div class="panel" aria-hidden="true" data-part="panel">${row ? '' : hoya(pose)}<span class="syl" lang="ko">${it.target}</span><span class="rom${resolved ? '' : ' held'}">${it.rom}</span></div>`;

  // ---- The four sound cards.
  const cards = it.options
    .map((op, i) => {
      const isRight = resolved && i === it.answer;
      const isWrong = wrong.has(i);
      const state = isRight ? 'correct' : isWrong ? 'wrong' : 'idle';
      const playing = o.playing === i;
      const selected = sel === i;
      const label = chips ? S.a11ySoundText(i + 1, N, op.rom) : S.a11ySound(i + 1, N);
      const name = isRight ? S.a11yRight(label) : isWrong ? S.a11yWrong(label) : selected ? S.a11ySelected(label) : label;
      const media = chips
        ? `<span class="chip" lang="ko-Latn">${o.text === 'asked' ? icon('speaker', 20) : ''}${op.rom}</span>`
        : `<span class="disc">${icon('speaker')}</span>`;
      const mark = isRight ? `<span class="mark">${icon('check')}</span>` : isWrong ? `<span class="mark">${icon('replay')}</span>` : '';
      // The target is the card and its selection ring with the ring's padding (Pic-Word Match's targetStyle): a touch on
      // the ring is a touch on the card, never a dead ring. A wrong card still plays on a tap but cannot be selected;
      // once resolved every card is inactive in the board (TapTarget), never announced as disabled (ChoiceCard).
      const cls = `card ${state}${playing ? ' playing' : ''}${o.pressed === i ? ' pressed' : ''}`;
      const tcls = `target${selected ? ' selected' : ''}${o.focus === `card:${i}` ? ' is-focus' : ''}`;
      return `<button class="${tcls}" type="button" aria-label="${name}" data-part="target" data-rom="${op.rom}">${o.anno ? badge(4 + i) : ''}<span class="${cls}" data-part="card">${media}<span class="lbl" aria-hidden="true">${S.sound(i + 1)}</span><span class="mark-slot">${mark}</span></span></button>`;
    })
    .join('');
  const grid = `<div class="grid" data-part="grid">${cards}</div>`;

  // ---- This one: drawn from the start, soft-disabled until a card is selected (OD-DC10 as amended by this pass).
  const pickOn = sel !== null && !resolved;
  const pick = `<button class="btn btn-primary btn-lg pick${o.focus === 'pick' ? ' is-focus' : ''}" type="button" data-part="pick" aria-label="${pickOn ? S.a11yPick(sel + 1) : S.pick}"${pickOn ? '' : ' aria-disabled="true"'}>${o.anno ? badge(8) : ''}${S.pick}</button>`;
  // The help slot: the Can't hear it? link while no text shows; the status action when a play cannot sound; nothing once
  // the learner asked (Show the letters).
  const loading = o.loading === true;
  const helpBtn =
    o.text === 'muted'
      ? `<button class="btn btn-secondary btn-sm" type="button" data-part="help">${S.turnOn}</button>`
      : o.text === 'failed'
        ? `<button class="btn btn-secondary btn-sm" type="button" data-part="help">${S.tryAgain}</button>`
        : o.text === 'asked'
          ? ''
          : `<button class="btn btn-ghost btn-sm" type="button" data-part="help"${loading ? ' aria-disabled="true"' : ''}>${o.anno ? badge(9) : ''}${S.cantHear}</button>`;
  // The slot keeps its room when it is empty, so This one never changes size when the link goes or changes.
  const help = `<div class="help-slot">${helpBtn}</div>`;

  // ---- The polite region (one, always mounted): the result of a commit, said once.
  const said = resolved ? S.annRight(it.rom) : wrong.size > 0 && o.justMissed ? S.annMiss(S.sound([...wrong].pop() + 1)) : '';
  const live = `<div class="visually-hidden" aria-live="polite">${said}</div>`;

  let body;
  if (side) {
    // Landscape: the header rides at the top of the prompt column, so the answers column has the window's full height.
    // The order is the portrait one (cards, This one, then the help slot), so rotating never changes the focus order.
    body = `<div class="cols"><div class="pcol">${header(done, 7, o.focus === 'close', null, o.anno)}${rhead}${panel}</div><div class="acol">${grid}<div class="acts">${pick}${help}</div></div></div>`;
  } else {
    const top = row ? `<div class="toprow">${rhead}${panel}</div>` : `${rhead}${panel}`;
    body = `${header(done, 7, o.focus === 'close', row ? pose : null, o.anno)}<div class="round">${top}${grid}<div class="acts">${pick}${help}</div></div>`;
  }
  const sheet = o.sheet
    ? `<div class="scrim" aria-hidden="true"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ch-title"><div class="sheet-hd"><h2 id="ch-title" tabindex="-1">${S.cantHear}</h2><button class="hdr-close" type="button" aria-label="${S.closeSheet}">${icon('close')}</button></div><p class="sheet-line">${S.lineApple}</p><button class="btn btn-primary" type="button">${S.showLetters}</button><button class="btn btn-secondary" type="button">${icon('speaker')}<span>${S.hearIt}</span></button></div>`
    : '';
  return `<div class="device" style="width: ${o.w}px; height: ${o.h}px" data-w="${o.w}" data-h="${o.h}"><div class="scr a-${arr}"${o.sheet ? ' inert' : ''}>${body}${live}</div>${sheet}</div>`;
}

// ---------------------------------------------------------------------------------------------- Listen & Pick (review)
/**
 * A name, final or word round of Listen & Pick in the review host (F-QUEST-002 section 3.10; options held, spec 3.1),
 * drawn only to show the part's one set of dots. Not measured: the app scrolls these rounds as today.
 * @param {object} o  w, h, done (dots filled), kind 'name' | 'final' | 'word', options, answer, right
 */
export function lpFrame(o) {
  const right = o.right === true;
  const done = o.done + (right ? 1 : 0);
  const opts = o.kind === 'word'
    ? [0, 1, 2, 3].map((k) => `<div class="opt pic${right && k === o.answer ? ' correct' : ''}" role="button" tabindex="0">${picArt(k)}${right && k === o.answer ? `<span class="end" style="position: absolute; top: var(--spacing-xs); right: var(--spacing-xs)">${icon('check')}</span>` : ''}</div>`).join('')
    : o.options.map((op, k) => `<div class="opt${right && k === o.answer ? ' correct' : ''}" role="button" tabindex="0"><span class="ko"><b lang="ko">${op.ko}</b><i class="${right ? 'shown' : ''}">${op.rom}</i></span><span class="end">${right && k === o.answer ? icon('check') : ''}</span></div>`).join('');
  return `<div class="device" style="width: ${o.w}px; height: ${o.h}px"><div class="scr a-lp">${header(done)}<div class="lp"><h2 class="heading">${S.listenHeading}</h2><div class="lp-prompt"><span class="speaker${o.playing ? ' playing' : ''}" role="button" aria-label="${S.a11yHearAgain}">${icon('speaker', 48)}</span><button class="btn btn-secondary" type="button">${S.hearAgain}</button><button class="btn btn-ghost btn-sm" type="button">${S.cantHear}</button></div><div class="lp-opts">${opts}</div></div></div></div>`;
}

/** The pause between parts (C), as built (StageReviewScreen pause phase): Hoya cheering 120, the line, Keep going (hero). */
export function pauseFrame(o) {
  return `<div class="device" style="width: ${o.w}px; height: ${o.h}px"><div class="scr"><div class="pause">${hoya('cheering', 'hoya-lg')}<p>${S.pauseFirst}</p><button class="btn btn-primary btn-hero" type="button">${S.keepGoing}</button></div></div></div>`;
}
