import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { startRolePlay, stepRolePlay, type RpEvent, type RpState } from '../reducer';
import { closingOf, logFollowY, logView, titleJoinsLog, partsText, pinnedCap, progressOf, repliesOf, replyViews, whyParts } from '../view';

const scene = LIBRARY_SCENE;
const labels = getMessages('en').a11y.minigame.rolePlay;
function at(events: RpEvent[]): RpState {
  let { state } = startRolePlay(scene);
  for (const e of events) state = stepRolePlay(scene, state, e).state;
  return state;
}

describe('Role Play views (row CM-35)', () => {
  it('the log names each bubble for screen readers: the partner by role with the line and its meaning, my replies as mine', () => {
    const view = logView(scene, at([{ type: 'tap', reply: 'hello' }, { type: 'sent' }]), labels);
    expect(view.map((b) => [b.who, b.ko, b.label])).toEqual([
      ['partner', '안녕하세요!', 'librarian says: 안녕하세요!, annyeonghaseyo. Hello!'],
      ['me', '안녕하세요!', 'You said: 안녕하세요!, annyeonghaseyo'],
      ['partner', '무슨 책을 찾아요?', 'librarian says: 무슨 책을 찾아요?, museun chaegeul chajayo. What book are you looking for?'],
    ]);
    expect(view[0]?.meaning).toBe('Hello!');
    expect(view[1]?.meaning).toBeUndefined();
    // An entry the scene does not hold is left out.
    expect(logView(scene, { log: [{ who: 'partner', node: 'gone' }, { who: 'me', node: 't1', reply: 'gone' }] }, labels)).toEqual([]);
  });

  it('replies keep a seeded order per turn (the same every time the turn opens) and hold their meanings back', () => {
    const state = at([]);
    expect(repliesOf(scene, state).map((r) => r.id)).toEqual(repliesOf(scene, at([])).map((r) => r.id));
    expect(repliesOf(scene, state).map((r) => r.id).sort()).toEqual(['hello', 'meal']);
    expect(replyViews(scene, state).every((r) => r.meaning === undefined && r.look === 'open' && !r.disabled)).toBe(true);
    const shown = replyViews(scene, at([{ type: 'showMeanings' }]));
    expect(shown.find((r) => r.id === 'meal')?.meaning).toBe('I will eat well. (said before eating)');
    expect(repliesOf(scene, at([{ type: 'tap', reply: 'hello' }, { type: 'sent' }, { type: 'tap', reply: 'storybook' }, { type: 'sent' }, { type: 'tap', reply: 'thanks' }, { type: 'sent' }, { type: 'tap', reply: 'stay' }, { type: 'sent' }]))).toEqual([]);
  });

  it('a locked reply, a reply being sent and the look-here ring; every tap waits while a reply is said', () => {
    const missed = replyViews(scene, at([{ type: 'tap', reply: 'meal' }]));
    expect(missed.find((r) => r.id === 'meal')).toMatchObject({ look: 'locked', disabled: true });
    expect(missed.find((r) => r.id === 'hello')).toMatchObject({ look: 'open', disabled: false });
    const sending = replyViews(scene, at([{ type: 'tap', reply: 'hello' }]));
    expect(sending.find((r) => r.id === 'hello')).toMatchObject({ look: 'sending', disabled: true });
    expect(sending.find((r) => r.id === 'meal')).toMatchObject({ look: 'open', disabled: true });
    const ringed = replyViews(scene, { ...at([]), locked: ['meal', 'x'] });
    expect(ringed.find((r) => r.id === 'hello')?.look).toBe('lookHere');
  });

  it("Hoya's why line splits around {ko:} tokens, so the quoted Korean is drawn with its romanization", () => {
    const state = at([{ type: 'tap', reply: 'hello' }, { type: 'sent' }, { type: 'tap', reply: 'storybook' }, { type: 'sent' }, { type: 'tap', reply: 'thanks' }, { type: 'sent' }, { type: 'tap', reply: 'go' }]);
    const parts = whyParts(scene, state);
    expect(parts).toEqual([{ text: 'You are the one leaving, so ' }, { ko: '안녕히 계세요', romanization: 'annyeonghi gyeseyo' }, { text: ' fits: it is said to the one who stays.' }]);
    expect(partsText(parts!)).toBe('You are the one leaving, so 안녕히 계세요 annyeonghi gyeseyo fits: it is said to the one who stays.');
    expect(partsText([{ ko: '책', romanization: '' }])).toBe('책');
    expect(whyParts(scene, at([]))).toBeNull();
  });

  it('progress counts learner turns, never past the turn count; the closing line shows only at the end', () => {
    expect(progressOf(scene, at([]))).toEqual({ value: 1, max: 4 });
    expect(progressOf(scene, { turn: 9, done: false })).toEqual({ value: 4, max: 4 });
    expect(progressOf(scene, { turn: 4, done: true })).toEqual({ value: 4, max: 4 });
    expect(closingOf(scene, at([]))).toBeNull();
    expect(closingOf(scene, { node: 'end', done: true })).toBe('You found your book!');
    expect(closingOf(scene, { node: 't1', done: true })).toBeNull();
  });

  it('the pinned area: up to half the window, short of the newest partner bubble, never under the instruction row and one reply', () => {
    // The mock at 320 x 568 (README "Checked by eye"): header 100, newest bubble 195, so the area stops at 273 of its 348.
    expect(pinnedCap({ windowHeight: 568, bodyHeight: 468, newestHeight: 195, keepHeight: 160 })).toBe(273);
    // At 768 x 1024 half the window (512) is the cap; the 348 of three replies fit.
    expect(pinnedCap({ windowHeight: 1024, bodyHeight: 900, newestHeight: 195, keepHeight: 160 })).toBe(512);
    // Largest text: the newest bubble takes most of the room, the row and one reply stay.
    expect(pinnedCap({ windowHeight: 568, bodyHeight: 468, newestHeight: 400, keepHeight: 200 })).toBe(200);
    // Before anything is measured: half the window.
    expect(pinnedCap({ windowHeight: 568, bodyHeight: 0, newestHeight: 0, keepHeight: 0 })).toBe(284);
  });

  it('the log follows the newest partner line: to the end when it fits, else its top, else its Korean line', () => {
    // The whole bubble (and what trails it) fits: to the end, and before the log is measured too.
    expect(logFollowY({ logHeight: 203, contentHeight: 600, below: 8, newestHeight: 195, lineTop: 30, lineBottom: 68 })).toBe('end');
    expect(logFollowY({ logHeight: 0, contentHeight: 600, below: 8, newestHeight: 195, lineTop: 30, lineBottom: 68 })).toBe('end');
    // Largest text: the bubble is taller than the log, but its role and Korean line fit, so the log opens on its top.
    expect(logFollowY({ logHeight: 120, contentHeight: 600, below: 8, newestHeight: 266, lineTop: 36, lineBottom: 74 })).toBe(326);
    // A shorter log (another font's taller lines): the Korean line opens at the top, its romanization under it.
    expect(logFollowY({ logHeight: 80, contentHeight: 600, below: 8, newestHeight: 266, lineTop: 40, lineBottom: 86 })).toBe(366);
    // A bubble taller than everything above it never asks for a negative offset.
    expect(logFollowY({ logHeight: 80, contentHeight: 200, below: 8, newestHeight: 266, lineTop: 40, lineBottom: 86 })).toBe(40);
    // The Korean line not yet measured: the bubble's top, as before.
    expect(logFollowY({ logHeight: 80, contentHeight: 600, below: 8, newestHeight: 266, lineTop: 0, lineBottom: 0 })).toBe(326);
  });

  it('the scene title joins the top of the log only when the window cannot hold it, the newest line and one reply', () => {
    // 320 x 568 at regular text: everything fits under the title, which stays put.
    expect(titleJoinsLog({ bodyHeight: 468, titleHeight: 60, titleInLog: false, lineBottom: 60, keepHeight: 160 })).toBe(false);
    // Largest text in a font with taller lines: 322 under the title, 86 for the newest line and 290 kept for a reply.
    expect(titleJoinsLog({ bodyHeight: 322, titleHeight: 98, titleInLog: false, lineBottom: 86, keepHeight: 290 })).toBe(true);
    // Once in the log it stays there (a later, shorter line does not move it back), so it never jumps between turns.
    expect(titleJoinsLog({ bodyHeight: 420, titleHeight: 98, titleInLog: true, lineBottom: 40, keepHeight: 160 })).toBe(true);
    // Nothing moves before everything is measured.
    expect(titleJoinsLog({ bodyHeight: 0, titleHeight: 98, titleInLog: false, lineBottom: 86, keepHeight: 290 })).toBe(false);
    expect(titleJoinsLog({ bodyHeight: 322, titleHeight: 98, titleInLog: false, lineBottom: 0, keepHeight: 290 })).toBe(false);
    expect(titleJoinsLog({ bodyHeight: 322, titleHeight: 98, titleInLog: false, lineBottom: 86, keepHeight: 0 })).toBe(false);
  });
});
