import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useAudioStore } from '../../store/audio-store';
import { byTestId, render, unmount } from '../../test-support/render';

/**
 * `slot.settled` (AMENDMENTS-TOUCH: nothing moves under a finger): while the voice check runs, the "No sound? Read it
 * here." text may still come in above the answers, so the screen holds them (`<TapBoard held={!slot.settled}>`). The
 * text and the answers then show in the same render, and answers once shown are never held again.
 */

function Probe({ hasClip = false }: { hasClip?: boolean }): ReactElement {
  const slot = usePromptSlot({ source: 'probe', hasClip });
  return <Text testID="probe">{`${String(slot.settled)}|${String(slot.view.textShown)}`}</Text>;
}

const initial = useAudioStore.getState();

beforeEach(() => {
  useAudioStore.setState({ muted: false, tts: { state: 'unknown' }, clips: false, unlocked: true, voiceCheckPending: true });
});

afterEach(() => {
  useAudioStore.setState(initial, true);
});

const shown = (r: Awaited<ReturnType<typeof render>>): string => String(byTestId(r.root, 'probe')[0]?.props.children ?? '');

describe('a prompt slot while the voice check runs', () => {
  it('is not settled and shows no text; when the check finds no voice, the text and settled come in the same render', async () => {
    const r = await render(<Probe />);
    expect(shown(r)).toBe('false|false');
    await act(async () => {
      useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' }, voiceCheckPending: false });
    });
    expect(shown(r)).toBe('true|true');
    await unmount(r);
  });

  it('a voice found: settled, no text', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      useAudioStore.setState({ tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' }, voiceCheckPending: false });
    });
    expect(shown(r)).toBe('true|false');
    await unmount(r);
  });

  it('sound off or a bundled clip: settled at once (the check cannot change the text)', async () => {
    useAudioStore.setState({ muted: true });
    const muted = await render(<Probe />);
    expect(shown(muted)).toBe('true|true');
    await unmount(muted);
    useAudioStore.setState({ muted: false, clips: true });
    const clip = await render(<Probe hasClip />);
    expect(shown(clip)).toBe('true|false');
    await unmount(clip);
  });

  it('once settled, stays settled even if the store says pending again', async () => {
    useAudioStore.setState({ voiceCheckPending: false });
    const r = await render(<Probe />);
    expect(shown(r).startsWith('true|')).toBe(true);
    await act(async () => {
      useAudioStore.setState({ voiceCheckPending: true });
    });
    expect(shown(r).startsWith('true|')).toBe(true);
    await unmount(r);
  });
});
