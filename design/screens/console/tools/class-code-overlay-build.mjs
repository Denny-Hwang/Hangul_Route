#!/usr/bin/env node
// CO-0 (docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md section 5): writes this design pass's mock pages from one string
// table, so every drawn word is checked in one place. A design tool (not shipped, not run by CI). Edit this file, not
// the HTML, then run it and the capture tool:
//
//   node design/screens/console/tools/class-code-overlay-build.mjs
//   node design/screens/console/tools/class-code-overlay-capture.mjs
//
// Both need apps/web's install (`pnpm install`; the capture tool also a Playwright Chromium). In a worktree with no
// install of its own, point NODE_PATH at a checkout's apps/web/node_modules.
//
// The QR code is drawn exactly as the console draws it (apps/web/src/lib/console/join-link.ts: qrcode-generator 2.0.4,
// error correction M, the smallest version, one path of row runs, a 4-module quiet zone), from apps/web's install.
//
// Every UI string below is an English dictionary value of packages/i18n (key in the comment) or a new key of the spec's
// section 3.8, word for word. Names, the class name, the plan title and the code are sample data.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../../..');
const MOCK = resolve(here, '../mock');
const require = createRequire(join(REPO, 'apps/web/package.json'));
const qrcode = require('qrcode-generator');

const CODE = 'SUN234';
const LINK = `https://app.hangulroute.com/join#c=${CODE}`; // joinLinkUrl(appUrl(), code)
const QUIET = 4; // QR_QUIET_ZONE

/** The same modules and path as `qrModules` and `qrPath` (join-link.ts). */
function qr(text) {
  const code = qrcode(0, 'M');
  code.addData(text, 'Byte');
  code.make();
  const size = code.getModuleCount();
  const parts = [];
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (!code.isDark(y, x)) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < size && code.isDark(y, x + run)) run += 1;
      parts.push(`M${x + QUIET} ${y + QUIET}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return { view: size + QUIET * 2, d: parts.join('') };
}

const S = {
  // frame (AdultFrame; shipped)
  brand: 'Hangul Route',
  persona: 'Teacher',
  learnerApp: 'Learner app',
  nav: ['Classes', 'Lessons', 'Lecture mode', 'Billing'],
  back: 'Back to Classes',
  // page head
  space: 'Sunday Class A', // sample
  count: '4 students', // console.spaceCounts.students(4)
  // This week (console.space.week.*)
  week: 'This week',
  practiced: '3 of 4 practiced this week',
  weekJamo: ['Jamo to revisit together: ', 'ㅂ · ㅅ · ㄱ'],
  weekWords: ['Words to revisit together: ', [['사과', 'sagwa (apple)'], ['눈', 'nun (eye)']]],
  // the bar
  plan: 'Plan: Week of Nov 23', // console.space.openPlan.label(title); the title is sample data
  planThisWeek: 'Plan this week', // console.planThisWeek
  planTerm: 'Plan this term', // console.curriculum.entries.planTerm.cta
  lecture: 'Lecture mode', // console.lecture.entry.cta
  classReport: 'Class report', // console.classReport (rosterClassReportLink)
  showCode: 'Show the code', // NEW console.space.codeOverlay.open.cta
  more: 'More', // console.space.more
  relinkWaiting: '1 new device needs your OK', // console.space.relinkPending.cta(1)
  // roster
  rosterHeading: 'Most recent activity first', // console.space.recentFirst
  invite: `Invite students · code ${CODE}`, // console.space.invite(code)
  inviteNone: 'Invite students · code —', // console.space.invite('—')
  seeReport: 'See report', // report.action.seeReport
  sendNote: 'Send a note', // console.notes.sendNote.cta
  revisitToggle: 'What to revisit', // NEW console.space.learner.revisitToggle
  revisitNothing: 'Nothing to revisit yet.', // NEW console.space.learner.revisitNothing
  statusNew: 'New', // console.status.new
  noPractice: 'No practice shared yet', // console.status.noPractice
  // overlay
  codeLabel: 'Class code', // console.space.codeLabel.class
  expiry: 'expires in 18 days', // console.codeExpiry.inDays(18)
  qrLabel: 'QR code of the join link', // console.space.joinLink.qr.label
  qrCaption: 'Scan it with the camera of a phone or tablet.', // console.space.joinLink.qr.caption
  howToJoin: 'Tap “Join a class” in Hangul Route and type this code.', // NEW console.space.codeOverlay.howToJoin(caregiver.spaces.join.cta), OD-CO5
  close: 'Close', // common.buttons.close
  // teacher home class row (OD-CO7, awaiting owner)
  homeOpen: 'Open →', // console.home.open.cta
  homeReport: 'Class report', // console.home.classReport
  homeNotes: 'Notes', // console.home.notes
};

/** Sample learners: what the class page behind the overlay holds, and what the overlay must never show. */
const LEARNERS = [
  {
    name: 'Mina', avatar: 'a3', level: 'Some reading', // common.levels.someReading.label
    lines: ['Practiced yesterday · 36 min this week', 'On Stage 1 · Stage 1 quests: 7 of 15 · 5 cards'],
    words: 'Words: 12 collected · 4 strong', // console.space.learner.words(12, 4)
    jamo: 'ㅂ · ㅅ', // console.space.learner.revisit
    revisitWords: [['사과', 'sagwa (apple)'], ['눈', 'nun (eye)']], // console.space.learner.wordsRevisit + wordGloss
    plan: 'Week of Nov 23: 2 / 3', // console.space.learner.planReadout(title, plan.readout.progress(2, 3))
    segs: 1,
  },
  {
    name: 'Jun', avatar: 'a1', level: 'Reads easily', // common.levels.readsEasily.label
    lines: ['Practiced today · 52 min this week', 'On Stage 2', 'Stage 1 quests: 15 of 15 · 6 cards'],
    words: 'Words: 30 collected · 18 strong',
    jamo: null,
    revisitWords: [],
    plan: 'Week of Nov 23: 3 / 3',
    segs: 2,
  },
  {
    name: 'Yuhan', avatar: 'a2', level: 'Pictures first', // common.levels.pictures.label
    lines: ['Practiced Thursday · 12 min this week', 'On Stage 1 · Stage 1 quests: 3 of 15 · 2 cards'],
    words: null,
    jamo: 'ㄱ · ㄴ · ㅁ',
    revisitWords: [],
    plan: 'Week of Nov 23: 1 / 3',
    segs: 0,
  },
  { name: 'Suji', avatar: 'a4', level: 'Some reading', isNew: true },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chev = (open = false) => `<svg class="chev${open ? ' open' : ''}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 6l5 5 5-5"/></svg>`;
const ko = (s) => `<span lang="ko">${s}</span>`;
/** As `Word` in VocabWordsParts.tsx: the Hangul and its romanization never break apart; the gloss may wrap. */
const wordList = (words) =>
  words
    .map(([h, rest]) => {
      const [roman, ...gloss] = rest.split(' ');
      return `<span><span class="keep">${ko(h)} ${roman}</span> ${gloss.join(' ')}</span>`;
    })
    .join(' · ');

function head(title, htmlClass = '') {
  return `<!doctype html>
<html lang="en"${htmlClass ? ` class="${htmlClass}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="../../app-shell/mock/app-shell.css">
<link rel="stylesheet" href="../../approvals/mock/approvals.css">
<link rel="stylesheet" href="class-code-overlay.css">
</head>
<body>
<!-- Design mock of docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md (row CO-0), written by ../tools/class-code-overlay-build.mjs; not shipped code. Names, the class name, the plan title and the code are sample data. -->
`;
}

const frameTop = () =>
  `<header class="frame-top"><div class="frame-bar"><a class="brand" href="#"><span class="brand-mark" aria-hidden="true">HR</span><span class="brand-name">${S.brand}</span></a><span class="persona-text">${S.persona}</span><a class="way-back" href="#"><span>${S.learnerApp}</span></a></div><nav class="frame-nav"><ul class="nav-list">${S.nav
    .map((n, i) => `<li><a class="nav-item" href="#"${i === 0 ? ' aria-current="page"' : ''}>${n}</a></li>`)
    .join('')}</ul></nav></header>`;

/** The action bar: `kind` = learners | empty | waiting | nocode. */
function bar(kind) {
  const primary = kind === 'empty' ? S.planThisWeek : S.plan;
  const items = [`<a class="btn btn-primary" href="#">${primary}</a>`, `<a class="btn" href="#">${S.planTerm}</a>`];
  if (kind !== 'empty') items.push(`<a class="btn" href="#">${S.lecture}</a>`, `<a class="btn" href="#">${S.classReport}</a>`);
  if (kind !== 'nocode') items.push(`<button class="btn" type="button" aria-haspopup="dialog" data-co="open">${S.showCode}</button>`);
  if (kind === 'waiting') items.push(`<a class="btn btn-nudge" href="#">${S.relinkWaiting}</a>`);
  items.push(`<button class="btn" type="button" aria-expanded="false">${S.more}${chev()}</button>`);
  return `<div class="bar" data-testid="class-actions"><div class="bar-row">${items.join('')}</div></div>`;
}

let uid = 0;
/** A class roster card. `open`: the What to revisit body is shown. `alias`: the roster is anonymized. */
function card(l, { open = false, alias = false } = {}) {
  const i = uid++;
  const name = alias ? `${l.name.charAt(0)}.` : l.name;
  const headRow = `<div class="student-head"><span class="avatar ${l.avatar}" aria-hidden="true"></span><strong class="student-name" id="name-${i}" tabindex="-1">${name}</strong>${l.isNew ? `<span class="gx-chip gx-chip-info">${S.statusNew}</span>` : ''}<span class="level">${l.level}</span></div>`;
  if (l.isNew) return `<article class="student" data-testid="student-card">${headRow}<p class="reason">${S.noPractice}</p></article>`;
  const segs = `<span class="segs" aria-hidden="true">${Array.from({ length: 7 }, (_, s) => `<i${s < l.segs ? ' class="done"' : ''}></i>`).join('')}</span>`;
  const lines = l.lines.map((t, n) => `<p class="line">${n === 1 ? segs : ''}${t}</p>`).join('');
  const words = l.words ? `<p class="line" data-testid="student-words">${l.words}</p>` : '';
  const bodyLines = [];
  if (l.jamo) bodyLines.push(`<p>Revisit: ${ko(l.jamo)}</p>`);
  if (l.revisitWords.length) bodyLines.push(`<p>Words to revisit: ${wordList(l.revisitWords)}</p>`);
  if (!bodyLines.length) bodyLines.push(`<p>${S.revisitNothing}</p>`);
  // The build does not mount a closed body; the mock keeps it `hidden` so its small script can open it.
  const fold = `<div class="fold"><button class="fold-toggle" type="button" data-body="fold-${i}" aria-expanded="${open}"${open ? ` aria-controls="fold-${i}"` : ''} aria-describedby="name-${i}">${S.revisitToggle}${chev(open)}</button><div class="fold-body" id="fold-${i}"${open ? '' : ' hidden'}>${bodyLines.join('')}</div></div>`;
  const plan = `<p class="line">${l.plan}</p>`;
  const actions = `<div class="card-row" data-testid="card-actions"><a class="btn" href="#">${S.seeReport}</a><a class="btn" href="#" aria-describedby="name-${i}">${S.sendNote}</a></div>`;
  return `<article class="student" data-testid="student-card">${headRow}${lines}${words}${fold}${plan}${actions}</article>`;
}

function classPage({ barKind = 'learners', cards = LEARNERS.map((l) => card(l)), invite = S.invite } = {}) {
  return `<div class="frame" data-co="page">${frameTop()}<main class="frame-main" id="content">
<a class="page-back text-link" href="#">${S.back}</a>
<div class="page-head"><h1 tabindex="-1">${S.space}</h1><span class="secondary">${S.count}</span></div>
<div class="stack-lg">
<section class="panel stack" aria-label="${S.week}"><h2 class="section-title">${S.week}</h2><ul class="week-list"><li>${S.practiced}</li><li>${S.weekJamo[0]}${ko(S.weekJamo[1])}</li><li>${S.weekWords[0]}${wordList(S.weekWords[1])}</li></ul></section>
${bar(barKind)}
<section class="stack" aria-label="Students"><h2 class="section-title">${S.rosterHeading}</h2><div class="roster-grid">${cards.join('')}</div></section>
<section class="panel invite"><h2><button class="invite-toggle" type="button" aria-expanded="false">${invite}${chev()}</button></h2></section>
</div></main></div>`;
}

function overlay({ howTo = false, hidden = false } = {}) {
  const { view, d } = qr(LINK);
  return `<div class="co-overlay" role="dialog" aria-modal="true" aria-labelledby="co-name" aria-describedby="co-caption co-spoken co-expiry" data-testid="class-code-overlay"${hidden ? ' hidden' : ''}>
<div class="co-body">
<div class="co-text">
<h2 class="co-name" id="co-name" tabindex="-1">${S.space}</h2>
<p class="co-caption" id="co-caption">${S.codeLabel}</p>
<p class="co-code" aria-hidden="true" data-testid="class-code">${CODE}</p>
<span class="visually-hidden" id="co-spoken">${CODE.split('').join(' ')}</span>
<p class="co-expiry" id="co-expiry">${S.expiry}</p>
${howTo ? `<p class="co-how">${S.howToJoin}</p>` : ''}
</div>
<figure class="co-qr"><svg role="img" aria-label="${S.qrLabel}" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges" data-testid="class-code-qr" data-link="${LINK}"><rect width="${view}" height="${view}"/><path d="${d}"/></svg><figcaption class="co-qr-caption">${S.qrCaption}</figcaption></figure>
</div>
<div class="co-close"><button class="btn" type="button" data-co="close">${S.close}</button></div>
</div>`;
}

/**
 * The class page mock's behaviour, so keyboard and pointer use can be tried (spec sections 3.3 and 3.7): Show the code
 * closes every open card, opens the overlay, makes the page inert, stops the page scrolling and focuses the class name;
 * Tab stays on Close; Escape and Close undo it all and focus the opener, or the page heading when it is gone. A card's
 * What to revisit opens and closes that card only. The build mounts no closed body; the mock uses `hidden`.
 */
const SCRIPT = `<script>
(() => {
  const root = document.documentElement;
  const page = document.querySelector('[data-co="page"]');
  const overlay = document.querySelector('.co-overlay');
  const heading = overlay.querySelector('.co-name');
  const close = overlay.querySelector('[data-co="close"]');
  let opener = null;
  const setFold = (button, open) => {
    const body = document.getElementById(button.dataset.body);
    body.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) button.setAttribute('aria-controls', body.id); else button.removeAttribute('aria-controls');
    button.querySelector('.chev').classList.toggle('open', open);
  };
  const folds = () => [...document.querySelectorAll('.fold-toggle')];
  folds().forEach((b) => b.addEventListener('click', () => setFold(b, b.getAttribute('aria-expanded') !== 'true')));
  const open = (button) => {
    opener = button;
    folds().forEach((b) => setFold(b, false));
    overlay.hidden = false;
    page.inert = true;
    root.classList.add('co-open');
    heading.focus();
  };
  const shut = () => {
    overlay.hidden = true;
    page.inert = false;
    root.classList.remove('co-open');
    (opener && opener.isConnected ? opener : document.querySelector('.page-head h1')).focus();
  };
  document.querySelectorAll('[data-co="open"]').forEach((b) => b.addEventListener('click', () => open(b)));
  close.addEventListener('click', shut);
  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); shut(); }
    else if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
  });
})();
</script>`;

/** OD-CO7 (awaiting owner), option (a): Show the code on a teacher home class row (counts only, no learner data). */
function homeRow() {
  return `<article class="gx-row"><div class="grow"><p class="gx-name">${S.space}</p><p class="line">${S.count}</p></div><a class="btn btn-small" href="#">${S.homeOpen}</a><div class="row-wrap row-full"><a class="btn btn-small" href="#">${S.homeReport}</a><a class="btn btn-small" href="#">${S.homeNotes}</a><button class="btn btn-small" type="button" aria-haspopup="dialog">${S.showCode}</button></div></article>`;
}

const pages = {
  // The overlay open over the class page (the page is in the DOM, inert and covered), with the how-to-join line of
  // OD-CO5 (owner decision 2026-11-23).
  'class-code-overlay.html': `${head('Class code overlay, open over the class page (CO-0 mock)', 'co-open')}<div inert>${classPage()}</div>
${overlay({ howTo: true })}
</body>
</html>
`,
  // The class page itself: Show the code in the bar, every card folded (the default); the overlay ready behind
  // Show the code, with a small script so the keyboard and pointer behaviour can be tried.
  'class-code-overlay-page.html': `${head('Class page with Show the code and the folded cards (CO-0 mock)')}${classPage()}
${overlay({ howTo: true, hidden: true })}
${SCRIPT}
</body>
</html>
`,
};

// The board of states: the bar in four cases, and the card in five.
uid = 100;
const boardItem = (label, title, body) => `<div class="board-item"><p class="board-label">${label}</p><p class="board-title">${title}</p><div class="sample"><div class="sample-pad">${body}</div></div></div>`;
pages['class-code-overlay-cards.html'] = `${head('Show the code and What to revisit: states (CO-0 mock)')}<div class="board">
<h1 class="board-title">Show the code in the bar, and the card's What to revisit (AMENDMENTS-CLASS-CODE-OVERLAY sections 3.1 and 3.7)</h1>
<div class="board-wide">
${boardItem('B1 · class with learners', 'Show the code after the everyday buttons', bar('learners'))}
${boardItem('B2 · empty class', 'Show the code with Plan this week and Plan this term', bar('empty'))}
${boardItem('B3 · something waiting', 'Show the code before the waiting entry', bar('waiting'))}
${boardItem('B4 · no live code', 'No Show the code; Invite students offers Create a code', `${bar('nocode')}<section class="panel invite after-bar"><h2><button class="invite-toggle" type="button" aria-expanded="false">${S.inviteNone}${chev()}</button></h2></section>`)}
${boardItem('H1 · teacher home class row (OD-CO7, awaiting owner)', 'Option (a): Show the code from the home, which names no learner', homeRow())}
</div>
<div class="board-grid">
${boardItem('C1 · folded (default)', 'Every card starts folded', card(LEARNERS[0]))}
${boardItem('C2 · open: letters and words (OD-CO1)', 'One card open; the others stay folded', card(LEARNERS[0], { open: true }))}
${boardItem('C3 · open: letters only', 'An older summary with no words', card(LEARNERS[2], { open: true }))}
${boardItem('C4 · open: nothing to revisit (OD-CO2)', 'The button is on every card with a summary', card(LEARNERS[1], { open: true }))}
${boardItem('C5 · no summary', 'No button: nothing is shared yet', card(LEARNERS[3]))}
${boardItem('C6 · anonymized roster, folded', 'Initials: the card folds the same', card(LEARNERS[0], { alias: true }))}
</div>
</div>
</body>
</html>
`;

for (const [file, html] of Object.entries(pages)) writeFileSync(join(MOCK, file), html);
console.log(`wrote ${Object.keys(pages).length} pages to ${MOCK}`);
