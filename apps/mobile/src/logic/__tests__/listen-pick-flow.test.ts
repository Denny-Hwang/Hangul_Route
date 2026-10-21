import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  LISTEN_PICK_AUDIO_SOURCE,
  LISTEN_PICK_TIMING,
  headerView as headerViewWith,
  listenPickSpeech,
  optionColumns,
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

describe('only the first touch in a 50 ms window counts (F-001 §3.4)', () => {
  it('drops a second tap on another option inside the window', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000));
    const second = stepFlow(first.state, tap('c', 1049));
    expect(second.state.wrongIds).toEqual(['b']);
    expect(second.effects).toEqual([]);
  });

  it('accepts a tap at 50 ms and later', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000));
    const second = stepFlow(first.state, tap('c', 1050));
    expect(second.state.wrongIds).toEqual(['b', 'c']);
  });

  it('does not let a dropped tap move the window', () => {
    const first = stepFlow(startFlow(2), tap('b', 1000)).state;
    const dropped = stepFlow(first, tap('c', 1040)).state;
    expect(dropped.lastTapAt).toBe(1000);
    expect(stepFlow(dropped, tap('c', 1050)).state.wrongIds).toEqual(['b', 'c']);
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
