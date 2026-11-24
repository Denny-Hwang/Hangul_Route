#!/usr/bin/env node
// LR-0b (docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md section 5): writes the mock pages of this design pass from one
// string table, so the boards and the single-frame pages never drift apart. A design tool (not shipped, not run by CI).
//
//   node design/screens/quest-leave-resume/tools/build-mocks.mjs
//
// English is the spec's section 3.7 table word for word, plus the shipped strings it reuses (packages/i18n
// en/learner.ts, en/common.ts). Content titles ("Meet o, u, m and the circle") are shipped catalogue titles, as in
// design/screens/learner-shell/mock/home-hero.html. es and ko are not drawn: each row carries its reviewed values.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MOCK = resolve(here, '../mock');

/** Spec 3.7 (new keys) and the reused shipped strings. */
const T = {
  // learner.home.next.* (shipped) and .resume.* (new, LR-2)
  heroHeading: 'Next lesson',
  heroTitle: 'Meet o, u, m and the circle',
  heroWhere: 'Stage 1 · Meet the Letters · lesson 2 of 3',
  heroMinutes: 'About 4 minutes',
  start: 'Start',
  cont: 'Continue',
  route: 'See your Learning Route',
  resumeLine: (step, total) => `You can go on from step ${step} of ${total}.`,
  startAgain: 'Start again',
  sheetTitle: 'Start this lesson again?',
  sheetMessage: 'You go back to the first step. Your stars and cards stay.',
  keepPlace: 'Keep my place',
  greeting: 'Hi, Mina!',
  subtitle: "Ready for today's quest?",
  today: 'Today with Hoya',
  // learner.stageReview.* and learner.stageCheck.* (shipped) and .resume.* / .leave.bodyKept (new, LR-3a)
  hangulCheck: 'Hangul Check',
  stageCheck: 'Stage Check',
  hangulIntro: 'About four minutes. Pictures and sounds. No timer.',
  hideRoman: 'Reading practice: hide the romanization until I tap',
  letsGo: "Let's go",
  later: 'Maybe later',
  resumeTitle: 'Pick up where you left off?',
  stopTitle: 'Stop the check?',
  stopBodyKept: 'You can keep going later.',
  stopBodyToday: 'You can take it again any time.',
  keepGoing: 'Keep going',
  stop: 'Stop',
  pauseFourth: 'Almost done. One more part!',
  // learner.dailyReview.* (shipped) and .saveFailed.* (new, LR-4)
  dailyReview: 'Daily Review',
  failedTitle: 'We could not save this yet.',
  failedBody: 'Your answers are still here.',
  failedLeaveBody: 'This is not saved yet.',
  stillStuck: 'Still stuck? You can stop for now and try another time.',
  drStopTitle: 'Stop for now?',
  backToIt: 'Back to it',
  tryAgain: 'Try again',
  greatWork: 'Great work!',
  saveLater: 'We could not save this yet. Keep the app open and we will try again.',
  // learner.minigame.leave.* (new, LR-1) and learner.quest.leave.* (shipped)
  mgTitle: 'Keep playing?',
  mgMessage: 'If you leave, the game starts again next time.',
  keepPlaying: 'Keep playing',
  leave: 'Leave',
  // common
  close: 'Close',
  displayA11y: 'Aa, Display: language and text size',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ------------------------------------------------------------------------------------------------ glyphs and Hoya
/** Hoya waving and thinking, as the other mocks draw them (home-hero.html, progress-read-failed). */
const HOYA_SYMBOLS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><filter id="grey" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/></filter></defs>
<symbol id="hoya-waving" viewBox="0 0 128 128"><ellipse cx="64" cy="116" rx="38" ry="5" style="fill: var(--colors-hoya-furDark); opacity: 0.2"/><path d="M107.5 79.5 Q120 67 126 56 L117.5 51.5 Q112 61 100.5 72.5 A5 5 0 0 0 107.5 79.5 Z" style="fill: var(--colors-hoya-fur)"/><circle cx="121.5" cy="54" r="6.5" style="fill: var(--colors-hoya-fur)"/><circle cx="64" cy="64" r="44" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="98" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><circle cx="98" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><path d="M26 54 Q30 58 26 62 M24 70 Q29 73 25 78 M28 84 Q33 86 30 90 M102 54 Q98 58 102 62 M104 70 Q99 73 103 78 M100 84 Q95 86 98 90 M64 24 Q66 30 64 36" style="fill: none; stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round"/><ellipse cx="64" cy="84" rx="26" ry="16" style="fill: var(--colors-hoya-belly)"/><ellipse cx="50" cy="72" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><ellipse cx="78" cy="72" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><circle cx="42" cy="84" r="5" style="fill: var(--colors-hoya-cheek); opacity: 0.6"/><circle cx="86" cy="84" r="5" style="fill: var(--colors-hoya-cheek); opacity: 0.6"/><path d="M58 84 H70 L64 90 Z" style="fill: var(--colors-hoya-nose)"/><path d="M48 92 Q60 104 72 92" style="fill: none; stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round"/></symbol>
<symbol id="hoya-thinking" viewBox="0 0 128 128"><ellipse cx="64" cy="116" rx="38" ry="5" style="fill: var(--colors-hoya-furDark); opacity: 0.18"/><circle cx="64" cy="64" r="44" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="98" cy="32" r="12" style="fill: var(--colors-hoya-fur)"/><circle cx="30" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><circle cx="98" cy="32" r="6" style="fill: var(--colors-hoya-cheek); opacity: 0.85"/><path d="M26 54 Q30 58 26 62 M24 70 Q29 73 25 78 M28 84 Q33 86 30 90 M102 54 Q98 58 102 62 M104 70 Q99 73 103 78 M100 84 Q95 86 98 90 M64 24 Q66 30 64 36" style="fill: none; stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round"/><ellipse cx="64" cy="84" rx="26" ry="16" style="fill: var(--colors-hoya-belly)"/><ellipse cx="52" cy="70" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><ellipse cx="80" cy="70" rx="3.5" ry="4" style="fill: var(--colors-hoya-stripes)"/><path d="M54 94 H72" style="stroke: var(--colors-hoya-stripes); stroke-width: 3; stroke-linecap: round; fill: none"/><circle cx="110" cy="18" r="7" style="fill: var(--colors-surface-paper); stroke: var(--colors-border-strong); stroke-width: 2"/><circle cx="100" cy="32" r="3" style="fill: var(--colors-surface-paper); stroke: var(--colors-border-strong); stroke-width: 2"/><path d="M58 84 H70 L64 90 Z" style="fill: var(--colors-hoya-nose)"/></symbol></svg>`;

const hoya = (pose, cls) => `<svg class="${cls}" viewBox="0 0 128 128" aria-hidden="true" focusable="false"><use href="#hoya-${pose}"/></svg>`;
/** Icon glyphs (packages/design-system Icon/glyphs.ts): close and route, drawn in currentColor. */
const ICON_CLOSE = '<svg class="icon" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
const ICON_ROUTE = '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="20" r="2.2" fill="currentColor"/><path d="M5 20 H15.75 A3.25 3.25 0 0 0 15.75 13.5 H11.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 14.6 C6.4 12.4 3.4 9.6 3.4 6.8 A5.1 5.1 0 0 1 13.6 6.8 C13.6 9.6 10.6 12.4 8.5 14.6 Z M6.7 6.8 A1.8 1.8 0 1 0 10.3 6.8 A1.8 1.8 0 1 0 6.7 6.8 Z" fill="currentColor" fill-rule="evenodd"/></svg>';
const ICON_PROFILE = '<svg class="icon" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 12 A4 4 0 1 1 12 4 A4 4 0 0 1 12 12 Z" fill="currentColor"/><path d="M4 21 A8 8 0 0 1 20 21 Z" fill="currentColor"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 L14.6 9 L21 9.6 L16.1 13.8 L17.6 20.2 L12 16.8 L6.4 20.2 L7.9 13.8 L3 9.6 L9.4 9 Z" style="fill: var(--colors-hoya-fur); stroke: var(--colors-hoya-furDark); stroke-width: 1.2; stroke-linejoin: round"/></svg>';

// ------------------------------------------------------------------------------------------------ shared parts
/** The route's learner header: Close (leading, touchTarget.min) and Display (Aa). */
const routeHeader = () => `<header class="screen-header"><button class="sh-lead qlr-close" type="button" aria-label="${esc(T.close)}">${ICON_CLOSE}</button><div class="sh-trail"><button class="aa-btn" type="button" aria-label="${esc(T.displayA11y)}">Aa</button></div></header>`;

/** ConfirmSheet (design/components/ConfirmSheet/spec.md): cancel first, paper, focused; confirm primary; no danger. */
function confirmSheet(id, { title, message, cancel, confirm }) {
  return `<div class="sheet-backdrop" data-qlr="backdrop"><div class="sheet confirm" role="alertdialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-m">
<h2 id="${id}-t">${esc(title)}</h2><p class="msg" id="${id}-m">${esc(message)}</p>
<div class="confirm-actions"><button class="btn focus-ring" type="button">${esc(cancel)}</button><button class="btn btn-primary" type="button">${esc(confirm)}</button></div>
</div></div>`;
}

/** What is under a sheet: inert, so only the sheet is reachable (Modal on native, aria-modal + inert on the web). */
const behind = (html) => `<div class="qlr-behind" inert>${html}</div>`;

// ------------------------------------------------------------------------------------------------ Home (LR-2)
/**
 * The Home screen with the next-lesson hero as built (HomeScreen.tsx NextLessonHero, :300-339): Card padding md,
 * eyebrow Caption secondary semibold, Heading prompt, where (Caption secondary), minutes (Caption muted), Spacer md,
 * Button primary hero full width, then the links. variant: 'plain-start' | 'plain-continue' | 'resume'.
 */
function home(variant) {
  const resume = variant === 'resume';
  const cta = variant === 'plain-start' ? T.start : T.cont;
  const resumeParts = resume
    ? `<p class="qlr-resume-line" id="hero-resume-line">${esc(T.resumeLine(3, 5))}</p><button class="rn-link qlr-quiet" type="button" data-qlr="start-again">${esc(T.startAgain)}</button>`
    : '';
  return `<div class="app-screen ls-screen qlr-home">
<header class="screen-header"><span class="who-face">${hoya('waving', 'qlr-hoya-face')}</span><h1 class="sh-title">${esc(T.greeting)}</h1><div class="sh-trail"><button class="aa-btn" type="button" aria-label="${esc(T.displayA11y)}">Aa</button><button class="profile-btn" type="button" aria-label="Profile and settings">${ICON_PROFILE}<span>Profile</span></button></div></header>
<p class="subtitle">${esc(T.subtitle)}</p>
<p class="unchanged">Streak, cards and stars pills: unchanged</p>
<section class="rn-card qlr-hero" aria-labelledby="hero-eyebrow"><p class="qlr-eyebrow" id="hero-eyebrow">${esc(T.heroHeading)}</p><p class="rn-prompt qlr-hero-title">${esc(T.heroTitle)}</p><p class="qlr-caption-secondary">${esc(T.heroWhere)}</p><p class="rn-caption">${esc(T.heroMinutes)}</p>
<button class="rn-btn rn-hero" type="button" aria-label="${esc(`${cta}: ${T.heroTitle}`)}"${resume ? ' aria-describedby="hero-resume-line"' : ''}>${esc(cta)}</button>${resumeParts}<button class="rn-link qlr-quiet" type="button">${ICON_ROUTE}<span>${esc(T.route)}</span></button></section>
<h2 class="h2">${esc(T.today)}</h2>
<p class="unchanged">The three cards of the day, the level-check card, Homework and the Tip: unchanged</p>
</div>`;
}

const homeSheet = () => confirmSheet('home-sa', { title: T.sheetTitle, message: T.sheetMessage, cancel: T.keepPlace, confirm: T.startAgain });

// ------------------------------------------------------------------------------------------------ Checks (LR-3a, LR-3b)
/** The check's opening column (StageReviewScreen.tsx :323-339; StageCheckScreen.tsx :279-300). */
function check(kind, state) {
  const title = kind === 'stage' ? T.stageCheck : T.hangulCheck;
  const top = `<div class="qlr-check-top">${hoya('waving', 'qlr-hoya-check')}<h1 class="rn-display">${esc(title)}</h1>`;
  if (state === 'reading') {
    // Panel R: the intro's Hoya and title, no buttons, for at most the read's limit (800 ms). aria-busy on the column.
    return `<div class="app-screen qlr-check" aria-busy="true">${routeHeader()}${top}</div></div>`;
  }
  if (state === 'resume') {
    return `<div class="app-screen qlr-check">${routeHeader()}${top}<h2 class="rn-heading qlr-resume-title" tabindex="-1">${esc(T.resumeTitle)}</h2></div>
<div class="qlr-actions"><button class="rn-btn rn-hero" type="button">${esc(T.cont)}</button><button class="rn-btn rn-secondary qlr-lg" type="button">${esc(T.startAgain)}</button></div></div>`;
  }
  // 'intro': the shipped intro, unchanged (reached by Start again; Let's go clears the stored check).
  return `<div class="app-screen qlr-check">${routeHeader()}${top}<p class="qlr-center">${esc(T.hangulIntro)}</p></div>
<div class="rn-card qlr-switch-row" role="switch" aria-checked="false" tabindex="0"><span class="qlr-switch-label">${esc(T.hideRoman)}</span><span class="qlr-switch" aria-hidden="true"><span></span></span></div>
<div class="qlr-actions"><button class="rn-btn rn-hero" type="button">${esc(T.letsGo)}</button><button class="rn-btn rn-ghost" type="button">${esc(T.later)}</button></div></div>`;
}

/** The pause between parts (unchanged), drawn under the stop sheet. */
const pause = () => `<div class="app-screen qlr-check">${routeHeader()}<div class="qlr-check-top">${hoya('waving', 'qlr-hoya-check')}<h1 class="rn-heading">${esc(T.pauseFourth)}</h1></div><div class="qlr-actions"><button class="rn-btn rn-hero" type="button">${esc(T.keepGoing)}</button></div></div>`;

const stopSheet = (body) => confirmSheet(`stop-${body === T.stopBodyKept ? 'k' : 'a'}`, { title: T.stopTitle, message: body, cancel: T.keepGoing, confirm: T.stop });

// ------------------------------------------------------------------------------------------------ Save failed (LR-4)
/**
 * The failed page, in the read-failed screen's layout (OopsScreen: Hoya thinking 140, title, body; the Screen footer
 * holds the one hero button, pinned). opts: busy (a try runs), stuck (3 tries in a row), fixed (a pinned footer).
 */
function failed({ busy = false, stuck = false } = {}) {
  const soft = busy ? ' aria-disabled="true"' : '';
  return `<div class="app-screen qlr-failed"${busy ? ' aria-busy="true"' : ''}>${routeHeader()}
<main class="qlr-failed-body"><div class="qlr-failed-inner">${hoya('thinking', 'qlr-hoya-failed')}<h1 class="rn-heading qlr-failed-title" tabindex="-1">${esc(T.failedTitle)}</h1><p class="qlr-secondary">${esc(T.failedBody)}</p><p class="qlr-secondary qlr-stuck" aria-live="polite">${stuck ? esc(T.stillStuck) : ''}</p></div></main>
<div class="qlr-foot"><button class="rn-btn rn-hero" type="button"${soft}>${esc(T.tryAgain)}</button></div></div>`;
}

const drStop = () => confirmSheet('dr-stop', { title: T.drStopTitle, message: T.failedLeaveBody, cancel: T.backToIt, confirm: T.stop });
const scStop = () => confirmSheet('sc-stop', { title: T.stopTitle, message: T.failedLeaveBody, cancel: T.keepGoing, confirm: T.stop });

/** A result page (Daily Review, as the other three) with the save-later line under the stars (OD-LR8). */
const resultSaveLater = () => `<div class="app-screen qlr-result">${routeHeader()}<div class="qlr-result-top"><p class="unchanged">Hoya cheering: unchanged</p><h1 class="rn-display">${esc(T.greatWork)}</h1><div class="qlr-stars" role="img" aria-label="2 stars">${STAR}${STAR}</div><p class="qlr-save-line">${esc(T.saveLater)}</p></div><p class="unchanged">The rest of the result (what got stronger, Back home): unchanged</p></div>`;

// ------------------------------------------------------------------------------------------------ Keep playing (LR-1, for reference)
const game = () => `<div class="app-screen qlr-game">${routeHeader()}<p class="unchanged">The game as it was (round 2), its sound stopped: unchanged</p></div>`;
const mgSheet = () => confirmSheet('mg', { title: T.mgTitle, message: T.mgMessage, cancel: T.keepPlaying, confirm: T.leave });

// ------------------------------------------------------------------------------------------------ pages
const head = (title, extra = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - design mock</title>
<link rel="stylesheet" href="${extra}../../app-shell/mock/app-shell.css">
<link rel="stylesheet" href="${extra}../../app-shell/mock/display-nav.css">
<link rel="stylesheet" href="${extra}../../learner-shell/mock/learner-shell.css">
<link rel="stylesheet" href="${extra}quest-leave-resume.css">
</head>
<body>
<!-- Design mock (docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md row LR-0b), not shipped code. Written by tools/build-mocks.mjs: edit the tool, not this file. -->
${HOYA_SYMBOLS}`;
const foot = `<script>document.documentElement.dataset.ready = 'yes';</script>
</body>
</html>
`;

const item = (label, title, inner, cls = 'phone') => `<div class="board-item"><p class="board-label">${esc(label)}</p><p class="board-title">${esc(title)}</p><div class="sample ${cls}"><div class="frame-host">${inner}</div></div></div>`;

/** The single-frame pages: one state each, filling the window, for the viewport shots. */
const FRAMES = {
  'home-resume': { title: 'Home, the hero resume variant (LR-2, Panel A)', html: home('resume') },
  'home-plain': { title: 'Home, the plain hero on a first day (LR-2, Panel C)', html: home('plain-start') },
  'home-sheet': { title: 'Home, Start again asks first (LR-2, Panel B)', html: behind(home('resume')) + homeSheet() },
  'check-reading': { title: 'Hangul Check, reading the stored check (LR-3a, Panel R)', html: check('hangul', 'reading') },
  'check-resume': { title: 'Hangul Check, the resume page (LR-3a, Panel A)', html: check('hangul', 'resume') },
  'stage-check-resume': { title: 'Stage Check, the resume page (LR-3b, Panel A)', html: check('stage', 'resume') },
  'check-stop': { title: 'The check stop sheet with OD-LR1 (c) (LR-3a, Panel E)', html: behind(pause()) + stopSheet(T.stopBodyKept) },
  'save-failed': { title: 'Daily Review, the finish could not be saved (LR-4, Panel A)', html: failed() },
  'save-failed-stuck': { title: 'Daily Review, after 3 tries in a row (LR-4, Panel A)', html: failed({ stuck: true }) },
  'save-failed-stop': { title: 'Daily Review, a back on the failed page (LR-4, Panel F)', html: behind(failed()) + drStop() },
  'result-save-later': { title: 'A check result with the save-later line (LR-4, OD-LR8, Panel C)', html: resultSaveLater() },
};

const pages = {};
mkdirSync(join(MOCK, 'frames'), { recursive: true });
for (const [name, f] of Object.entries(FRAMES)) {
  pages[`frames/${name}.html`] = `${head(f.title, '../')}\n<div class="qlr-frame">${f.html}</div>\n${foot}`;
}

pages['home-resume.html'] = `${head('Home: the hero says the lesson goes on (LR-0b)')}
<div class="board">
<h1 class="page-title">Home: a lesson left in the middle</h1>
<p class="annot">AMENDMENTS-QUEST-LEAVE-RESUME 3.2 and 3.3 (row LR-2); wireframe design/wireframes/home/next-lesson-resume.md. The hero as built (HomeScreen.tsx :300-339). Only for a saved run of the hero's own lesson, past its first step, under 24 hours, not a story quest, whose step list is unchanged. The button never moves: the caption and Start again come in under it.</p>
<div class="board-grid">
${item('A. resume variant (a saved run at step 3 of 5)', 'Continue; the caption under it is its accessibility hint; Start again is a quiet link (role button, 64 high)', home('resume'))}
${item('C. plain hero on a first day (no candidate; also while the read and the steps load)', 'Exactly as today: Start, no caption, no link', home('plain-start'))}
${item('A on a first day (no quest done, a saved run)', 'Continue, not Start, whatever questsDone is', home('resume'))}
${item('B. Start again asks first (bottom sheet)', 'ConfirmSheet: Keep my place first and focused; Start again primary, never danger', behind(home('resume')) + homeSheet())}
</div>
<div class="board-wide">
${item('B, wide (1024): centred dialog', 'ConfirmSheet from 600 px: cancel-first row', `${behind(home('resume'))}${homeSheet().replace('sheet-backdrop', 'sheet-backdrop dialog')}`, 'tablet')}
</div>
</div>
${foot}`;

pages['check-resume.html'] = `${head('Checks: reading frame, resume page and stop sheet (LR-0b)')}
<div class="board">
<h1 class="page-title">The Hangul Check and the Stage Check go on</h1>
<p class="annot">AMENDMENTS-QUEST-LEAVE-RESUME 3.4 (rows LR-3a, LR-3b; both wait for OD-LR1 and OD-LR9). Wireframe design/wireframes/reviews/check-resume.md. Drawn with the recommendations OD-LR1 (c) and OD-LR9 (b). The resume page follows the level check's own (screens/placement/ResumeScreen.tsx): Hoya waving, a title, Continue (hero), Start again (secondary, lg). No count of items done or left, no percent.</p>
<div class="board-grid">
${item('R. reading (Hangul Check, at most 800 ms)', 'The intro\'s Hoya and title, no buttons; the column is aria-busy', check('hangul', 'reading'))}
${item('A. resume page, Hangul Check', 'Continue goes on at the item after the last one answered; Start again goes to the intro and clears nothing', check('hangul', 'resume'))}
${item('A. resume page, Stage Check (LR-3b)', 'The same page; read inside the Stage Check\'s existing loading frame', check('stage', 'resume'))}
${item('C. the intro after Start again (unchanged)', 'Let\'s go clears the stored check and begins a new one; Maybe later and Close keep it', check('hangul', 'intro'))}
${item('E. the stop sheet, OD-LR1 (c) (recommended)', 'Stop keeps the stored check: "You can keep going later." (new)', behind(pause()) + stopSheet(T.stopBodyKept))}
${item('E. the stop sheet, OD-LR1 (a) (today)', 'Stop clears the stored check: the shipped line stays', behind(pause()) + stopSheet(T.stopBodyToday))}
</div>
<div class="board-wide">
${item('A, wide (1024)', 'The same column at the Screen frame\'s reading width', check('hangul', 'resume'), 'tablet')}
</div>
</div>
${foot}`;

pages['save-failed.html'] = `${head('A finish that could not be saved (LR-0b)')}
<div class="board">
<h1 class="page-title">A finish that could not be saved</h1>
<p class="annot">AMENDMENTS-QUEST-LEAVE-RESUME 3.5 (row LR-4). Wireframe design/wireframes/reviews/save-failed.md. The read-failed screen's layout (OopsScreen): Hoya thinking 140, title (first focus), body, the still-stuck line (a polite live region, empty until the third try), Try again pinned in the Screen footer. No bubble, no warning icon, no danger colour, no score. The Stage Check draws the same page with the same keys.</p>
<div class="board-grid">
${item('A. Daily Review or Stage Check, the finish was rejected', 'One action: Try again on the same answers', failed())}
${item('A, busy: a try is running', 'Try again soft-disabled (same words, no spinner); aria-busy on the screen', failed({ busy: true }))}
${item('A, after 3 tries in a row', 'The still-stuck line fills, announced once', failed({ stuck: true }))}
${item('F. a back, Daily Review', 'The stop sheet with a true body: Back to it first', behind(failed()) + drStop())}
${item('F. a back, Stage Check', 'Stop the check?, the same body, Keep going first', behind(failed()) + scStop())}
${item('C. a result whose progress write waits (OD-LR8)', 'learner.results.saveLater under the stars, quiet (Body secondary, no icon); the same on all four check results', resultSaveLater())}
</div>
<div class="board-wide">
${item('A, wide (1024)', 'The same column; Try again stays in the footer', failed(), 'tablet')}
</div>
</div>
${foot}`;

pages['keep-playing.html'] = `${head('Keep playing? (LR-1, for reference)')}
<div class="board">
<h1 class="page-title">Keep playing? (for reference only)</h1>
<p class="annot">AMENDMENTS-QUEST-LEAVE-RESUME 3.1 (row LR-1) needs no mock: it is the shipped ConfirmSheet with new words (spec section 5). Drawn here only so the four sheets of this amendment can be read side by side. Keep playing first and focused; Leave primary, never danger.</p>
<div class="board-grid">
${item('Keep playing? over a game with one answer', 'learner.minigame.leave.title / .message; learner.quest.leave.keep.cta / .confirm.cta', behind(game()) + mgSheet())}
</div>
</div>
${foot}`;

/** Greyscale: the state-carrying frames drawn as they are and with colour removed (Rec. 709 luminance, linear RGB). */
const pair = (label, html) => `<div class="board-item"><p class="board-label">${esc(label)}</p><div class="qlr-pair"><div class="sample phone"><div class="frame-host">${html}</div></div><div class="sample phone vision-grey"><div class="frame-host">${html}</div></div></div></div>`;
pages['greyscale.html'] = `${head('Greyscale check (LR-0b)')}
<div class="board">
<h1 class="page-title">Greyscale: every state reads without colour</h1>
<p class="annot">Left as drawn, right in luminance greyscale (the #grey feColorMatrix of design/screens/app-shell/mock/check.html). The states differ by words and shape, never by colour alone: the resume hero adds a caption and a link; the busy Try again is drawn sunken and muted; the sheet's focused safe choice has the focus ring; the resume page's two buttons differ in size and position.</p>
<div class="board-wide">
${pair('Home: plain hero on a first day', home('plain-start'))}
${pair('Home: resume variant', home('resume'))}
${pair('Start again sheet (focus ring on Keep my place)', behind(home('resume')) + homeSheet())}
${pair('Check resume page', check('hangul', 'resume'))}
${pair('Failed page, ready', failed())}
${pair('Failed page, busy', failed({ busy: true }))}
${pair('Failed page, stop sheet', behind(failed()) + drStop())}
</div>
</div>
${foot}`;

for (const [name, html] of Object.entries(pages)) {
  writeFileSync(join(MOCK, name), html);
  console.log(`wrote mock/${name}`);
}

