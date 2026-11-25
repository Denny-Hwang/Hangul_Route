import type { TypeHangulRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { TypeRound } from '../../../logic/reviews/review-rounds';
import { HEAR_HOLD_MS } from '../../../logic/type-hangul/hear-mode';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, screenTexts, textOf, unmount } from '../../../test-support/render';
import { TypeRoundView } from '../../reviews/ReviewRounds';
import * as kit from '../dictation-chunk';
import type { AnswerMeta, MinigameHost } from '../host';
import { TypeHangulGame } from '../TypeHangulGame';

/**
 * "Can't hear it?" on Dictation (AMENDMENTS-AUDIO-CANT-HEAR row CH-1c, section 3.6, test 19): the link sits after the
 * speaker of a `hear` round and is inactive while the round holds (the voice list unknown, at most `HEAR_HOLD_MS`);
 * Show the letters turns the round into the `see` round that two failed plays already lead to (`HearSeeReason`
 * `'asked'`: the word, "No sound? Read it here.", no reason line), with focus on the word and nothing else announced;
 * a right first Done there is hinted for the memory store (CH-1f); the next round opens as hear again.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
const events = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    events.push(event);
  }),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await importOriginal<object>()));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

const EN = getMessages('en');
const T = EN.learner.audio;
const TH = EN.learner.minigame.typeHangul;

const APPLE: TypeHangulRound = { id: 'd-apple', promptEn: 'Type the word you hear.', mode: 'hear', target: { ko: '사과', romanization: 'sagwa', en: 'apple' } };
const MILK: TypeHangulRound = { id: 'd-milk', promptEn: 'Type the word you hear.', mode: 'hear', target: { ko: '우유', romanization: 'uyu', en: 'milk' } };
const SEE: TypeHangulRound = { id: 's-bread', promptEn: 'Type this word.', mode: 'see', target: { ko: '빵', romanization: 'ppang', en: 'bread' } };

type Answer = [string | number, boolean, AnswerMeta | undefined];
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false, tts: { state: 'ready', voiceId: 'com.apple.voice.Yuna', voiceName: 'Yuna', local: true, quality: 'standard' } });
  clearReaderLog(reader);
  events.length = 0;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const FOCUS = ['dictation-prompt-speaker', 'dictation-asked-word'];

async function game(rounds: TypeHangulRound[], size = { width: 360, height: 740 }, mode: MinigameHost['mode'] = 'quest'): Promise<{ r: ReactTestRenderer; answers: Answer[] }> {
  const answers: Answer[] = [];
  const host: MinigameHost = { mode, answer: (k, c, meta) => void answers.push([k, c, meta]), complete: () => undefined };
  const r = await render(
    <LayoutProvider value={layoutClassFor(size)}>
      <RomanizationModeOverride mode="always">
        <TypeHangulGame scope={{ kind: 'type-hangul', rounds: rounds.length, typeHangul: { rounds } }} host={host} hear={kit} />
      </RomanizationModeOverride>
    </LayoutProvider>,
    { createNodeMock: focusNodes(FOCUS) as never },
  );
  mounted.push(r);
  await tick(20);
  return { r, answers };
}
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => press(pressableById(r.root, id));
const typeKeys = async (r: ReactTestRenderer, jamo: string): Promise<void> => {
  for (const j of jamo) await tap(r, `hangul-key-${j}`);
};
const texts = (r: ReactTestRenderer): string => screenTexts(r.root).join(' | ');
const dim = (r: ReactTestRenderer): boolean => byTestId(r.root, 'cant-hear')[0]!.props.style.opacity === 0.6;
/** Opens the sheet and taps Show the letters; the beat before the text is waited out. */
async function showLetters(r: ReactTestRenderer): Promise<void> {
  await tap(r, 'cant-hear');
  await tap(r, 'cant-hear-show-letters');
  await tick(400);
}

describe('Dictation, "Can\'t hear it?" (test 19)', () => {
  it('a hear round shows the link after the speaker, before the answer field, active once the round has opened', async () => {
    const { r } = await game([APPLE]);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(dim(r)).toBe(false);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['dictation-prompt-speaker', 'cant-hear', 'type-hangul-field'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['dictation-prompt-speaker', 'cant-hear', 'type-hangul-field']);
  });

  it('is drawn but inactive while the round holds (the voice list unknown), takes no tap, and turns active when the hold ends', async () => {
    useAudioStore.setState({ tts: { state: 'unknown' } });
    const { r } = await game([APPLE]);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(dim(r)).toBe(true);
    const link = byTestId(r.root, 'cant-hear').find((n) => typeof n.props.onClick === 'function');
    if (link) await press(link);
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(false);
    await tick(HEAR_HOLD_MS);
    expect(dim(r)).toBe(false);
    await tap(r, 'cant-hear');
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(true);
  });

  it('a see round, sound off and no Korean voice have no link', async () => {
    const see = await game([SEE]);
    expect(hasId(see.r.root, 'cant-hear')).toBe(false);
    useAudioStore.setState({ muted: true });
    const muted = await game([APPLE]);
    expect(hasId(muted.r.root, 'cant-hear')).toBe(false);
    useAudioStore.setState({ muted: false });
    rig.current = createAudioRig({ voices: [] });
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    const none = await game([APPLE]);
    expect(hasId(none.r.root, 'cant-hear')).toBe(false);
  });

  it('Show the letters: the round becomes the see round of the word, "No sound? Read it here." with no reason line, no speaker, no link', async () => {
    const { r } = await game([APPLE]);
    expect(texts(r)).not.toContain('사과');
    await showLetters(r);
    expect(texts(r)).toContain('사과');
    expect(texts(r)).toContain('sagwa');
    expect(texts(r)).toContain(TH.heading.see);
    const notice = textOf(byTestId(r.root, 'dictation-notice')[0]!);
    expect(notice).toContain(T.readHere);
    for (const line of [T.noKoreanVoiceSentence, T.soundIsOff, T.didNotPlay]) expect(notice).not.toContain(line);
    expect(hasId(r.root, 'dictation-notice-action')).toBe(false);
    expect(hasId(r.root, 'dictation-prompt-speaker')).toBe(false);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Show the letters sends audio.fallback_shown {source, reason: asked} exactly once, and nothing else about the ask', async () => {
    const { r } = await game([APPLE, MILK]);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
    await showLetters(r);
    const sent = (): unknown[] => events.filter((e) => e.name === 'audio.fallback_shown').map((e) => e.payload);
    expect(sent()).toEqual([{ source: 'type-hangul-hear', reason: 'asked' }]);
    // Asked again on the next round: the count is one per session and source.
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    await tick(2000);
    await showLetters(r);
    expect(sent()).toEqual([{ source: 'type-hangul-hear', reason: 'asked' }]);
  });

  it('the word wrapper after Show the letters shrinks with the row, so a long word line wraps inside the window', async () => {
    const { r } = await game([APPLE]);
    await showLetters(r);
    const style = byTestId(r.root, 'dictation-asked-word')[0]!.props.style as { flexShrink?: number; minWidth?: string };
    expect(style).toMatchObject({ flexShrink: 1, minWidth: '0px' });
  });

  it('Show the letters: focus goes to the word once it is there, and nothing else is announced', async () => {
    const { r } = await game([APPLE]);
    await tap(r, 'cant-hear');
    clearReaderLog(reader);
    await tap(r, 'cant-hear-show-letters');
    await tick(0);
    // Before the letters are up there is no word to focus.
    expect(reader.log).toEqual(['focus:none']);
    await tick(400);
    expect(reader.log).toEqual(['focus:none', 'focus:dictation-asked-word']);
    expect(reader.announced).toEqual([]);
    expect(hasId(r.root, 'dictation-asked-word')).toBe(true);
  });

  it('a right first Done after Show the letters is hinted (CH-1f), and the next round opens as hear with the link again', async () => {
    const { r, answers } = await game([APPLE, MILK]);
    await showLetters(r);
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, true, { itemId: 'd-apple', hinted: true }]]);
    await tick(2000);
    expect(texts(r)).toContain(TH.hear.meaning('milk'));
    expect(texts(r)).not.toContain('우유');
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(hasId(r.root, 'dictation-notice')).toBe(false);
  });

  it('a wrong first Done after Show the letters is a plain miss (CH-1f): correct false, no hinted mark', async () => {
    const { r, answers } = await game([APPLE]);
    await showLetters(r);
    await typeKeys(r, 'ㅇㅜㅇㅠ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, false, { itemId: 'd-apple' }]]);
  });

  it('a right first Done in the hear round with no ask is not marked; Sound off, no Korean voice, two failed plays and "Always show the letters" are not asks either (CH-1f)', async () => {
    const heard = await game([APPLE]);
    await typeKeys(heard.r, 'ㅅㅏㄱㅗㅏ');
    await tap(heard.r, 'type-hangul-done');
    expect(heard.answers).toEqual([[0, true, { itemId: 'd-apple' }]]);

    const done = async (g: { r: ReactTestRenderer; answers: Answer[] }): Promise<Answer[]> => {
      await typeKeys(g.r, 'ㅅㅏㄱㅗㅏ');
      await tap(g.r, 'type-hangul-done');
      return g.answers;
    };
    useAudioStore.setState({ muted: true });
    expect(await done(await game([APPLE]))).toEqual([[0, true, { itemId: 'd-apple' }]]);
    useAudioStore.setState({ muted: false, tts: { state: 'none', reason: 'no_korean_voice' } });
    expect(await done(await game([APPLE]))).toEqual([[0, true, { itemId: 'd-apple' }]]);
    useAudioStore.setState({ tts: { state: 'ready', voiceId: 'com.apple.voice.Yuna', voiceName: 'Yuna', local: true, quality: 'standard' }, showLetters: true });
    expect(await done(await game([APPLE]))).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('two failed plays turn the round into the see round with reason error: a right Done there is not marked', async () => {
    rig.current!.synth.speak = () => {
      throw new Error('no speech');
    };
    const g = await game([APPLE]);
    await tap(g.r, 'dictation-prompt-speaker');
    await tap(g.r, 'dictation-prompt-speaker');
    await tick(100);
    expect(texts(g.r)).toContain('사과');
    expect(hasId(g.r.root, 'cant-hear')).toBe(false);
    await typeKeys(g.r, 'ㅅㅏㄱㅗㅏ');
    await tap(g.r, 'type-hangul-done');
    expect(g.answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('a one-letter slip after Show the letters is a plain miss: the see round shows the word, so it is not help given', async () => {
    const { r, answers } = await game([APPLE]);
    await showLetters(r);
    await typeKeys(r, 'ㅅㅏㄱㅗㅓ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, false, { itemId: 'd-apple' }]]);
  });

  it('the asked text stays when the voice list later says there is no Korean voice', async () => {
    const { r } = await game([APPLE]);
    await showLetters(r);
    await act(async () => {
      useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    });
    expect(texts(r)).toContain('사과');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Hear it from the sheet plays the word once and keeps the hear round', async () => {
    const { r } = await game([APPLE]);
    await tap(r, 'cant-hear');
    await tap(r, 'cant-hear-hear');
    await tick(1000);
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['사과']);
    expect(texts(r)).not.toContain('사과');
    expect(hasId(r.root, 'cant-hear')).toBe(true);
  });

  it('below 640 tall the link is under the one row of speaker and meaning', async () => {
    const { r } = await game([APPLE], { width: 320, height: 568 });
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['dictation-prompt-speaker', 'cant-hear'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['dictation-prompt-speaker', 'cant-hear']);
    await showLetters(r);
    expect(texts(r)).toContain('사과');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Always show the letters (CH-2): the round opens as the see round, no link, nothing hidden behind a tap', async () => {
    useAudioStore.setState({ showLetters: true });
    const { r } = await game([APPLE]);
    expect(texts(r)).toContain('사과');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    expect(hasId(r.root, 'dictation-prompt-speaker')).toBe(false);
    // The device switch is not the learner's ask: no focus move, no focus wrapper, no `asked` count (CH-1f keys on `asked`).
    expect(reader.log).toEqual([]);
    expect(hasId(r.root, 'dictation-asked-word')).toBe(false);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
  });

  it('Always show the letters during the hold opens as see at once, not after 1.5 s', async () => {
    useAudioStore.setState({ showLetters: true, tts: { state: 'unknown' } });
    const { r } = await game([APPLE]);
    expect(texts(r)).toContain('사과');
  });
});

describe('Dictation in a review round, "Can\'t hear it?"', () => {
  const ROUND: TypeRound = {
    type: 'type',
    mode: 'hear',
    target: '사과',
    question: { itemId: 'lex:sagwa', kind: 'lex', rung: 'produce', format: 'dictation', theme: 'life', stretch: false, voiceFallback: false },
    answer: { ko: { ko: '사과', romanization: 'sagwa' }, gloss: 'apple' },
  };
  async function review(): Promise<ReactTestRenderer> {
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TypeRoundView round={ROUND} reducedMotion onFirst={() => undefined} onSolved={() => undefined} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
      </LayoutProvider>,
      { createNodeMock: focusNodes(FOCUS) as never },
    );
    mounted.push(r);
    await tick(50);
    return r;
  }

  it('the hear round has the link; Show the letters draws the word with its romanization, the notice with no reason line, and focuses the word', async () => {
    const r = await review();
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(texts(r)).not.toContain('사과');
    await tap(r, 'cant-hear');
    clearReaderLog(reader);
    await tap(r, 'cant-hear-show-letters');
    await tick(400);
    expect(textOf(byTestId(r.root, 'daily-review-type-target')[0]!)).toContain('sagwa');
    const notice = textOf(byTestId(r.root, 'daily-review-dictation-notice')[0]!);
    expect(notice).toContain(T.readHere);
    expect(notice).not.toContain(T.noKoreanVoiceSentence);
    expect(reader.log).toEqual(['focus:none', 'focus:dictation-asked-word']);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  /** The first answer the review round reports, after the learner types `jamo` and taps Done. */
  async function firstAnswer(r: ReactTestRenderer, onFirst: ReturnType<typeof vi.fn>, jamo: string): Promise<unknown> {
    await typeKeys(r, jamo);
    await tap(r, 'daily-review-type-done');
    return onFirst.mock.calls[0]?.[0];
  }
  async function reviewWith(onFirst: ReturnType<typeof vi.fn>, check?: 'stage-check'): Promise<ReactTestRenderer> {
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TypeRoundView round={ROUND} cantHear {...(check ? { check } : {})} reducedMotion onFirst={onFirst} onSolved={() => undefined} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
      </LayoutProvider>,
      { createNodeMock: focusNodes(FOCUS) as never },
    );
    mounted.push(r);
    await tick(50);
    return r;
  }

  it('the hinted mark (CH-1f): a right first Done after Show the letters says asked, a wrong one is a plain miss, no ask says nothing; the review keeps its stars (no `hinted`)', async () => {
    const askedRight = vi.fn();
    const a = await reviewWith(askedRight);
    await showLetters(a);
    expect(await firstAnswer(a, askedRight, 'ㅅㅏㄱㅗㅏ')).toEqual({ correct: true, asked: true });

    const askedWrong = vi.fn();
    const b = await reviewWith(askedWrong);
    await showLetters(b);
    expect(await firstAnswer(b, askedWrong, 'ㅇㅜㅇㅠ')).toEqual({ correct: false });

    const plain = vi.fn();
    const c = await reviewWith(plain);
    expect(await firstAnswer(c, plain, 'ㅅㅏㄱㅗㅏ')).toEqual({ correct: true });
  });

  it('the hinted mark (CH-1f): Sound off, no Korean voice and "Always show the letters" are not asks', async () => {
    useAudioStore.setState({ muted: true });
    const off = vi.fn();
    expect(await firstAnswer(await reviewWith(off), off, 'ㅅㅏㄱㅗㅏ')).toEqual({ correct: true });
    useAudioStore.setState({ muted: false, tts: { state: 'none', reason: 'no_korean_voice' } });
    const none = vi.fn();
    expect(await firstAnswer(await reviewWith(none), none, 'ㅅㅏㄱㅗㅏ')).toEqual({ correct: true });
    useAudioStore.setState({ tts: { state: 'ready', voiceId: 'com.apple.voice.Yuna', voiceName: 'Yuna', local: true, quality: 'standard' }, showLetters: true });
    const always = vi.fn();
    expect(await firstAnswer(await reviewWith(always), always, 'ㅅㅏㄱㅗㅏ')).toEqual({ correct: true });
  });

  /** A Check's Dictation hear round (CH-1g): the stage-check or cell-check host. */
  async function checkRound(check: 'stage-check' | 'cell-check'): Promise<ReactTestRenderer> {
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TypeRoundView round={ROUND} check={check} cantHear reducedMotion onFirst={() => undefined} onSolved={() => undefined} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
      </LayoutProvider>,
      { createNodeMock: focusNodes(FOCUS) as never },
    );
    mounted.push(r);
    await tick(50);
    return r;
  }

  it.each(['stage-check', 'cell-check'] as const)('%s (CH-1g): the link is there, its sheet is guidance only (no Show the letters), and the word is never drawn', async (check) => {
    const r = await checkRound(check);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    await tap(r, 'cant-hear');
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(true);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
    expect(texts(r)).not.toContain('사과');
    expect(texts(r)).not.toContain(T.cantHear.showLetters.cta);
  });

  it.each(['stage-check', 'cell-check'] as const)('%s (CH-1g): Hear it plays the word again, the round stays a hear round, and no audio.fallback_shown can fire', async (check) => {
    const r = await checkRound(check);
    // A review round opens heard (it is not round 1 of a step): the word has been said once when the learner asks.
    const before = rig.current!.synth.spoken.length;
    await tap(r, 'cant-hear');
    await tap(r, 'cant-hear-hear');
    await tick(1000);
    expect(rig.current!.synth.spoken.slice(before).map((u) => u.text)).toEqual(['사과']);
    expect(texts(r)).not.toContain('사과');
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(hasId(r.root, 'dictation-notice')).toBe(false);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
  });

  it('a Check\'s Dictation hear round has no asked answer to mark: a right first Done is a plain right (CH-1f has nothing to mark there)', async () => {
    const onFirst = vi.fn();
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TypeRoundView round={ROUND} check="stage-check" cantHear reducedMotion onFirst={onFirst} onSolved={() => undefined} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
      </LayoutProvider>,
      { createNodeMock: focusNodes(FOCUS) as never },
    );
    mounted.push(r);
    await tick(50);
    await tap(r, 'cant-hear');
    await tap(r, 'cant-hear-hear');
    await tick(1000);
    expect(await firstAnswer(r, onFirst, 'ㅅㅏㄱㅗㅏ')).toEqual({ correct: true });
  });

  it('in a Stage or Cell Check (check) Always show the letters does not open the hear round as a see round: sound first, with the link', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TypeRoundView round={ROUND} check="stage-check" cantHear reducedMotion onFirst={() => undefined} onSolved={() => undefined} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
      </LayoutProvider>,
      { createNodeMock: focusNodes(FOCUS) as never },
    );
    mounted.push(r);
    await tick(2000);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(texts(r)).not.toContain('사과');
  });
});

describe('Dictation in a quest Check (host mode check), "Can\'t hear it?" (CH-1g)', () => {
  it('the sheet is guidance only: no Show the letters, Hear it plays the word, nothing is asked or counted', async () => {
    const { r, answers } = await game([APPLE], { width: 320, height: 568 }, 'check');
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    await tap(r, 'cant-hear');
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(true);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    await tap(r, 'cant-hear-hear');
    await tick(1000);
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['사과']);
    expect(texts(r)).not.toContain('사과');
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('is sound first: "Always show the letters" does not open the hear round as the see round', async () => {
    useAudioStore.setState({ showLetters: true });
    const { r } = await game([APPLE], { width: 320, height: 568 }, 'check');
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    expect(texts(r)).not.toContain('사과');
  });

  it('the practice host still offers Show the letters', async () => {
    const { r } = await game([APPLE], { width: 320, height: 568 }, 'quest');
    await tap(r, 'cant-hear');
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(true);
  });
});
