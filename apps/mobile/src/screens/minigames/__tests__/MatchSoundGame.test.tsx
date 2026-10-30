import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import { jamoVoice } from '../../../logic/audio/jamo-voice';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { MatchSoundGame } from '../MatchSoundGame';

/**
 * Match Sound over the shipped web audio adapter and FakeSpeechSynthesis (AMENDMENTS-AUDIO-CLIPS
 * section 6.2, row JV-2): a letter question says the letter's name (ㄴ is 니은) and the wrong-answer
 * bubble names it ("니은 · nieun"); a wrong tap then a quick right tap never lets the replay of the
 * old prompt play over the next round (M6).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const AUDIO = getMessages('en').learner.audio;
const L1 = ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'];
/** The letter a prompt names (or, as the timing check needs no voice rule, sounds). */
const NAME_OF = new Map(
  jamoAll.filter((j) => L1.includes(j.id)).flatMap((j) => [[jamoVoice(j, 'sound').text, j.id] as const, [jamoVoice(j, 'letter').text, j.id] as const]),
);
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-29T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  useAudioStore.setState({ muted: false });
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const tile = (root: ReactTestInstance, jamoId: string): ReactTestInstance => {
  const node = byTestId(root, `match-sound-tile-${jamoId}`).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no tile ${jamoId}`);
  return node;
};
const spoken = (): string[] => rig.current!.synth.spoken.map((u) => u.text);

async function play(scope: MinigameScope): Promise<ReactTestRenderer> {
  const r = await render(<MatchSoundGame scope={scope} onFinish={() => undefined} />);
  mounted.push(r);
  await tick(0);
  return r;
}

describe('MatchSoundGame says the letter name (JV-A1) and its bubble names it (JV-A4)', () => {
  it('a ㄴ round says 니은, and after a miss the bubble reads "Listen again. This letter is" 니은 · nieun', async () => {
    const r = await play({ kind: 'match-sound', jamoIds: L1, rounds: 1, focusJamoIds: ['jamo:nieun'] });
    expect(spoken()).toEqual(['니은']);
    expect(spoken()).not.toContain('나');

    await press(tile(r.root, 'jamo:a'));
    const bubble = byTestId(r.root, 'match-sound-bubble')[0]!;
    expect(textOf(bubble)).toContain(AUDIO.listenAgainLetter);
    expect(textOf(bubble)).toContain('니은');
    expect(textOf(bubble)).toContain('nieun');
    expect(textOf(bubble)).not.toContain(AUDIO.listenAgain);
  });
});

describe('M6: no stale replay over the next round', () => {
  it('a wrong tap then the right tap within 100 ms: the old prompt never plays after the advance', async () => {
    const r = await play({ kind: 'match-sound', jamoIds: L1, rounds: 2 });
    const [first] = spoken();
    const target = NAME_OF.get(first!);
    expect(target, `the first prompt "${first}" is one of the four names`).toBeDefined();
    const wrong = L1.find((id) => id !== target)!;

    await press(tile(r.root, wrong));
    await tick(60);
    await press(tile(r.root, target!));
    // The 700 ms advance opens round 2, which says its own prompt; the 800 ms replay of round 1 is gone.
    await tick(700);
    const afterAdvance = spoken();
    expect(afterAdvance).toHaveLength(2);
    expect(afterAdvance[1]).not.toBe(first);
    await tick(2_000);
    expect(spoken()).toEqual(afterAdvance);
  });

  it('a miss alone still replays the prompt after 800 ms', async () => {
    const r = await play({ kind: 'match-sound', jamoIds: L1, rounds: 2, focusJamoIds: ['jamo:giyeok'] });
    const [first] = spoken();
    const target = NAME_OF.get(first!)!;
    await press(tile(r.root, L1.find((id) => id !== target)!));
    await tick(799);
    expect(spoken()).toEqual([first]);
    await tick(2);
    expect(spoken()).toEqual([first, first]);
  });
});
