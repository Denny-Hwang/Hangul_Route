import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { describe, expect, it } from 'vitest';
import { FADE_READING_FROM_QUEST } from '../locale/romanization-fade';
import { romanizationResolver } from '../locale/romanization-mode';
import { symbolsMetThrough } from '../stage1/curriculum';
import {
  LISTEN_PICK_AUDIO_SOURCE,
  LISTEN_PICK_TIMING,
  askedTextIsRomanizationOnly,
  checkHoldsRomanization,
  textPromptView,
  headerView as headerViewWith,
  listenPickSpeech,
  optionColumns,
  optionItem,
  optionView as optionViewWith,
  promptView,
  startFlow,
  stepFlow,
  type FlowEffect,
  type FlowEvent,
  type ListenPickFlowState,
} from '../listen-pick-flow';

// The words are learner.minigame and a11y.minigame (F-I18N-001 PR 7b); these tests read the dictionary.
const messages = getMessages('en');
const COPY = messages.learner.minigame;
const A11Y = messages.a11y.minigame;
type HeaderArgs = Parameters<typeof headerViewWith>;
type OptionArgs = Parameters<typeof optionViewWith>;
const headerView = (mode: HeaderArgs[0], state: HeaderArgs[1]): ReturnType<typeof headerViewWith> =>
  headerViewWith(mode, state, COPY);
const optionView = (
  round: OptionArgs[0],
  option: OptionArgs[1],
  state: OptionArgs[2],
  context: OptionArgs[3],
): ReturnType<typeof optionViewWith> => optionViewWith(round, option, state, context, A11Y);

const text = (ko: string, romanization: string, en = ko) => ({ ko, romanization, en });

const textRound: ListenPickRound = {
  id: 'lp:sym:ga',
  prompt: text('가', 'ga', 'the letter giyeok'),
  options: [
    { id: 'a', text: text('가', 'ga') },
    { id: 'b', text: text('나', 'na') },
    { id: 'c', text: text('다', 'da') },
    { id: 'd', text: text('라', 'ra') },
  ],
  answerId: 'a',
};

const pictureRound: ListenPickRound = {
  id: 'lp:pic:bap',
  prompt: text('밥', 'bap', 'rice'),
  options: [
    { id: 'rice', pictureRef: 'card:rice', labelEn: 'rice' },
    { id: 'hanbok', pictureRef: 'card:hanbok', labelEn: 'hanbok' },
  ],
  answerId: 'rice',
};

/** Run events in order, collecting every effect. */
function run(
  start: ListenPickFlowState,
  events: FlowEvent[],
): { state: ListenPickFlowState; effects: FlowEffect[][] } {
  let state = start;
  const effects: FlowEffect[][] = [];
  for (const event of events) {
    const out = stepFlow(state, event);
    state = out.state;
    effects.push(out.effects);
  }
  return { state, effects };
}

const tap = (optionId: string, at: number, answerId = 'a'): FlowEvent => ({ type: 'tap', optionId, answerId, at });

describe('startFlow (F-QUEST-002 §3.10)', () => {
  it('opens round 1 asking, with nothing locked and no autoplay planned', () => {
    expect(startFlow(2)).toEqual({
      status: 'asking',
      roundIdx: 0,
      total: 2,
      wrongIds: [],
      hint: false,
      textPrompt: false,
      lastTapAt: null,
    });
  });

  it('is empty for a scope without a playable round', () => {
    expect(startFlow(0).status).toBe('empty');
    expect(startFlow(-1).status).toBe('empty');
  });

  it('ignores every event when empty', () => {
    const empty = startFlow(0);
    for (const event of [tap('a', 100), { type: 'advance' } as const, { type: 'hear' } as const]) {
      expect(stepFlow(empty, event)).toEqual({ state: empty, effects: [] });
    }
  });
});

describe('hearing the prompt', () => {
  it('plays on the speaker press and cancels a pending replay', () => {
    const out = stepFlow(startFlow(2), { type: 'hear' });
    expect(out.effects).toEqual([{ type: 'cancel-replay' }, { type: 'play', why: 'manual' }]);
    expect(out.state).toEqual(startFlow(2));
  });

  it('is unlimited: every press plays again', () => {
    const { effects } = run(startFlow(2), [{ type: 'hear' }, { type: 'hear' }, { type: 'hear' }]);
    expect(effects.every((e) => e.some((x) => x.type === 'play'))).toBe(true);
  });

  it('shows the prompt as text when the voice is unavailable or muted', () => {
    for (const result of ['unavailable', 'muted'] as const) {
      const out = stepFlow(startFlow(2), { type: 'audio', round: 0, result });
      expect(out.state.textPrompt).toBe(true);
      expect(out.effects).toEqual([]);
    }
  });

  it('keeps the audio view when the prompt played', () => {
    const out = stepFlow(startFlow(2), { type: 'audio', round: 0, result: 'played' });
    expect(out.state.textPrompt).toBe(false);
  });

  it('keeps the text once shown, even if a later play succeeds', () => {
    const { state } = run(startFlow(2), [
      { type: 'audio', round: 0, result: 'unavailable' },
      { type: 'audio', round: 0, result: 'played' },
    ]);
    expect(state.textPrompt).toBe(true);
  });

  it('ignores an audio result from an earlier round', () => {
    const afterTap = run(startFlow(2), [tap('a', 100), { type: 'advance' }]).state;
    expect(afterTap.roundIdx).toBe(1);
    const late = stepFlow(afterTap, { type: 'audio', round: 0, result: 'unavailable' });
    expect(late.state.textPrompt).toBe(false);
  });
});

describe('a wrong tap', () => {
  it('locks the option, reports a missed answer, nudges and schedules the 800 ms replay', () => {
    const out = stepFlow(startFlow(2), tap('b', 100));
    expect(out.state.wrongIds).toEqual(['b']);
    expect(out.state.status).toBe('asking');
    expect(out.state.hint).toBe(false);
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-replay' },
      { type: 'schedule-replay', ms: LISTEN_PICK_TIMING.replayDelayMs },
    ]);
    expect(LISTEN_PICK_TIMING.replayDelayMs).toBe(800);
  });

  it('does not end the round and a locked option does nothing when tapped again', () => {
    const { state, effects } = run(startFlow(2), [tap('b', 100), tap('b', 900)]);
    expect(state.wrongIds).toEqual(['b']);
    expect(effects[1]).toEqual([]);
  });

  it('shows the hint ring only after the second wrong option', () => {
    const first = run(startFlow(2), [tap('b', 100)]).state;
    expect(first.hint).toBe(false);
    const second = run(first, [tap('c', 900)]).state;
    expect(second.hint).toBe(true);
    expect(second.wrongIds).toEqual(['b', 'c']);
  });

  it('keeps a ring that is on from the start through a miss (the scaffold round, F-CURR-002 section 4.6)', () => {
    const ringed = { ...startFlow(1), hint: true };
    const missed = run(ringed, [tap('b', 100)]).state;
    expect(missed.hint).toBe(true);
    expect(missed.wrongIds).toEqual(['b']);
    expect(run(missed, [tap('c', 900)]).state.hint).toBe(true);
  });

  it('replays the prompt when the replay timer fires while still asking', () => {
    const asking = run(startFlow(2), [tap('b', 100)]).state;
    expect(stepFlow(asking, { type: 'replay-due' }).effects).toEqual([{ type: 'play', why: 'replay' }]);
  });

  it('does not replay after the round resolved', () => {
    const resolved = run(startFlow(2), [tap('b', 100), tap('a', 900)]).state;
    expect(stepFlow(resolved, { type: 'replay-due' })).toEqual({ state: resolved, effects: [] });
  });
});

describe('the right tap', () => {
  it('resolves on the first try: scored correct, plays the prompt once more, advances after 700 ms', () => {
    const out = stepFlow(startFlow(2), tap('a', 100));
    expect(out.state.status).toBe('resolved');
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: true },
      { type: 'haptic', kind: 'success' },
      { type: 'cancel-replay' },
      { type: 'play', why: 'confirm' },
      { type: 'schedule-advance', ms: LISTEN_PICK_TIMING.advanceDelayMs },
    ]);
    expect(LISTEN_PICK_TIMING.advanceDelayMs).toBe(700);
  });

  it('after a miss it is still reported with the same round key (the store keeps it a retry)', () => {
    const { effects } = run(startFlow(2), [tap('b', 100), tap('a', 900)]);
    const answers = effects.flat().filter((e) => e.type === 'answer');
    expect(answers).toEqual([
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'answer', roundKey: 0, correct: true },
    ]);
  });

  it('ignores taps once the round resolved', () => {
    const resolved = run(startFlow(2), [tap('a', 100)]).state;
    expect(stepFlow(resolved, tap('b', 5000))).toEqual({ state: resolved, effects: [] });
    expect(stepFlow(resolved, tap('a', 5000))).toEqual({ state: resolved, effects: [] });
  });
});

describe('a bounce inside the window is dropped (AMENDMENTS-TOUCH KT-D5; was the 50 ms window of F-001 §3.4)', () => {
  it('the window is TAP_LOCK_MS less a 50 ms clock slack (the board lock is the gate at 400 ms)', () => {
    expect(LISTEN_PICK_TIMING.touchWindowMs).toBe(TAP_LOCK_MS - 50);
    expect(TAP_LOCK_MS).toBe(400);
  });

  it('drops a second tap on another option inside the window (a bounce 60, 150 or 349 ms later)', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000));
    for (const gap of [60, 150, LISTEN_PICK_TIMING.touchWindowMs - 1]) {
      const second = stepFlow(first.state, tap('c', 1000 + gap));
      expect(second.state.wrongIds).toEqual(['b']);
      expect(second.effects).toEqual([]);
    }
  });

  it('accepts a tap at TAP_LOCK_MS and later', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000));
    const second = stepFlow(first.state, tap('c', 1000 + TAP_LOCK_MS));
    expect(second.state.wrongIds).toEqual(['b', 'c']);
  });

  it('accepts a tap the board passed at 400 ms that reached the flow 5 ms early (the first handler ran late)', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000));
    const second = stepFlow(first.state, tap('c', 1000 + TAP_LOCK_MS - 5));
    expect(second.state.wrongIds).toEqual(['b', 'c']);
  });

  it('does not let a dropped tap move the window', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000)).state;
    const dropped = stepFlow(first, tap('c', 1300)).state;
    expect(dropped.lastTapAt).toBe(1000);
    expect(stepFlow(dropped, tap('c', 1000 + TAP_LOCK_MS)).state.wrongIds).toEqual(['b', 'c']);
  });
});

describe('advancing', () => {
  it('opens the next round fresh and autoplays its prompt (round 2 on)', () => {
    const resolved = run(startFlow(3), [tap('b', 100), tap('c', 900), tap('a', 1800)]).state;
    const out = stepFlow(resolved, { type: 'advance' });
    expect(out.state).toEqual({
      status: 'asking',
      roundIdx: 1,
      total: 3,
      wrongIds: [],
      hint: false,
      textPrompt: false,
      lastTapAt: null,
    });
    expect(out.effects).toEqual([{ type: 'play', why: 'autoplay' }]);
  });

  it('completes after the last round', () => {
    const lastResolved = run(startFlow(1), [tap('a', 100)]).state;
    const out = stepFlow(lastResolved, { type: 'advance' });
    expect(out.state.status).toBe('done');
    expect(out.effects).toEqual([{ type: 'complete' }]);
  });

  it('does nothing when no round is resolved (a stale timer)', () => {
    const asking = startFlow(2);
    expect(stepFlow(asking, { type: 'advance' })).toEqual({ state: asking, effects: [] });
    const done = run(startFlow(1), [tap('a', 100), { type: 'advance' }]).state;
    expect(stepFlow(done, { type: 'advance' })).toEqual({ state: done, effects: [] });
  });

  it('uses the round index as the round key for every round', () => {
    const { effects } = run(startFlow(2), [tap('a', 100), { type: 'advance' }, tap('b', 5000), tap('a', 6000)]);
    const keys = effects.flat().flatMap((e) => (e.type === 'answer' ? [e.roundKey] : []));
    expect(keys).toEqual([0, 1, 1]);
  });
});

describe('headerView', () => {
  it('is a bar with "n / N" for a quest step', () => {
    expect(headerView('quest', startFlow(4))).toEqual({
      kind: 'bar',
      title: undefined,
      value: 1,
      max: 4,
      label: '1 / 4',
    });
  });

  it('is two fill-only dots titled Quick check in check mode', () => {
    const start = headerView('check', startFlow(2));
    expect(start).toEqual({ kind: 'dots', title: 'Quick check', value: 0, max: 2, label: undefined });
    const resolved = run(startFlow(2), [tap('a', 100)]).state;
    expect(headerView('check', resolved).value).toBe(1);
    const next = stepFlow(resolved, { type: 'advance' }).state;
    expect(headerView('check', next).value).toBe(1);
  });

  it('is fill-only dots with no number and no title for the Hangul Check (review mode, F-QUEST-002 §3.10)', () => {
    expect(headerView('review', startFlow(7))).toEqual({ kind: 'dots', title: undefined, value: 0, max: 7, label: undefined });
    const resolved = run(startFlow(7), [tap('a', 100)]).state;
    expect(headerView('review', resolved).value).toBe(1);
  });

  it('fills the last dot once the final round is done', () => {
    const done = run(startFlow(2), [tap('a', 100), { type: 'advance' }, tap('a', 5000), { type: 'advance' }]).state;
    expect(headerView('check', done).value).toBe(2);
  });

  it('keeps the bar for the other modes', () => {
    for (const mode of ['vocab', 'preview'] as const) {
      expect(headerView(mode, startFlow(3)).kind).toBe('bar');
    }
  });

  it('never has a percent or fraction beyond "n / N" in its label', () => {
    expect(headerView('quest', startFlow(3)).label).not.toMatch(/%/);
  });
});

describe('promptView', () => {
  const asking = startFlow(2);
  const resolved = run(startFlow(2), [tap('a', 100)]).state;

  it('hides the gloss and the answer while asking', () => {
    expect(promptView(textRound, asking, 'quest')).toEqual({ showText: false, content: undefined });
  });

  it('shows the Korean and romanization with no gloss as the sound fallback', () => {
    const noSound = stepFlow(asking, { type: 'audio', round: 0, result: 'unavailable' }).state;
    expect(promptView(textRound, noSound, 'quest')).toEqual({
      showText: true,
      content: { ko: '가', romanization: 'ga', gloss: undefined },
    });
  });

  it('adds the gloss and romanization once the round resolved', () => {
    expect(promptView(textRound, resolved, 'quest')).toEqual({
      showText: false,
      content: { ko: '가', romanization: 'ga', gloss: 'the letter giyeok' },
    });
  });

  it('keeps the gloss back in the review (no per-item feedback text)', () => {
    expect(promptView(textRound, resolved, 'review').content).toBeUndefined();
  });

  it('still shows the fallback text in the review (no sound must not block the item)', () => {
    const noSound = stepFlow(asking, { type: 'audio', round: 0, result: 'muted' }).state;
    expect(promptView(textRound, noSound, 'review').content).toEqual({ ko: '가', romanization: 'ga', gloss: undefined });
  });

  it('hides the fallback gloss even after resolve in the review, keeps it in the quest', () => {
    const noSoundResolved = run(startFlow(2), [{ type: 'audio', round: 0, result: 'unavailable' }, tap('a', 100)]).state;
    expect(promptView(textRound, noSoundResolved, 'review').content?.gloss).toBeUndefined();
    expect(promptView(textRound, noSoundResolved, 'quest').content?.gloss).toBe('the letter giyeok');
  });
});

describe('promptView: the prompt slot shows the text (F-AUDIO-004 §3.8)', () => {
  it('shows the Korean as the fallback as soon as the slot shows its text, before any play result', () => {
    expect(promptView(textRound, startFlow(2), 'quest', true)).toEqual({
      showText: true,
      content: { ko: '가', romanization: 'ga', gloss: undefined },
    });
    expect(promptView(textRound, startFlow(2), 'quest', false)).toEqual({ showText: false, content: undefined });
  });
});

describe('listenPickSpeech: source and speech rate (F-AUDIO-004 §3.3)', () => {
  const round = (id: string, ko: string, extra: Partial<ListenPickRound['prompt']> = {}): ListenPickRound => ({
    id,
    prompt: { ko, romanization: 'x', en: 'x', ...extra },
    options: [
      { id: 'a', text: { ko: '가', romanization: 'ga', en: 'a' } },
      { id: 'b', text: { ko: '나', romanization: 'na', en: 'b' } },
    ],
    answerId: 'a',
  });

  it('a letter or syllable round is a sound, a sentence is a sentence, a word is a word', () => {
    expect(listenPickSpeech(round('lp:sym:jamo:giyeok', '가')).kind).toBe('sound');
    expect(listenPickSpeech(round('lp:syl:달', '달')).kind).toBe('sound');
    expect(listenPickSpeech(round('lp:word:나무', '나무')).kind).toBe('word');
    expect(listenPickSpeech(round('pic-gimbap', '김밥')).kind).toBe('word');
    expect(listenPickSpeech(round('a1', '가방이에요.')).kind).toBe('sentence');
    expect(listenPickSpeech(round('c1', '어디 가요?')).kind).toBe('sentence');
  });

  it('a one-syllable word or picture round is a word, read at the word rate (not the slow sound rate)', () => {
    expect(listenPickSpeech(round('lp:word:집', '집')).kind).toBe('word');
    expect(listenPickSpeech(round('lp:pic:달', '달')).kind).toBe('word');
    expect(listenPickSpeech(round('read-ppang', '빵')).kind).toBe('word');
  });

  it('says the spoken form, keeps the recording and names the surface', () => {
    expect(listenPickSpeech(round('lp:word:x', '숫자', { spokenKo: '숟짜', audioRef: 'audio/vocab/sutja.mp3' }))).toEqual({
      text: '숟짜',
      audioRef: 'audio/vocab/sutja.mp3',
      kind: 'word',
      source: 'listen-pick',
    });
    expect(LISTEN_PICK_AUDIO_SOURCE).toBe('listen-pick');
    expect('audioRef' in listenPickSpeech(round('lp:word:x', '나무'))).toBe(false);
  });

  it("a letter round with the letter's recording is still a sound: the carrier syllable at the sound rate, the clip tried first", () => {
    expect(listenPickSpeech(round('lp:sym:jamo:giyeok', '가', { audioRef: 'audio/jamo/giyeok.mp3' }))).toEqual({
      text: '가',
      audioRef: 'audio/jamo/giyeok.mp3',
      kind: 'sound',
      source: 'listen-pick',
    });
  });
});

describe('optionView', () => {
  const asking = startFlow(2);
  const optionA = textRound.options[0]!;
  const optionB = textRound.options[1]!;

  it('is an idle, interactive text card with its romanization', () => {
    const view = optionView(textRound, optionB, asking, { mode: 'quest', romanizationMode: 'always' });
    expect(view).toMatchObject({ cardState: 'idle', ko: '나', romanization: 'na', pictureRef: undefined, label: undefined });
    expect(view.accessibilityLabel).toBe('나, na');
  });

  it('hides the romanization of an untouched option in tap mode and shows it once tapped', () => {
    const hidden = optionView(textRound, optionB, asking, { mode: 'quest', romanizationMode: 'tap' });
    expect(hidden.romanization).toBe('');
    expect(hidden.accessibilityLabel).toBe('나');
    const tapped = run(asking, [tap('b', 100)]).state;
    const shown = optionView(textRound, optionB, tapped, { mode: 'quest', romanizationMode: 'tap' });
    expect(shown.romanization).toBe('na');
    expect(shown.cardState).toBe('wrong');
  });

  it('marks a missed option wrong with a label that says so, and never red', () => {
    const missed = run(asking, [tap('b', 100)]).state;
    const view = optionView(textRound, optionB, missed, { mode: 'quest', romanizationMode: 'always' });
    expect(view.cardState).toBe('wrong');
    expect(view.accessibilityLabel).toBe('Not this one: 나, na');
  });

  it('rings the right option after two misses, but never in the review', () => {
    const twice = run(asking, [tap('b', 100), tap('c', 900)]).state;
    const quest = optionView(textRound, optionA, twice, { mode: 'quest', romanizationMode: 'always' });
    expect(quest.cardState).toBe('hint');
    expect(quest.accessibilityLabel).toBe('Look here: 가, ga');
    const review = optionView(textRound, optionA, twice, { mode: 'review', romanizationMode: 'always' });
    expect(review.cardState).toBe('idle');
    expect(review.accessibilityLabel).toBe('가, ga');
  });

  it('turns the answer correct on resolve and dims the others', () => {
    const resolved = run(asking, [tap('b', 100), tap('a', 900)]).state;
    const right = optionView(textRound, optionA, resolved, { mode: 'quest', romanizationMode: 'always' });
    expect(right.cardState).toBe('correct');
    expect(right.accessibilityLabel).toBe('Right answer: 가, ga');
    expect(optionView(textRound, optionB, resolved, { mode: 'quest', romanizationMode: 'always' }).cardState).toBe('wrong');
    const other = textRound.options[2]!;
    expect(optionView(textRound, other, resolved, { mode: 'quest', romanizationMode: 'always' }).cardState).toBe('disabled');
  });

  it('draws a picture option with the art and its visible label, which is also its name', () => {
    const view = optionView(pictureRound, pictureRound.options[1]!, startFlow(1), { mode: 'quest', romanizationMode: 'tap' });
    expect(view).toMatchObject({ pictureRef: 'card:hanbok', label: 'hanbok', ko: undefined, gloss: 'hanbok' });
    expect(view.accessibilityLabel).toBe('hanbok');
  });

  it('falls back to the option text for a picture-less label', () => {
    const odd: ListenPickRound = {
      ...pictureRound,
      options: [
        { id: 'x', pictureRef: 'swatch:primary', text: text('빨강', 'ppalgang', 'red') },
        { id: 'y', pictureRef: 'swatch:accent' },
      ],
      answerId: 'x',
    };
    const withText = optionView(odd, odd.options[0]!, startFlow(1), { mode: 'quest', romanizationMode: 'always' });
    expect(withText.label).toBe('red');
    const bare = optionView(odd, odd.options[1]!, startFlow(1), { mode: 'quest', romanizationMode: 'always' });
    expect(bare.label).toBeUndefined();
    expect(bare.gloss).toBe('Picture');
    expect(bare.accessibilityLabel).toBe('Picture');
  });
});

describe('a Check holds its options\' romanization until the answer (AMENDMENTS-AUDIT-2026-11 AU-8, widened by AMENDMENTS-STAGE1-DECODING-CHECK DC-1a)', () => {
  const asking = startFlow(2);
  const check = { mode: 'check', romanizationMode: 'always', holdRomanization: checkHoldsRomanization('check') } as const;

  it('the quest Check and the Hangul Check hold it, text prompt rounds included; a practice host never does', () => {
    expect(checkHoldsRomanization('check')).toBe(true);
    expect(checkHoldsRomanization('review')).toBe(true);
    for (const mode of ['quest', 'vocab', 'preview'] as const) expect(checkHoldsRomanization(mode)).toBe(false);
  });

  it('an open question draws no romanization on any option and keeps each line\'s room', () => {
    for (const option of textRound.options) {
      const view = optionView(textRound, option, asking, check);
      expect(view.romanization).toBe('');
      expect(view.heldRomanization).toBe(option.text!.romanization);
      expect(view.cardState).toBe('idle');
    }
  });

  it('the accessible name keeps the romanization while it is held', () => {
    expect(optionView(textRound, textRound.options[1]!, asking, check).accessibilityLabel).toBe('나, na');
    expect(optionView(textRound, textRound.options[1]!, asking, check).accessibilityLabel).toBe(
      optionView(textRound, textRound.options[1]!, asking, { mode: 'quest', romanizationMode: 'always' }).accessibilityLabel,
    );
  });

  it('a missed option, and the ringed answer after two misses, stay without it while the question is open', () => {
    const missed = run(asking, [tap('b', 100)]).state;
    const wrong = optionView(textRound, textRound.options[1]!, missed, check);
    expect(wrong).toMatchObject({ cardState: 'wrong', romanization: '', heldRomanization: 'na' });
    expect(wrong.accessibilityLabel).toBe('Not this one: 나, na');
    const twice = run(asking, [tap('b', 100), tap('c', 900)]).state;
    expect(optionView(textRound, textRound.options[0]!, twice, check)).toMatchObject({ cardState: 'hint', romanization: '', heldRomanization: 'ga' });
  });

  it('once the question is answered every option shows its romanization and nothing is held', () => {
    const resolved = run(asking, [tap('b', 100), tap('a', 900)]).state;
    expect(resolved.status).toBe('resolved');
    expect(textRound.options.map((o) => optionView(textRound, o, resolved, check).romanization)).toEqual(['ga', 'na', 'da', 'ra']);
    expect(textRound.options.every((o) => optionView(textRound, o, resolved, check).heldRomanization === '')).toBe(true);
    const done = { ...resolved, status: 'done' as const };
    expect(optionView(textRound, textRound.options[2]!, done, check).romanization).toBe('da');
  });

  it('the next question is held again', () => {
    const next = run(asking, [tap('a', 100), { type: 'advance' }]).state;
    expect(next).toMatchObject({ status: 'asking', roundIdx: 1 });
    expect(optionView(textRound, textRound.options[0]!, next, check)).toMatchObject({ romanization: '', heldRomanization: 'ga' });
  });

  it('the stricter tap mode keeps winning: nothing untouched is shown or held, and a touched option waits for the answer', () => {
    const tapCheck = { ...check, romanizationMode: 'tap' } as const;
    expect(optionView(textRound, textRound.options[1]!, asking, tapCheck)).toMatchObject({ romanization: '', heldRomanization: '' });
    expect(optionView(textRound, textRound.options[1]!, asking, tapCheck).accessibilityLabel).toBe('나');
    const missed = run(asking, [tap('b', 100)]).state;
    expect(optionView(textRound, textRound.options[1]!, missed, tapCheck)).toMatchObject({ romanization: '', heldRomanization: 'na' });
    const resolved = run(asking, [tap('b', 100), tap('a', 900)]).state;
    expect(textRound.options.map((o) => optionView(textRound, o, resolved, tapCheck).romanization)).toEqual(['ga', 'na', '', '']);
  });

  it('a picture option has no romanization to hold', () => {
    expect(optionView(pictureRound, pictureRound.options[0]!, startFlow(1), check)).toMatchObject({ romanization: '', heldRomanization: '', label: 'rice' });
  });

  it('the Hangul Check holds it the same way, whatever the learner\'s mode: nothing shows while asking, and the answer shows it as the mode does', () => {
    const review = { mode: 'review', romanizationMode: 'always', holdRomanization: checkHoldsRomanization('review') } as const;
    for (const option of textRound.options) {
      expect(optionView(textRound, option, asking, review)).toMatchObject({ romanization: '', heldRomanization: option.text!.romanization });
    }
    const resolved = run(asking, [tap('b', 100), tap('a', 900)]).state;
    expect(textRound.options.map((o) => optionView(textRound, o, resolved, review).romanization)).toEqual(['ga', 'na', 'da', 'ra']);
    const tapReview = { ...review, romanizationMode: 'tap' } as const;
    expect(textRound.options.map((o) => optionView(textRound, o, resolved, tapReview).romanization)).toEqual(['ga', 'na', '', '']);
  });

  it('every practice host is unchanged: a practice step, vocabulary and a preview show it from the start', () => {
    for (const mode of ['quest', 'vocab', 'preview'] as const) {
      const context = { mode, romanizationMode: 'always', holdRomanization: checkHoldsRomanization(mode) } as const;
      for (const option of textRound.options) {
        expect(optionView(textRound, option, asking, context)).toMatchObject({ romanization: option.text!.romanization, heldRomanization: '' });
      }
    }
    // A Check context without the flag (Cloze Pick's own option cards) is unchanged too.
    expect(optionView(textRound, textRound.options[1]!, asking, { mode: 'check', romanizationMode: 'always' })).toMatchObject({ romanization: 'na', heldRomanization: '' });
  });
});

describe('textPromptView: a text prompt round holds its own romanization while the question is open (DC-1a, section 3.3)', () => {
  const asking = startFlow(2);
  const resolved = run(startFlow(2), [tap('a', 100)]).state;

  it('held while asking: the Korean and its romanization are the round\'s, the line is marked held', () => {
    expect(textPromptView(textRound, asking, true)).toEqual({ ko: '가', romanization: 'ga', held: true });
  });

  it('shown once the round is answered, and never held when the surface holds nothing', () => {
    expect(textPromptView(textRound, resolved, true)).toEqual({ ko: '가', romanization: 'ga', held: false });
    expect(textPromptView(textRound, asking, false)).toEqual({ ko: '가', romanization: 'ga', held: false });
    expect(textPromptView(textRound, { ...resolved, status: 'done' }, true).held).toBe(false);
  });
});

describe('the view-models take their words as a parameter (F-I18N-001 §3.4 rule 3)', () => {
  it('render the subtree they are given (en-XA)', () => {
    const pseudo = pseudoLocalize(messages);
    expect(headerViewWith('check', startFlow(2), pseudo.learner.minigame).title).toBe(pseudoText('Quick check'));
    expect(headerViewWith('quest', startFlow(4), pseudo.learner.minigame).label).toBe(pseudoText('1 / 4'));
    const missed = run(startFlow(1), [tap('b', 100)]).state;
    const view = optionViewWith(textRound, textRound.options[1]!, missed, { mode: 'quest', romanizationMode: 'always' }, pseudo.a11y.minigame);
    expect(view.accessibilityLabel).toBe(pseudoText('Not this one: 나, na'));
  });
});

describe('optionColumns', () => {
  it('uses two columns for pictures, whatever the text', () => {
    expect(optionColumns(pictureRound, 390)).toBe(2);
  });

  it('uses two columns for text of at most eight glyphs and one beyond', () => {
    expect(optionColumns(textRound, 390)).toBe(2);
    const long: ListenPickRound = {
      ...textRound,
      options: [
        { id: 'a', text: text('안녕하세요 여러분 반가워요', 'annyeonghaseyo') },
        { id: 'b', text: text('감사합니다', 'gamsahamnida') },
      ],
    };
    expect(optionColumns(long, 390)).toBe(1);
    const nine: ListenPickRound = {
      ...long,
      options: [
        { id: 'a', text: text('가나다라마바사아자', 'x') },
        { id: 'b', text: text('가', 'y') },
      ],
    };
    expect(optionColumns(nine, 390)).toBe(1);
    const eight: ListenPickRound = {
      ...long,
      options: [
        { id: 'a', text: text('가나다라마바사아', 'x') },
        { id: 'b', text: text('가', 'y') },
      ],
    };
    expect(optionColumns(eight, 390)).toBe(2);
  });

  it('treats an option with no text as short (a bad round is skipped elsewhere)', () => {
    const bare: ListenPickRound = { ...textRound, options: [{ id: 'a' }, { id: 'b' }] };
    expect(optionColumns(bare, 390)).toBe(2);
  });

  it('uses one column on a narrow screen', () => {
    expect(optionColumns(textRound, 339)).toBe(1);
    expect(optionColumns(pictureRound, 320)).toBe(1);
    expect(optionColumns(textRound, 340)).toBe(2);
  });
});

describe('optionItem (F-A11Y-001 §3.2: what a result line calls an option)', () => {
  const a11y = messages.a11y;
  const slashed = { id: 's', text: text('ㄱ', 'g/k', 'giyeok') };
  it('names a Korean option by its romanization read as sounds, with its meaning only after a right answer, never its Hangul', () => {
    expect(optionItem(slashed, a11y, { gloss: false })).toBe('g or k');
    expect(optionItem(slashed, a11y, { gloss: true })).toBe('g or k, giyeok');
    expect(optionItem(textRound.options[0]!, a11y, { gloss: true })).toBe('ga, 가');
  });
  it('names a picture by its label, then its text meaning, then "Picture"', () => {
    expect(optionItem(pictureRound.options[0]!, a11y, { gloss: true })).toBe('rice');
    expect(optionItem({ id: 'p', pictureRef: 'card:x', text: text('밥', 'bap', 'rice') }, a11y, { gloss: false })).toBe('rice');
    expect(optionItem({ id: 'p', pictureRef: 'card:x' }, a11y, { gloss: false })).toBe(a11y.minigame.picture);
  });
  it("uses the spelling round's own name for a text option, as it is", () => {
    expect(optionItem(slashed, a11y, { gloss: true, labelOf: (t) => `spelled ${t.romanization}` })).toBe('spelled g/k');
  });
});

describe('the asked text in a Check (AMENDMENTS-AUDIO-CANT-HEAR CH-1e, section 3.12)', () => {
  const asking = startFlow(2);
  const resolved = run(startFlow(2), [tap('a', 100)]).state;

  it('askedTextIsRomanizationOnly: every Check host with a sound prompt, whatever the mode; a practice host never (DC-1a, section 3.2)', () => {
    expect(askedTextIsRomanizationOnly('check', false)).toBe(true);
    expect(askedTextIsRomanizationOnly('review', false)).toBe(true);
    for (const mode of ['quest', 'vocab', 'preview'] as const) expect(askedTextIsRomanizationOnly(mode, false)).toBe(false);
  });

  it('a text prompt round has no sound to ask about, so it is never the romanization-only case', () => {
    expect(askedTextIsRomanizationOnly('check', true)).toBe(false);
    expect(askedTextIsRomanizationOnly('review', true)).toBe(false);
  });

  it('romanizationOnly: the text carries the romanization and no Hangul while the question is open', () => {
    expect(promptView(textRound, asking, 'check', true, true)).toEqual({
      showText: true,
      content: { ko: undefined, romanization: 'ga', gloss: undefined },
    });
    expect(promptView(textRound, asking, 'review', true, true).content?.ko).toBeUndefined();
  });

  it('without the flag the surface keeps its own text (Sound off, a practice host, a Check with the romanization shown)', () => {
    expect(promptView(textRound, asking, 'check', true)).toEqual({
      showText: true,
      content: { ko: '가', romanization: 'ga', gloss: undefined },
    });
  });

  it('the flag changes nothing when no text shows, and once the round resolved the answer is known so the Korean shows', () => {
    expect(promptView(textRound, asking, 'check', false, true)).toEqual({ showText: false, content: undefined });
    expect(promptView(textRound, resolved, 'check', true, true).content).toEqual({ ko: '가', romanization: 'ga', gloss: 'the letter giyeok' });
  });
});

describe('item-level folding and the answer showing every option (AMENDMENTS-ROMANIZATION-FADE sections 3.6 and 3.8, row RF-1b)', () => {
  const wordRound: ListenPickRound = {
    id: 'lp:word:san',
    prompt: text('산', 'san', 'mountain'),
    options: [
      { id: 'a', text: text('산', 'san', 'mountain') },
      { id: 'b', text: text('바다', 'bada', 'sea') },
      { id: 'c', text: text('까치', 'kkachi', 'magpie') },
      { id: 'd', text: text('떡국', 'tteokguk', 'rice cake soup') },
    ],
    answerId: 'a',
  };
  const met = new Set<string>(symbolsMetThrough(FADE_READING_FROM_QUEST));
  const auto = romanizationResolver(null, { romanizationChoice: 'auto' }, { phase: 'reading', met, screenReader: false });
  const asking = startFlow(2);
  const resolved = run(asking, [tap('b', 100), tap('a', 900)]).state;
  const shown = (state: ListenPickFlowState, context: Parameters<typeof optionView>[3]): string[] =>
    wordRound.options.map((o) => optionView(wordRound, o, state, context).romanization);
  const quest = { mode: 'quest', romanizationMode: 'always', romanizationModeOf: auto.forText } as const;

  it('on the quest host a decodable option folds while the question is open; a theme word with an unmet letter stays shown', () => {
    expect(shown(asking, quest)).toEqual(['', '', 'kkachi', 'tteokguk']);
    // The accessible name follows what is drawn, as tap's does today.
    expect(optionView(wordRound, wordRound.options[0]!, asking, quest).accessibilityLabel).toBe('산');
    expect(optionView(wordRound, wordRound.options[2]!, asking, quest).accessibilityLabel).toBe('까치, kkachi');
  });

  it('a touched option shows it; when the round resolves every option does', () => {
    const missed = run(asking, [tap('b', 100)]).state;
    expect(shown(missed, quest)).toEqual(['', 'bada', 'kkachi', 'tteokguk']);
    expect(shown(resolved, quest)).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
    expect(shown({ ...resolved, status: 'done' }, quest)).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
  });

  it('every non-Check host shows every option once resolved, for an explicit tap too, and keeps its fold while asking', () => {
    for (const mode of ['quest', 'vocab', 'preview'] as const) {
      const tapContext = { mode, romanizationMode: 'tap' } as const;
      expect(shown(asking, tapContext)).toEqual(['', '', '', '']);
      expect(shown(resolved, tapContext)).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
    }
  });

  it('is ignored on vocab, preview, check and review: the one mode decides', () => {
    for (const mode of ['vocab', 'preview', 'check', 'review'] as const) {
      expect(shown(asking, { mode, romanizationMode: 'always', romanizationModeOf: auto.forText })).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
      expect(shown(asking, { mode, romanizationMode: 'tap', romanizationModeOf: () => 'always' })).toEqual(['', '', '', '']);
    }
  });

  it('check and review are unchanged: tap shows only the touched options at the answer (AU-8), a hold still holds', () => {
    for (const mode of ['check', 'review'] as const) {
      const context = { mode, romanizationMode: 'tap', holdRomanization: checkHoldsRomanization(mode) } as const;
      expect(shown(resolved, context)).toEqual(['san', 'bada', '', '']);
      expect(shown(asking, { ...context, romanizationMode: 'always' })).toEqual(['', '', '', '']);
      expect(wordRound.options.map((o) => optionView(wordRound, o, asking, { ...context, romanizationMode: 'always' }).heldRomanization)).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
    }
  });

  it('with an explicit Always choice (what the default was before RF-2) every option is exactly what it was, in every phase, host and state', () => {
    const states = [asking, run(asking, [tap('b', 100)]).state, resolved, { ...resolved, status: 'done' as const }];
    for (const phase of ['letters', 'reading', 'all'] as const) {
      const resolver = romanizationResolver(null, { romanizationChoice: 'always' }, { phase, met, screenReader: false });
      for (const mode of ['quest', 'check', 'review', 'vocab', 'preview'] as const) {
        const hold = checkHoldsRomanization(mode);
        for (const state of states) {
          for (const option of wordRound.options) {
            expect(optionView(wordRound, option, state, { mode, romanizationMode: 'always', romanizationModeOf: resolver.forText, holdRomanization: hold })).toEqual(
              optionView(wordRound, option, state, { mode, romanizationMode: 'always', holdRomanization: hold }),
            );
          }
        }
      }
    }
  });

  it('phase letters and a screen reader keep every option shown on the quest host', () => {
    const fadeOf = (phase: 'letters' | 'reading' | 'all', screenReader: boolean) =>
      romanizationResolver(null, { romanizationChoice: 'auto' }, { phase, met, screenReader });
    expect(shown(asking, { ...quest, romanizationModeOf: fadeOf('letters', false).forText })).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
    expect(shown(asking, { ...quest, romanizationModeOf: fadeOf('reading', true).forText })).toEqual(['san', 'bada', 'kkachi', 'tteokguk']);
  });

  it('a picture option has no romanization to fold or show', () => {
    expect(optionView(pictureRound, pictureRound.options[0]!, startFlow(1), quest)).toMatchObject({ romanization: '', label: 'rice' });
  });
});
