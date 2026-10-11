import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../ui-store';

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({ hapticsOn: true, parentGateOpenedAt: null });
  });

  it('no longer holds the sound switch: mute lives in audio-store (F-AUDIO-004 AD7)', () => {
    const state = useUiStore.getState() as unknown as Record<string, unknown>;
    expect('soundOn' in state).toBe(false);
    expect('toggleSound' in state).toBe(false);
  });

  it('toggleHaptics flips hapticsOn', () => {
    useUiStore.getState().toggleHaptics();
    expect(useUiStore.getState().hapticsOn).toBe(false);
  });

  it('openParentGate stamps a numeric time', () => {
    useUiStore.getState().openParentGate();
    expect(useUiStore.getState().parentGateOpenedAt).toBeTypeOf('number');
  });

  it('resetParentGate clears the stamp', () => {
    useUiStore.getState().openParentGate();
    useUiStore.getState().resetParentGate();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
  });
});
