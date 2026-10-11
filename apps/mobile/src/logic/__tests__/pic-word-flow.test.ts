import type { PicWordRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  PIC_WORD_COPY,
  PIC_WORD_TIMING,
  announcement,
  boardCount,
  canSkip,
  headerView,
  hintTarget,
  pairRoundKey,
  pictureSide,
  pictureTileView,
  shuffleBoard,
  startFlow,
  stepFlow,
  validBoards,
  wordTileView,
  type FlowEffect,
  type FlowEvent,
  type PicWordFlowState,
} from '../pic-word-flow';

const ko = (word: string, romanization: string, en: string) => ({ ko: word, romanization, en });

const board: PicWordRound = {
  pairs: [
    { id: 'bap', pictureRef: 'card:rice', word: ko('밥', 'bap', 'rice') },
    { id: 'hanbok', pictureRef: 'card:hanbok', word: ko('한복', 'hanbok', 'hanbok') },
    { id: 'san', pictureRef: 'card:mountain', word: ko('산', 'san', 'mountain') },
    { id: 'yeon', word: ko('연', 'yeon', 'kite') },
  ],
};

/** Run events in order, collecting every effect list. */
function run(start: PicWordFlowState, events: FlowEvent[]): { state: PicWordFlowState; effects: FlowEffect[][] } {
  let state = start;
  const effects: FlowEffect[][] = [];
  for (const event of events) {
    const out = stepFlow(state, event);
    state = out.state;
    effects.push(out.effects);
  }
  return { state, effects };
}

const pic = (pairId: string): FlowEvent => ({ type: 'select', side: 'picture', pairId });
const word = (pairId: string): FlowEvent => ({ type: 'select', side: 'word', pairId });

const fresh = () => startFlow([4, 4]);

/** Match every pair of the current board, picture first. */
const matchAll = (ids: string[]): FlowEvent[] => ids.flatMap((id) => [pic(id), word(id)]);

describe('pairRoundKey (F-QUEST-002 §3.11)', () => {
  it('is b<board>:<pairId>, so a miss and the later match share one key', () => {
    expect(pairRoundKey(0, 'bap')).toBe('b0:bap');
    expect(pairRoundKey(2, 'san')).toBe('b2:san');
  });
});

describe('startFlow', () => {
  it('opens board 1 with nothing selected, matched or answered', () => {
    expect(fresh()).toEqual({
      status: 'playing',
      boardIdx: 0,
      pairCounts: [4, 4],
      selected: null,
      matched: [],
      missCounts: {},
      flash: null,
      answered: false,
    });
  });

  it('is empty without a board', () => {
    expect(startFlow([]).status).toBe('empty');
  });

  it('ignores every event when empty', () => {
    const empty = startFlow([]);
    for (const event of [pic('bap'), { type: 'advance' } as const, { type: 'skip' } as const, { type: 'clear-flash' } as const]) {
      expect(stepFlow(empty, event)).toEqual({ state: empty, effects: [] });
    }
  });
});

describe('tap-tap pairing, either order', () => {
  it('selects on the first tap without scoring anything', () => {
    const out = stepFlow(fresh(), pic('bap'));
    expect(out.state.selected).toEqual({ side: 'picture', pairId: 'bap' });
    expect(out.effects).toEqual([]);
    expect(out.state.answered).toBe(false);
  });

  it('matches picture then word: locks both, scores correct, speaks the word', () => {
    const { state, effects } = run(fresh(), [pic('bap'), word('bap')]);
    expect(state.matched).toEqual(['bap']);
    expect(state.selected).toBeNull();
    expect(state.answered).toBe(true);
    expect(effects[1]).toEqual([
      { type: 'answer', roundKey: 'b0:bap', correct: true, pairId: 'bap' },
      { type: 'haptic', kind: 'success' },
      { type: 'play', pairId: 'bap' },
    ]);
  });

  it('matches word then picture the same way', () => {
    const { state, effects } = run(fresh(), [word('san'), pic('san')]);
    expect(state.matched).toEqual(['san']);
    expect(effects[1]).toContainEqual({ type: 'answer', roundKey: 'b0:san', correct: true, pairId: 'san' });
  });

  it('clears the selection when the selected tile is tapped again', () => {
    const { state, effects } = run(fresh(), [pic('bap'), pic('bap')]);
    expect(state.selected).toBeNull();
    expect(effects[1]).toEqual([]);
  });

  it('moves the selection when another tile of the same side is tapped', () => {
    const { state } = run(fresh(), [pic('bap'), pic('san')]);
    expect(state.selected).toEqual({ side: 'picture', pairId: 'san' });
    expect(state.answered).toBe(false);
  });

  it('numbers the pairs in the order they were matched', () => {
    const { state } = run(fresh(), matchAll(['san', 'bap']));
    expect(state.matched).toEqual(['san', 'bap']);
  });

  it('ignores a tap on a tile that is already matched', () => {
    const matched = run(fresh(), [pic('bap'), word('bap')]).state;
    expect(stepFlow(matched, pic('bap'))).toEqual({ state: matched, effects: [] });
    expect(stepFlow(matched, word('bap'))).toEqual({ state: matched, effects: [] });
  });
});

describe('a wrong pair', () => {
  it('scores the first-selected tile pair as missed, ambers the tapped word, keeps the picture selected', () => {
    const out = stepFlow(run(fresh(), [pic('bap')]).state, word('san'));
    expect(out.state.selected).toEqual({ side: 'picture', pairId: 'bap' });
    expect(out.state.flash).toEqual({ side: 'word', pairId: 'san' });
    expect(out.state.missCounts).toEqual({ bap: 1 });
    expect(out.state.matched).toEqual([]);
    expect(out.state.status).toBe('playing');
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 'b0:bap', correct: false, pairId: 'bap' },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-clear' },
      { type: 'schedule-clear', ms: PIC_WORD_TIMING.missClearMs },
    ]);
    expect(PIC_WORD_TIMING.missClearMs).toBe(600);
  });

  it('keys the miss by the FIRST-selected tile: word first, picture second', () => {
    const out = stepFlow(run(fresh(), [word('bap')]).state, pic('san'));
    expect(out.effects[0]).toEqual({ type: 'answer', roundKey: 'b0:bap', correct: false, pairId: 'bap' });
    expect(out.state.flash).toEqual({ side: 'picture', pairId: 'san' });
    expect(out.state.selected).toEqual({ side: 'word', pairId: 'bap' });
  });

  it('does not score the pair the wrong tile belongs to', () => {
    const { effects } = run(fresh(), [pic('bap'), word('san'), word('bap')]);
    const answers = effects.flat().filter((e) => e.type === 'answer');
    expect(answers).toEqual([
      { type: 'answer', roundKey: 'b0:bap', correct: false, pairId: 'bap' },
      { type: 'answer', roundKey: 'b0:bap', correct: true, pairId: 'bap' },
    ]);
  });

  it('clears the amber flash when the timer fires', () => {
    const missed = run(fresh(), [pic('bap'), word('san')]).state;
    const out = stepFlow(missed, { type: 'clear-flash' });
    expect(out.state.flash).toBeNull();
    expect(out.state.selected).toEqual({ side: 'picture', pairId: 'bap' });
    expect(out.effects).toEqual([]);
  });

  it('ignores a flash timer that fires with nothing flashing', () => {
    expect(stepFlow(fresh(), { type: 'clear-flash' })).toEqual({ state: fresh(), effects: [] });
  });

  it('drops a pending flash (and its timer) when the learner matches', () => {
    const missed = run(fresh(), [pic('bap'), word('san')]).state;
    const out = stepFlow(missed, word('bap'));
    expect(out.state.flash).toBeNull();
    expect(out.effects).toContainEqual({ type: 'cancel-clear' });
  });

  it('drops a pending flash when the selection changes', () => {
    const missed = run(fresh(), [pic('bap'), word('san')]).state;
    const out = stepFlow(missed, pic('hanbok'));
    expect(out.state.flash).toBeNull();
    expect(out.effects).toEqual([{ type: 'cancel-clear' }]);
  });

  it('counts misses per scored pair and shows the hint ring after the second one', () => {
    const afterOne = run(fresh(), [pic('bap'), word('san')]).state;
    expect(hintTarget(afterOne)).toBeNull();
    const afterTwo = run(afterOne, [word('hanbok')]).state;
    expect(afterTwo.missCounts).toEqual({ bap: 2 });
    expect(hintTarget(afterTwo)).toEqual({ side: 'word', pairId: 'bap' });
  });

  it('rings the picture when the scored tile was a word', () => {
    const state = run(fresh(), [word('bap'), pic('san'), pic('hanbok')]).state;
    expect(hintTarget(state)).toEqual({ side: 'picture', pairId: 'bap' });
  });

  it('keeps the pair open until it is matched', () => {
    const state = run(fresh(), [pic('bap'), word('san'), word('hanbok'), word('yeon')]).state;
    expect(state.matched).toEqual([]);
    expect(state.status).toBe('playing');
  });

  it('shows no ring when nothing is selected or the selected pair has fewer than two misses', () => {
    expect(hintTarget(fresh())).toBeNull();
    const missedTwice = run(fresh(), [pic('bap'), word('san'), word('hanbok')]).state;
    const cleared = stepFlow(missedTwice, pic('bap')).state;
    expect(hintTarget(cleared)).toBeNull();
    const other = stepFlow(missedTwice, pic('san')).state;
    expect(hintTarget(other)).toBeNull();
  });
});

describe('finishing a board', () => {
  const ids = ['bap', 'hanbok', 'san', 'yeon'];

  it('resolves when the last pair matches and advances after 700 ms', () => {
    const { state, effects } = run(fresh(), matchAll(ids));
    expect(state.status).toBe('resolved');
    expect(effects[effects.length - 1]).toEqual([
      { type: 'answer', roundKey: 'b0:yeon', correct: true, pairId: 'yeon' },
      { type: 'haptic', kind: 'success' },
      { type: 'play', pairId: 'yeon' },
      { type: 'schedule-advance', ms: PIC_WORD_TIMING.advanceDelayMs },
    ]);
    expect(PIC_WORD_TIMING.advanceDelayMs).toBe(700);
  });

  it('opens the next board clean, keeping the run-wide answered flag', () => {
    const resolved = run(fresh(), matchAll(ids)).state;
    const out = stepFlow(resolved, { type: 'advance' });
    expect(out.state).toEqual({ ...fresh(), boardIdx: 1, answered: true });
    expect(out.effects).toEqual([]);
  });

  it('keys the second board b1:<pairId>', () => {
    const second = run(fresh(), [...matchAll(ids), { type: 'advance' }]).state;
    const out = stepFlow(run(second, [pic('bap')]).state, word('bap'));
    expect(out.effects[0]).toEqual({ type: 'answer', roundKey: 'b1:bap', correct: true, pairId: 'bap' });
  });

  it('completes after the last board', () => {
    const single = startFlow([4]);
    const resolved = run(single, matchAll(ids)).state;
    const out = stepFlow(resolved, { type: 'advance' });
    expect(out.state.status).toBe('done');
    expect(out.effects).toEqual([{ type: 'complete' }]);
  });

  it('ignores advance unless the board is resolved', () => {
    expect(stepFlow(fresh(), { type: 'advance' })).toEqual({ state: fresh(), effects: [] });
  });

  it('ignores taps while resolved and after done', () => {
    const resolved = run(startFlow([4]), matchAll(ids)).state;
    expect(stepFlow(resolved, pic('bap'))).toEqual({ state: resolved, effects: [] });
    const done = stepFlow(resolved, { type: 'advance' }).state;
    expect(stepFlow(done, pic('bap'))).toEqual({ state: done, effects: [] });
    expect(stepFlow(done, { type: 'skip' })).toEqual({ state: done, effects: [] });
  });
});

describe('skip', () => {
  it('is not available before the first answer', () => {
    expect(canSkip(fresh())).toBe(false);
    expect(stepFlow(fresh(), { type: 'skip' })).toEqual({ state: fresh(), effects: [] });
    expect(canSkip(run(fresh(), [pic('bap')]).state)).toBe(false);
  });

  it('is available after the first answer, right or wrong', () => {
    expect(canSkip(run(fresh(), [pic('bap'), word('san')]).state)).toBe(true);
    expect(canSkip(run(fresh(), [pic('bap'), word('bap')]).state)).toBe(true);
  });

  it('completes without marking the unmatched pairs', () => {
    const answered = run(fresh(), [pic('bap'), word('bap')]).state;
    const out = stepFlow(answered, { type: 'skip' });
    expect(out.state.status).toBe('done');
    expect(out.state.matched).toEqual(['bap']);
    expect(out.effects).toEqual([{ type: 'cancel-clear' }, { type: 'complete' }]);
    expect(canSkip(out.state)).toBe(false);
  });

  it('is hidden once the board has resolved (the advance is already coming)', () => {
    const resolved = run(startFlow([4]), matchAll(['bap', 'hanbok', 'san', 'yeon'])).state;
    expect(canSkip(resolved)).toBe(false);
    expect(stepFlow(resolved, { type: 'skip' })).toEqual({ state: resolved, effects: [] });
  });
});

describe('headerView', () => {
  it('counts matched pairs over every board', () => {
    expect(headerView(fresh())).toEqual({ value: 0, max: 8, label: '0 / 8' });
    const mid = run(fresh(), matchAll(['bap', 'san'])).state;
    expect(headerView(mid)).toEqual({ value: 2, max: 8, label: '2 / 8' });
  });

  it('carries the pairs of finished boards into the second board', () => {
    const second = run(fresh(), [...matchAll(['bap', 'hanbok', 'san', 'yeon']), { type: 'advance' }, pic('bap'), word('bap')]).state;
    expect(headerView(second)).toEqual({ value: 5, max: 8, label: '5 / 8' });
  });

  it('never exceeds the total', () => {
    const done = run(startFlow([4]), [...matchAll(['bap', 'hanbok', 'san', 'yeon']), { type: 'advance' }]).state;
    expect(headerView(done).value).toBe(4);
  });
});

describe('tile views', () => {
  const [bap, hanbok, san, yeon] = board.pairs as [
    PicWordRound['pairs'][number],
    PicWordRound['pairs'][number],
    PicWordRound['pairs'][number],
    PicWordRound['pairs'][number],
  ];
  const always = { romanizationMode: 'always' as const };

  it('hides the gloss on a word until its pair is matched', () => {
    const before = wordTileView(bap, fresh(), always);
    expect(before.gloss).toBeUndefined();
    expect(before.ko).toBe('밥');
    expect(before.romanization).toBe('bap');
    expect(before.cardState).toBe('idle');
    expect(before.badge).toBeUndefined();
    expect(before.accessibilityLabel).toBe('밥, bap');

    const matched = run(fresh(), [pic('bap'), word('bap')]).state;
    const after = wordTileView(bap, matched, always);
    expect(after.gloss).toBe('rice');
    expect(after.cardState).toBe('correct');
    expect(after.badge).toBe(1);
    expect(after.accessibilityLabel).toBe('Matched, number 1: 밥, bap, rice');
  });

  it('gives both tiles of a pair the same badge', () => {
    const state = run(fresh(), matchAll(['san', 'bap'])).state;
    expect(pictureTileView(bap, state).badge).toBe(2);
    expect(wordTileView(bap, state, always).badge).toBe(2);
    expect(pictureTileView(san, state).badge).toBe(1);
  });

  it('marks the selected tile and says so in its name', () => {
    const state = run(fresh(), [pic('bap')]).state;
    const tile = pictureTileView(bap, state);
    expect(tile.selected).toBe(true);
    expect(tile.cardState).toBe('idle');
    expect(tile.accessibilityLabel).toBe('Selected: rice');
    expect(pictureTileView(hanbok, state).selected).toBe(false);
    expect(wordTileView(bap, state, always).selected).toBe(false);
  });

  it('turns the flashing tile amber (wrong) in an accessible, non-red way', () => {
    const state = run(fresh(), [pic('bap'), word('san')]).state;
    const tile = wordTileView(san, state, always);
    expect(tile.cardState).toBe('wrong');
    expect(tile.accessibilityLabel).toBe(`${PIC_WORD_COPY.a11y.wrong}: 산, san`);
    expect(wordTileView(hanbok, state, always).cardState).toBe('idle');
    expect(pictureTileView(bap, state).cardState).toBe('idle');
  });

  it('flashes a picture when the learner picked the word first', () => {
    const state = run(fresh(), [word('bap'), pic('san')]).state;
    expect(pictureTileView(san, state).cardState).toBe('wrong');
  });

  it('rings the partner of the scored tile after two misses', () => {
    const state = run(fresh(), [pic('bap'), word('san'), word('hanbok'), { type: 'clear-flash' }]).state;
    const tile = wordTileView(bap, state, always);
    expect(tile.cardState).toBe('hint');
    expect(tile.accessibilityLabel).toBe(`${PIC_WORD_COPY.a11y.hint}: 밥, bap`);
    expect(wordTileView(yeon, state, always).cardState).toBe('idle');
  });

  it('rings the picture partner when the scored tile was a word', () => {
    const state = run(fresh(), [word('bap'), pic('san'), pic('hanbok'), { type: 'clear-flash' }]).state;
    expect(pictureTileView(bap, state).cardState).toBe('hint');
  });

  it('keeps a matched tile correct even when a hint would apply', () => {
    const state = run(fresh(), [pic('bap'), word('san'), word('hanbok'), word('bap')]).state;
    expect(wordTileView(bap, state, always).cardState).toBe('correct');
    expect(pictureTileView(bap, state).cardState).toBe('correct');
  });

  it('describes a picture by its English gloss, never blank', () => {
    expect(pictureTileView(bap, fresh())).toMatchObject({ pictureRef: 'card:rice', gloss: 'rice' });
    expect(pictureTileView(yeon, fresh())).toMatchObject({ pictureRef: undefined, gloss: 'kite' });
    const matched = run(fresh(), [pic('bap'), word('bap')]).state;
    expect(pictureTileView(bap, matched).accessibilityLabel).toBe('Matched, number 1: rice');
  });

  it('hides the romanization until tapped only when the learner opted in', () => {
    const tap = { romanizationMode: 'tap' as const };
    const idle = wordTileView(bap, fresh(), tap);
    expect(idle.romanization).toBe('');
    expect(idle.accessibilityLabel).toBe('밥');

    const selected = run(fresh(), [word('bap')]).state;
    expect(wordTileView(bap, selected, tap).romanization).toBe('bap');

    const flashing = run(fresh(), [pic('bap'), word('san')]).state;
    expect(wordTileView(san, flashing, tap).romanization).toBe('san');

    const matched = run(fresh(), [pic('bap'), word('bap')]).state;
    expect(wordTileView(bap, matched, tap).romanization).toBe('bap');
  });
});

describe('announcement', () => {
  it('invites the first tap when nothing is selected', () => {
    expect(announcement(fresh(), board)).toBe(PIC_WORD_COPY.instruction);
  });

  it('announces a selected picture and asks for a word', () => {
    expect(announcement(run(fresh(), [pic('bap')]).state, board)).toBe('Picture selected: rice. Choose a word.');
  });

  it('announces a selected word and asks for a picture', () => {
    expect(announcement(run(fresh(), [word('bap')]).state, board)).toBe('Word selected: 밥. Choose a picture.');
  });

  it('falls back to the instruction for a selection that is not on the board', () => {
    const state: PicWordFlowState = { ...fresh(), selected: { side: 'word', pairId: 'ghost' } };
    expect(announcement(state, board)).toBe(PIC_WORD_COPY.instruction);
  });
});

describe('validBoards and boardCount', () => {
  const scopeOf = (boards: PicWordRound[] | undefined) => ({ picWord: boards ? { boards } : undefined });

  it('keeps boards with at least three playable pairs', () => {
    expect(validBoards(scopeOf([board]))).toEqual([board]);
    expect(boardCount(scopeOf([board, board]))).toBe(2);
  });

  it('drops a board with fewer than three valid pairs', () => {
    const thin: PicWordRound = { pairs: board.pairs.slice(0, 2) };
    expect(validBoards(scopeOf([thin, board]))).toEqual([board]);
    expect(boardCount(scopeOf([thin]))).toBe(0);
  });

  it('is empty for a scope without boards', () => {
    expect(validBoards(scopeOf(undefined))).toEqual([]);
    expect(validBoards({})).toEqual([]);
    expect(boardCount({})).toBe(0);
  });

  it('skips pairs without a Korean word or an id, and repeated ids or words', () => {
    const messy = {
      pairs: [
        { id: 'bap', word: ko('밥', 'bap', 'rice') },
        { id: '', word: ko('물', 'mul', 'water') },
        { id: 'bap', word: ko('밤', 'bam', 'night') },
        { id: 'mul', word: ko('밥', 'bap', 'rice again') },
        { id: 'san', word: ko('산', 'san', 'mountain') },
        { id: 'yeon', word: ko('연', 'yeon', 'kite') },
        { id: 'gim', word: ko(' ', 'gim', 'blank') },
      ],
    } as unknown as PicWordRound;
    const out = validBoards(scopeOf([messy]));
    expect(out).toHaveLength(1);
    expect(out[0]?.pairs.map((p) => p.id)).toEqual(['bap', 'san', 'yeon']);
  });

  it('caps a board at five pairs', () => {
    const big = {
      pairs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, word: ko(id, id, id) })),
    } as unknown as PicWordRound;
    expect(validBoards(scopeOf([big]))[0]?.pairs).toHaveLength(5);
  });

  it('drops a board whose pairs reduce below three after cleaning', () => {
    const dup = {
      pairs: [
        { id: 'bap', word: ko('밥', 'bap', 'rice') },
        { id: 'bap', word: ko('밤', 'bam', 'night') },
        { id: 'san', word: ko('산', 'san', 'mountain') },
      ],
    } as unknown as PicWordRound;
    expect(validBoards(scopeOf([dup]))).toEqual([]);
  });
});

describe('shuffleBoard', () => {
  const ids = board.pairs.map((p) => p.id).sort();

  it('is deterministic for a seed and keeps every pair in both columns', () => {
    const a = shuffleBoard(board, 7);
    expect(shuffleBoard(board, 7)).toEqual(a);
    expect([...a.pictureOrder].sort()).toEqual(ids);
    expect([...a.wordOrder].sort()).toEqual(ids);
  });

  it('never lines a word up across from its own picture', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const size of [3, 4, 5]) {
        const sub: PicWordRound = { pairs: board.pairs.concat([{ id: 'x', word: ko('x', 'x', 'x') }]).slice(0, size) };
        const { pictureOrder, wordOrder } = shuffleBoard(sub, seed);
        expect(pictureOrder.some((id, i) => wordOrder[i] === id)).toBe(false);
      }
    }
  });

  it('does not always put the pictures in the content order', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 50; seed++) orders.add(shuffleBoard(board, seed).pictureOrder.join());
    expect(orders.size).toBeGreaterThan(1);
  });

  it('does not change its input', () => {
    const copy = JSON.parse(JSON.stringify(board)) as PicWordRound;
    shuffleBoard(board, 3);
    expect(board).toEqual(copy);
  });

  it('handles a single pair without looping', () => {
    const one: PicWordRound = { pairs: [board.pairs[0]!] };
    expect(shuffleBoard(one, 1)).toEqual({ pictureOrder: ['bap'], wordOrder: ['bap'] });
  });
});

describe('pictureSide', () => {
  it('uses the hero step on a roomy portrait phone', () => {
    expect(pictureSide(390, 844)).toBe('hero');
  });

  it('shrinks to the minimum step on a narrow phone', () => {
    expect(pictureSide(320, 568)).toBe('min');
  });

  it('shrinks in landscape', () => {
    expect(pictureSide(844, 390)).toBe('min');
  });
});
