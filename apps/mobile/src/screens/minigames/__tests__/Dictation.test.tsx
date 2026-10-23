import type { ListenPickRound, TypeHangulRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { TypeRound } from '../../../logic/reviews/review-rounds';
import { TypeRoundView } from '../../reviews/ReviewRounds';
import { HEAR_HOLD_MS } from '../../../logic/type-hangul/hear-mode';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, screenTexts, textOf } from '../../../test-support/render';
import * as kit from '../dictation-chunk';
import type { AnswerMeta, MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';
import { TypeHangulGame } from '../TypeHangulGame';

/**
 * F-CURR-002 row CM-31 (design/wireframes/minigame/type-hangul.md "Hear mode: Dictation" and "The spelling round",
 * audio-fallback.md W11): Type Hangul `hear` through the shipped web audio adapter over FakeSpeechSynthesis. The word
 * is heard and its Korean and romanization stay hidden until Done; with no Korean voice the round opens as `see` with
 * the sound notice, decided before it opens; while the voice list is unknown the round holds (keys inactive) at most
 * 1.5 s. The spelling round shows its picture and meaning, and spells each option by letter name for screen readers.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const EN = getMessages('en');
const T = EN.learner.minigame.typeHangul;
const AUDIO = EN.learner.audio;

const APPLE: TypeHangulRound = { id: 'd-apple', promptEn: 'Type the word you hear.', mode: 'hear', target: { ko: '사과', romanization: 'sagwa', en: 'apple' } };
const MILK: TypeHangulRound = { id: 'd-milk', promptEn: 'Type the word you hear.', mode: 'hear', target: { ko: '우유', romanization: 'uyu', en: 'milk' } };

type Answer = [string | number, boolean, AnswerMeta | undefined];
function host(): MinigameHost & { answers: Answer[] } {
  const h = { mode: 'quest' as const, answers: [] as Answer[], answer: (k: string | number, c: boolean, meta?: AnswerMeta) => void h.answers.push([k, c, meta]), complete: () => undefined };
  return h;
}

const mounted: ReactTestRenderer[] = [];
/** Every `focus()` a mounted node took (the field is never focused while a round holds). */
const focused: string[] = [];
async function play(rounds: TypeHangulRound[], size = { width: 768, height: 1024 }, withKit = true): Promise<{ r: ReactTestRenderer; h: ReturnType<typeof host> }> {
  const h = host();
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor(size)}>
        <RomanizationModeOverride mode="always">
          <TypeHangulGame scope={{ kind: 'type-hangul', rounds: rounds.length, typeHangul: { rounds } }} host={h} hear={withKit ? kit : null} />
        </RomanizationModeOverride>
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => focused.push('node'), addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return { r, h };
}
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const typeKeys = async (r: ReactTestRenderer, jamo: string): Promise<void> => {
  for (const j of jamo) await tap(r, `hangul-key-${j}`);
};
const settle = async (ms = 20): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const texts = (r: ReactTestRenderer): string => screenTexts(r.root).join(' | ');
const labels = (root: ReactTestInstance): string[] =>
  root.findAll((n) => typeof n.props.accessibilityLabel === 'string' || typeof n.props['aria-label'] === 'string').map((n) => String(n.props.accessibilityLabel ?? n.props['aria-label']));
/** The field's accessible name: the mode's instruction while empty, else what was typed. */
const field = (r: ReactTestRenderer): string => labels(byTestId(r.root, 'type-hangul-field')[0]!).join(' ');

beforeEach(() => {
  focused.length = 0;
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
  useAudioStore.setState({ muted: false });
});

describe('Dictation (Type Hangul hear) with a Korean voice', () => {
  it('hides the Korean and its romanization before Done, shows the meaning, and plays the word on the speaker', async () => {
    const { r } = await play([APPLE]);
    expect(texts(r)).toContain(T.hear.meaning('apple'));
    expect(texts(r)).not.toContain('사과');
    expect(texts(r)).not.toContain('sagwa');
    // The empty field says what to do.
    expect(field(r)).toContain(T.heading.hear);
    // Round 1 waits for a tap on the speaker.
    expect(rig.current!.synth.spoken).toHaveLength(0);
    expect(labels(r.root)).toContain(EN.a11y.minigame.dictation.speaker);
    await tap(r, 'dictation-prompt-speaker');
    await settle();
    expect(rig.current!.synth.spoken.map((u) => [u.text, u.lang])).toEqual([['사과', 'ko-KR']]);
  });

  it('a right first Done is a right round; the word then shows with its romanization and meaning', async () => {
    const { r, h } = await play([APPLE]);
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(h.answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
    const word = textOf(byTestId(r.root, 'type-hangul-word')[0]!);
    expect(word).toContain('사과');
    expect(word).toContain('sagwa');
    expect(word).toContain('apple');
  });

  it('Show how it sounds reveals the romanization, and a right answer after it is hinted for the memory store', async () => {
    const { r, h } = await play([APPLE]);
    await tap(r, 'dictation-prompt-show-sound');
    expect(textOf(byTestId(r.root, 'dictation-prompt-romanization')[0]!)).toBe('sagwa');
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(h.answers).toEqual([[0, true, { itemId: 'd-apple', hinted: true }]]);
  });

  it('one letter off is a missed round for the stars and a hinted answer for the memory store; two off is a plain miss', async () => {
    const near = await play([APPLE]);
    await typeKeys(near.r, 'ㅅㅏㄱㅏ');
    await tap(near.r, 'type-hangul-done');
    expect(near.h.answers).toEqual([[0, false, { itemId: 'd-apple', hinted: true }]]);
    const far = await play([APPLE]);
    await typeKeys(far.r, 'ㄱㅏㄱㅏ');
    await tap(far.r, 'type-hangul-done');
    expect(far.h.answers).toEqual([[0, false, { itemId: 'd-apple' }]]);
  });

  it('plays the word when round 2 opens', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { r } = await play([APPLE, MILK]);
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['우유']);
    expect(texts(r)).toContain(T.hear.meaning('milk'));
  });

  it('below 640 tall: one row of speaker, meaning button and Skip, with no count pill', async () => {
    const { r } = await play([APPLE], { width: 320, height: 568 });
    const meaning = byTestId(r.root, 'dictation-prompt-meaning').find((n) => typeof n.props.onClick === 'function')!;
    expect(textOf(meaning)).toContain('apple');
    expect(textOf(meaning)).toContain(T.hear.showSound);
    expect(texts(r)).not.toMatch(/\b1 \/ 1\b/);
    await press(meaning);
    expect(textOf(byTestId(r.root, 'dictation-prompt-romanization')[0]!)).toBe('sagwa');
  });
});

describe('Dictation with no Korean voice, sound off, or the voice list unknown (decided before the round opens)', () => {
  it('no Korean voice: the round opens as see with the sound notice', async () => {
    rig.current = createAudioRig({ voices: [] });
    const { r, h } = await play([APPLE]);
    expect(texts(r)).toContain('사과');
    expect(field(r)).toContain(T.heading.see);
    const notice = textOf(byTestId(r.root, 'dictation-notice')[0]!);
    expect(notice).toContain(AUDIO.readHere);
    expect(notice).toContain(AUDIO.noKoreanVoiceSentence);
    expect(byTestId(r.root, 'dictation-prompt-speaker')).toHaveLength(0);
    // It scores as usual, as a see round: no hint.
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(h.answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('sound off: the round opens as see with Sound is off, and turning sound on keeps it see', async () => {
    useAudioStore.setState({ muted: true });
    const { r } = await play([APPLE]);
    expect(texts(r)).toContain('사과');
    expect(textOf(byTestId(r.root, 'dictation-notice')[0]!)).toContain(AUDIO.soundIsOff);
    await act(async () => {
      useAudioStore.setState({ muted: false });
    });
    expect(texts(r)).toContain('사과');
    expect(byTestId(r.root, 'dictation-prompt-speaker')).toHaveLength(0);
  });

  it('the voice list unknown: holds (keys type nothing, speaker disabled), then opens as hear at 1.5 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    rig.current = createAudioRig({ voices: [KO_VOICE] });
    useAudioStore.setState({ tts: { state: 'unknown' } });
    const { r } = await play([APPLE]);
    expect(texts(r)).not.toContain('사과');
    const speaker = byTestId(r.root, 'dictation-prompt-speaker').find((n) => n.props.accessibilityState !== undefined || n.props['aria-disabled'] !== undefined);
    expect(speaker?.props.accessibilityState?.disabled ?? speaker?.props['aria-disabled']).toBe(true);
    await typeKeys(r, 'ㅅㅏ');
    expect(field(r)).toContain(T.heading.hear);
    // Nothing takes focus while the round holds: not the field, not a panel.
    expect(focused).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HEAR_HOLD_MS);
    });
    await typeKeys(r, 'ㅅㅏ');
    expect(field(r)).toContain('사');
  });

  it('the voice list resolves to available during the hold: the round opens as hear at once, before 1.5 s, keys live', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    useAudioStore.setState({ tts: { state: 'unknown' } });
    const { r } = await play([APPLE]);
    await typeKeys(r, 'ㅅ');
    expect(field(r)).toContain(T.heading.hear);
    await act(async () => {
      useAudioStore.setState({ tts: { state: 'ready', voiceId: 'com.apple.voice.Yuna', voiceName: 'Yuna', local: true, quality: 'standard' } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HEAR_HOLD_MS / 3);
    });
    // Open as hear, well inside the hold: the speaker is live, the Korean is still hidden, and the first key is taken.
    const speaker = byTestId(r.root, 'dictation-prompt-speaker').find((n) => n.props.accessibilityState !== undefined || n.props['aria-disabled'] !== undefined);
    expect(speaker?.props.accessibilityState?.disabled ?? speaker?.props['aria-disabled'] ?? false).toBe(false);
    expect(texts(r)).not.toContain('사과');
    await typeKeys(r, 'ㅅㅏ');
    expect(field(r)).toContain('사');
    expect(byTestId(r.root, 'dictation-notice')).toHaveLength(0);
  });

  it('the voice list resolves to none during the hold: the round opens as see with the notice', async () => {
    rig.current = createAudioRig({ voices: [] });
    useAudioStore.setState({ tts: { state: 'unknown' } });
    const { r } = await play([APPLE]);
    expect(texts(r)).not.toContain('사과');
    await act(async () => {
      useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    });
    expect(texts(r)).toContain('사과');
    expect(textOf(byTestId(r.root, 'dictation-notice')[0]!)).toContain(AUDIO.noKoreanVoiceSentence);
  });

  it('without the dictation chunk (switch off or not loaded) a hear round is the see round of the word', async () => {
    const { r } = await play([APPLE], undefined, false);
    expect(texts(r)).toContain('사과');
    // An ordinary see round: its line is the see heading, never the hear line the round was written with.
    expect(texts(r)).toContain(T.heading.see);
    expect(texts(r)).not.toContain(APPLE.promptEn);
    expect(byTestId(r.root, 'dictation-notice')).toHaveLength(0);
    expect(byTestId(r.root, 'dictation-prompt-speaker')).toHaveLength(0);
  });
});

describe('the spelling round (Listen & Pick, promptKind spelling)', () => {
  const book = { ko: '책이', romanization: 'chaegi', en: 'book' };
  const round: ListenPickRound = {
    id: 'sp',
    promptKind: 'spelling',
    prompt: book,
    options: [{ id: 'a', text: book }, { id: 'b', text: { ko: '채기', romanization: 'chaegi', en: 'book' } }],
    answerId: 'a',
    fallbackOptions: [{ id: 'c', text: { ko: '학교', romanization: 'hakgyo', en: 'school' } }, { id: 'd', text: { ko: '우유', romanization: 'uyu', en: 'milk' } }],
  };
  const renderPick = async (withKit: boolean): Promise<ReactTestRenderer> => {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
          <RomanizationModeOverride mode="always">
            <ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: [round] } }} host={host()} spelling={withKit ? kit : null} />
          </RomanizationModeOverride>
        </LayoutProvider>,
      );
    });
    mounted.push(r);
    return r;
  };

  it('asks which spelling matches, shows the meaning, and spells each option block by block for screen readers', async () => {
    const r = await renderPick(true);
    expect(texts(r)).toContain(EN.learner.minigame.spellingPick.heading);
    expect(textOf(byTestId(r.root, 'spelling-cue-gloss')[0]!)).toBe('book');
    const all = labels(r.root);
    expect(all).toContain('치읓 애 기역, 이응 이. chaegi');
    expect(all).toContain('치읓 애, 기역 이. chaegi');
    // Never the Korean prompt as text before the answer: it is the answer.
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
  });

  it('below 640 tall the speaker is its one sound control, and the two short spellings sit side by side', async () => {
    const r = await renderPick(true);
    expect(byTestId(r.root, 'listen-pick-hear-again')).toHaveLength(0);
    expect(byTestId(r.root, 'listen-pick-speaker').length).toBeGreaterThan(0);
    const cells = byTestId(r.root, 'listen-pick-options')[0]!.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
    const bases = r.root.findAll((n) => n.props.style !== undefined && JSON.stringify(n.props.style).includes('"flexBasis":"45%"'));
    expect(cells.length).toBeGreaterThan(0);
    expect(bases.length).toBeGreaterThanOrEqual(2);
  });

  it('a miss points back to the meaning', async () => {
    const r = await renderPick(true);
    await tap(r, 'listen-pick-option-b');
    expect(texts(r)).toContain(EN.learner.minigame.spellingPick.miss);
  });

  it('without the chunk it is Listen & Pick on the same word: the look-alike spelling left out', async () => {
    const r = await renderPick(false);
    expect(texts(r)).toContain(EN.learner.minigame.listenPick.heading);
    expect(byTestId(r.root, 'listen-pick-option-b')).toHaveLength(0);
    for (const id of ['a', 'c', 'd']) expect(byTestId(r.root, `listen-pick-option-${id}`).length, id).toBeGreaterThan(0);
    expect(byTestId(r.root, 'spelling-cue')).toHaveLength(0);
  });
});

describe('Dictation in a review (the produce rung of a word)', () => {
  const ROUND: TypeRound = {
    type: 'type',
    mode: 'hear',
    target: '사과',
    question: { itemId: 'lex:sagwa', kind: 'lex', rung: 'produce', format: 'dictation', theme: 'life', stretch: false, voiceFallback: false },
    answer: { ko: { ko: '사과', romanization: 'sagwa' }, gloss: 'apple' },
  };
  const mount = async (onFirst: (a: unknown) => void): Promise<ReactTestRenderer> => {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
          <TypeRoundView round={ROUND} reducedMotion onFirst={onFirst} onSolved={() => undefined} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
        </LayoutProvider>,
      );
    });
    mounted.push(r);
    await settle(50);
    return r;
  };

  it('plays the word as the round opens, hides it until the answer, and shows it with its romanization once right', async () => {
    const answers: unknown[] = [];
    const r = await mount((a) => answers.push(a));
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['사과']);
    expect(texts(r)).toContain(T.heading.hear);
    expect(texts(r)).not.toContain('사과');
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'daily-review-type-done');
    expect(answers).toEqual([{ correct: true }]);
    expect(textOf(byTestId(r.root, 'daily-review-type-target')[0]!)).toContain('sagwa');
  });

  it('a right answer after Show how it sounds is hinted', async () => {
    const answers: unknown[] = [];
    const r = await mount((a) => answers.push(a));
    await tap(r, 'daily-review-dictation-show-sound');
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'daily-review-type-done');
    expect(answers).toEqual([{ correct: true, hinted: true }]);
  });

  it('with no Korean voice it is the see round of the word, with the sound notice', async () => {
    rig.current = createAudioRig({ voices: [] });
    const r = await mount(() => undefined);
    expect(texts(r)).toContain('사과');
    expect(textOf(byTestId(r.root, 'daily-review-dictation-notice')[0]!)).toContain(AUDIO.noKoreanVoiceSentence);
  });
});
