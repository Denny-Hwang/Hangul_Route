import { motion } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESULT_MARK_MIN_MS } from '../../../logic/answer-feedback';
import { ANSWER_SOUND_MAX_MS } from '../../../logic/audio/reply-advance';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { LISTEN_PICK_TIMING } from '../../../logic/listen-pick-flow';
import type { ReadPickRound } from '../../../logic/match-shape/fallback';
import type { MinigameScope } from '../../../logic/minigame-config';
import { symbolRound } from '../../../logic/stage1/hangul-check';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { CardMatchGame } from '../CardMatchGame';
import { CultureQuizGame } from '../CultureQuizGame';
import type { MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';
import { MatchSoundGame } from '../MatchSoundGame';
import { ReadPickGame } from '../ReadPickGame';
import { SOLVED_PAUSE_MS, SyllableBuildBoard } from '../SyllableBuildBoard';

/**
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the answer's sound ends before the quest moves on. In each game the next
 * round (or the end of the step) is held while the sound is still playing, released when it ends, never sooner than
 * the game's own delay and never later than the cap. The games that say nothing on an answer (Match Sound, Culture
 * Quiz) wait the same way for a prompt that is still sounding. The rule itself is `logic/audio/sound-pacing.ts`.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => {
  const state = {
    /** While true a play does not end until `endAll()`. */
    hold: false,
    said: [] as string[],
    pending: [] as Array<() => void>,
    play: (text: string): Promise<'played'> => {
      state.said.push(text);
      if (!state.hold) return Promise.resolve('played');
      return new Promise((resolve) => state.pending.push(() => resolve('played')));
    },
  };
  return state;
});
vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: (spec: { text: string }) => audio.play(spec.text),
  playJamo: (jamo: { id: string }) => audio.play(jamo.id),
  stop: () => undefined,
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => reduced.on }));
const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));

const mounted: ReactTestRenderer[] = [];
const open = async (element: React.ReactElement): Promise<ReactTestRenderer> => {
  const r = await render(element);
  mounted.push(r);
  return r;
};
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const endAll = async (): Promise<void> => {
  for (const end of audio.pending.splice(0)) end();
  await tick(0);
};
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
function host(): MinigameHost & { completes: number } {
  const h = {
    mode: 'quest' as const,
    completes: 0,
    answer: () => undefined,
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

/**
 * The shared shape of every case: `moved()` says whether the game went on. Held past the game's own delay while the
 * sound plays; released when it ends.
 */
async function heldUntilTheSoundEnds(minMs: number, moved: () => boolean): Promise<void> {
  await tick(minMs + 600);
  expect(moved(), 'held while the sound is playing').toBe(false);
  await endAll();
  expect(moved(), 'released when the sound ends').toBe(true);
}
/** Never sooner than the game's own delay when the sound is over, and never later than the cap when it does not end. */
async function releasedAtTheCap(minMs: number, moved: () => boolean, capMs = ANSWER_SOUND_MAX_MS): Promise<void> {
  await tick(capMs - 1);
  expect(moved(), 'still held just before the cap').toBe(false);
  await tick(1);
  expect(moved(), 'released at the cap').toBe(true);
  expect(minMs).toBeLessThan(capMs);
}

beforeEach(() => {
  endVoiceCheckHold();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-17T09:00:00Z'));
  audio.hold = false;
  audio.said = [];
  audio.pending = [];
  reduced.on = false;
  useAudioStore.setState({ muted: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('[QS-4] Listen and Pick (and the Quick check): the confirm ends before the next round', () => {
  const rounds = [symbolRound('jamo:giyeok'), symbolRound('jamo:nieun')];
  const scope: MinigameScope = { kind: 'listen-pick', rounds: 2, listenPick: { rounds } };
  const round2 = (r: ReactTestRenderer): boolean => byTestId(r.root, `listen-pick-option-${rounds[1]!.answerId}`).length > 0 && screenTexts(r.root).includes('2 / 2');

  it('held until the confirm ends', async () => {
    const r = await open(<ListenPickGame scope={scope} host={host()} />);
    audio.hold = true;
    await press(pressable(r.root, `listen-pick-option-${rounds[0]!.answerId}`));
    expect(audio.said).toHaveLength(1); // the confirm
    await heldUntilTheSoundEnds(LISTEN_PICK_TIMING.advanceDelayMs, () => round2(r));
    // The next round says its prompt as it opens (QS-3: no wait after the first round).
    expect(audio.said).toHaveLength(2);
  });

  it('released at the cap, and the last round completes the step the same way', async () => {
    const h = host();
    const r = await open(<ListenPickGame scope={{ ...scope, rounds: 1, listenPick: { rounds: [rounds[0]!] } }} host={h} />);
    audio.hold = true;
    await press(pressable(r.root, `listen-pick-option-${rounds[0]!.answerId}`));
    await releasedAtTheCap(LISTEN_PICK_TIMING.advanceDelayMs, () => h.completes === 1);
  });

  it('a confirm that has ended does not add to the 700 ms', async () => {
    const r = await open(<ListenPickGame scope={scope} host={host()} />);
    await press(pressable(r.root, `listen-pick-option-${rounds[0]!.answerId}`));
    await tick(LISTEN_PICK_TIMING.advanceDelayMs - 1);
    expect(round2(r)).toBe(false);
    await tick(1);
    expect(round2(r)).toBe(true);
  });
});

describe('[QS-4] Match Sound: nothing is said on an answer, so the prompt that is still sounding ends first', () => {
  const L1 = ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'];
  const scope: MinigameScope = { kind: 'match-sound', jamoIds: L1, rounds: 2 };
  const tile = (root: ReactTestInstance, jamoId: string): ReactTestInstance => pressable(root, `match-sound-tile-${jamoId}`);

  it('held until the prompt ends, then released; at the cap when it never ends', async () => {
    const finish = vi.fn();
    const r = await open(<MatchSoundGame scope={scope} onFinish={finish} />);
    audio.hold = true;
    await tick(SCREEN_SETTLE_MS);
    expect(audio.said).toHaveLength(1);
    await press(tile(r.root, audio.said[0]!));
    await heldUntilTheSoundEnds(700, () => audio.said.length === 2); // round 2 said its prompt: it opened
    await press(tile(r.root, audio.said[1]!));
    await releasedAtTheCap(700, () => finish.mock.calls.length === 1);
  });
});

describe('[QS-4] Read Pick: the letter\'s sound ends before the next round, with reduced motion too', () => {
  const round = (id: string, target: string): ReadPickRound => ({
    id,
    target,
    answerId: `${id}-right`,
    options: [
      { id: `${id}-right`, sound: 'n' },
      { id: `${id}-other`, sound: 'm' },
    ],
  });
  const scope: MinigameScope = { kind: 'match-shape', rounds: 2, readPick: { rounds: [round('r1', 'jamo:nieun'), round('r2', 'jamo:mieum')] } };
  const round2 = (r: ReactTestRenderer): boolean => byTestId(r.root, 'read-pick-option-r2-right').length > 0;

  it('held until the sound ends', async () => {
    const r = await open(<ReadPickGame scope={scope} host={host()} />);
    audio.hold = true;
    await press(pressable(r.root, 'read-pick-option-r1-right'));
    await heldUntilTheSoundEnds(motion.duration.celebration, () => round2(r));
  });

  it('with reduced motion the least wait is 0, and the sound still ends first; the cap releases it', async () => {
    reduced.on = true;
    const h = host();
    const r = await open(<ReadPickGame scope={scope} host={h} />);
    audio.hold = true;
    await press(pressable(r.root, 'read-pick-option-r1-right'));
    await tick(1200);
    expect(round2(r)).toBe(false);
    await endAll();
    expect(round2(r)).toBe(true);
    await tick(400);
    await press(pressable(r.root, 'read-pick-option-r2-right'));
    await tick(ANSWER_SOUND_MAX_MS - 1);
    expect(h.completes).toBe(0);
    await tick(1);
    expect(h.completes).toBe(1);
  });

  it('with reduced motion and no sound left to wait for, the next round opens at once', async () => {
    reduced.on = true;
    const r = await open(<ReadPickGame scope={scope} host={host()} />);
    await press(pressable(r.root, 'read-pick-option-r1-right'));
    await tick(0);
    expect(round2(r)).toBe(true);
  });
});

describe('[QS-4] Card Match: the step ends once the word that is being said has ended (and the result floor of F-A11Y-001 OD-AF2 (b) is the least wait)', () => {
  const PAIRS = [
    { ko: '그네', en: 'swing', romanization: 'geune' },
    { ko: '모래', en: 'sand', romanization: 'morae' },
  ];
  const scope = { kind: 'card-match', rounds: PAIRS.length, cardPairs: PAIRS } as unknown as MinigameScope;
  const card = (r: ReactTestRenderer, side: 'ko' | 'en', idx: number): ReactTestInstance => byTestId(r.root, `card-match-${side}-${idx}`).find((n) => n.props.role === 'button')!;
  const matchAll = async (r: ReactTestRenderer): Promise<void> => {
    for (const idx of [0, 1]) {
      await tick(500);
      await press(card(r, 'ko', idx));
      await tick(500);
      await press(card(r, 'en', idx));
    }
  };

  it('held until the last word ends', async () => {
    const finish = vi.fn();
    const r = await open(<CardMatchGame scope={scope} onFinish={finish} />);
    audio.hold = true;
    await matchAll(r);
    await heldUntilTheSoundEnds(RESULT_MARK_MIN_MS, () => finish.mock.calls.length === 1);
  });

  it('released at the cap', async () => {
    const finish = vi.fn();
    const r = await open(<CardMatchGame scope={scope} onFinish={finish} />);
    audio.hold = true;
    await matchAll(r);
    await releasedAtTheCap(RESULT_MARK_MIN_MS, () => finish.mock.calls.length === 1);
  });
});

describe('[QS-4] Culture Quiz: a word that is still sounding ends before the next round (and the result floor of F-A11Y-001 OD-AF2 (b) is the least wait)', () => {
  const PAIRS = [
    { ko: '그네', en: 'swing', romanization: 'geune' },
    { ko: '모래', en: 'sand', romanization: 'morae' },
    { ko: '공', en: 'ball', romanization: 'gong' },
    { ko: '미끄럼틀', en: 'slide', romanization: 'mikkeureomteul' },
  ];
  const scope = { kind: 'culture-quiz', rounds: 2, cardPairs: PAIRS } as unknown as MinigameScope;
  const asked = (r: ReactTestRenderer): string => PAIRS.find((p) => screenTexts(r.root).includes(p.ko))!.ko;
  const answer = async (r: ReactTestRenderer): Promise<string> => {
    const pair = PAIRS.find((p) => p.ko === asked(r))!;
    await press(pressable(r.root, 'culture-quiz-hear'));
    await tick(500);
    await press(buttonsNamed(r.root, pair.en)[0]!);
    return pair.ko;
  };

  it('held until the word ends, then released; at the cap when it never ends', async () => {
    const finish = vi.fn();
    const r = await open(<CultureQuizGame scope={scope} onFinish={finish} />);
    audio.hold = true;
    const first = await answer(r);
    await heldUntilTheSoundEnds(RESULT_MARK_MIN_MS - 500, () => asked(r) !== first);
    await tick(500);
    await answer(r);
    await releasedAtTheCap(RESULT_MARK_MIN_MS, () => finish.mock.calls.length === 1);
  });
});

describe('[QS-4] Syllable Build: the built word ends before the next round', () => {
  const BAP = { ko: '밥', romanization: 'bap', gloss: 'rice, a meal' };
  const TILES = { firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'] };
  const build = async (r: ReactTestRenderer): Promise<void> => {
    for (const id of ['final:ㅂ', 'first:ㅂ', 'vowel:ㅏ']) {
      await tick(500);
      await press(pressable(r.root, `syllable-build-tile-${id}`));
    }
  };

  it('held until the word ends', async () => {
    const solved = vi.fn();
    const r = await open(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={() => undefined} onSolved={solved} />);
    audio.hold = true;
    await build(r);
    await heldUntilTheSoundEnds(SOLVED_PAUSE_MS, () => solved.mock.calls.length === 1);
  });

  it('released at the cap', async () => {
    const solved = vi.fn();
    const r = await open(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={() => undefined} onSolved={solved} />);
    audio.hold = true;
    await build(r);
    await releasedAtTheCap(SOLVED_PAUSE_MS, () => solved.mock.calls.length === 1);
  });
});
