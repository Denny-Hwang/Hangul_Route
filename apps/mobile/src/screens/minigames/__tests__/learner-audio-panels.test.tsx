import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { validBoards } from '../../../logic/pic-word-flow';
import { REALIA_FIXTURES } from '../../../navigation/realia-read-e2e-fixture';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { MinigameScreen } from '../MinigameScreen';
import { PicWordMatchGame } from '../PicWordMatchGame';
import { RealiaReadGame } from '../RealiaReadGame';
import { StorySequenceGame } from '../StorySequenceGame';
import { TraceStrokeGame } from '../TraceStrokeGame';
import { TraceWordGame } from '../TraceWordGame';
import { VocabCardsScreen } from '../../vocab/VocabCardsScreen';

/**
 * The learner audio pass, review of #740 (F-AUDIO-004 §3.8, A-5b), through the shipped web audio
 * adapter over FakeSpeechSynthesis: Realia Read and the Story Order replay say why a line is silent;
 * Pic-Word Match's panel replays the matched word and a new pair starts clean; Trace Stroke's compact
 * row shows for Show me, never for the opening sound; a trace game's row never appears mid-stroke;
 * leaving a game stops the voice.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null, stops: 0 }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const bound = (await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!);
  return {
    ...(await importOriginal<object>()),
    ...bound,
    stop: () => {
      rig.stops += 1;
      bound.stop();
    },
  };
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));
// Motion allowed, so the Story Order replay moves on by itself (the render lane's default is reduced motion).
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
// The native gesture handler has no build that loads in Node: a Pan whose callbacks the test calls, a detector
// that draws its child.
const pan = vi.hoisted(() => ({ latest: {} as Record<string, (e?: { x: number; y: number }) => void> }));
vi.mock('react-native-gesture-handler', () => {
  const Pan = () => {
    const handlers: Record<string, (e?: { x: number; y: number }) => void> = {};
    pan.latest = handlers;
    const builder = {
      onBegin: (fn: (e?: { x: number; y: number }) => void) => ((handlers.begin = fn), builder),
      onUpdate: (fn: (e?: { x: number; y: number }) => void) => ((handlers.update = fn), builder),
      onEnd: (fn: () => void) => ((handlers.end = fn), builder),
      onFinalize: (fn: () => void) => ((handlers.finalize = fn), builder),
    };
    return builder;
  };
  return {
    Gesture: { Pan },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
// The native navigation package has no build that loads in Node.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
// Show me's animated demonstration draws with reanimated's animated SVG, which the render lane stands in for.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const AUDIO = getMessages('en').learner.audio;
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  rig.stops = 0;
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  useAudioStore.setState({ muted: false });
});

const host = (): MinigameHost => ({ mode: 'quest', answer: () => undefined, complete: () => undefined });
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const settle = async (ms = 20): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const said = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
const detail = (root: ReactTestInstance, id: string): string | null => {
  const node = byTestId(root, `${id}-detail`)[0];
  return node ? textOf(node) : null;
};
/** Lets every `onLayout` report a size, as a device does after its first frame (the trace games draw nothing before). */
async function layOut(r: ReactTestRenderer, width = 390, height = 760): Promise<void> {
  for (let pass = 0; pass < 3; pass += 1) {
    const views = r.root.findAll((n) => typeof n.props.onLayout === 'function' && typeof n.type !== 'string');
    await act(async () => {
      for (const v of views) (v.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    });
  }
}

describe('Realia Read: a silent line or option says why', () => {
  it('sound off: a line tap shows Sound is off under the sheet, and Turn sound on says that line', async () => {
    useAudioStore.setState({ muted: true });
    const r = await render(
      <RomanizationModeOverride mode="always">
        <RealiaReadGame scope={REALIA_FIXTURES.menu as MinigameScope} host={host()} />
      </RomanizationModeOverride>,
    );
    mounted.push(r);
    // Nothing is said before a tap.
    expect(detail(r.root, 'realia-read-line-sound')).toBeNull();
    await press(pressable(r.root, 'realia-read-sheet-line-gimbap'));
    await settle();
    expect(detail(r.root, 'realia-read-line-sound')).toBe(AUDIO.soundIsOff);
    expect(detail(r.root, 'realia-read-option-sound')).toBeNull();
    const [action] = buttonsNamed(byTestId(r.root, 'realia-read-line-sound')[0]!, AUDIO.action.turn_on.cta);
    expect(action).toBeDefined();
    expect(said()).toEqual([]);

    await press(action!);
    await settle();
    expect(useAudioStore.getState().muted).toBe(false);
    expect(rig.current!.synth.spoken.map((u) => [u.text, u.lang])).toEqual([['김밥 2,000원', 'ko-KR']]);
    expect(byTestId(r.root, 'realia-read-line-sound-action')).toHaveLength(0);
  });

  it('a different line is a new prompt: the last line\'s "Try again" never shows while the next one plays', async () => {
    const r = await render(
      <RomanizationModeOverride mode="always">
        <RealiaReadGame scope={REALIA_FIXTURES.menu as MinigameScope} host={host()} />
      </RomanizationModeOverride>,
    );
    mounted.push(r);
    rig.current!.synth.failNext('synthesis-failed');
    await press(pressable(r.root, 'realia-read-sheet-line-gimbap'));
    await settle();
    expect(buttonsNamed(r.root, AUDIO.action.try_again.cta).length).toBeGreaterThan(0);
    rig.current!.synth.holdUntil(new Promise<void>(() => undefined));
    await press(pressable(r.root, 'realia-read-sheet-line-ramyeon'));
    await settle();
    expect(said()).toHaveLength(2);
    expect(buttonsNamed(r.root, AUDIO.action.try_again.cta)).toHaveLength(0);
    expect(detail(r.root, 'realia-read-line-sound')).toBeNull();
  });
});

describe('Story Order replay: the replay line says why it is silent', () => {
  const steps = [
    { id: 'a', labelEn: 'Hoya wakes up.', labelKo: '호야가 일어나요.', romanization: 'hoyaga ireonayo' },
    { id: 'b', labelEn: 'Hoya eats rice.', labelKo: '호야가 밥을 먹어요.', romanization: 'hoyaga bapeul meogeoyo' },
  ];

  it('sound off: the replay card shows Sound is off, and Turn sound on says the line at the sentence rate', async () => {
    useAudioStore.setState({ muted: true });
    const r = await render(
      <StorySequenceGame scope={{ kind: 'story-sequence', rounds: 1, storySteps: steps }} onFinish={() => undefined} sequenceId="t" nonce={1} />,
    );
    mounted.push(r);
    for (const s of steps) await press(pressable(r.root, `story-sequence-card-${s.id}`));
    await settle();
    expect(textOf(byTestId(r.root, 'story-sequence-replay-ko')[0]!)).toContain('호야가 일어나요.');
    expect(detail(r.root, 'story-sequence-replay-sound')).toBe(AUDIO.soundIsOff);
    // Pause, so the replay stays on this line.
    await press(pressable(r.root, 'story-sequence-replay-pause'));
    const [action] = buttonsNamed(byTestId(r.root, 'story-sequence-replay-sound')[0]!, AUDIO.action.turn_on.cta);
    expect(action).toBeDefined();
    await press(action!);
    await settle();
    expect(useAudioStore.getState().muted).toBe(false);
    expect(said()).toEqual(['호야가 일어나요.']);
  });

  it('a tap on the replay line plays through the slot: no voice shows the status under it', async () => {
    rig.current = createAudioRig({ voices: [] });
    const r = await render(
      <StorySequenceGame scope={{ kind: 'story-sequence', rounds: 1, storySteps: steps }} onFinish={() => undefined} sequenceId="t" nonce={1} />,
    );
    mounted.push(r);
    for (const s of steps) await press(pressable(r.root, `story-sequence-card-${s.id}`));
    await press(pressable(r.root, 'story-sequence-replay-pause'));
    await press(pressable(r.root, 'story-sequence-replay-ko'));
    await settle();
    expect(detail(r.root, 'story-sequence-replay-sound')).toBe(AUDIO.noKoreanVoiceSentence);
    expect(byTestId(r.root, 'story-sequence-replay-sound-help').length).toBeGreaterThan(0);
  });
});

describe('Pic-Word Match: the matched word says why it is silent', () => {
  const scope = scopeFor('minigame:s1-life-q1-apply')!;
  const pairs = validBoards(scope)[0]!.pairs;
  const match = async (r: ReactTestRenderer, pairId: string): Promise<void> => {
    await press(pressable(r.root, `pic-word-picture-${pairId}`));
    await press(pressable(r.root, `pic-word-word-${pairId}`));
    await settle();
  };

  it('sound off: a match shows Sound is off, and its action says the same word', async () => {
    useAudioStore.setState({ muted: true });
    const r = await render(<PicWordMatchGame scope={scope} host={host()} />);
    mounted.push(r);
    expect(detail(r.root, 'pic-word-sound')).toBeNull();
    await match(r, pairs[0]!.id);
    expect(detail(r.root, 'pic-word-sound')).toBe(AUDIO.soundIsOff);
    const [action] = buttonsNamed(byTestId(r.root, 'pic-word-sound')[0]!, AUDIO.action.turn_on.cta);
    await press(action!);
    await settle();
    expect(said()).toEqual([pairs[0]!.word.spokenKo ?? pairs[0]!.word.ko]);
  });

  it('matching a different pair clears the last pair\'s "Try again" while the new word plays', async () => {
    const r = await render(<PicWordMatchGame scope={scope} host={host()} />);
    mounted.push(r);
    rig.current!.synth.failNext('synthesis-failed');
    await match(r, pairs[0]!.id);
    expect(buttonsNamed(r.root, AUDIO.action.try_again.cta).length).toBeGreaterThan(0);
    rig.current!.synth.holdUntil(new Promise<void>(() => undefined));
    await match(r, pairs[1]!.id);
    expect(said()).toHaveLength(2);
    expect(buttonsNamed(r.root, AUDIO.action.try_again.cta)).toHaveLength(0);
    expect(detail(r.root, 'pic-word-sound')).toBeNull();
  });
});

describe('Trace Stroke: the compact row', () => {
  const scope = scopeFor('minigame:s1-letters-q2-apply')!;

  it('no Korean voice: the opening sound shows nothing; Show me shows the row with the help link', async () => {
    rig.current = createAudioRig({ voices: [] });
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    await settle();
    // The opening sound is outside the slot: its result never adds the row.
    expect(detail(r.root, 'trace-stroke-sound')).toBeNull();
    expect(byTestId(r.root, 'trace-stroke-sound-help')).toHaveLength(0);
    const [showMe] = buttonsNamed(r.root, getMessages('en').learner.minigame.trace.showMe.cta);
    await press(showMe!);
    await settle();
    expect(detail(r.root, 'trace-stroke-sound')).toBe(AUDIO.noKoreanVoiceSentence);
    expect(byTestId(r.root, 'trace-stroke-sound-help').length).toBeGreaterThan(0);
  });

  it('a result that comes in mid-stroke waits for the stroke to end (the canvas never moves under the finger)', async () => {
    // iOS outside a gesture: the speak is dropped and given up after the controller's start timeout.
    rig.current = createAudioRig({ voices: [KO_VOICE], requireGesture: true });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    const [showMe] = buttonsNamed(r.root, getMessages('en').learner.minigame.trace.showMe.cta);
    await press(showMe!);
    // The finger goes down on the canvas before the dropped speak is given up.
    await act(async () => {
      pan.latest.begin?.({ x: 40, y: 40 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(byTestId(r.root, 'trace-stroke-sound-action')).toHaveLength(0);
    // The stroke ends: the row catches up.
    await act(async () => {
      pan.latest.end?.();
      pan.latest.finalize?.();
    });
    expect(buttonsNamed(byTestId(r.root, 'trace-stroke-sound')[0]!, AUDIO.action.tap_to_hear.cta).length).toBeGreaterThan(0);
  });
});

describe('Trace a Word: the compact row waits for the stroke to end', () => {
  const scope: MinigameScope = { kind: 'trace-word', rounds: 1, traceWord: { rounds: [{ id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } }] } };

  it('a block speaker\'s late "Tap to hear" shows only once the finger is up', async () => {
    rig.current = createAudioRig({ voices: [KO_VOICE], requireGesture: true });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const r = await render(<TraceWordGame scope={scope} host={host()} />);
    mounted.push(r);
    await layOut(r);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(byTestId(r.root, 'trace-word-sound-action')).toHaveLength(0);
    const speaker = byTestId(r.root, 'trace-word-strip')[0]!.findAll((n) => n.props.role === 'button' && typeof n.props.onClick === 'function')[0]!;
    await press(speaker);
    await act(async () => {
      pan.latest.begin?.({ x: 30, y: 30 });
      pan.latest.update?.({ x: 60, y: 60 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(byTestId(r.root, 'trace-word-sound-action')).toHaveLength(0);
    await act(async () => {
      pan.latest.end?.();
      pan.latest.finalize?.();
    });
    expect(buttonsNamed(byTestId(r.root, 'trace-word-sound')[0]!, AUDIO.action.tap_to_hear.cta).length).toBeGreaterThan(0);
  });
});

describe('leaving a game stops the voice', () => {
  it('MinigameScreen calls stop() when it unmounts', async () => {
    const route = { key: 'Minigame-1', name: 'Minigame' as const, params: { questId: 'quest:none', episodeId: 'episode:none', stepIndex: 0 } };
    const r = await render(<MinigameScreen route={route as never} navigation={{ goBack: vi.fn(), navigate: vi.fn() } as never} />);
    const before = rig.stops;
    await unmount(r);
    expect(rig.stops).toBeGreaterThan(before);
  });

  it('the word cards call stop() when they unmount (Back, Stop, the done sheet)', async () => {
    const navigation = { goBack: vi.fn(), navigate: vi.fn(), replace: vi.fn(), setOptions: vi.fn(), addListener: vi.fn(() => () => undefined) };
    const route = { key: 'VocabCards-1', name: 'VocabCards' as const, params: { topicKey: 'food' } };
    const r = await render(<VocabCardsScreen route={route as never} navigation={navigation as never} />);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'vocab-cards-redirect')).toHaveLength(0);
    const before = rig.stops;
    await unmount(r);
    expect(rig.stops).toBeGreaterThan(before);
  });
});
