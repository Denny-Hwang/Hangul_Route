import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../ui-store';

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({ soundOn: true, hapticsOn: true, parentGateOpenedAt: null });
  });

  it('toggleSound flips soundOn back and forth', () => {
    useUiStore.getState().toggleSound();
    expect(useUiStore.getState().soundOn).toBe(false);
    useUiStore.getState().toggleSound();
    expect(useUiStore.getState().soundOn).toBe(true);
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
