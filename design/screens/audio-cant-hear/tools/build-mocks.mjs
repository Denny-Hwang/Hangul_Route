#!/usr/bin/env node
// CH-0b (docs/specs/AMENDMENTS-AUDIO-CANT-HEAR.md section 5): writes the mock pages of this design pass from one
// string table, so the boards, the one-state frames and the lengths board never drift apart. A design tool (not
// shipped, not run by CI).
//
//   node design/screens/audio-cant-hear/tools/build-mocks.mjs
//
// English is the spec's section 3.10 table and the shipped `learner.audio` / `common.buttons` values, word for word.
// Spanish and Korean of the new keys are length drafts only (marked on the board); the shipped es and ko values of the
// existing keys are copied from packages/i18n. The reviewed values of the new keys land with CH-1a and CH-2 (drafted
// and reviewed in those PRs, F-I18N-001 section 3.10; spec 3.10).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MOCK = resolve(here, '../mock');
const FRAMES = join(MOCK, 'frames');
mkdirSync(FRAMES, { recursive: true });

/** `new` marks the keys spec 3.10 adds (es and ko are drafts); the rest are shipped values. */
const S = {
  en: {
    cta: "Can't hear it?", // new
    lines: {
      apple: 'Turn off silent mode. Then turn the volume up.', // new
      android: 'Turn up the media volume with the volume buttons.', // new
      computer: 'Turn the volume up. Check that this page is not muted.', // new
    },
    showLetters: 'Show the letters', // new
    alwaysShowLetters: 'Always show the letters', // new (CH-2)
    hearIt: 'Hear it',
    close: 'Close',
    ok: 'OK',
    readHere: 'No sound? Read it here.',
    headingListen: 'Tap the letter you hear',
    headingText: 'Tap the letter for this sound',
    tapToReplay: 'Tap to replay',
    playSound: 'Play sound',
    playSoundOff: 'Play sound, sound is off',
    soundIsOff: 'Sound is off.',
    turnOn: 'Turn sound on',
    mine: 'My settings',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    voiceReady: 'Korean voice: ready',
    noVoice: 'No Korean voice on this device',
    howTo: 'How to add a voice',
    letterName: 'Letter name',
    cont: 'Continue',
    help: {
      title: 'Add a Korean voice',
      note: 'Menu names can differ on your device.',
      footer: 'You can still play: the sound is written on screen.',
      sections: {
        apple: { title: 'iPhone or iPad', steps: ['Open Settings, then Accessibility.', 'Tap Spoken Content, then Voices, then Korean.', 'Download a voice, such as Yuna. Enhanced or Premium sounds best.', 'Come back and reopen Hangul Route.'] },
        android: { title: 'Android', steps: ['Open Settings, then search for Text-to-speech output.', 'Choose Speech Services by Google and tap the gear.', 'Tap Install voice data, then Korean.', 'Come back and reopen Hangul Route.'] },
        computer: { title: 'Computer', steps: ['Mac: System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, then Korean.', 'Windows: Settings, Time & language, Speech, Manage voices, then Add voices and Korean.', 'Chrome and Edge: some Korean voices need the internet, so check you are online.', 'Reload this page.'] },
      },
    },
  },
  es: {
    cta: '¿No se oye?',
    lines: {
      apple: 'Desactiva el modo silencio. Luego sube el volumen.',
      android: 'Sube el volumen multimedia con los botones de volumen.',
      computer: 'Sube el volumen. Revisa que esta página tenga sonido.',
    },
    showLetters: 'Mostrar las letras',
    alwaysShowLetters: 'Mostrar siempre las letras',
    hearIt: 'Escuchar',
    close: 'Cerrar',
    headingListen: 'Toca la letra que escuchas',
    tapToReplay: 'Toca para repetir',
    playSound: 'Oír el sonido',
    mine: 'Mis ajustes',
    sound: 'Sonido',
    on: 'Sí',
    off: 'No',
    voiceReady: 'Voz coreana: lista',
  },
  ko: {
    cta: '소리가 안 들려요?',
    lines: {
      apple: '무음 모드를 꺼요. 그런 다음 볼륨을 올려요.',
      android: '볼륨 버튼으로 미디어 볼륨을 올려요.',
      computer: '볼륨을 올려요. 이 페이지가 음소거되어 있지 않은지 확인해요.',
    },
    showLetters: '글자 보기',
    alwaysShowLetters: '항상 글자 보기',
    hearIt: '들어 보기',
    close: '닫기',
    headingListen: '들리는 글자를 눌러요',
    tapToReplay: '눌러서 다시 듣기',
    playSound: '소리 듣기',
    mine: '내 설정',
    sound: '소리',
    on: '켜짐',
    off: '꺼짐',
    voiceReady: '한국어 음성: 준비됨',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Glyphs: packages/design-system/src/components/Icon/glyphs.ts, path data unchanged (24 x 24, currentColor).
const svg = (inner, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
const G = {
  speaker: svg('<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" style="fill: currentColor"/><path d="M16.5 9 Q18.5 12 16.5 15 M19 7 Q22 12 19 17" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"/>'),
  speakerOff: svg('<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" style="fill: currentColor"/><path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round"/>'),
  ear: svg('<path d="M9 10 A5.5 5.5 0 0 1 20 10 C20 13.5 17 14.5 17 17.5 A3 3 0 0 1 11.5 19" style="fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round"/><path d="M12.5 13 V10.5 A2.5 2.5 0 0 1 17.5 10.5 C17.5 12 15.5 12.5 14 13.5 M6.5 8.5 Q4.5 12 6.5 15.5 M3.5 6.5 Q1 12 3.5 17.5" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"/>'),
  close: svg('<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round"/>'),
};

// ------------------------------------------------------------------------------------------------ parts
/** The link: Button tone ghost size sm. `soft`: inactive while the round holds (softDisabled, still focusable). */
function link(t, { soft = false, glyph = null } = {}) {
  const lead = glyph === 'speakerOff' ? G.speakerOff : glyph === 'ear' ? G.ear : '';
  return `<button class="rn-btn rn-ghost btn-sm ch-link${soft ? ' soft' : ''}" type="button" data-ch="link"${soft ? ' aria-disabled="true"' : ''}>${lead}${esc(t.cta)}</button>`;
}

const TILES = [
  ['ㄴ', 'n'],
  ['ㄱ', 'g/k'],
  ['ㄹ', 'r/l'],
  ['ㄷ', 'd/t'],
];
const tiles = (held) =>
  `<div class="tiles${held ? ' held' : ''}" data-ch="tiles" role="group" aria-label="Answers">${TILES.map(([k, r]) => `<button class="tile" type="button" aria-label="${esc(r)}"><span class="ko" lang="ko" aria-hidden="true">${k}</span><span class="rom" aria-hidden="true">${esc(r)}</span></button>`).join('')}</div>`;

/**
 * Match Sound. state: 'hold' (the voice check is running: link inactive, answers held), 'ok' (played, nothing heard:
 * link active), 'asked' (after Show the letters: the text is up, no link), 'muted' (Sound off: its own panel, no link).
 */
function matchSound(t, { state = 'ok', side = false, glyph = null, focusSpeaker = false, inert = false } = {}) {
  const textUp = state === 'asked' || state === 'muted';
  const heading = textUp ? t.headingText : t.headingListen;
  const speakerLabel = state === 'muted' ? t.playSoundOff : t.playSound;
  const linkHtml = textUp ? '' : link(t, { soft: state === 'hold', glyph });
  const panel = textUp
    ? `<div class="panel" data-ch="panel" aria-live="polite"><span class="kt"><span class="ko" lang="ko">니은</span><span class="rom">nieun</span></span><p class="read-line">${esc(t.readHere)}</p>${state === 'muted' ? `<p class="detail">${esc(t.soundIsOff)}</p><button class="rn-btn rn-secondary" type="button">${esc(t.turnOn)}</button>` : ''}</div>`
    : '<div class="panel-slot" aria-live="polite"></div>';
  return `<div class="ms${side ? ' side' : ''}" data-ch="screen"${inert ? ' inert' : ''}>
<div class="ms-top"><div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="2" aria-label="Round 2 of 4"><i style="width: 50%"></i></div><span class="pill">2 / 4</span></div>
<div class="ms-cols"><div class="ms-prompt" data-ch="prompt"><h1 class="ms-heading">${esc(heading)}</h1>
<div class="speaker-row"><button class="speaker${focusSpeaker ? ' focus-ring' : ''}" type="button" aria-label="${esc(speakerLabel)}" data-ch="speaker">${G.speaker}</button><span class="caption">${esc(t.tapToReplay)}</span>${linkHtml}</div>
${panel}</div>
<div class="ms-answers">${tiles(state === 'hold')}${state === 'hold' ? '<p class="held-note">(answers held until the voice check ends, at most 2 s)</p>' : ''}</div></div>
</div>`;
}

/** Discover (C6): the letter is printed; the guidance-only link sits under the card's buttons, once per page. */
function discover(t, { inert = false } = {}) {
  return `<div class="ms" data-ch="screen"${inert ? ' inert' : ''}>
<div class="ms-top"><div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="2" aria-valuenow="1" aria-label="Page 1 of 2"><i style="width: 50%"></i></div><span class="pill">1 / 2</span></div>
<div class="dc-card"><span class="kt"><span class="ko" lang="ko">ㄱ</span><span class="rom">g/k</span></span>
<button class="rn-btn rn-secondary full" type="button">${G.speaker}${esc(t.hearIt)}</button><button class="rn-btn rn-ghost full" type="button">${esc(t.letterName)}</button>${link(t)}</div>
<div class="dc-foot"><button class="rn-btn rn-hero" type="button">${esc(t.cont)}</button></div>
</div>`;
}

let uid = 0;
/** The Can't hear it? sheet. family: apple | android | computer. guidance: no Show the letters, Hear it primary. */
function sheet(t, family, { guidance = false, capped = false } = {}) {
  uid += 1;
  const id = `ch-title-${uid}`;
  const hear = `<button class="rn-btn ${guidance ? 'rn-primary' : 'rn-secondary'} full" type="button" data-ch="hear">${G.speaker}${esc(t.hearIt)}</button>`;
  const show = guidance ? '' : `<button class="rn-btn rn-primary full" type="button" data-ch="show">${esc(t.showLetters)}</button>`;
  return `<div class="scrim" aria-hidden="true" data-ch="scrim"></div>
<div class="bs${capped ? ' capped' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}" data-ch="sheet" data-family="${family}"${guidance ? ' data-guidance="yes"' : ''}>
<div class="bs-body"><div class="bs-title-row"><h2 class="bs-title" id="${id}" tabindex="-1" data-ch="first-focus">${esc(t.cta)}</h2><button class="bs-close" type="button" aria-label="${esc(t.close)}">${G.close}</button></div>
<p class="bs-line" data-ch="line">${esc(t.lines[family])}</p></div>
<div class="bs-actions">${show}${hear}</div>
</div>`;
}

/** "Add a Korean voice", this device's section only (spec 3.9; P2-22). */
function helpSheet(t, family) {
  uid += 1;
  const id = `vh-title-${uid}`;
  const h = t.help;
  const sec = h.sections[family];
  return `<div class="scrim" aria-hidden="true" data-ch="scrim"></div>
<div class="bs" role="dialog" aria-modal="true" aria-labelledby="${id}" data-ch="sheet" data-family="${family}" data-kind="voice-help">
<div class="bs-body"><div class="bs-title-row"><h2 class="bs-title" id="${id}" tabindex="-1" data-ch="first-focus">${esc(h.title)}</h2><button class="bs-close" type="button" aria-label="${esc(t.close)}">${G.close}</button></div>
<p class="bs-note">${esc(h.note)}</p><div class="bs-section" data-ch="section" data-section="${family}"><h3>${esc(sec.title)}</h3>${sec.steps.map((s, i) => `<p>${i + 1}. ${esc(s)}</p>`).join('')}</div><p class="bs-footer">${esc(h.footer)}</p></div>
<div class="bs-actions"><button class="rn-btn rn-primary full" type="button">${esc(t.ok)}</button></div>
</div>`;
}

/** Profile, My settings: the Sound card with the CH-2 switch under the Sound switch. */
function profile(t, { letters = false, voice = true, inert = false } = {}) {
  const howTo = voice ? '' : `<div><button class="rn-btn rn-ghost" type="button">${esc(t.howTo)}</button></div>`;
  return `<div class="pf" data-ch="screen"${inert ? ' inert' : ''}>
<p class="unchanged">ScreenHeader, the learner's name, stats: unchanged</p>
<h2 class="pf-group">${esc(t.mine)}</h2>
<div class="card-md" data-ch="sound-card">
<button class="sw" type="button" role="switch" aria-checked="true" aria-label="${esc(t.sound)}, ${esc(t.on)}. ${esc(voice ? t.voiceReady : t.noVoice)}"><span class="sw-lead"><span class="on">${G.speaker}</span><span class="sw-text"><span class="sw-label">${esc(t.sound)}</span><span class="caption">${esc(voice ? t.voiceReady : t.noVoice)}</span></span></span><span class="pill on">${esc(t.on)}</span></button>
${howTo}
<div class="divider" aria-hidden="true"></div>
<button class="sw indent" type="button" role="switch" aria-checked="${letters}" data-ch="always-letters"><span class="sw-lead"><span class="sw-text"><span class="sw-label">${esc(t.alwaysShowLetters)}</span></span></span><span class="pill${letters ? ' on' : ''}" aria-hidden="true">${esc(letters ? t.on : t.off)}</span></button>
</div>
<p class="unchanged">Display card (language, text size) and For grown-ups: unchanged</p>
</div>`;
}

// ------------------------------------------------------------------------------------------------ page shells
const head = (title, { solo = false, htmlClass = '' } = {}) => `<!doctype html>
<html lang="en"${htmlClass ? ` class="${htmlClass}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - design mock</title>
<link rel="stylesheet" href="${solo ? '../' : ''}../../app-shell/mock/app-shell.css">
<link rel="stylesheet" href="${solo ? '../' : ''}../../app-shell/mock/display-nav.css">
<link rel="stylesheet" href="${solo ? '../' : ''}cant-hear.css">
</head>
<body${solo ? ' class="fp"' : ''}>
<!-- Design mock (docs/specs/AMENDMENTS-AUDIO-CANT-HEAR.md row CH-0b), not shipped code. Written by ${solo ? '../' : ''}../tools/build-mocks.mjs: edit the tool, not this file. -->
`;
// A sheet body that scrolls gets the scroll cue (README MD11): a rule over the buttons. Re-run on resize and text size.
const foot = `<script>
function cue() { document.querySelectorAll('.bs-body').forEach((b) => b.closest('.bs').classList.toggle('scrolls', b.scrollHeight > b.clientHeight + 1)); }
cue(); window.addEventListener('resize', cue); new MutationObserver(cue).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
document.documentElement.dataset.ready = 'yes';
</script>
</body>
</html>
`;

const frame = (inner, { tablet = false } = {}) => `<div class="ch-frame${tablet ? ' tablet' : ''}"><div class="scroll">${inner.screen}</div>${inner.over ?? ''}</div>`;
const item = (label, title, inner, cls = 'phone') => `<div class="board-item"><p class="board-label">${esc(label)}</p><p class="board-title">${esc(title)}</p><div class="sample ${cls}">${inner}</div></div>`;

const en = S.en;

// The one-state frames, for the viewport shots (360 x 740, 320 x 568 at 200 % text, 1024 x 768).
// `side`: on a tablet landscape window Match Sound is two columns (GameColumns, prompt left, tiles right).
const FRAME_DEFS = {
  'link-hold': { title: 'Match Sound, the round holds: the link is drawn, inactive', make: (side) => ({ screen: matchSound(en, { state: 'hold', side }) }) },
  'link-ready': { title: 'Match Sound, a play that ended "played": the link is active', make: (side) => ({ screen: matchSound(en, { state: 'ok', side }) }) },
  'letters-shown': { title: 'After Show the letters: the text is up, the link is gone, focus on the speaker', make: (side) => ({ screen: matchSound(en, { state: 'asked', side, focusSpeaker: true }) }) },
  'sound-off': { title: 'Sound off (muted): its own panel and action, no link', make: (side) => ({ screen: matchSound(en, { state: 'muted', side }) }) },
  'sheet-apple': { title: 'The sheet on an iPhone or iPad: the Apple line only', make: (side) => ({ screen: matchSound(en, { state: 'ok', side, inert: true }), over: sheet(en, 'apple') }) },
  'sheet-android': { title: 'The sheet on Android: the Android line only', make: (side) => ({ screen: matchSound(en, { state: 'ok', side, inert: true }), over: sheet(en, 'android') }) },
  'sheet-computer': { title: 'The sheet on a computer: the computer line only', make: (side) => ({ screen: matchSound(en, { state: 'ok', side, inert: true }), over: sheet(en, 'computer') }) },
  'sheet-guidance': { title: 'Guidance only (Discover, OD-CH3; the cue rule): no Show the letters, Hear it primary', make: () => ({ screen: discover(en, { inert: true }), over: sheet(en, 'apple', { guidance: true }) }) },
  discover: { title: 'Discover: the guidance-only link under the card buttons', make: () => ({ screen: discover(en) }) },
  'voice-help-apple': { title: 'Add a Korean voice: this device only (iPhone)', make: () => ({ screen: profile(en, { voice: false, inert: true }), over: helpSheet(en, 'apple') }) },
  'profile-sound': { title: 'Profile, My settings: Always show the letters under the Sound switch (CH-2)', make: () => ({ screen: profile(en, { letters: true }) }) },
};

for (const [name, def] of Object.entries(FRAME_DEFS)) {
  // One file; the capture tool sets the window and, for the tablet, the html class `side` so the frame is two columns.
  const phone = def.make(false);
  const tab = def.make(true);
  const html = `${head(`${def.title} (CH-0b frame)`, { solo: true })}<div class="only-phone">${frame(phone)}</div><div class="only-tablet">${frame(tab, { tablet: true })}</div>
${foot}`;
  writeFileSync(join(FRAMES, `${name}.html`), html);
}

// ------------------------------------------------------------------------------------------------ link.html
const glyphRow = `<div class="variant-row">${link(en)}${link(en, { glyph: 'speakerOff' })}${link(en, { glyph: 'ear' })}</div>`;
const linkPage = `${head('Can\'t hear it? link: active, inactive, gone (CH-0b)')}
<div class="board">
<h1 class="page-title">The "Can't hear it?" link</h1>
<p class="annot">AMENDMENTS-AUDIO-CANT-HEAR 3.2, 3.6, 3.11; wireframe design/wireframes/minigame/audio-cant-hear.md C1, C3, C4, C8. Button tone ghost size sm (64 high), after the speaker caption in the speaker row; the row wraps, so at 320, or with large text, the link drops under the caption (at 360 it stays in the row). There from the round's first frame (spec D1); inactive (softDisabled) while the round holds; hidden whenever any text is up. No amber, no red, no X.</p>
<div class="board-grid wide-cols">
${item('L1. the round opens, the voice check holds (at most 2 s)', 'Link drawn, inactive (softDisabled, announced as disabled); the answers are held (TapBoard held: not drawn)', frame(FRAME_DEFS['link-hold'].make(false)))}
${item('L2. a play ended "played", nothing heard (<ok>)', 'Link active; focus order: heading, speaker, link, tiles', frame(FRAME_DEFS['link-ready'].make(false)))}
${item('L3. after Show the letters (<text>, asked)', 'Text heading, the panel: 니은 nieun, the read line, no reason line, no action; the link is gone; focus on the speaker', frame(FRAME_DEFS['letters-shown'].make(false)))}
${item('L4. Sound off (<text: muted>), for comparison', 'The panel has its own action (Turn sound on); no link', frame(FRAME_DEFS['sound-off'].make(false)))}
${item('L5. Discover (C6, OD-CH3): guidance-only link', 'Once per page, under the card buttons; never gates Continue', frame(FRAME_DEFS.discover.make(false)))}
</div>
<div class="board-wide">
${item('L6. tablet landscape, 1024 x 768 (GameColumns side)', 'The link stays in the prompt column, in the speaker row; the tiles never move because of it', frame(FRAME_DEFS['link-ready'].make(true), { tablet: true }), 'tablet-wrap')}
${item('L7. open question 7: a glyph before the words?', 'a. words only (proposed) · b. speaker-off · c. ear. See README MD3: speaker-off is the Sound-off sign, so b would read as "sound is off" on a round whose sound is on.', glyphRow, '')}
</div>
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ sheet.html
const sheetPage = `${head('Can\'t hear it? sheet (CH-0b)')}
<div class="board">
<h1 class="page-title">The "Can't hear it?" sheet</h1>
<p class="annot">Spec 3.3, 3.4, 3.7, 3.10. Built like VoiceHelpSheet: a bottom sheet (paper, radii.xl top corners, padding spacing.lg) over colors.surface.overlay. Title (a heading, first focus), Close at the end of the title row, exactly one line for this device, then Show the letters (primary) and Hear it (secondary, the speaker glyph). The scrim is not an accessibility element; the round behind is inert. Neutral: no Hoya, no amber, no red.</p>
<div class="board-grid wide-cols">
${item('S1. iPhone or iPad (app or browser)', 'The Apple line only', frame(FRAME_DEFS['sheet-apple'].make(false)))}
${item('S2. Android (app or browser)', 'The Android line only', frame(FRAME_DEFS['sheet-android'].make(false)))}
${item('S3. computer (and anything else)', 'The computer line only ("this page": an installed PWA has no tab)', frame(FRAME_DEFS['sheet-computer'].make(false)))}
${item('S4. guidance only (Discover; cue rounds)', 'No Show the letters; Hear it is the primary action', frame(FRAME_DEFS['sheet-guidance'].make(false)))}
</div>
<div class="board-wide">
${item('S5. tablet landscape, 1024 x 768', 'A bottom sheet kept to layout.maxWidth.reading (720), centred (proposed, README MD6 and Q2, pending the owner); the two buttons stay full width of the sheet', frame(FRAME_DEFS['sheet-apple'].make(true), { tablet: true }), 'tablet-wrap')}
</div>
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ help-and-setting.html
const helpPage = `${head('Add a Korean voice (one device) and Always show the letters (CH-0b)')}
<div class="board">
<h1 class="page-title">One-section help sheet and the CH-2 switch</h1>
<p class="annot">Spec 3.9 (P2-22, NB-7): "Add a Korean voice" shows this device's section only; title, note and footer unchanged; the scrim leaves the accessibility tree and focus starts on the title. Row CH-2 (OD-CH1 approved): "Always show the letters", a device switch on Profile's Sound card under the Sound switch; it uses the Sound row's pill (On / Off) and adds no caption (the spec adds one string).</p>
<div class="board-grid wide-cols">
${item('H1. iPhone or iPad', 'Only the Apple steps', frame({ screen: profile(en, { voice: false, inert: true }), over: helpSheet(en, 'apple') }))}
${item('H2. Android', 'Only the Android steps', frame({ screen: profile(en, { voice: false, inert: true }), over: helpSheet(en, 'android') }))}
${item('H3. computer', 'Only the computer steps', frame({ screen: profile(en, { voice: false, inert: true }), over: helpSheet(en, 'computer') }))}
${item('P1. Sound card, voice ready, switch off (the default)', 'Always show the letters: Off', frame({ screen: profile(en, { letters: false }) }))}
${item('P2. switch on', 'Every opted-in round opens with its text; the sound still plays', frame({ screen: profile(en, { letters: true }) }))}
${item('P3. no Korean voice, switch on', 'How to add a voice stays with the voice line, above the divider', frame({ screen: profile(en, { letters: true, voice: false }) }))}
</div>
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ lengths.html
const LANGS = ['en', 'es', 'ko'];
const lengthsPage = `${head('Lengths: en, es, ko at 320 x 568 with 200 % text (CH-0b)', { htmlClass: 't200' })}
<div class="board">
<h1 class="page-title">Lengths at 320 x 568, 200 % text</h1>
<p class="annot">The new strings in three languages at the narrowest phone with 200 % OS text. Spanish and Korean of the new keys are length drafts for this board only, not dictionary values (CH-1a and CH-2 draft and review them, spec 3.10); the other words are the shipped values. Frames are fixed 320 x 568; the screen and the sheet scroll inside; nothing may scroll sideways; every button stays at least 64 high.</p>
${LANGS.map((l) => {
  const t = { ...en, ...S[l], lines: S[l].lines };
  return `<p class="board-title">${l === 'en' ? 'English (spec 3.10)' : l === 'es' ? 'Spanish (new keys: length draft)' : 'Korean (new keys: length draft)'}</p>
<div class="board-grid" lang="${l}">
${item(`${l}: the link in the speaker row`, 'Wraps under the caption', `<div class="ch-frame len">${`<div class="scroll">${matchSound(t, { state: 'ok' })}</div>`}</div>`)}
${item(`${l}: the sheet, longest line (computer)`, 'The sheet scrolls inside; the buttons stay at the bottom', `<div class="ch-frame len"><div class="scroll">${matchSound(t, { state: 'ok', inert: true })}</div>${sheet(t, 'computer')}</div>`)}
${item(`${l}: the CH-2 switch`, 'The label wraps; the pill stays in the row', `<div class="ch-frame len"><div class="scroll">${profile(t, { letters: true })}</div></div>`)}
</div>`;
}).join('\n')}
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ greyscale.html
const greyPage = `${head('Greyscale: the states without colour (CH-0b)')}
<div class="board">
<h1 class="page-title">Greyscale check</h1>
<p class="annot">Every state that changes must read without colour: the inactive link is a filled grey pill with muted words, the active link an outlined pill; the switch says On or Off in words; the two sheet buttons differ by label, by order and by Hear it's speaker glyph (their fills come out as near greys).</p>
<div class="board-grid wide-cols grey">
${item('G1. link inactive (holding)', '', frame(FRAME_DEFS['link-hold'].make(false)))}
${item('G2. link active', '', frame(FRAME_DEFS['link-ready'].make(false)))}
${item('G3. after Show the letters', '', frame(FRAME_DEFS['letters-shown'].make(false)))}
${item('G4. the sheet', '', frame(FRAME_DEFS['sheet-apple'].make(false)))}
${item('G5. guidance only', '', frame(FRAME_DEFS['sheet-guidance'].make(false)))}
${item('G6. switch off / on', '', `<div class="ch-frame"><div class="scroll">${profile(en, { letters: false })}${profile(en, { letters: true })}</div></div>`)}
</div>
</div>
${foot}`;

for (const [name, html] of [
  ['link.html', linkPage],
  ['sheet.html', sheetPage],
  ['help-and-setting.html', helpPage],
  ['lengths.html', lengthsPage],
  ['greyscale.html', greyPage],
]) {
  writeFileSync(join(MOCK, name), html);
  console.log(`wrote mock/${name}`);
}
console.log(`wrote ${Object.keys(FRAME_DEFS).length} frames in mock/frames/`);
