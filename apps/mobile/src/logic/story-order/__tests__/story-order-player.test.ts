import { StoryOrderRoundSchema, romanize } from '@hangul-route/content-schema';
import { storyOrderIssues } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { STORY_ORDER_FIXTURES } from '../../../navigation/story-order-e2e-fixture';
import { HIGHLIGHT_SLOT_AFTER_WRONG } from '../../story/sequence-player';
import { playableStoryOrder } from '../fallback';
import {
  startStoryOrder,
  stepStoryOrder,
  storyOrderCards,
  storyOrderHinted,
  storyOrderItemId,
  storyOrderRoundKey,
  type StoryOrderAction,
  type StoryOrderEffect,
  type StoryOrderPlay,
  type StoryOrderState,
} from '../story-order-player';

/** F-CURR-002 §7.1 F5, row CM-34: the Story Order reducer over the shipped Story Sequence player. */

const play = (key: keyof typeof STORY_ORDER_FIXTURES, seed = 7): StoryOrderPlay => ({ rounds: playableStoryOrder(STORY_ORDER_FIXTURES[key]), seeds: [seed, seed + 1] });

function run(p: StoryOrderPlay, actions: StoryOrderAction[], from = startStoryOrder(p)): { state: StoryOrderState; effects: StoryOrderEffect[] } {
  let state = from;
  const effects: StoryOrderEffect[] = [];
  for (const action of actions) {
    const out = stepStoryOrder(p, state, action);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

const solution = (p: StoryOrderPlay, round = 0): string[] => p.rounds[round]!.panels.map((x) => x.id);
const tapAll = (ids: string[]): StoryOrderAction[] => ids.map((cardId) => ({ type: 'tap', cardId }));

describe('the fixtures', () => {
  it('every round parses with StoryOrderRoundSchema, and each scope passes the lint story-order-text', () => {
    for (const fixture of Object.values(STORY_ORDER_FIXTURES)) {
      const rounds = fixture.storyOrder?.rounds ?? [];
      for (const round of rounds) expect(StoryOrderRoundSchema.parse(round)).toEqual(round);
      expect(storyOrderIssues(rounds)).toBeUndefined();
    }
  });

  it('are romanized as rr.ts romanizes them (no punctuation in the romanization)', () => {
    for (const fixture of Object.values(STORY_ORDER_FIXTURES)) {
      for (const round of fixture.storyOrder?.rounds ?? []) {
        for (const panel of round.panels) expect(panel.caption.romanization, panel.caption.ko).toBe(romanize(panel.caption.ko).text);
      }
    }
  });
});

describe('storyOrderCards', () => {
  it('lists the panels in their right order, with a picture only on a round that draws them', () => {
    const [day, morning] = play('twoRounds').rounds;
    expect(storyOrderCards(day!).map((c) => [c.id, c.pictureRef ?? ''])).toEqual([
      ['sun', 'word:nature-sun'],
      ['bread', 'word:food-bread'],
      ['rain', 'word:nature-rain'],
      ['star', 'word:nature-star'],
    ]);
    expect(storyOrderCards(morning!).every((c) => c.pictureRef === undefined)).toBe(true);
    expect(storyOrderCards({ ...day!, captionsOnly: true }).every((c) => c.pictureRef === undefined)).toBe(true);
    expect(storyOrderCards(morning!)[0]?.line).toEqual({ ko: '먼저 일어나요.', romanization: 'meonjeo ireonayo', en: 'First, I get up.' });
  });
});

describe('startStoryOrder', () => {
  it('deranges the first round: never the right order, no card in its own place', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const p = play('captions', seed);
      const { seq } = startStoryOrder(p);
      expect(seq.solution).toEqual(solution(p));
      seq.order.forEach((id, i) => expect(id).not.toBe(seq.solution[i]));
    }
  });

  it('is done at once when no round can be played', () => {
    const p = play('empty');
    expect(p.rounds).toEqual([]);
    expect(startStoryOrder(p).phase).toBe('done');
  });
});

describe('stepStoryOrder', () => {
  it('a right tap places the card and scores its slot first try; each slot has its own key and item', () => {
    const p = play('captions');
    const ids = solution(p);
    const { state, effects } = run(p, tapAll(ids.slice(0, 2)));
    expect(state.seq.placed).toEqual(ids.slice(0, 2));
    expect(effects).toEqual([
      { type: 'answer', roundKey: storyOrderRoundKey('morning', 0), itemId: storyOrderItemId('morning', 'up'), correct: true, hinted: false },
      { type: 'placed', cardId: 'up' },
      { type: 'answer', roundKey: storyOrderRoundKey('morning', 1), itemId: storyOrderItemId('morning', 'wash'), correct: true, hinted: false },
      { type: 'placed', cardId: 'wash' },
    ]);
    expect(storyOrderRoundKey('morning', 1)).toBe('so:morning:1');
    expect(storyOrderItemId('morning', 'wash')).toBe('morning/wash');
  });

  it('a wrong tap moves nothing and answers the slot it was for (only the first answer of a key scores); the second rings the right card', () => {
    const p = play('captions');
    const ids = solution(p);
    const wrong = ids[2]!;
    const once = run(p, tapAll([wrong]));
    expect(once.state.seq.placed).toEqual([]);
    expect(once.effects).toEqual([
      { type: 'answer', roundKey: 'so:morning:0', itemId: 'morning/up', correct: false, hinted: false },
      { type: 'miss', cardId: wrong },
    ]);
    const twice = run(p, tapAll([wrong]), once.state);
    expect(HIGHLIGHT_SLOT_AFTER_WRONG).toBe(2);
    expect(twice.effects).toContainEqual({ type: 'highlight', cardId: 'up' });
  });

  it('Show meanings holds for the rest of the round: later answers are hinted and still score as usual', () => {
    const p = play('twoRounds');
    const [first, second] = [solution(p, 0), solution(p, 1)];
    const shown = run(p, [{ type: 'tap', cardId: first[0]! }, { type: 'showMeanings' }]);
    expect(shown.state.meanings).toBe(true);
    const rest = run(p, [...tapAll(first.slice(1)), { type: 'showMeanings' }], shown.state);
    const answers = rest.effects.filter((e) => e.type === 'answer');
    expect(answers.map((e) => [e.correct, e.hinted])).toEqual([
      [true, true],
      [true, true],
      [true, true],
    ]);
    expect(rest.state.seq.phase).toBe('replay');
    // Show meanings is for ordering only: in the replay it changes nothing.
    expect(stepStoryOrder(p, rest.state, { type: 'showMeanings' }).state).toBe(rest.state);
    // Done ends the replay and starts round 2 with the meanings held back again.
    const next = run(p, [{ type: 'finish' }], rest.state);
    expect(next.effects).toEqual([{ type: 'nextRound', roundIndex: 1 }]);
    expect(next.state).toMatchObject({ roundIndex: 1, meanings: false, phase: 'playing' });
    expect(next.state.seq.solution).toEqual(second);
    next.state.seq.order.forEach((id, i) => expect(id).not.toBe(second[i]));
    const firstAnswer = run(p, tapAll([second[0]!]), next.state).effects[0];
    expect(firstAnswer).toEqual({ type: 'answer', roundKey: 'so:morning:0', itemId: 'morning/up', correct: true, hinted: false });
  });

  it('the replay steps through the lines (Back, Next, Pause) and Skip replay or Done after the last round completes the step', () => {
    const p = play('captions');
    const placed = run(p, tapAll(solution(p)));
    expect(placed.state.seq.phase).toBe('replay');
    const moved = run(p, [{ type: 'replayNext' }, { type: 'replayNext' }, { type: 'replayBack' }, { type: 'togglePause' }], placed.state);
    expect(moved.state.seq).toMatchObject({ replayIndex: 1, paused: true });
    expect(moved.effects).toEqual([]);
    const skipped = run(p, [{ type: 'skipReplay' }], moved.state);
    expect(skipped.effects).toEqual([{ type: 'complete', skipped: false }]);
    expect(skipped.state.phase).toBe('done');
    expect(run(p, [{ type: 'finish' }], placed.state).effects).toEqual([{ type: 'complete', skipped: false }]);
  });

  it('Skip this one completes the step at once, recording no slot left', () => {
    const p = play('twoRounds');
    const out = run(p, [{ type: 'tap', cardId: solution(p)[0]! }, { type: 'skip' }]);
    expect(out.effects.at(-1)).toEqual({ type: 'complete', skipped: true });
    expect(out.state.phase).toBe('done');
    // Nothing moves once the step is done.
    expect(stepStoryOrder(p, out.state, { type: 'tap', cardId: solution(p)[1]! })).toEqual({ state: out.state, effects: [] });
    expect(stepStoryOrder(p, out.state, { type: 'skip' })).toEqual({ state: out.state, effects: [] });
  });

  it('the last slot (one card left) still scores but names no item, so the memory store hears nothing (§4.1)', () => {
    const p = play('captions');
    const ids = solution(p);
    const answers = run(p, tapAll(ids)).effects.filter((e) => e.type === 'answer');
    expect(answers).toHaveLength(ids.length);
    expect(answers.slice(0, -1).every((e) => e.itemId !== undefined)).toBe(true);
    expect(answers.at(-1)).toEqual({ type: 'answer', roundKey: storyOrderRoundKey('morning', ids.length - 1), correct: true, hinted: false });
  });

  it('an illustrated round its captions do not settle records every answer hinted (the pictures could order it)', () => {
    const day = STORY_ORDER_FIXTURES.twoRounds.storyOrder!.rounds[0]!;
    const unsettled = { ...day, id: 'pics', captionsSettleOrder: false };
    expect(storyOrderHinted(unsettled, false)).toBe(true);
    expect(storyOrderHinted(day, false)).toBe(false);
    const p: StoryOrderPlay = { rounds: [unsettled], seeds: [7] };
    const answers = run(p, tapAll(unsettled.panels.map((x) => x.id))).effects.filter((e) => e.type === 'answer');
    expect(answers.map((e) => e.hinted)).toEqual([true, true, true, true]);
  });

  it('a tap on a placed card, or outside the cards, does nothing', () => {
    const p = play('captions');
    const placed = run(p, tapAll([solution(p)[0]!]));
    expect(run(p, tapAll([solution(p)[0]!, 'nope']), placed.state).effects).toEqual([]);
  });
});
