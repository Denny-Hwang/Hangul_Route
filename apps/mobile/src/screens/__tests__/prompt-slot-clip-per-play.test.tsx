import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import type { ClipLookup } from '../../logic/audio/controller';
import { useAudioStore } from '../../store/audio-store';
import { byTestId, render, unmount } from '../../test-support/render';

/**
 * [FU] AMENDMENTS-FOLLOWUPS-2026-11 FU-3: a screen with many words behind one prompt slot (Card Match, a story page,
 * the word list) cannot say up front which word plays next, so it tells the slot with each play what that play says.
 * On a device with no Korean voice, a word whose recording is bundled then plays it (clip, then voice, then text: AD4)
 * and the slot does not say "No Korean voice on this device." over it; a word with no recording still does.
 */

const CLIPPED = '가방';
vi.mock('../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../platform/audio')>()),
  noteFallbackShown: () => undefined,
  hasClipFor: (spec: ClipLookup) => spec.text === CLIPPED && (spec.language ?? 'ko-KR') === 'ko-KR',
}));

let slotNow: PromptSlot | null = null;
function Probe(): ReactElement {
  const slot = usePromptSlot({ source: 'probe', textOnScreen: true });
  slotNow = slot;
  return <Text testID="probe">{`${slot.view.reason ?? 'none'}|${String(slot.view.statusShown)}`}</Text>;
}

const initial = useAudioStore.getState();

beforeEach(() => {
  useAudioStore.setState({ muted: false, tts: { state: 'none', reason: 'no_korean_voice' }, clips: true, unlocked: true, voiceCheckPending: false });
});

afterEach(() => {
  useAudioStore.setState(initial, true);
  slotNow = null;
});

const shown = (r: Awaited<ReturnType<typeof render>>): string => String(byTestId(r.root, 'probe')[0]?.props.children ?? '');

describe('a prompt slot told what each play says', () => {
  it('a word with a bundled recording: no "no voice" status after it plays', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      await slotNow!.play(() => Promise.resolve('played'), { text: CLIPPED });
    });
    expect(shown(r)).toBe('none|false');
    await unmount(r);
  });

  it('a word with no recording still says there is no Korean voice', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      await slotNow!.play(() => Promise.resolve('played'), { text: '나무' });
    });
    expect(shown(r)).toBe('no_voice|true');
    await unmount(r);
  });

  it('a chain counts as recorded when every Korean step has a recording (an English step has none and is not asked)', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      await slotNow!.play(() => Promise.resolve('played'), [{ text: 'A bag.', language: 'en-US' }, { text: CLIPPED }]);
    });
    expect(shown(r)).toBe('none|false');
    await act(async () => {
      await slotNow!.play(() => Promise.resolve('played'), [{ text: CLIPPED }, { text: '나무' }]);
    });
    expect(shown(r)).toBe('no_voice|true');
    await unmount(r);
  });

  it('a new round forgets the last word', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      await slotNow!.play(() => Promise.resolve('played'), { text: CLIPPED });
    });
    await act(async () => {
      slotNow!.reset();
      await slotNow!.play(() => Promise.resolve('played'));
    });
    expect(shown(r)).toBe('no_voice|true');
    await unmount(r);
  });
});
