#!/usr/bin/env node
// DP-0b (docs/specs/AMENDMENTS-DURABLE-PROGRESS.md section 5): writes the four mock pages of this design pass from one
// string table, so the English board and the three-language lengths board never drift apart. A design tool (not
// shipped, not run by CI).
//
//   node design/screens/system/progress-read-failed/tools/build-mocks.mjs
//
// English is the spec's section 3.8 table, word for word. Spanish and Korean are length drafts only (marked on the
// board): the reviewed values land with DP-1c, DP-1d and DP-2 through R8 and the F-I18N-001 section 3.10 review.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MOCK = resolve(here, '../mock');

/** Section 3.8 (en) and length drafts (es, ko). `grownUp.*` keys: see README decision D9 (namespace). */
const S = {
  en: {
    title: 'We could not open your progress.',
    body: "Nothing was erased. Let's try again.",
    bubble: 'Hmm, the box is stuck.',
    tryAgain: 'Try again',
    chooseAnother: 'Choose another learner',
    grownUpHelp: 'A grown-up can help',
    stillStuck: 'Still stuck? Close the app and open it again.',
    recoverTitle: 'This record is damaged.',
    recoverBody: 'We kept a copy of it on this device.',
    fresh: 'Start fresh on this device',
    notNow: 'Not now',
  },
  es: {
    title: 'No pudimos abrir tu progreso.',
    body: 'No se borró nada. Intentémoslo de nuevo.',
    bubble: 'Mmm, la caja está atascada.',
    tryAgain: 'Reintentar',
    chooseAnother: 'Elegir otro estudiante',
    grownUpHelp: 'Un adulto puede ayudar',
    stillStuck: '¿Sigue sin abrirse? Cierra la app y ábrela de nuevo.',
    recoverTitle: 'Este registro está dañado.',
    recoverBody: 'Guardamos una copia en este dispositivo.',
    fresh: 'Empezar de cero en este dispositivo',
    notNow: 'Ahora no',
  },
  ko: {
    title: '진도를 열지 못했어요.',
    body: '지워진 건 없어요. 다시 해 봐요.',
    bubble: '음, 상자가 안 열려요.',
    tryAgain: '다시 해 보기',
    chooseAnother: '다른 학습자 고르기',
    grownUpHelp: '어른이 도와줄 수 있어요',
    stillStuck: '그래도 안 되나요? 앱을 닫았다가 다시 열어 봐요.',
    recoverTitle: '이 기록이 손상됐어요.',
    recoverBody: '이 기기에 사본을 보관해 두었어요.',
    fresh: '이 기기에서 새로 시작하기',
    notNow: '나중에',
  },
};

/** The four quiet lines (section 3.8, DP-2), English only, and the existing strings drawn around them. */
const LINES = {
  saveLater: 'We could not save this yet. Keep the app open and we will try again.',
  profileTrouble: 'This device is having trouble saving. Free up some space, then open the app again.',
  grownUpTrouble: 'This device could not save some progress. Free up some space on it.',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Hoya `thinking` (as the other mocks draw it: a thought bubble top right). */
const HOYA_SYMBOL = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><symbol id="hoya-thinking" viewBox="0 0 128 128"><ellipse cx="64" cy="116" rx="38" ry="5" style="fill: var(--colors-hoya-furDark); opacity: 0.18"/><circle cx="64" cy="64" r="44" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="98" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><circle cx="98" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><path d="M26 54 Q30 58 26 62 M24 70 Q29 73 25 78 M28 84 Q33 86 30 90 M102 54 Q98 58 102 62 M104 70 Q99 73 103 78 M100 84 Q95 86 98 90 M64 24 Q66 30 64 36" style="fill: none; stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round"/><ellipse cx="64" cy="84" rx="26" ry="16" style="fill: var(--colors-hoya-belly)"/><ellipse cx="52" cy="70" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><ellipse cx="80" cy="70" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><path d="M54 94 H72" style="stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round; fill: none"/><circle cx="110" cy="18" r="7" style="fill: var(--colors-surface-paper); stroke: var(--colors-border-strong); stroke-width: 2"/><circle cx="100" cy="32" r="3" style="fill: var(--colors-surface-paper); stroke: var(--colors-border-strong); stroke-width: 2"/><path d="M58 84 H70 L64 90 Z" style="fill: var(--colors-hoya-nose)"/></symbol></svg>`;

/** HoyaBubble tone thinking: its own Hoya (72) and the text in a row, padding spacing.lg, gap spacing.md (HoyaBubble.tsx). */
const bubble = (text, cls = '') => `<div class="bubble thinking ${cls}" aria-live="polite">${hoya('bubble-hoya')}<p>${esc(text)}</p></div>`;

const hoya = (cls = 'prf-hoya') => `<svg class="${cls}" viewBox="0 0 128 128" aria-hidden="true" focusable="false"><use href="#hoya-thinking"/></svg>`;

/**
 * The screen. variant: 'list' | 'learner'. opts: grownUp (list, parse with kept), choose (learner, 2+ profiles),
 * busy (a try is running), stuck (3 tries done), lang.
 */
function screen(lang, { variant, grownUp = false, choose = false, busy = false, stuck = false, fixed = false }) {
  const t = S[lang];
  const soft = busy ? ' aria-disabled="true"' : '';
  const buttons = [
    `<button class="rn-btn rn-hero" type="button"${soft}>${esc(t.tryAgain)}</button>`,
    variant === 'learner' && choose ? `<button class="rn-btn rn-secondary rn-lg" type="button"${soft}>${esc(t.chooseAnother)}</button>` : '',
    variant === 'list' && grownUp ? `<button class="rn-btn rn-ghost" type="button"${soft}>${esc(t.grownUpHelp)}</button>` : '',
  ].join('');
  return `<div class="app-screen prf-screen${fixed ? ' fixed' : ''}" lang="${lang}"${busy ? ' aria-busy="true"' : ''}>
<main class="prf-body"><div class="prf-inner">${hoya()}<h1 class="rn-heading prf-title">${esc(t.title)}</h1><p class="prf-text">${esc(t.body)}</p>${bubble(t.bubble, 'prf-bubble')}<p class="prf-stuck" aria-live="polite">${stuck ? esc(t.stillStuck) : ''}</p></div></main>
<div class="prf-foot">${buttons}</div>
</div>`;
}

/** The RecoverRecord sheet (a ConfirmSheet: Not now first and focused, Start fresh second, primary, no danger). */
function sheet(lang, { dialog = false } = {}) {
  const t = S[lang];
  return `<div class="sheet-backdrop${dialog ? ' dialog' : ''}"><div class="sheet confirm" role="alertdialog" aria-modal="true" aria-labelledby="rr-title-${lang}${dialog ? '-w' : ''}" aria-describedby="rr-msg-${lang}${dialog ? '-w' : ''}" lang="${lang}">
<h2 id="rr-title-${lang}${dialog ? '-w' : ''}">${esc(t.recoverTitle)}</h2><p class="msg" id="rr-msg-${lang}${dialog ? '-w' : ''}">${esc(t.recoverBody)}</p>
<div class="confirm-actions"><button class="btn focus-ring" type="button">${esc(t.notNow)}</button><button class="btn btn-primary" type="button">${esc(t.fresh)}</button></div>
</div></div>`;
}

const item = (label, title, inner, cls = 'phone') => `<div class="board-item"><p class="board-label">${esc(label)}</p><p class="board-title">${esc(title)}</p><div class="sample ${cls}">${inner}</div></div>`;

const head = (title, htmlClass = '') => `<!doctype html>
<html lang="en"${htmlClass ? ` class="${htmlClass}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - design mock</title>
<link rel="stylesheet" href="../../../app-shell/mock/app-shell.css">
<link rel="stylesheet" href="../../../app-shell/mock/display-nav.css">
<link rel="stylesheet" href="progress-read-failed.css">
</head>
<body>
<!-- Design mock (docs/specs/AMENDMENTS-DURABLE-PROGRESS.md row DP-0b), not shipped code. Written by ../tools/build-mocks.mjs: edit the tool, not this file. -->
${HOYA_SYMBOL}`;

const foot = `<script>document.documentElement.dataset.ready = 'yes';</script>
</body>
</html>
`;

// ------------------------------------------------------------------------------------------------ screen.html
const screenPage = `${head('ProgressReadFailedScreen: list and learner variants (DP-0b)')}
<div class="board">
<h1 class="page-title">ProgressReadFailedScreen</h1>
<p class="annot">AMENDMENTS-DURABLE-PROGRESS 3.4 and 3.5; wireframe design/wireframes/shell/progress-read-failed.md revision 4a. OopsScreen's layout and tokens: Hoya thinking 140, title, body (secondary), HoyaBubble thinking (amber, never danger), the buttons in the Screen footer. No X, no warning icon. Frames 320 x 568.</p>
<div class="board-grid">
${item('A. list variant, read error (or parse with no copy kept)', 'Try again only', screen('en', { variant: 'list' }))}
${item('B. list variant, parse with kept: true', 'Try again, then A grown-up can help (ghost)', screen('en', { variant: 'list', grownUp: true }))}
${item('C. learner variant, 1 profile on the device', 'Try again only', screen('en', { variant: 'learner' }))}
${item('D. learner variant, 2 or more profiles', 'Try again, then Choose another learner (secondary)', screen('en', { variant: 'learner', choose: true }))}
${item('E. a try is running (D shown)', 'Every button soft-disabled; same words; aria-busy on the screen', screen('en', { variant: 'learner', choose: true, busy: true }))}
${item('F. after 3 tries in this session (B shown)', 'The still-stuck line under the bubble, announced once (polite)', screen('en', { variant: 'list', grownUp: true, stuck: true }))}
</div>
<div class="board-wide">
${item('G. tablet / wide (1024 wide, D with F)', 'Same column, the Screen frame max width (maxWidth.reading); nothing moves to the side', screen('en', { variant: 'learner', choose: true, stuck: true }), 'tablet')}
</div>
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ sheet.html
const sheetPage = `${head('RecoverRecord sheet (DP-0b)')}
<div class="board">
<h1 class="page-title">RecoverRecord: the grown-up sheet</h1>
<p class="annot">AMENDMENTS-DURABLE-PROGRESS 3.6. Reached only from frame B (list variant, damaged bytes, copy kept), through the grown-up gate (PIN, unchanged; not drawn). The gate's own record unreadable: the button opens nothing new and the sheet is not offered (fail closed), Try again stays. A ConfirmSheet: Not now first and focused (the safe choice), Start fresh on this device second, primary. No danger colour: nothing is erased (the per-profile keys and profiles-corrupt are kept). Escape, the backdrop and the system back are Not now.</p>
<div class="board-grid">
${item('H. phone (compact): bottom sheet over frame B', 'Not now has the initial focus; the two buttons stack full width', `<div class="frame-host">${screen('en', { variant: 'list', grownUp: true })}${sheet('en')}</div>`)}
</div>
<div class="board-wide">
${item('I. tablet / wide (regular): centred dialog', 'Cancel-first row, each button at least 64 high', `<div class="frame-host">${screen('en', { variant: 'list', grownUp: true })}${sheet('en', { dialog: true })}</div>`, 'tablet')}
</div>
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ save-lines.html
const unchanged = (s) => `<p class="unchanged">${esc(s)}</p>`;
const savePage = `${head('The quiet save lines (DP-0b, for DP-2)')}
<div class="board">
<h1 class="page-title">The quiet save lines</h1>
<p class="annot">AMENDMENTS-DURABLE-PROGRESS 3.7 (built by DP-2). One line, Body tone secondary, no icon, no box, no colour of its own; nothing is blocked. Shown while the learner is in saveFailedFor (all four) or loadFailedFor (Results and Restore). The line is in the reading order where it is drawn; it is not a live region (it is there when the screen opens), except on Restore, where it replaces the notice text after the restore ran (D8).</p>
<div class="board-grid">
${item('K. Results (learner.results.saveLater)', 'Under the headline block (headline and stars, ResultsScreen.tsx:476-507), above the bubble: an interpretation of 3.7 (D6)', `<div class="app-screen prf-screen"><div class="results-top">${unchanged('Avatar pill and Hoya (140), unchanged')}<h1 class="rn-display">Great!</h1><p class="draft">headline: tier unchanged</p>${unchanged('StarRow (2 of 3), unchanged')}<p class="save-line">${esc(LINES.saveLater)}</p></div>${unchanged('HoyaBubble cheering, card banner, buttons: unchanged')}</div>`)}
${item('L. Profile (learner.profile.saveTrouble; saveFailedFor only)', 'Above the For grown-ups group (Account & more on a self-only device)', `<div class="app-screen prf-screen"><div class="ls-col"><h1 class="rn-heading">Profiles &amp; settings</h1>${unchanged('Stats and My settings, unchanged')}<p class="save-line">${esc(LINES.profileTrouble)}</p><div class="rn-card"><p class="rn-row-title">For grown-ups</p></div></div></div>`)}
${item('M. Grown-up area (grownUp.saveTrouble, see D9; any learner on the device)', 'After the title block (title, persona, read-only caption), before Switch user', `<div class="app-screen prf-screen"><div class="ls-col"><div><h1 class="rn-heading">Grown-up area</h1><p class="rn-body-secondary">Parent or caregiver</p><p class="rn-caption">Read-only — learners on this device.</p></div><p class="save-line">${esc(LINES.grownUpTrouble)}</p><button class="rn-btn rn-ghost" type="button">Switch user</button>${unchanged('Account card (native), People on this device and the rest of the dashboard, unchanged')}</div></div>`)}
${item('N. Restore (caregiver.restore.saveLater), after whenWritten: as the spec says', 'The line in place of the restored notice text, Body secondary; card, Hoya and Great unchanged', `<div class="app-screen prf-screen"><div class="ls-col"><h1 class="rn-heading">Bring back progress</h1>${unchanged('HoyaBubble thinking with the restore prompt, unchanged')}<div class="rn-card restore-card">${unchanged('Card tone success and Hoya cheering 96, unchanged')}<p class="save-line">${esc(LINES.saveLater)}</p><button class="rn-btn rn-primary" type="button">Great</button></div></div></div>`)}
${item('N2. Restore: proposal D7 (an owner question, not the spec)', 'A not-yet card: paper, Hoya thinking, the line, OK (common.buttons.ok) in place of Great', `<div class="app-screen prf-screen"><div class="ls-col"><h1 class="rn-heading">Bring back progress</h1>${unchanged('HoyaBubble thinking with the restore prompt, unchanged')}<div class="rn-card restore-card">${hoya()}<p class="save-line">${esc(LINES.saveLater)}</p><button class="rn-btn rn-primary" type="button">OK</button></div></div></div>`)}
</div>
</div>
${foot}`;

// ------------------------------------------------------------------------------------------------ lengths.html
const LANGS = ['en', 'es', 'ko'];
const lengthsPage = `${head('Lengths: en, es, ko at 320 with Largest text (DP-0b)', 'ts-largest')}
<div class="board">
<h1 class="page-title">Lengths at 320, Largest text</h1>
<p class="annot">The longest cases in three languages at 320 wide with Largest text (1.5). Spanish and Korean are length drafts for this board only, not dictionary values: DP-1c and DP-1d carry the reviewed es and ko (R8 draft, F-I18N-001 3.10 review). Each screen frame is 320 x 568 and fixed: the body scrolls (to its end once the still-stuck line fills, D3) and the footer is pinned. Nothing may scroll sideways; every button stays at least 64 high; tools/capture.mjs checks that the footer ends inside the frame.</p>
${LANGS.map((l) => `<p class="board-title">${l === 'en' ? 'English (spec 3.8)' : l === 'es' ? 'Spanish (length draft)' : 'Korean (length draft)'}</p>
<div class="lengths">
${item(`${l}: list variant, damaged, after 3 tries`, 'B with F', screen(l, { variant: 'list', grownUp: true, stuck: true, fixed: true }))}
${item(`${l}: learner variant, 2 or more profiles, after 3 tries`, 'D with F', screen(l, { variant: 'learner', choose: true, stuck: true, fixed: true }))}
${item(`${l}: the sheet`, 'H', `<div class="frame-host">${screen(l, { variant: 'list', grownUp: true })}${sheet(l)}</div>`)}
</div>`).join('\n')}
</div>
${foot}`;

for (const [name, html] of [
  ['screen.html', screenPage],
  ['sheet.html', sheetPage],
  ['save-lines.html', savePage],
  ['lengths.html', lengthsPage],
]) {
  writeFileSync(join(MOCK, name), html);
  console.log(`wrote mock/${name}`);
}
