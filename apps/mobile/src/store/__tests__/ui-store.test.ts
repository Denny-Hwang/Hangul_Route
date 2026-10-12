import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../ui-store';

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({ hapticsOn: true, parentGateOpenedAt: null, lastPinVerifiedAt: null, tabBarHeight: 0 });
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

  it('tabBarHeight starts at 0 (no tab bar) and follows setTabBarHeight (F-LAYOUT-001 PR 2b)', () => {
    expect(useUiStore.getState().tabBarHeight).toBe(0);
    useUiStore.getState().setTabBarHeight(76);
    expect(useUiStore.getState().tabBarHeight).toBe(76);
    useUiStore.getState().setTabBarHeight(0);
    expect(useUiStore.getState().tabBarHeight).toBe(0);
  });

  /**
   * F-APP-001 section 3.9 (A-6): the time of the last correct PIN on the PIN screen, in memory
   * only, for the 2-minute fresh-PIN rule of the grown-up hand-off. A gate the 15-minute
   * session opens directly never sets it.
   */
  it('markPinVerified stamps the time of a correct PIN, in memory only', () => {
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    useUiStore.getState().markPinVerified();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeTypeOf('number');
  });

  it('opening the gate through the 15-minute session does not count as a PIN entry', () => {
    useUiStore.getState().openParentGate();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
  });
});
