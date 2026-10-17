import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, resetPlatform, setPlatform, unmount } from '../../test-support/render';
import { useBackGuard, type BackGuardNavigation } from '../use-back-guard';

/**
 * AMENDMENTS-DISPLAY-NAV section 7.1 (row DN-4, review): a back guard answers every back that
 * reaches `beforeRemove` (the header's Back or Close, the browser and the Android back), lets a
 * screen's own ways on through, and, because native-stack cannot cancel the native iOS swipe (or a
 * modal's swipe down) from `beforeRemove`, turns the gesture off while it would hold the screen.
 */
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return { NavigationContext: createContext(undefined) };
});

type Listener = Parameters<BackGuardNavigation['addListener']>[1];

function fakeNavigation(): BackGuardNavigation & { fire: (type: string) => boolean; setOptions: ReturnType<typeof vi.fn> } {
  const listeners: Listener[] = [];
  return {
    addListener: (_type, listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    setOptions: vi.fn(),
    fire: (type) => {
      let held = false;
      for (const listener of listeners) listener({ data: { action: { type } }, preventDefault: () => (held = true) });
      return held;
    },
  };
}

function Guarded({ navigation, onBack, holds }: { navigation: BackGuardNavigation; onBack: () => boolean; holds?: boolean }): null {
  useBackGuard(navigation, onBack, holds);
  return null;
}

afterEach(() => resetPlatform());

describe('useBackGuard', () => {
  it('holds a back the screen takes itself, and never a way on', async () => {
    const navigation = fakeNavigation();
    const onBack = vi.fn(() => true);
    const r = await render(<Guarded navigation={navigation} onBack={onBack} />);
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(navigation.fire('POP')).toBe(true);
    expect(navigation.fire('REPLACE')).toBe(false);
    expect(navigation.fire('RESET')).toBe(false);
    expect(onBack).toHaveBeenCalledTimes(2);
    await unmount(r);
    expect(navigation.fire('GO_BACK')).toBe(false);
  });

  it('on iOS the swipe back is off while the guard holds, and on again when it does not', async () => {
    setPlatform('ios');
    const navigation = fakeNavigation();
    const r = await render(<Guarded navigation={navigation} onBack={() => true} holds />);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    await act(async () => {
      r.update(<Guarded navigation={navigation} onBack={() => false} holds={false} />);
    });
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    await unmount(r);
  });

  it('the web has no swipe to turn off, and a guard that names no state leaves the gesture alone', async () => {
    setPlatform('web');
    const web = fakeNavigation();
    const a = await render(<Guarded navigation={web} onBack={() => true} holds />);
    expect(web.setOptions).not.toHaveBeenCalled();
    await unmount(a);

    setPlatform('ios');
    const silent = fakeNavigation();
    const b = await render(<Guarded navigation={silent} onBack={() => true} />);
    expect(silent.setOptions).not.toHaveBeenCalled();
    await unmount(b);
  });
});
