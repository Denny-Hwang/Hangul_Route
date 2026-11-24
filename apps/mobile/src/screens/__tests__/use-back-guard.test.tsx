import { NavigationContext } from '@react-navigation/native';
import type { ReactElement, ReactNode } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, resetPlatform, setPlatform, unmount } from '../../test-support/render';
import { BackGuardScopeContext, useBackGuard, useBackGuardScope, useRouteBackGuard, type BackGuardNavigation } from '../use-back-guard';

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

/**
 * The fake navigation of the route-level tests: `fire(type)` runs the `beforeRemove` listeners with an event that carries
 * `defaultPrevented` as React Navigation's does (a listener after one that prevented sees it), and answers whether the
 * back was held. [LR] `listenerCount` says how many guards a route holds.
 */
export function fakeNavigation(): BackGuardNavigation & { fire: (type: string) => boolean; setOptions: ReturnType<typeof vi.fn>; listenerCount: () => number } {
  const listeners: Listener[] = [];
  return {
    addListener: (_type, listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    setOptions: vi.fn(),
    listenerCount: () => listeners.length,
    fire: (type) => {
      const event = {
        data: { action: { type } },
        defaultPrevented: false,
        preventDefault: () => {
          event.defaultPrevented = true;
        },
      };
      for (const listener of [...listeners]) listener(event);
      return event.defaultPrevented;
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

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME LR-1 (section 3.1, test 2): nested guards on one route. A scope's owner adds the one
 * `beforeRemove` listener and writes `gestureEnabled` once; a `useRouteBackGuard` inside the scope registers with it,
 * so the order two guards mounted in never decides which one answers.
 */
function ScopeOwner({ onBack, holds, children }: { onBack: () => boolean; holds: boolean; children?: ReactNode }): ReactElement {
  const scope = useBackGuardScope(onBack, holds);
  return <BackGuardScopeContext.Provider value={scope}>{children}</BackGuardScopeContext.Provider>;
}

function Nested({ onBack, holds }: { onBack: () => boolean; holds?: boolean }): null {
  useRouteBackGuard(onBack, holds);
  return null;
}

const onRoute = (navigation: BackGuardNavigation, element: ReactElement): ReactElement => (
  <NavigationContext.Provider value={navigation as never}>{element}</NavigationContext.Provider>
);

describe('a back guard scope', () => {
  it('a nested guard that holds takes the back and the owner is not asked', async () => {
    const navigation = fakeNavigation();
    const own = vi.fn(() => true);
    const nested = vi.fn(() => true);
    const r = await render(
      onRoute(
        navigation,
        <ScopeOwner onBack={own} holds>
          <Nested onBack={nested} holds />
        </ScopeOwner>,
      ),
    );
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(nested).toHaveBeenCalledTimes(1);
    expect(own).not.toHaveBeenCalled();
    expect(navigation.listenerCount()).toBe(1);
    await unmount(r);
  });

  it('a nested guard that does not hold passes the back to the owner', async () => {
    const navigation = fakeNavigation();
    const own = vi.fn(() => true);
    const nested = vi.fn(() => false);
    const r = await render(
      onRoute(
        navigation,
        <ScopeOwner onBack={own} holds>
          <Nested onBack={nested} holds={false} />
        </ScopeOwner>,
      ),
    );
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(nested).toHaveBeenCalledTimes(1);
    expect(own).toHaveBeenCalledTimes(1);
    expect(navigation.fire('REPLACE')).toBe(false);
    await unmount(r);
  });

  it('the answer is the same whatever mounted first', async () => {
    const navigation = fakeNavigation();
    const own = vi.fn(() => true);
    const nested = vi.fn(() => true);
    // The nested guard mounts after the owner's own effects have run (a game drawn after a waiting frame).
    const r = await render(onRoute(navigation, <ScopeOwner onBack={own} holds />));
    await act(async () => {
      r.update(
        onRoute(
          navigation,
          <ScopeOwner onBack={own} holds>
            <Nested onBack={nested} holds />
          </ScopeOwner>,
        ),
      );
    });
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(nested).toHaveBeenCalledTimes(1);
    expect(own).not.toHaveBeenCalled();
    expect(navigation.listenerCount()).toBe(1);
    // And when it unmounts again the owner answers alone.
    await act(async () => {
      r.update(onRoute(navigation, <ScopeOwner onBack={own} holds />));
    });
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(own).toHaveBeenCalledTimes(1);
    await unmount(r);
  });

  it('the latest mounted nested guard is asked first', async () => {
    const navigation = fakeNavigation();
    const order: string[] = [];
    const r = await render(
      onRoute(
        navigation,
        <ScopeOwner onBack={() => true} holds={false}>
          <Nested onBack={() => (order.push('first'), false)} holds={false} />
          <Nested onBack={() => (order.push('second'), true)} holds />
        </ScopeOwner>,
      ),
    );
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(order).toEqual(['second']);
    await unmount(r);
  });

  it('only the owner writes gestureEnabled, from its own holds or any nested holds', async () => {
    setPlatform('ios');
    const navigation = fakeNavigation();
    const drawn = (own: boolean, nested: boolean): ReactElement =>
      onRoute(
        navigation,
        <ScopeOwner onBack={() => own} holds={own}>
          <Nested onBack={() => nested} holds={nested} />
        </ScopeOwner>,
      );
    const r = await render(drawn(false, false));
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    await act(async () => r.update(drawn(false, true)));
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    await act(async () => r.update(drawn(true, false)));
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    await act(async () => r.update(drawn(false, false)));
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    // One writer: the value never disagrees with "own or nested holds" at the end of a render (two writers overwrite each other).
    expect(navigation.setOptions.mock.calls.every(([options]) => Object.keys(options).join() === 'gestureEnabled')).toBe(true);
    await unmount(r);
  });

  it('outside a scope useRouteBackGuard adds its own listener', async () => {
    const navigation = fakeNavigation();
    const onBack = vi.fn(() => true);
    const r = await render(onRoute(navigation, <Nested onBack={onBack} holds />));
    expect(navigation.listenerCount()).toBe(1);
    expect(navigation.fire('GO_BACK')).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    await unmount(r);
    expect(navigation.listenerCount()).toBe(0);
  });
});
