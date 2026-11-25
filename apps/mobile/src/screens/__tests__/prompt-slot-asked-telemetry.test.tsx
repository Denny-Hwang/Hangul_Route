import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import { useAudioStore } from '../../store/audio-store';
import { render, unmount } from '../../test-support/render';

const noted = vi.hoisted(() => vi.fn());
vi.mock('../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../platform/audio')>()), noteFallbackShown: noted }));

/**
 * AMENDMENTS-AUDIO-CANT-HEAR CH-4 (test 24, client half): Show the letters reports `audio.fallback_shown` with the
 * reason `asked` through the platform's `noteFallbackShown` (which sends once per session, source and reason); the
 * Sound off and no Korean voice paths report their own reasons, as before, and never `asked`.
 */

let slot: PromptSlot | null = null;

function Probe({ reportFallback = true }: { reportFallback?: boolean }): ReactElement {
  slot = usePromptSlot({ source: 'probe', cantHear: true, reportFallback });
  return <Text testID="probe">{String(slot.view.textShown)}</Text>;
}

const initial = useAudioStore.getState();

beforeEach(() => {
  slot = null;
  noted.mockClear();
  useAudioStore.setState({ muted: false, tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' }, clips: false, unlocked: true, voiceCheckPending: false });
});

afterEach(() => {
  useAudioStore.setState(initial, true);
});

describe('Show the letters reports reason asked', () => {
  it('once per tap, with the slot source and nothing else', async () => {
    const r = await render(<Probe />);
    expect(noted).not.toHaveBeenCalled();
    await act(async () => {
      slot!.showLetters();
    });
    expect(noted).toHaveBeenCalledTimes(1);
    expect(noted).toHaveBeenCalledWith('probe', 'asked');
    await act(async () => {
      slot!.reset();
    });
    await act(async () => {
      slot!.showLetters();
    });
    expect(noted).toHaveBeenCalledTimes(2);
    expect(noted).toHaveBeenLastCalledWith('probe', 'asked');
    await unmount(r);
  });

  it('a slot that reports no fallback reports no ask either', async () => {
    const r = await render(<Probe reportFallback={false} />);
    await act(async () => {
      slot!.showLetters();
    });
    expect(noted).not.toHaveBeenCalled();
    await unmount(r);
  });

  it('showing the asked text does not also report a failure reason', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      slot!.showLetters();
    });
    await act(async () => {
      await slot!.play(async () => 'played');
    });
    expect(noted.mock.calls).toEqual([['probe', 'asked']]);
    await unmount(r);
  });
});

describe('the Sound off and no Korean voice paths are unchanged', () => {
  it('Sound off reports muted, not asked', async () => {
    useAudioStore.setState({ muted: true });
    const r = await render(<Probe />);
    expect(noted.mock.calls).toEqual([['probe', 'muted']]);
    await unmount(r);
  });

  it('no Korean voice reports no_voice, not asked', async () => {
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    const r = await render(<Probe />);
    expect(noted.mock.calls).toEqual([['probe', 'no_voice']]);
    await unmount(r);
  });
});
