import { sayRef } from '@hangul-route/content-schema';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { clipRegistry } from '../../platform/audio-assets-store';
import { useAudioStore } from '../../store/audio-store';
import { byTestId, render, unmount } from '../../test-support/render';

/**
 * AMENDMENTS-AUDIO-CLIPS AC-B6 (row AC-6 review): a say clip of a pack outside the start map reaches the registry
 * only when its pack chunk lands, after the prompt slot first rendered. On a device with no Korean voice the slot
 * must not keep saying "no Korean voice" once the clip is in: the slot re-renders its caller when a chunk is added,
 * and the caller's `hasClip` (read from the registry) clears the text.
 */

const TEXT = '가방';
const REF = sayRef(TEXT);

function Probe(): ReactElement {
  const slot = usePromptSlot({ source: 'probe', hasClip: clipRegistry.has(REF), textOnScreen: true });
  return <Text testID="probe">{`${slot.view.reason ?? 'none'}|${String(slot.view.textShown)}`}</Text>;
}

const initial = useAudioStore.getState();

beforeEach(() => {
  useAudioStore.setState({ muted: false, tts: { state: 'none', reason: 'no_korean_voice' }, clips: true, unlocked: true });
});

afterEach(() => {
  useAudioStore.setState(initial, true);
});

function shown(r: Awaited<ReturnType<typeof render>>): string {
  const node = byTestId(r.root, 'probe')[0];
  return String(node?.props.children ?? '');
}

describe('a prompt slot whose clip arrives in a late pack chunk', () => {
  it('shows the no-voice text before the chunk, and clears it once the chunk adds the clip', async () => {
    expect(clipRegistry.has(REF)).toBe(false);
    const r = await render(<Probe />);
    expect(shown(r)).toBe('no_voice|true');
    await act(async () => {
      clipRegistry.add({ pack: 'stage2', clips: { [REF]: 'gabang.mp3' }, units: {} });
    });
    expect(shown(r)).toBe('none|false');
    await unmount(r);
  });
});
