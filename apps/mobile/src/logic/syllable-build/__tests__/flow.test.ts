import { blockParts, type BlockParts } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { hoyaLine, NO_FINAL, REPLAY_AFTER_MS, startBuild, stepBuild, wantedLetter, type BuildEvent, type BuildState } from '../flow';
import { promptView, rowViews, zoneViews } from '../view';

/**
 * F-CURR-002 section 7.1 F3, row CM-32 (design/wireframes/minigame/syllable-build.md, Interaction points): the round
 * reducer, Hoya's lines and the view models. Tiles show the jamo only; the romanization waits.
 */
const BAP = blockParts('밥') as BlockParts;
const GA = blockParts('가') as BlockParts;
const ctx = (target: BlockParts, voice = true) => ({ target, voice });

function run(target: BlockParts, events: BuildEvent[], voice = true, fixed: 'first' | 'vowel' | 'final' | null = null) {
  let state = startBuild(target, fixed);
  const effects: string[] = [];
  for (const e of events) {
    const out = stepBuild(state, e, ctx(target, voice));
    state = out.state;
    for (const f of out.effects) effects.push(f.type === 'answer' ? `answer:${f.correct}${f.hinted ? ':hinted' : ''}` : f.type === 'play' ? `play:${f.why}` : f.type === 'schedule-replay' ? `replay:${f.ms}` : f.type === 'haptic' ? `haptic:${f.kind}` : f.type);
  }
  return { state, effects };
}

const tile = (zone: 'first' | 'vowel' | 'final', letter: string): BuildEvent => ({ type: 'tile', zone, letter });

describe('the round reducer', () => {
  it('fills a zone per tile in any order and checks the full block: right on the first try', () => {
    const { state, effects } = run(BAP, [tile('final', 'ㅂ'), tile('first', 'ㅂ'), tile('vowel', 'ㅏ')]);
    expect(state.status).toBe('right');
    expect(effects).toEqual(['cancel-replay', 'cancel-replay', 'cancel-replay', 'answer:true', 'haptic:success', 'play:right', 'solved']);
  });

  it('No final counts as a filled zone', () => {
    const { state, effects } = run(GA, [tile('first', 'ㄱ'), tile('vowel', 'ㅏ'), tile('final', NO_FINAL)]);
    expect(state.status).toBe('right');
    expect(effects).toContain('answer:true');
  });

  it('a zone that does not fit is marked, the zones that fit stay, the sound replays after 0.8 s; the miss is the scored answer', () => {
    const { state, effects } = run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ')]);
    expect(state.status).toBe('marked');
    expect(state.marked).toEqual(['vowel']);
    expect(state.zones).toEqual({ first: 'ㅂ', vowel: 'ㅓ', final: 'ㅂ' });
    expect(effects.slice(-4)).toEqual(['answer:false', 'haptic:nudge', 'cancel-replay', `replay:${REPLAY_AFTER_MS}`]);
    expect(stepBuild(state, { type: 'replay-due' }, ctx(BAP)).effects).toEqual([{ type: 'play', why: 'replay' }]);
  });

  it('changing the marked zone checks again as a retry, never scored a second time', () => {
    const { state, effects } = run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ'), tile('vowel', 'ㅏ')]);
    expect(state.status).toBe('right');
    expect(effects.filter((e) => e.startsWith('answer'))).toEqual(['answer:false']);
  });

  it('a second miss on the same zone rings the right tile of that row; the right tile clears the ring', () => {
    const missTwice = [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ'), tile('vowel', 'ㅗ')];
    const { state } = run(BAP, missTwice);
    expect(state.misses.vowel).toBe(2);
    expect(state.ring).toBe('vowel');
    expect(hoyaLine(state, BAP)).toBe('lookHere');
    const fixedRing = stepBuild(state, tile('vowel', 'ㅏ'), ctx(BAP)).state;
    expect(fixedRing.ring).toBeNull();
    expect(fixedRing.status).toBe('right');
  });

  it('a tap on a filled zone empties it; a second tile of a row replaces the first; nothing changes a right block', () => {
    let s = run(BAP, [tile('first', 'ㄱ')]).state;
    s = stepBuild(s, tile('first', 'ㅂ'), ctx(BAP)).state;
    expect(s.zones.first).toBe('ㅂ');
    s = stepBuild(s, { type: 'clear', zone: 'first' }, ctx(BAP)).state;
    expect(s.zones.first).toBeNull();
    expect(stepBuild(s, { type: 'clear', zone: 'first' }, ctx(BAP)).state).toBe(s);
    expect(stepBuild(s, tile('vowel', 'ㅏ'), ctx(BAP)).state.zones.vowel).toBe('ㅏ');
    const right = run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')]).state;
    expect(stepBuild(right, tile('first', 'ㄱ'), ctx(BAP)).state).toBe(right);
    expect(stepBuild(right, { type: 'replay-due' }, ctx(BAP)).effects).toEqual([]);
    // The same tile again changes nothing.
    const same = run(BAP, [tile('first', 'ㅂ')]).state;
    expect(stepBuild(same, tile('first', 'ㅂ'), ctx(BAP)).state).toBe(same);
  });

  it('emptying a marked zone leaves the other marked zones marked', () => {
    const { state } = run(BAP, [tile('first', 'ㄱ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ')]);
    expect(state.marked).toEqual(['first', 'vowel']);
    const cleared = stepBuild(state, { type: 'clear', zone: 'first' }, ctx(BAP)).state;
    expect(cleared.marked).toEqual(['vowel']);
    expect(cleared.status).toBe('marked');
    const both = stepBuild(cleared, { type: 'clear', zone: 'vowel' }, ctx(BAP)).state;
    expect(both.status).toBe('building');
    expect(stepBuild(both, { type: 'replay-due' }, ctx(BAP)).effects).toEqual([]);
  });

  it('Show how it sounds before the scored answer records it as hinted; after it, or with no device voice, it is no hint', () => {
    const reveal: BuildEvent = { type: 'reveal' };
    expect(run(BAP, [reveal, tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')]).effects).toContain('answer:true:hinted');
    expect(run(BAP, [reveal, tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')], false).effects).toContain('answer:true');
    const late = run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ'), reveal, tile('vowel', 'ㅏ')]);
    expect(late.effects.filter((e) => e.startsWith('answer'))).toEqual(['answer:false']);
    const twice = run(BAP, [reveal]).state;
    expect(stepBuild(twice, reveal, ctx(BAP)).state).toBe(twice);
  });

  it('a fixed zone (a symbol item at the produce rung) is filled from the start and never changes', () => {
    const s = startBuild(BAP, 'first');
    expect(s.zones.first).toBe('ㅂ');
    expect(stepBuild(s, tile('first', 'ㄱ'), ctx(BAP)).state).toBe(s);
    expect(stepBuild(s, { type: 'clear', zone: 'first' }, ctx(BAP)).state).toBe(s);
    expect(run(BAP, [tile('vowel', 'ㅏ'), tile('final', 'ㅂ')], true, 'first').state.status).toBe('right');
    expect(startBuild(GA, 'final').zones.final).toBe(NO_FINAL);
    expect(wantedLetter(GA, 'final')).toBe(NO_FINAL);
  });
});

describe("Hoya's lines", () => {
  it('say where to listen, by zone, and ask about the final when No final and a final are mixed up', () => {
    expect(hoyaLine(startBuild(BAP), BAP)).toBeNull();
    expect(hoyaLine(run(BAP, [tile('first', 'ㄱ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')]).state, BAP)).toBe('first');
    expect(hoyaLine(run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ')]).state, BAP)).toBe('vowel');
    expect(hoyaLine(run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㄴ')]).state, BAP)).toBe('final');
    expect(hoyaLine(run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', NO_FINAL)]).state, BAP)).toBe('finalOrNone');
    expect(hoyaLine(run(GA, [tile('first', 'ㄱ'), tile('vowel', 'ㅏ'), tile('final', 'ㄴ')]).state, GA)).toBe('finalOrNone');
    expect(hoyaLine(run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')]).state, BAP)).toBe('built');
  });
});

const copy = getMessages('en').learner.minigame.syllableBuild;
const a11y = getMessages('en').a11y.minigame.syllableBuild;
const rows = { firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'] };
const SOUND_VALUES = ['b', 'p', 'b/p', 'g', 'k', 'g/k', 'm', 'd', 't', 'd/t', 'n', 'ng', 'l', 'r'];

function everyState(target: BlockParts): BuildState[] {
  const out = [startBuild(target)];
  const seqs: BuildEvent[][] = [
    [tile('first', 'ㅂ')],
    [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ')],
    [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ'), tile('vowel', 'ㅗ')],
    [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', NO_FINAL)],
  ];
  for (const s of seqs) out.push(run(target, s).state);
  return out;
}

describe('the view: jamo-only tiles and the romanization held back (the CM-32 test)', () => {
  it('before the block is right, no tile face or tile or zone name carries the romanization or a sound value, in every audio state', () => {
    for (const state of everyState(BAP)) {
      if (state.status === 'right') continue;
      const tiles = rowViews(rows, state, BAP, copy, a11y).flatMap((r) => r.tiles);
      for (const t of tiles) {
        expect(t.face === copy.noFinal || /^[ㄱ-ㅣ]$/.test(t.face), t.face).toBe(true);
        const words = t.accessibilityLabel.split(/[\s,]+/);
        expect(words, t.accessibilityLabel).not.toContain('bap');
        if (t.zone !== 'vowel') for (const v of SOUND_VALUES) expect(words, t.accessibilityLabel).not.toContain(v);
        expect(t.accessibilityLabel).toMatch(t.text ? /^No final letter$/ : /^[ㄱ-ㅣ], letter [a-z]+(, as a final)?$/);
      }
      for (const z of zoneViews(state, copy, a11y)) {
        const words = z.accessibilityLabel.split(/[\s,]+/);
        expect(words, z.accessibilityLabel).not.toContain('bap');
        for (const v of SOUND_VALUES) expect(words, z.accessibilityLabel).not.toContain(v);
      }
      for (const noVoice of [false]) expect(promptView({ ko: '밥', romanization: 'bap', gloss: 'rice, a meal' }, state, noVoice, a11y).sound).toBe(state.revealed ? 'bap' : null);
    }
  });

  it('the prompt shows the romanization only after Show how it sounds, with no device voice, or once the block is right', () => {
    const target = { ko: '밥', romanization: 'bap', gloss: 'rice, a meal' };
    const fresh = startBuild(BAP);
    expect(promptView(target, fresh, false, a11y)).toEqual({ gloss: 'rice, a meal', sound: null, showLink: true, blockLabel: null });
    expect(promptView(target, fresh, true, a11y).sound).toBe('bap');
    expect(promptView(target, { ...fresh, revealed: true }, false, a11y)).toMatchObject({ sound: 'bap', showLink: false });
    const right = run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')]).state;
    expect(promptView(target, right, false, a11y)).toEqual({ gloss: 'rice, a meal', sound: 'bap', showLink: false, blockLabel: 'Block 밥, bap, built' });
    expect(promptView({ ko: '가', romanization: 'ga' }, startBuild(GA), false, a11y).gloss).toBeUndefined();
  });

  it('rows: captions in block order, No final last, the fixed row hidden, the looks of a pick, a mark and a ring', () => {
    const fresh = rowViews(rows, startBuild(BAP), BAP, copy, a11y);
    expect(fresh.map((r) => r.caption)).toEqual(['First letter', 'Vowel', 'Final']);
    expect(fresh[2]!.tiles.map((t) => t.face)).toEqual(['ㅂ', 'ㄴ', 'ㅇ', 'No final']);
    expect(fresh[2]!.tiles[0]!.accessibilityLabel).toBe('ㅂ, letter bieup, as a final');
    expect(fresh[0]!.tiles[1]!.accessibilityLabel).toBe('ㅂ, letter bieup');
    expect(rowViews(rows, startBuild(BAP, 'first'), BAP, copy, a11y).map((r) => r.zone)).toEqual(['vowel', 'final']);
    const ringed = run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ'), tile('vowel', 'ㅗ')]).state;
    const vowels = rowViews(rows, ringed, BAP, copy, a11y)[1]!.tiles;
    expect(vowels.map((t) => t.look)).toEqual(['ring', 'idle', 'marked', 'idle']);
    expect(rowViews(rows, run(BAP, [tile('first', 'ㅂ')]).state, BAP, copy, a11y)[0]!.tiles.map((t) => t.look)).toEqual(['idle', 'selected', 'idle', 'idle']);
  });

  it('zones: empty, filled (tap to empty), fixed, marked (listen again) and right', () => {
    const z = (s: BuildState) => zoneViews(s, copy, a11y);
    expect(z(startBuild(BAP)).map((v) => v.accessibilityLabel)).toEqual(['First letter, empty', 'Vowel, empty', 'Final, empty']);
    const filled = z(run(BAP, [tile('first', 'ㅂ'), tile('final', NO_FINAL)]).state);
    expect(filled[0]).toMatchObject({ face: 'ㅂ', look: 'filled', tappable: true, accessibilityLabel: 'First letter, ㅂ, letter bieup' });
    expect(filled[2]).toMatchObject({ face: 'No final', text: true, accessibilityLabel: 'Final, No final letter' });
    expect(z(startBuild(BAP, 'first'))[0]).toMatchObject({ look: 'fixed', tappable: false });
    const marked = z(run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅓ'), tile('final', 'ㅂ')]).state);
    expect(marked[1]).toMatchObject({ look: 'marked', tappable: true, accessibilityLabel: 'Vowel, ㅓ, letter eo, listen again' });
    expect(z(run(BAP, [tile('first', 'ㅂ'), tile('vowel', 'ㅏ'), tile('final', 'ㅂ')]).state).every((v) => v.look === 'right' && !v.tappable)).toBe(true);
  });
});
