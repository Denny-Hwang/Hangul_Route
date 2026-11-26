// DC-2a: the pages of this design pass, built from frames.mjs. A design tool (not shipped, not run by CI).
//
//   node design/screens/hangul-check/tools/build.mjs       # writes ../mock/*.html
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLOSED, frame, item, lpFrame, MOCK, OPEN, page, pauseFrame, S } from './frames.mjs';

/** The arrangement the measured ladder picks at each size (tools/measure.mjs --matrix, recorded in the note). */
export const CHOSEN = [
  { w: 320, h: 568, arr: 'tight-row', tag: '320x568' },
  { w: 375, h: 667, arr: 'compact', tag: '375x667' },
  { w: 390, h: 844, arr: 'full', tag: '390x844' },
  { w: 844, h: 390, arr: 'side', tag: '844x390' },
  { w: 667, h: 375, arr: 'side-tight', tag: '667x375' },
  { w: 768, h: 1024, arr: 'full', tag: '768x1024' },
  { w: 1180, h: 820, arr: 'side', tag: '1180x820' },
  { w: 390, h: 844, arr: 'compact', ts: 'ts-largest', tag: '390x844-largest' },
  { w: 375, h: 667, arr: 'tight-row', ts: 'ts-largest', tag: '375x667-largest' },
  { w: 390, h: 844, arr: 'tight-row', ts: 'ts-200', tag: '390x844-200' },
];

const ARR_LABEL = {
  full: 'full',
  compact: 'compact: This one and the help link share a row',
  tight: 'tight: compact, no hint line, sm gaps, This one md',
  'tight-row': 'tight-row: tight, heading and syllable side by side, Hoya in the header',
  side: 'side: prompt column (header, heading, syllable, help) | cards and This one',
  'side-tight': 'side-tight: side, no hint line, sm gaps',
};

const COMMENT = 'Design mock (docs/specs/AMENDMENTS-STAGE1-DECODING-CHECK.md row DC-2a), not shipped code. Built by ../tools/frames.mjs. Every UI string is an English dictionary value of packages/i18n or a key proposed for DC-2d (../README.md, "Strings"). The decode items are illustrative; DC-2b authors the pool.';

// The states of spec 3.5 as one round played through (an open item: 그 among 거 드 그 더, the answer is Sound 3).
export const ST = [
  ['D1 · opens: four sound cards, nothing plays by itself, This one off (drawn from the start), Hoya idle', { it: OPEN }],
  ['D2 · tap Sound 2: its clip plays (the disc fills) and it is selected (the brand ring); This one turns on', { it: OPEN, sel: 1, playing: 1 }],
  ['D3 · tap Sound 4: it plays and takes the selection; Sound 2 is plain again. Playing is never scored', { it: OPEN, sel: 3, playing: 3 }],
  ['D4 · a finger on Sound 3 (the press look: thick border.shape outline, slight shrink), Sound 4 still selected', { it: OPEN, sel: 3, pressed: 2 }],
  ['D5 · This one with Sound 2 selected (the first commit: the scored try): wrong. Amber + replay mark (it still plays on a tap, it cannot be picked again); the selection clears and This one is off; Hoya thinking, no words', { it: OPEN, wrong: [1], justMissed: true }],
  ['D6 · after the miss: Sound 3 selected; Sound 2 tapped again to compare (it plays, the selection stays on Sound 3); This one on', { it: OPEN, wrong: [1], sel: 2, playing: 1 }],
  ['D7 · This one: right. Sound 3 green with the check and plays once more, 그 shows geu, Hoya cheering, the dot fills; the round moves on after the replay', { it: OPEN, wrong: [1], right: true, playing: 2 }],
  ['D8 · a closed item (둠 among 곰 국 둠 독), right on the first try: 둠 shows dum', { it: CLOSED, done: 1, right: true, playing: 2 }],
  ['D9 · keyboard / switch focus on the selected card (the focus ring outside the selection ring)', { it: OPEN, sel: 1, focus: 'card:1' }],
  ['D10 · keyboard / switch focus on This one', { it: OPEN, sel: 1, focus: 'pick' }],
];
export const ST_TEXT = [
  ['N1 · Sound off: each card shows its Latin sound chip, 둠 stays Hangul only; the status line in the hint\'s place, Turn sound on in the help slot', { it: CLOSED, done: 1, text: 'muted' }],
  ['N2 · the clip did not play (a failed or blocked play, the pack failed to load): the chips, "The sound did not play.", Try again', { it: CLOSED, done: 1, text: 'failed', sel: 1 }],
  ['N3 · Show the letters (the learner asked): the chips, each still plays (the small speaker); the help slot is empty and keeps its room', { it: OPEN, text: 'asked', sel: 1, playing: 1 }],
  ['N4 · Can\'t hear it? open: the device line, Show the letters (primary), Hear it (plays the selected card, else Sound 1)', { it: OPEN, sel: 1, sheet: true }],
  ['N5 · Sound off, right: the chips stay, 둠 shows dum', { it: CLOSED, done: 1, text: 'muted', right: true }],
  ['N6 · the clip pack still loading: the board holds the cards (no tap, no look change), Can\'t hear it? is inactive, up to VOICE_CHECK_HOLD_MAX_MS; then D1, or N2 if it failed', { it: OPEN, loading: true }],
];

export function build() {
  const out = {};
  const at = (c, st) => frame({ w: c.w, h: c.h, arr: c.arr, ...st });
  const C375 = CHOSEN[1];
  const C320 = CHOSEN[0];

  // 1. States (spec 3.5) at 375 x 667 (compact), and six of them at 320 x 568 (tight-row).
  out['decode-states.html'] = page({
    title: 'Hangul Check decode round: states (DC-2a) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Decode round · one item played through (spec 3.5, OD-DC10 (a) as amended) at 375 x 667 (compact)</h1>
<div class="board-row">${ST.map(([label, st]) => item(label, at(C375, st))).join('')}</div>
<h1 class="board-title">No sound, a failed play, Show the letters and the Can't hear it? sheet (spec 3.5; AMENDMENTS-AUDIO-CANT-HEAR 3.3, 3.12) at 375 x 667</h1>
<div class="board-row">${ST_TEXT.map(([label, st]) => item(label, at(C375, st))).join('')}</div>
<h1 class="board-title">The same at 320 x 568 (tight-row)</h1>
<div class="board-row">${[ST[0], ST[1], ST[4], ST[6], ST_TEXT[0], ST_TEXT[3]].map(([label, st]) => item(label.split(':')[0], at(C320, st))).join('')}</div></main>`,
  });

  // 2. Every size at standard text in the arrangement it takes (the selected state), and the missed state.
  const std = CHOSEN.filter((c) => !c.ts);
  const sizeItem = (c, st, note) => item(`${c.tag} · ${ARR_LABEL[c.arr]}`, at(c, st), note);
  out['decode-sizes.html'] = page({
    title: 'Hangul Check decode round: sizes (DC-2a) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Decode round · the arrangement each size takes (measured in ../README.md), Sound 2 selected and playing</h1>
<div class="board-row">${std.filter((c) => c.w < c.h).map((c) => sizeItem(c, ST[1][1])).join('')}</div>
<div class="board-row">${std.filter((c) => c.w > c.h).map((c) => sizeItem(c, ST[1][1])).join('')}</div>
<h1 class="board-title">After a miss (D5) and Sound off (N1) at the row's phone sizes</h1>
<div class="board-row">${[C320, C375, CHOSEN[2], CHOSEN[3]].map((c) => sizeItem(c, ST[4][1])).join('')}${[C320, CHOSEN[3]].map((c) => sizeItem(c, ST_TEXT[0][1])).join('')}</div></main>`,
  });

  // 3. Largest text (the app's text size step largest, f = 1.5).
  const lg = CHOSEN.find((c) => c.tag === '390x844-largest');
  const lgSmall = CHOSEN.find((c) => c.tag === '375x667-largest');
  out['decode-largest.html'] = page({
    title: 'Hangul Check decode round: Largest text (DC-2a) - design mock',
    ts: 'ts-largest',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Decode round · Largest text (f = 1.5) on 390 x 844 (compact)</h1>
<div class="board-row">${[ST[0], ST[1], ST[4], ST[6], ST_TEXT[0], ST_TEXT[2]].map(([label, st]) => item(label.split(':')[0], at(lg, st))).join('')}</div>
<h1 class="board-title">Largest on 375 x 667 (tight-row), and 320 x 568 for the record</h1>
<div class="board-row">${[ST[1], ST[4], ST_TEXT[0]].map(([label, st]) => item(label.split(':')[0], at(lgSmall, st))).join('')}
${item('320x568 · Largest · tight-row (not an acceptance size): does not fit, the screen scrolls', frame({ w: 320, h: 568, arr: 'tight-row', ...ST[1][1] }), 'Not an acceptance size. The four cards are on screen; This one and the help slot are under the fold (the Screen scrolls, as Listen & Pick does). Recorded as an open item for DC-2d\'s text-size run.')}</div></main>`,
  });

  // 4. 200 % text (f = 2) on 390 x 844, the stress case.
  const t2 = CHOSEN.find((c) => c.tag === '390x844-200');
  out['decode-200.html'] = page({
    title: 'Hangul Check decode round: 200 % text (DC-2a) - design mock',
    ts: 'ts-200',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Decode round · 200 % text (f = 2) on 390 x 844 (tight-row)</h1>
<div class="board-row">${[ST[1], ST[4], ST[6], ST_TEXT[0]].map(([label, st]) => item(label.split(':')[0], at(t2, st))).join('')}</div></main>`,
  });

  // 5. The version 2 part: one set of dots across the decode, name, final and word segments (spec 3.4, OD-DC11 (a)).
  const W = 375;
  const H = 667;
  // The name asked is a letter neither decode target holds (spec 3.4 step 2): ㅂ, not ㄱ or ㄷ, which the reveals geu
  // and dum have just shown; the final asked (안) is not the closed target's final (ㅁ) either.
  const names = [{ ko: 'ㅂ', rom: 'b/p' }, { ko: 'ㅍ', rom: 'p' }, { ko: 'ㅁ', rom: 'm' }, { ko: 'ㅈ', rom: 'j' }];
  const finals = [{ ko: '악', rom: 'ak' }, { ko: '안', rom: 'an' }, { ko: '알', rom: 'al' }, { ko: '암', rom: 'am' }];
  const part = [
    ['1 · decode (open): DecodeRound, dots 0 of 7', frame({ w: W, h: H, arr: 'compact', it: OPEN, done: 0, n: 1 })],
    ['2 · decode (closed; its initial ㄷ differs from item 1\'s ㄱ), answered: the second dot fills', frame({ w: W, h: H, arr: 'compact', it: CLOSED, done: 1, n: 2, right: true, playing: 2 })],
    ['3 · name: Listen & Pick (review host) opens on the same dots, 2 of 7; its prompt plays by itself (the This one tap was the gesture), so the speaker does not pulse', lpFrame({ w: W, h: H, done: 2, kind: 'name', options: names, answer: 0, playing: true })],
    ['3 · name, answered: the options show their romanization only now (held, spec 3.1); the third dot fills', lpFrame({ w: W, h: H, done: 2, kind: 'name', options: names, answer: 0, right: true })],
    ['6 · final (hear 안, pick the written syllable): dots 5 of 7', lpFrame({ w: W, h: H, done: 5, kind: 'final', options: finals, answer: 1 })],
    ['7 · word (DC-2d: heard, pick the picture; DC-3: read): dots 6 of 7', lpFrame({ w: W, h: H, done: 6, kind: 'word', answer: 2 })],
    ['C · the pause after the part (as built; the line is DC-2d\'s "Nice work! Ready for more?")', pauseFrame({ w: W, h: H })],
  ];
  out['part-v2.html'] = page({
    title: 'Hangul Check version 2: a part with continuing dots (DC-2a) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Version 2 part 1 (2 decode, 3 names, 1 final, 1 word; spec 3.4): one header, one set of 7 fill-only dots across the segments</h1>
<div class="board-row">${part.map(([label, f]) => item(label, f)).join('')}</div>
<p class="note" style="max-width: 1100px">Parts 1-2: 2 decode, 3 names, 1 final, 1 word · parts 3-4: 3, 2, 1, 1 · part 5: 2, 2, 2, 1. Each part runs decode first, then names, then finals, then its word. The dots never say "n / N" on screen, and never go back. The Listen &amp; Pick rounds are drawn only for their header (their own look is F-QUEST-002 section 3.10 with the hold of DC-1a); the app scrolls them as today, so they are not measured here.</p></main>`,
  });

  // 6. Screen reader: the focus order, the names, what is said.
  const a11yNotes = [
    `1 · "${S.stop}", button`,
    `2 · "${S.progress}", progress bar, "${S.progressValue(0, 7)}" (the dots; no count is drawn)`,
    `3 · the round's heading node, focused when the round opens: "${S.a11yRound(1, 7, `${S.heading} ${S.hint} geu`)}" (the syllable read as its sound value, as the text prompt of Read Pick Meaning; known limit, spec 4)`,
    `4-7 · "${S.a11ySound(1, 4)}", button ... "${S.a11ySound(4, 4)}"; selected: "${S.a11ySelected(S.a11ySound(2, 4))}"; activation plays the clip after the reader has said the name`,
    `8 · before a selection: "${S.pick}", dimmed (soft-disabled, still focusable); with Sound 2 selected: "${S.a11yPick(2)}", button`,
    `9 · "${S.cantHear}", button (opens the sheet; focus to its title)`,
    `After a wrong commit, said once (polite): "${S.annMiss(S.sound(2))}"; the card reads "${S.a11yWrong(S.a11ySound(2, 4))}"; focus stays on This one (dimmed again)`,
    `After the right commit, said once: "${S.annRight('geu')}", and only then the right card's replay (announceAndWait); the round moves on when the replay ends + motion.duration.slow, and focus moves to the next round's heading; the card reads "${S.a11yRight(S.a11ySound(3, 4))}"`,
    `A wrong card still plays on activation and reads "${S.a11yWrong(S.a11ySound(2, 4))}"; it is never announced as disabled`,
    `With the chips: "${S.a11ySoundText(1, 4, 'gom')}"`,
  ];
  out['decode-a11y.html'] = page({
    title: 'Hangul Check decode round: screen reader (DC-2a) - design mock',
    comment: COMMENT,
    body: `<main class="board"><h1 class="board-title">Decode round · screen-reader focus order (numbered badges are board notes) and what each stop says</h1>
<div class="board-row">${item('Opens (D1)', frame({ w: W, h: H, arr: 'compact', it: OPEN, anno: true }))}${item('Sound 2 selected (D2)', frame({ w: W, h: H, arr: 'compact', it: OPEN, sel: 1, anno: true }))}<div class="board-item">${a11yNotes.map((t) => `<p class="note">${t}</p>`).join('')}</div></div></main>`,
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pages = build();
  for (const [name, html] of Object.entries(pages)) writeFileSync(resolve(MOCK, name), html);
  console.log('wrote', Object.keys(pages).join(', '));
}
