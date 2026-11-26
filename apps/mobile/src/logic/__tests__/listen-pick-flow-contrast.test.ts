import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { describe, expect, it } from 'vitest';
import { LISTEN_PICK_TIMING, compareItems, contrastKindLine, startFlow, stepFlow, type FlowEvent } from '../listen-pick-flow';

/**
 * A contrast round in the Listen & Pick flow (AMENDMENTS-MINIMAL-PAIRS sections 3.6 to 3.8, row MP-2a): unscored, no
 * replay of the prompt on a miss, a compare row, a pair that ends after its miss and a triple that stays open, and a round
 * dropped when its clip did not play.
 */

const messages = getMessages('en');
const COPY = messages.learner.minigame;
const text = (ko: string, romanization: string, en = ko) => ({ ko, romanization, en });

describe('a contrast round in the flow', () => {
  const tap = (optionId: string, at: number, answerId = 'a'): FlowEvent => ({ type: 'tap', optionId, answerId, at });
  const pairTap = (optionId: string, at: number, answerId = 'ga'): FlowEvent => ({ type: 'tap', optionId, answerId, at, contrast: { optionCount: 2 } });
  const tripleTap = (optionId: string, at: number, answerId = 'dal'): FlowEvent => ({ type: 'tap', optionId, answerId, at, contrast: { optionCount: 3 } });

  it('a right tap emits its answer tagged scored: false, then the effects of any right answer, on the contrast wait', () => {
    const out = stepFlow(startFlow(3), pairTap('ga', 100));
    expect(out.state.status).toBe('resolved');
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: true, scored: false },
      { type: 'haptic', kind: 'success' },
      { type: 'cancel-replay' },
      { type: 'play', why: 'confirm' },
      { type: 'schedule-advance', ms: LISTEN_PICK_TIMING.contrastAdvanceMs },
    ]);
  });

  it('a round that is not a contrast round says nothing of scored', () => {
    const out = stepFlow(startFlow(3), tap('a', 100));
    expect(out.effects[0]).toEqual({ type: 'answer', roundKey: 0, correct: true });
    expect('scored' in out.effects[0]!).toBe(false);
  });

  it('a wrong tap on a pair: no replay of the prompt, a compare effect (the right one, then the tapped), and the round resolves, unscored', () => {
    const out = stepFlow(startFlow(3), pairTap('ka', 100));
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false, scored: false },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-replay' },
      { type: 'compare', rightId: 'ga', tappedId: 'ka' },
      { type: 'schedule-advance', ms: LISTEN_PICK_TIMING.contrastMissAdvanceMs },
    ]);
    expect(out.effects.some((e) => e.type === 'schedule-replay')).toBe(false);
    expect(out.state).toMatchObject({ status: 'resolved', wrongIds: ['ka'], compare: { rightId: 'ga', tappedId: 'ka' } });
  });

  it('a wrong tap on a triple keeps the round open, locks the option and compares; the second miss rings the right option', () => {
    const first = stepFlow(startFlow(2), tripleTap('tal', 100));
    expect(first.state).toMatchObject({ status: 'asking', wrongIds: ['tal'], hint: false, compare: { rightId: 'dal', tappedId: 'tal' } });
    expect(first.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false, scored: false },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-replay' },
      { type: 'compare', rightId: 'dal', tappedId: 'tal' },
    ]);
    const second = stepFlow(first.state, tripleTap('ttal', 100 + TAP_LOCK_MS));
    expect(second.state).toMatchObject({ status: 'asking', wrongIds: ['tal', 'ttal'], hint: true, compare: { rightId: 'dal', tappedId: 'ttal' } });
    const right = stepFlow(second.state, tripleTap('dal', 100 + 2 * TAP_LOCK_MS));
    expect(right.state.status).toBe('resolved');
    expect(right.effects[0]).toEqual({ type: 'answer', roundKey: 0, correct: true, scored: false });
  });

  it('the next round opens fresh, with no compare row', () => {
    const missed = stepFlow(startFlow(2), pairTap('ka', 100)).state;
    const next = stepFlow(missed, { type: 'advance' });
    expect(next.state).toEqual({ status: 'asking', roundIdx: 1, total: 2, wrongIds: [], hint: false, textPrompt: false, lastTapAt: null });
    expect('compare' in next.state).toBe(false);
    expect(next.effects).toEqual([{ type: 'play', why: 'autoplay' }]);
  });

  it('a prompt that did not play is a drop: nothing scored, the next round takes its slot and the count shrinks', () => {
    const out = stepFlow(startFlow(3), { type: 'drop', total: 2 });
    expect(out.state).toEqual({ status: 'asking', roundIdx: 0, total: 2, wrongIds: [], hint: false, textPrompt: false, lastTapAt: null });
    expect(out.effects).toEqual([{ type: 'cancel-replay' }, { type: 'play', why: 'autoplay' }]);
    expect(out.effects.some((e) => e.type === 'answer')).toBe(false);
  });

  it('dropping the last round completes the step, having scored nothing; dropping every round does the same', () => {
    const atLast = { ...startFlow(3), roundIdx: 2 };
    const last = stepFlow(atLast, { type: 'drop', total: 2 });
    expect(last.state.status).toBe('done');
    expect(last.effects).toEqual([{ type: 'cancel-replay' }, { type: 'complete' }]);
    const all = stepFlow(startFlow(1), { type: 'drop', total: 0 });
    expect(all.state.status).toBe('done');
    expect(all.effects).toEqual([{ type: 'cancel-replay' }, { type: 'complete' }]);
  });

  it('a round the learner has already tried, or has resolved, is never dropped from under them', () => {
    const tried = stepFlow(startFlow(3), tripleTap('tal', 100)).state;
    expect(stepFlow(tried, { type: 'drop', total: 2 })).toEqual({ state: tried, effects: [] });
    const resolved = stepFlow(startFlow(3), pairTap('ga', 100)).state;
    expect(stepFlow(resolved, { type: 'drop', total: 2 })).toEqual({ state: resolved, effects: [] });
  });

  it('advance carries the count the game holds after it dropped the later rounds that cannot play', () => {
    const resolved = stepFlow(startFlow(4), pairTap('ga', 100)).state;
    const next = stepFlow(resolved, { type: 'advance', total: 3 });
    expect(next.state).toMatchObject({ roundIdx: 1, total: 3 });
    const end = stepFlow(resolved, { type: 'advance', total: 1 });
    expect(end.state).toMatchObject({ status: 'done', total: 1 });
    expect(end.effects).toEqual([{ type: 'complete' }]);
  });

  it("total shrinks the count to the rounds the game holds (Can't hear it?), never under the open round", () => {
    const at = { ...startFlow(6), roundIdx: 2 };
    expect(stepFlow(at, { type: 'total', total: 3 }).state.total).toBe(3);
    expect(stepFlow(at, { type: 'total', total: 1 }).state.total).toBe(3);
    expect(stepFlow(at, { type: 'total', total: 3 }).effects).toEqual([]);
  });

  it('an empty flow ignores a drop and a total', () => {
    const empty = startFlow(0);
    expect(stepFlow(empty, { type: 'drop', total: 0 })).toEqual({ state: empty, effects: [] });
    expect(stepFlow(empty, { type: 'total', total: 2 })).toEqual({ state: empty, effects: [] });
  });
});

describe("a contrast round's lines (section 3.7)", () => {
  const copy = COPY.contrast;

  it('names the cue of each series: plain soft and lower, aspirated a puff and higher, tense tight', () => {
    expect(contrastKindLine(copy, { kind: 'plain', series: 'k' })).toBe('Soft, starts lower.');
    expect(contrastKindLine(copy, { kind: 'aspirated', series: 't' })).toBe('Big puff, starts higher.');
    expect(contrastKindLine(copy, { kind: 'tense', series: 'p' })).toBe('Tight, no puff.');
  });

  it('s and ss have their own lines, with no "starts lower" for s', () => {
    expect(contrastKindLine(copy, { kind: 'plain', series: 's' })).toBe('Soft, with a little breath.');
    expect(contrastKindLine(copy, { kind: 'tense', series: 's' })).toBe('A long, sharp hiss.');
    expect(copy.kind.plainS).not.toMatch(/lower/i);
    expect(contrastKindLine(copy, { kind: 'aspirated', series: 's' })).toBe(copy.kind.aspirated);
  });

  const round: ListenPickRound = {
    id: 'lp:pair:ga-ka',
    contrastSet: 'ga-ka',
    prompt: text('가', 'ga'),
    options: [
      { id: 'ga', text: text('가', 'ga', 'the syllable ga') },
      { id: 'ka', text: text('카', 'ka', 'the syllable ka') },
    ],
    answerId: 'ga',
  };
  const note = (option: { id: string }): { kind: 'plain' | 'aspirated'; series: string } | undefined =>
    option.id === 'ga' ? { kind: 'plain', series: 'k' } : option.id === 'ka' ? { kind: 'aspirated', series: 'k' } : undefined;

  it('the compare row is the right member, then the tapped one, each with its line and a name by romanization', () => {
    const state = { ...startFlow(2), compare: { rightId: 'ga', tappedId: 'ka' } };
    expect(compareItems(round, state, copy, messages.a11y, note)).toEqual([
      { id: 'ga', ko: '가', romanization: 'ga', kindLine: 'Soft, starts lower.', label: 'ga, Soft, starts lower.' },
      { id: 'ka', ko: '카', romanization: 'ka', kindLine: 'Big puff, starts higher.', label: 'ka, Big puff, starts higher.' },
    ]);
  });

  it('is empty without a miss, and leaves out an option it cannot place', () => {
    expect(compareItems(round, startFlow(2), copy, messages.a11y, note)).toEqual([]);
    const state = { ...startFlow(2), compare: { rightId: 'ga', tappedId: 'zz' } };
    expect(compareItems(round, state, copy, messages.a11y, note).map((i) => i.id)).toEqual(['ga']);
    expect(compareItems(round, { ...startFlow(2), compare: { rightId: 'ga', tappedId: 'ka' } }, copy, messages.a11y, () => undefined)).toEqual([]);
  });
});
