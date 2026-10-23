import { isRolePlayEnd, rolePlayTurnCount, type RolePlayScene } from '@hangul-route/content-schema';
import { isSoundRolePlayScene, rolePlayPaths } from '@hangul-route/content-schema/lint';
import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { firstNatural, lookHereOf, startRolePlay, stepRolePlay, turnOf, type RpEffect, type RpEvent, type RpState } from '../reducer';

const scene = LIBRARY_SCENE;

function play(events: RpEvent[], from = startRolePlay(scene)): { state: RpState; effects: RpEffect[] } {
  let { state } = from;
  const effects: RpEffect[] = [...from.effects];
  for (const e of events) {
    const step = stepRolePlay(scene, state, e);
    state = step.state;
    effects.push(...step.effects);
  }
  return { state, effects };
}
const tap = (reply: string): RpEvent => ({ type: 'tap', reply });
const SENT: RpEvent = { type: 'sent' };
const answers = (effects: RpEffect[]) => effects.filter((e) => e.type === 'answer');

describe('Role Play branch reducer (row CM-35)', () => {
  it('opens on the start line, in the log and said once', () => {
    const { state, effects } = startRolePlay(scene);
    expect(state).toMatchObject({ node: 't1', turn: 0, log: [{ who: 'partner', node: 't1' }], locked: [], why: null, sending: null, done: false });
    expect(effects).toEqual([{ type: 'sayLine', node: 't1' }]);
  });

  it('a natural reply is sent and said; once said, the partner answers along its branch', () => {
    const sent = play([tap('hello')]);
    expect(sent.state).toMatchObject({ node: 't1', sending: 'hello', log: [{ who: 'partner', node: 't1' }, { who: 'me', node: 't1', reply: 'hello' }] });
    expect(sent.effects.slice(1)).toEqual([
      { type: 'answer', node: 't1', reply: 'hello', correct: true, hinted: false },
      { type: 'success', reply: 'hello' },
      { type: 'sayReply', node: 't1', reply: 'hello' },
    ]);
    // Taps wait while the reply is said.
    expect(stepRolePlay(scene, sent.state, tap('meal')).state).toBe(sent.state);
    const next = play([tap('hello'), SENT]);
    expect(next.state).toMatchObject({ node: 't2', turn: 1, sending: null, scored: false });
    expect(next.effects.at(-1)).toEqual({ type: 'sayLine', node: 't2' });
  });

  it('two natural replies lead to their own branches', () => {
    expect(play([tap('hello'), SENT, tap('storybook'), SENT]).state.node).toBe('t3a');
    expect(play([tap('hello'), SENT, tap('hangeul'), SENT]).state.node).toBe('t3b');
  });

  it('a less natural reply is never sent: it locks, Hoya says why, the partner does not react; the first tap scores', () => {
    const missed = play([tap('meal')]);
    expect(missed.state).toMatchObject({ node: 't1', locked: ['meal'], why: 'meal', sending: null, scored: true, log: [{ who: 'partner', node: 't1' }] });
    // The miss is about the turn's first natural reply (the exchange it teaches).
    expect(answers(missed.effects)).toEqual([{ type: 'answer', node: 't1', reply: 'hello', correct: false, hinted: false }]);
    expect(missed.effects.at(-1)).toEqual({ type: 'nudge', reply: 'meal' });
    // A locked reply does nothing; the retry is not scored again.
    expect(stepRolePlay(scene, missed.state, tap('meal')).state).toBe(missed.state);
    const retry = play([tap('meal'), tap('hello')]);
    expect(answers(retry.effects)).toHaveLength(1);
    expect(retry.state).toMatchObject({ sending: 'hello', why: null });
  });

  it('rings the first natural reply from the second less natural tap in a turn', () => {
    const wide: RolePlayScene = structuredClone(scene);
    const t1 = turnOf(wide, { node: 't1' })!;
    t1.replies.push({ id: 'sorry', text: { ko: '미안합니다.', romanization: 'mianhamnida', en: 'I am sorry.' }, kind: 'lessNatural', whyEn: 'Try a greeting.' });
    let state = startRolePlay(wide).state;
    state = stepRolePlay(wide, state, tap('meal')).state;
    expect(lookHereOf(wide, state)).toBeNull();
    state = stepRolePlay(wide, state, tap('sorry')).state;
    expect(lookHereOf(wide, state)).toBe('hello');
    state = stepRolePlay(wide, state, tap('hello')).state;
    expect(lookHereOf(wide, state)).toBeNull();
    expect(lookHereOf(wide, { ...state, node: 'end' })).toBeNull();
  });

  it('Show meanings once a turn; a turn scored with them showing is hinted, and the next turn hides them again', () => {
    const shown = play([{ type: 'showMeanings' }]);
    expect(shown.state.meanings).toBe(true);
    expect(stepRolePlay(scene, shown.state, { type: 'showMeanings' }).state).toBe(shown.state);
    const hinted = play([{ type: 'showMeanings' }, tap('hello')]);
    expect(answers(hinted.effects)).toEqual([{ type: 'answer', node: 't1', reply: 'hello', correct: true, hinted: true }]);
    expect(play([{ type: 'showMeanings' }, tap('hello'), SENT]).state.meanings).toBe(false);
  });

  it('every way ends with the closing line: the end effect, done, and nothing more happens', () => {
    const end = play([tap('hello'), SENT, tap('hangeul'), SENT, tap('thanks'), SENT, tap('go'), tap('stay'), SENT]);
    expect(end.state).toMatchObject({ node: 'end', done: true, turn: 4 });
    expect(end.effects.at(-1)).toEqual({ type: 'end', node: 'end' });
    expect(answers(end.effects).map((a) => a.type === 'answer' && [a.node, a.reply, a.correct])).toEqual([
      ['t1', 'hello', true],
      ['t2', 'hangeul', true],
      ['t3b', 'thanks', true],
      ['t4', 'stay', false],
    ]);
    for (const e of [tap('stay'), SENT, { type: 'showMeanings' } as const]) expect(stepRolePlay(scene, end.state, e).state).toBe(end.state);
  });

  it('ignores a tap on a reply the turn does not hold, and a sent with nothing sending', () => {
    const { state } = startRolePlay(scene);
    expect(stepRolePlay(scene, state, tap('nope')).state).toBe(state);
    expect(stepRolePlay(scene, state, SENT).state).toBe(state);
    expect(stepRolePlay(scene, { ...state, node: 'gone' }, tap('hello')).state).toMatchObject({ node: 'gone' });
    expect(firstNatural(turnOf(scene, state)!)?.id).toBe('hello');
  });
});

/**
 * Property (section 7.7, "no bad ending in a Role Play branch"): whatever the learner taps, in any order, any scene
 * the schema accepts ends at a closing line, after exactly its turn count, with one scored answer per turn.
 */
const sceneArb = fc
  .record({ turns: fc.integer({ min: 4, max: 6 }), split: fc.integer({ min: 0, max: 5 }), merge: fc.boolean() })
  .map(({ turns, split, merge }): RolePlayScene => {
    const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
    const nudge = { id: 'x', text: kt('아니요.', 'aniyo', 'No.'), kind: 'lessNatural' as const, whyEn: 'Try another.' };
    const at = Math.min(split, turns - 2);
    const nodes: RolePlayScene['nodes'] = [];
    for (let i = 0; i < turns; i += 1) {
      const next = i === turns - 1 ? 'end' : `t${i + 1}`;
      const replies =
        i === at
          ? [
              { id: 'a', text: kt('네.', 'ne', 'Yes.'), kind: 'natural' as const, next },
              { id: 'b', text: kt('좋아요.', 'joayo', 'Good.'), kind: 'natural' as const, next: merge ? next : `b${i + 1}` },
              nudge,
            ]
          : [{ id: 'a', text: kt('네.', 'ne', 'Yes.'), kind: 'natural' as const, next }, nudge];
      nodes.push({ id: `t${i}`, line: kt('뭐예요?', 'mwoyeyo', 'What is it?'), replies });
      if (!merge && i > at) nodes.push({ id: `b${i}`, line: kt('뭐예요?', 'mwoyeyo', 'What is it?'), replies: [{ ...replies[0]!, next: i === turns - 1 ? 'end' : `b${i + 1}` }, nudge] });
    }
    nodes.push({ id: 'end', end: true, closingEn: 'Well done!' });
    return { title: kt('도서관', 'doseogwan', 'At the library'), partner: kt('사서', 'saseo', 'librarian'), start: 't0', nodes };
  });

describe('any taps reach a good ending (property)', () => {
  it('random taps through any accepted scene: ends at a closing line after its turn count, one score a turn', () => {
    fc.assert(
      fc.property(fc.oneof(fc.constant(LIBRARY_SCENE), sceneArb), fc.array(fc.nat(), { minLength: 80, maxLength: 80 }), (s, picks) => {
        expect(isSoundRolePlayScene(s)).toBe(true);
        let { state } = startRolePlay(s);
        let scored = 0;
        for (const p of picks) {
          if (state.done) break;
          if (state.sending !== null) {
            state = stepRolePlay(s, state, { type: 'sent' }).state;
            continue;
          }
          const turn = turnOf(s, state)!;
          const open = turn.replies.filter((r) => !state.locked.includes(r.id));
          const step = stepRolePlay(s, state, tap(open[p % open.length]!.id));
          scored += step.effects.filter((e) => e.type === 'answer').length;
          state = step.state;
        }
        expect(state.done).toBe(true);
        expect(isRolePlayEnd(s.nodes.find((n) => n.id === state.node))).toBe(true);
        expect(state.turn).toBe(rolePlayTurnCount(s));
        expect(scored).toBe(rolePlayTurnCount(s));
        expect(rolePlayPaths(s).every((path) => isRolePlayEnd(s.nodes.find((n) => n.id === path.at(-1))))).toBe(true);
      }),
      { numRuns: 300, seed: 35 },
    );
  });
});
