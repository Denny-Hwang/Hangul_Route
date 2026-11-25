import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import { useAudioStore } from '../../store/audio-store';
import { byTestId, render, unmount } from '../../test-support/render';

// As prompt-slot-settled.test.tsx: reporting a shown fallback would start the real audio platform.
vi.mock('../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../platform/audio')>()), noteFallbackShown: () => undefined }));

/**
 * The "Can't hear it?" slot (AMENDMENTS-AUDIO-CANT-HEAR section 3.6 and test 10): `slot.cantHear` is true while no text
 * shows, `cantHearActive` once the voice check is over, `showLetters()` brings the text up (and settles the slot), and
 * `reset()` brings the link back.
 */

let slot: PromptSlot | null = null;

function Probe({ cantHear = true, guidanceOnly = false }: { cantHear?: boolean; guidanceOnly?: boolean }): ReactElement {
  slot = usePromptSlot({ source: 'probe', cantHear, guidanceOnly });
  return <Text testID="probe">{`${String(slot.cantHear)}|${String(slot.cantHearActive)}|${String(slot.settled)}|${String(slot.view.textShown)}`}</Text>;
}

const initial = useAudioStore.getState();
const READY = { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' } as const;

beforeEach(() => {
  slot = null;
  useAudioStore.setState({ muted: false, showLetters: false, tts: { state: 'unknown' }, clips: false, unlocked: true, voiceCheckPending: true });
});

afterEach(() => {
  useAudioStore.setState(initial, true);
});

const shown = (r: Awaited<ReturnType<typeof render>>): string => String(byTestId(r.root, 'probe')[0]?.props.children ?? '');

describe('slot.cantHear and slot.cantHearActive', () => {
  it('the link is drawn from the start but inactive while the voice check holds, and active once it is over', async () => {
    const r = await render(<Probe />);
    // cantHear | cantHearActive | settled | textShown
    expect(shown(r)).toBe('true|false|false|false');
    await act(async () => {
      useAudioStore.setState({ tts: READY, voiceCheckPending: false });
    });
    expect(shown(r)).toBe('true|true|true|false');
    await unmount(r);
  });

  it('an option that is not set never shows the link', async () => {
    useAudioStore.setState({ voiceCheckPending: false });
    const r = await render(<Probe cantHear={false} />);
    expect(shown(r)).toBe('false|false|true|false');
    await unmount(r);
  });

  it('is false in each text state: sound off, no Korean voice, a failed play and a blocked play', async () => {
    useAudioStore.setState({ voiceCheckPending: false, muted: true });
    const muted = await render(<Probe />);
    expect(shown(muted).startsWith('false|false|')).toBe(true);
    await unmount(muted);

    useAudioStore.setState({ muted: false, tts: { state: 'none', reason: 'no_korean_voice' } });
    const noVoice = await render(<Probe />);
    expect(shown(noVoice).startsWith('false|false|')).toBe(true);
    await unmount(noVoice);

    for (const failure of ['error', 'blocked'] as const) {
      useAudioStore.setState({ tts: READY, lastFailure: { reason: failure, at: 1 } });
      const r = await render(<Probe />);
      expect(shown(r).startsWith('true|true|')).toBe(true);
      await act(async () => {
        await slot!.play(async () => 'unavailable');
      });
      expect(shown(r).startsWith('false|false|')).toBe(true);
      expect(slot!.view.reason).toBe(failure);
      await unmount(r);
    }
  });
});

describe('slot.showLetters()', () => {
  it('brings the text up and settles the slot while the voice check is still running', async () => {
    const r = await render(<Probe />);
    expect(shown(r)).toBe('true|false|false|false');
    expect(useAudioStore.getState().voiceCheckPending).toBe(true);
    await act(async () => {
      slot!.showLetters();
    });
    expect(shown(r)).toBe('false|false|true|true');
    expect(slot!.view.reason).toBeNull();
    expect(slot!.view.helpLabel).toBeNull();
    expect(useAudioStore.getState().voiceCheckPending).toBe(true);
    await unmount(r);
  });

  it('the text stays through a successful play and through the voices loading late', async () => {
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' }, voiceCheckPending: false });
    const r = await render(<Probe />);
    await act(async () => {
      slot!.showLetters();
    });
    await act(async () => {
      await slot!.play(async () => 'played');
    });
    await act(async () => {
      useAudioStore.setState({ tts: READY });
    });
    expect(slot!.view.textShown).toBe(true);
    expect(slot!.view.reason).toBeNull();
    await unmount(r);
  });

  it('reset() forgets the ask and brings the link back for the next round', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      slot!.showLetters();
    });
    expect(slot!.view.textShown).toBe(true);
    await act(async () => {
      slot!.reset();
    });
    expect(slot!.view.textShown).toBe(false);
    expect(slot!.cantHear).toBe(true);
    await unmount(r);
  });
});

describe('slot with Always show the letters on (AMENDMENTS-AUDIO-CANT-HEAR CH-2, test 23)', () => {
  it('opens with the text, settled while the voice check still runs, and no link', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await render(<Probe />);
    expect(shown(r)).toBe('false|false|true|true');
    expect(slot!.view.reason).toBeNull();
    expect(slot!.view.statusShown).toBe(false);
    expect(useAudioStore.getState().voiceCheckPending).toBe(true);
    await unmount(r);
  });

  it('reaches a round that is already open when the switch turns on, and goes when it turns off', async () => {
    const r = await render(<Probe />);
    expect(shown(r)).toBe('true|false|false|false');
    await act(async () => {
      useAudioStore.getState().setShowLetters(true);
    });
    expect(slot!.view.textShown).toBe(true);
    await act(async () => {
      useAudioStore.getState().setShowLetters(false);
    });
    expect(slot!.view.textShown).toBe(false);
    await unmount(r);
  });

  it('the text is there on the next round too: reset() does not take it away', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await render(<Probe />);
    await act(async () => {
      slot!.reset();
    });
    expect(slot!.view.textShown).toBe(true);
    await unmount(r);
  });

  it('a surface that did not opt in keeps its sound-only round', async () => {
    useAudioStore.setState({ showLetters: true, voiceCheckPending: false });
    const r = await render(<Probe cantHear={false} />);
    expect(shown(r)).toBe('false|false|true|false');
    await unmount(r);
  });

  it('a guidance-only round (a cue settles it, the Korean is its answer) shows no text and keeps its link', async () => {
    useAudioStore.setState({ showLetters: true, voiceCheckPending: false, tts: READY });
    const r = await render(<Probe guidanceOnly />);
    expect(shown(r)).toBe('true|true|true|false');
    await unmount(r);
  });

  it('the sound still plays and the text stays: a successful play does not hide it', async () => {
    useAudioStore.setState({ showLetters: true, tts: READY, voiceCheckPending: false });
    const r = await render(<Probe />);
    await act(async () => {
      await slot!.play(async () => 'played');
    });
    expect(slot!.view.textShown).toBe(true);
    expect(slot!.view.reason).toBeNull();
    await unmount(r);
  });
});
