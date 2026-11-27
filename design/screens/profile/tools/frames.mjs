// RF-0b (docs/specs/AMENDMENTS-ROMANIZATION-FADE.md sections 3.9, 3.10): the frame builder of this design pass. A design
// tool (not shipped, not run by CI). It writes the static pages under ../mock from one description of each screen, so
// the boards, the measuring tool (measure.mjs) and the shots draw exactly the same markup.
//
//   node design/screens/profile/tools/build.mjs        # writes ../mock/*.html (the pages are in build.mjs)
//
// Every English UI string is a dictionary value of packages/i18n (existing keys) or one of the six keys of spec 3.11
// (marked NEW). The Spanish and Korean values of the NEW keys are LENGTH-STRESS DRAFTS of this pass, not translations:
// row RF-2 drafts the real ones and has them reviewed under F-I18N-001 section 3.10. Existing es / ko keys are their
// dictionary values.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOYA } from './hoya-figure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const MOCK = resolve(here, '../mock');

// ---------------------------------------------------------------------------------------------- strings
export const STR = {
  en: {
    lang: 'en',
    mine: 'My settings', // learner.profile.groups.mine
    display: 'Display', // learner.profile.display.row
    displayLine: 'English · Text: Standard', // learner.profile.display.line
    title: 'Reading practice', // learner.profile.reading.title
    group: 'Show romanization', // NEW learner.profile.reading.groupLabel
    auto: 'As I learn', // NEW learner.profile.reading.auto.label
    autoHint: 'Shows less as you read more.', // NEW learner.profile.reading.auto.hint
    always: 'Always', // NEW learner.profile.reading.always.label
    tap: 'Only when I tap', // NEW learner.profile.reading.tap.label
    challenge: 'Challenge', // learner.vocab.speed.challenge.label (ChallengeCard)
    challengeLine: 'Adds a 60-second clock. You can turn it off any time.', // .tryLine(60)
    off: 'Off', // learner.profile.sound.off
    close: 'Close', // common.buttons.close (the quest header's close)
    aaSign: 'Aa', // common.display.button
    aaName: 'Aa, Display: language and text size', // common.display.a11y (the Aa control's name)
    progress: (s, t) => `${s} / ${t}`, // learner.quest.progress
    stepTitle: 'Into the Hills', // quest:stage1-nature-q2 steps.s1.titleEn
    hello: 'Hello', // learner.quest.step.intro.pill
    questLine: "Korea has many mountains, and the sea is on three sides. Let's read nature words!", // steps.s1.hoyaLineEn
    notice: 'You can read Hangul now! Need help with a word? Tap Show how to say it.', // NEW learner.quest.readingNotice
    reveal: 'Show how to say it', // learner.quest.discover.showHowToSay.cta (the button the line names)
    cont: 'Continue', // learner.quest.continue.cta
  },
  es: {
    lang: 'es',
    mine: 'Mis ajustes',
    display: 'Pantalla',
    displayLine: 'Español · Texto: Normal',
    title: 'Práctica de lectura',
    group: 'Mostrar la romanización', // NEW, stress draft
    auto: 'A medida que aprendo', // NEW, stress draft
    autoHint: 'Se muestra menos a medida que lees más.', // NEW, stress draft
    always: 'Siempre', // NEW, stress draft
    tap: 'Solo cuando la toque', // NEW, stress draft
    challenge: 'Desafío',
    challengeLine: 'Agrega un reloj de 60 segundos. Puedes quitarlo cuando quieras.',
    off: 'No',
    close: 'Cerrar',
    aaSign: 'Aa',
    aaName: 'Aa, Pantalla: idioma y tamaño del texto',
    progress: (s, t) => `${s} / ${t}`,
    stepTitle: 'Hacia las colinas',
    hello: 'Hola',
    questLine: 'Corea tiene muchas montañas y mar por tres lados. ¡Leamos palabras de la naturaleza!',
    notice: '¡Ya puedes leer hangul! ¿Necesitas ayuda con una palabra? Toca Ver cómo se dice.', // NEW, stress draft
    reveal: 'Ver cómo se dice',
    cont: 'Continuar',
  },
  ko: {
    lang: 'ko',
    mine: '내 설정',
    display: '보기 설정',
    displayLine: '한국어 · 글자 크기: 보통',
    title: '읽기 연습',
    group: '로마자 표기 보기', // NEW, stress draft
    auto: '배우는 만큼', // NEW, stress draft
    autoHint: '많이 읽을수록 조금씩 덜 보여요.', // NEW, stress draft
    always: '항상', // NEW, stress draft
    tap: '누를 때만', // NEW, stress draft
    challenge: '도전',
    challengeLine: '60초 시계가 생겨요. 언제든지 끌 수 있어요.',
    off: '꺼짐',
    close: '닫기',
    aaSign: '가가',
    aaName: '가가, 보기 설정: 언어와 글자 크기',
    progress: (s, t) => `${s} / ${t}`,
    stepTitle: '언덕으로 가요',
    hello: '인사',
    questLine: '한국은 산이 많고 삼면이 바다예요. 자연 낱말을 읽어 봐요!',
    notice: '이제 한글을 읽을 수 있어요! 낱말이 어려우면 ‘읽는 법 보기’를 눌러요.', // NEW, stress draft
    reveal: '읽는 법 보기',
    cont: '계속',
  },
};

export const CHOICES = ['auto', 'always', 'tap'];

// ---------------------------------------------------------------------------------------------- icons and Hoya
const ICON = {
  close: '<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round"/>',
  arrowRight: '<path d="M9 5.5 L15.5 12 L9 18.5" style="fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round"/>',
};
const icon = (name, size = 24, cls = 'icon') => `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;
/** Hoya as Hoya.tsx draws it: an image named "Hoya the tiger, <pose>" (HOYA_LABELS in scene-art/hoya.ts). */
const HOYA_NAME = { idle: 'Hoya the tiger, standing', waving: 'Hoya the tiger, waving' };
const hoya = (pose, cls) => `<svg class="${cls}" viewBox="0 0 128 128" role="img" aria-label="${HOYA_NAME[pose]}" focusable="false" data-pose="${pose}">${HOYA[pose]}</svg>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------------------------- page shell
export function page({ title, body, comment, lang = 'en' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="reading-practice.css">
</head>
<body>
<!-- ${comment} -->
${body}
</body>
</html>
`;
}

export const item = (label, frameHtml, note) => `<div class="board-item"><p class="board-label">${label}</p>${frameHtml}${note ? `<p class="note">${note}</p>` : ''}</div>`;

const device = (o, inner) => `<div class="device${o.ts ? ` ${o.ts}` : ''}" lang="${STR[o.locale ?? 'en'].lang}" style="width: ${o.w}px; height: ${o.h}px" data-w="${o.w}" data-h="${o.h}">${inner}</div>`;

// ---------------------------------------------------------------------------------------------- Panel A: the card
let uid = 0;
/**
 * The Reading practice card (spec 3.10, wireframe Panel A).
 * @param {object} o
 *   locale   'en' | 'es' | 'ko'
 *   checked  'auto' | 'always' | 'tap' (the stored choice, romanizationChoiceOf)
 *   focus    a choice with the keyboard / switch focus ring, or null
 *   pressed  a choice under a finger (the press look), or null
 */
export function readingCard(o) {
  const s = STR[o.locale ?? 'en'];
  const id = `rp${++uid}`;
  const rows = CHOICES.map((c) => {
    const on = o.checked === c;
    const label = s[c];
    const hint = c === 'auto' ? s.autoHint : null;
    // The accessible name is the label alone; the hint is the radio's description (aria-describedby on the web,
    // accessibilityHint on native), as DisplaySheet's screen-reader switch (Q2). Roving focus on the web only: only the
    // checked radio is a Tab stop (DisplaySheet, D19; Q3).
    const name = label;
    const hintId = `${id}-${c}-hint`;
    const cls = `radio${o.focus === c ? ' is-focus' : ''}${o.pressed === c ? ' is-pressed' : ''}`;
    return `<div class="${cls}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" aria-label="${esc(name)}"${hint ? ` aria-describedby="${hintId}"` : ''} data-choice="${c}" data-part="radio"><div class="radio-in"><span class="ring-slot" aria-hidden="true"><span class="ring" data-part="ring">${on ? '<i></i>' : ''}</span></span><span class="radio-text" aria-hidden="true"><span class="radio-label" data-part="label">${esc(label)}</span>${hint ? `<span class="radio-hint" id="${hintId}" data-part="hint">${esc(hint)}</span>` : ''}</span></div></div>`;
  }).join('');
  return `<div class="card" data-part="card"><h3 class="t-prompt" id="${id}-title">${esc(s.title)}</h3><div class="gap-xs"></div><p class="t-body secondary" id="${id}-group" data-part="group-label">${esc(s.group)}</p><div class="gap-sm"></div><div class="rp-group" role="radiogroup" aria-labelledby="${id}-group" data-part="group">${rows}</div></div>`;
}

/** The unchanged neighbours of Profile's My settings group, drawn for context (the Display row, the Challenge card). */
function displayCard(s) {
  return `<div class="card unchanged" aria-hidden="true"><div class="row"><div class="grow"><p class="t-body semibold">${esc(s.display)}</p><p class="t-caption muted">${esc(s.displayLine)}</p></div>${icon('arrowRight', 24)}</div></div>`;
}
function challengeCard(s) {
  return `<div class="card unchanged" aria-hidden="true"><div class="row"><div class="grow"><p class="t-body semibold">${esc(s.challenge)}</p><p class="t-caption muted">${esc(s.challengeLine)}</p></div><span class="pill neutral">${esc(s.off)}</span></div></div>`;
}

/**
 * Profile scrolled to My settings (the profiles, the stats and Classes & family are above), the Reading practice card in
 * its place between Display and Challenge (ProfileScreen.tsx order; Sound is above Display and scrolled away here).
 */
export function profileFrame(o) {
  const s = STR[o.locale ?? 'en'];
  // o.context: scrolled to My settings (its heading and the Display row above the card); otherwise scrolled so the card's
  // top is at the window's top (what a learner sees after scrolling to it on a small or landscape window).
  const above = o.context ? `${displayCard(s)}<div class="gap-lg"></div>` : '';
  const note = o.context ? 'scrolled: Profile, My settings (its heading and Sound above)' : 'scrolled: Profile, the card at the top';
  const inner = `<div class="scr"><p class="scrolled-note" aria-hidden="true">${note}</p><div>${above}${readingCard(o)}<div class="gap-lg"></div>${challengeCard(s)}</div></div>`;
  return device(o, inner);
}

// ---------------------------------------------------------------------------------------------- Panel B: Hello step
/**
 * The first step (Hello) of quest 11 (Mountain, River, Sea) in phase reading, the one time the line is due (spec 3.9,
 * wireframe Panel B). NarrativeStepBody: the brand card, Hoya waving 120, the quest's own bubble, then the line.
 * @param {object} o
 *   locale  'en' | 'es' | 'ko'
 *   line    'none' (every other run, as today)
 *           'bare' (RECOMMENDED, Q4 + Q5: a second bubble with no figure, and on this one run the step card draws no
 *           Hoya 120: the first bubble's Hoya speaks both lines)
 *           'bare-hoya' (the spec as first written: the same bubble, the step's Hoya 120 kept)
 *           'figure' (a second full HoyaBubble with its own Hoya 72)
 *           'joined' (the line as a second paragraph of the first bubble)
 */
export function helloFrame(o) {
  const s = STR[o.locale ?? 'en'];
  const line = o.line ?? 'bare';
  const first = line === 'joined'
    ? `<div class="bubble" data-part="bubble1" aria-live="polite">${hoya('idle', 'hoya-bubble')}<div class="msg"><p>${esc(s.questLine)}</p><div class="gap-sm"></div><p data-part="notice">${esc(s.notice)}</p></div></div>`
    : `<div class="bubble" data-part="bubble1" aria-live="polite">${hoya('idle', 'hoya-bubble')}<p class="msg">${esc(s.questLine)}</p></div>`;
  // The reading line: not a live region (read in order, spec 3.9), tone idle.
  const second = line === 'bare' || line === 'bare-hoya'
    ? `<div class="gap-sm"></div><div class="bubble" data-part="bubble2" data-notice="1"><p class="msg" data-part="notice">${esc(s.notice)}</p></div>`
    : line === 'figure'
      ? `<div class="gap-sm"></div><div class="bubble" data-part="bubble2" data-notice="1">${hoya('idle', 'hoya-bubble')}<p class="msg" data-part="notice">${esc(s.notice)}</p></div>`
      : '';
  // The step's own Hoya 120 (waving): not drawn on the run that shows the line in the recommended look (Q5).
  const big = line === 'bare' ? '' : `${hoya('waving', 'hoya-step')}<div class="gap-md"></div>`;
  const card = `<div class="card pad-lg tone-brand step-card" data-part="stepcard">${big}${first}${second}</div>`;
  const header = `<div class="hdr"><button class="hdr-close" type="button" aria-label="${esc(s.close)}" data-part="close">${icon('close')}</button><button class="aa-btn" type="button" aria-label="${esc(s.aaName)}" data-part="aa"><span aria-hidden="true">${esc(s.aaSign)}</span></button></div>`;
  const dots = `<div class="dots-row"><div class="dots" role="progressbar" aria-valuemin="0" aria-valuemax="6" aria-valuenow="1">${Array.from({ length: 6 }, (_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div><span class="pill neutral">${s.progress(1, 6)}</span></div>`;
  const body = `<div class="scroll" data-part="scroll"><div class="scroll-in" data-part="content">${dots}<div class="gap-lg"></div><h1 class="t-title">${esc(s.stepTitle)}</h1><div class="gap-xs"></div><div><span class="pill primary">${esc(s.hello)}</span></div><div class="gap-lg"></div>${card}<div class="spacer"></div><div class="gap-lg"></div><button class="btn btn-hero" type="button" data-part="continue">${esc(s.cont)}</button><div class="gap-lg"></div></div></div>`;
  return device(o, `<div class="scr">${header}${body}</div>`);
}
