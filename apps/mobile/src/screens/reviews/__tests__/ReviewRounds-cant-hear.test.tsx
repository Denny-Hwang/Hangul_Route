import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import type { BuildRound, ClozeRound, PickRound } from '../../../logic/reviews/review-rounds';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { RoundView, type RoundProps } from '../ReviewRounds';
import type { ReviewRound } from '../../../logic/reviews/review-rounds';

/**
 * "Can't hear it?" on the heard rounds of `RoundView` (AMENDMENTS-AUDIO-CANT-HEAR rows CH-1b and CH-1e, sections 3.1 and
 * 3.12, tests 18 and 21): the Daily Review, Keep going, This week in Korea and the Stage and Cell Check pass `cantHear`.
 * A heard pick round with a cue (a picture or a meaning) gets the guidance-only sheet; without one, Show the letters
 * brings the prompt's Korean with its romanization and focus goes to Hear again; in the Stage Check with its hide switch
 * on (`hidesRomanization`) the asked text is the romanization only. Text rounds never show the link.
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
vi.mock('../../minigames/syllable-build-entry', async () => {
  const chunk = await import('../../minigames/syllable-build-chunk');
  return { useSyllableBuildChunk: () => ({ chunk, failed: false, retry: () => undefined }) };
});

const T = getMessages('en').learner.audio;
const question = (itemId: string, extra: object = {}) =>
  ({ itemId, kind: 'lex', rung: 'recognize', format: 'hear-pick', theme: 'friends', stretch: false, voiceFallback: false, ...extra }) as never;

const HEARD: PickRound = {
  type: 'pick',
  heard: true,
  ask: 'spelling',
  prompt: { ko: '나무', romanization: 'namu' },
  question: question('lex:namu'),
  answer: { ko: { ko: '나무', romanization: 'namu' }, gloss: 'tree' },
  options: [
    { id: 'lex:namu', ko: { ko: '나무', romanization: 'namu' } },
    { id: 'lex:nabi', ko: { ko: '나비', romanization: 'nabi' } },
  ],
  answerId: 'lex:namu',
};
const CUED: PickRound = { ...HEARD, question: question('lex:sul', { cue: 'gloss' }), cue: { gloss: 'tree' } };
const SEEN: PickRound = { ...HEARD, heard: false, ask: 'meaning' };
const CLOZE = {
  type: 'cloze',
  question: question('frame:1'),
  answer: { ko: { ko: '나무가 커요', romanization: 'namuga keoyo' } },
  gapped: { ko: '___가 커요', romanization: '___ga keoyo' },
  tiles: [{ id: 'a', ko: { ko: '나무', romanization: 'namu' } }],
  answerId: 'a',
} as unknown as ClozeRound;
const BUILD = {
  type: 'build',
  target: { ko: '밥', romanization: 'bap' },
  question: question('syl:bap', { kind: 'syl', format: 'build' }),
  answer: { ko: { ko: '밥', romanization: 'bap' } },
} as unknown as BuildRound;

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
  clearReaderLog(reader);
  events.length = 0;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

async function open(round: ReviewRound, props: Partial<RoundProps<ReviewRound>> = {}): Promise<ReactTestRenderer> {
  const r = await render(<RoundView round={round} reducedMotion onFirst={() => undefined} onSolved={() => undefined} grade={() => 'miss'} {...props} />, {
    createNodeMock: focusNodes(['daily-review-hear-again', 'syllable-build-speaker', 'daily-review-build-board-speaker']) as never,
  });
  mounted.push(r);
  await tick(SCREEN_SETTLE_MS);
  return r;
}

describe('RoundView, "Can\'t hear it?" (test 18)', () => {
  it('a heard pick round shows the link after Hear again when the host opts in', async () => {
    const r = await open(HEARD, { cantHear: true });
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['daily-review-hear-again', 'cant-hear', 'daily-review-option-lex:namu'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['daily-review-hear-again', 'cant-hear', 'daily-review-option-lex:namu']);
  });

  it('without the prop (a host that does not opt in) there is no link', async () => {
    const r = await open(HEARD);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Show the letters: focus goes to Hear again, then the prompt Korean comes up with its romanization', async () => {
    const r = await open(HEARD, { cantHear: true });
    await press(pressableById(r.root, 'cant-hear'));
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await tick(0);
    expect(reader.log).toEqual(['focus:daily-review-hear-again']);
    expect(hasId(r.root, 'prompt-panel-text')).toBe(false);
    await tick(320);
    const panel = textOf(byTestId(r.root, 'daily-review-prompt-panel')[0]!);
    expect(panel).toContain('나무');
    expect(panel).toContain('namu');
    expect(panel).toContain(T.readHere);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    // The options keep their place: they were held only while the voice check ran.
    expect(hasId(r.root, 'daily-review-option-lex:namu')).toBe(true);
  });

  it('Always show the letters (CH-2): a heard round opens with the prompt Korean and no link; with a cue it prints nothing and keeps its link', async () => {
    useAudioStore.setState({ showLetters: true });
    const plain = await open(HEARD, { cantHear: true });
    const panel = textOf(byTestId(plain.root, 'daily-review-prompt-panel')[0]!);
    expect(panel).toContain('나무');
    expect(panel).toContain('namu');
    expect(hasId(plain.root, 'cant-hear')).toBe(false);
    const cued = await open(CUED, { cantHear: true });
    expect(textOf(byTestId(cued.root, 'daily-review-prompt-panel')[0]!)).not.toContain('namu');
    expect(hasId(cued.root, 'cant-hear')).toBe(true);
  });

  it('Always show the letters does not reach a host that did not opt in', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await open(HEARD);
    expect(textOf(byTestId(r.root, 'daily-review-prompt-panel')[0]!)).not.toContain('namu');
  });

  it('a heard round with a cue gets the guidance-only sheet: the cue settles it, so the prompt is not printed', async () => {
    const r = await open(CUED, { cantHear: true });
    await press(pressableById(r.root, 'cant-hear'));
    expect(textOf(byTestId(r.root, 'cant-hear-line')[0]!)).toBe(T.cantHear.lines.computer);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
  });

  it('a heard reply round (an exchange) offers Show the letters, which shows the prompt line', async () => {
    const r = await open({ ...HEARD, ask: 'reply', prompt: { ko: '안녕하세요', romanization: 'annyeonghaseyo' }, question: question('lex:hi') }, { cantHear: true });
    await press(pressableById(r.root, 'cant-hear'));
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(true);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await tick(400);
    expect(textOf(byTestId(r.root, 'daily-review-prompt-panel')[0]!)).toContain('annyeonghaseyo');
  });

  it('a text round (shown prompt) and a cloze round have no link even with the prop', async () => {
    for (const round of [SEEN, CLOZE]) {
      const r = await open(round, { cantHear: true });
      expect(hasId(r.root, 'cant-hear')).toBe(false);
      await unmount(r);
      mounted.pop();
    }
  });

  it('a Syllable Build round passes the prop through the loader: the link next to its speaker, only when the host opts in', async () => {
    const on = await open(BUILD, { cantHear: true });
    expect(hasId(on.root, 'cant-hear')).toBe(true);
    const off = await open(BUILD);
    expect(hasId(off.root, 'cant-hear')).toBe(false);
  });
});

describe('RoundView in the Stage Check and the Cell Check (CH-1e, section 3.12, test 21)', () => {
  const HANGUL = /[ㄱ-ㆎ가-힣]/;
  const panelText = (r: ReactTestRenderer): string => textOf(byTestId(r.root, 'daily-review-prompt-panel')[0]!);
  const ask = async (r: ReactTestRenderer): Promise<void> => {
    await press(pressableById(r.root, 'cant-hear'));
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await tick(400);
  };

  it('with the hide switch on (hidesRomanization) the asked text is the romanization only: no Hangul in the prompt, focus on Hear again, the romanization announced once', async () => {
    const r = await open(HEARD, { cantHear: true, hidesRomanization: true });
    await ask(r);
    expect(byTestId(r.root, 'daily-review-prompt-panel-text')).toHaveLength(1);
    expect(textOf(byTestId(r.root, 'daily-review-prompt-panel-text')[0]!)).toBe('namu');
    expect(panelText(r)).toContain(T.readHere);
    expect(panelText(r).replace(T.readHere, '')).not.toMatch(HANGUL);
    expect(reader.log).toEqual(['focus:daily-review-hear-again', 'announce']);
    expect(reader.announced).toEqual(['namu']);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('with the switch off (the Cell Check, the Stage Check with the romanization shown) the asked text is the surface\'s own: the Korean with its romanization', async () => {
    const r = await open(HEARD, { cantHear: true });
    await ask(r);
    expect(panelText(r)).toContain('나무');
    expect(panelText(r)).toContain('namu');
    expect(reader.announced).toEqual([getMessages('en').a11y.koreanItem({ ko: '나무', romanization: 'namu' })]);
  });

  it('Always show the letters follows the same rule: the romanization only with the switch on, the own text with it off', async () => {
    useAudioStore.setState({ showLetters: true });
    const hidden = await open(HEARD, { cantHear: true, hidesRomanization: true });
    expect(textOf(byTestId(hidden.root, 'daily-review-prompt-panel-text')[0]!)).toBe('namu');
    const shown = await open(HEARD, { cantHear: true });
    expect(panelText(shown)).toContain('나무');
  });

  it('Sound off is not an ask: the surface keeps its own text (AD13) even with the switch on', async () => {
    useAudioStore.setState({ muted: true });
    const r = await open(HEARD, { cantHear: true, hidesRomanization: true });
    expect(panelText(r)).toContain('나무');
  });

  it('a round with a cue stays guidance only, with the switch on too', async () => {
    const r = await open(CUED, { cantHear: true, hidesRomanization: true });
    await press(pressableById(r.root, 'cant-hear'));
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(panelText(r)).not.toContain('namu');
  });

  it('a right first answer after Show the letters is reported as a right one and the ask is counted once: identifiable as asked (CH-1f)', async () => {
    const first: Array<{ correct: boolean }> = [];
    const r = await open(HEARD, { cantHear: true, hidesRomanization: true, onFirst: (a) => void first.push(a) });
    await ask(r);
    expect(events.filter((e) => e.name === 'audio.fallback_shown').map((e) => e.payload)).toEqual([{ source: 'daily-review', reason: 'asked' }]);
    await press(pressableById(r.root, 'daily-review-option-lex:namu'));
    expect(first).toEqual([{ correct: true }]);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toHaveLength(1);
  });

  it('a Syllable Build round in a Check has its link; Show the letters shows the block\'s romanization, as ever', async () => {
    const r = await open(BUILD, { cantHear: true, hidesRomanization: true });
    expect(hasId(r.root, 'cant-hear')).toBe(true);
  });
});
