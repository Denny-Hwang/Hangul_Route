import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, render, resetPlatform, setPlatform, textOf } from '../../../test-support/render';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 row FN-5 (finding F10): Home stays mounted under the quest (and its Results) and
 * subscribes to the progress the quest writes on every step. Frozen while it is not focused, it renders not once for
 * those writes, and renders once, with the progress as it is then, when the learner is back on it. The Home stand-in
 * subscribes to the progress store the way `HomeScreen` does (`byProfile[profile.id]`) and the writes change the
 * learner's snapshot as the quest player's step saves do. Focus is React Navigation's `useIsFocused`, driven here as the
 * root stack drives it (a pushed quest blurs every screen of the tabs beneath; the Node render lane cannot load the
 * navigators themselves); the e2e and the speed review's Results measurement run the real ones.
 */

const focus = vi.hoisted(() => {
  let focused = true;
  const listeners = new Set<() => void>();
  return {
    get: () => focused,
    set: (next: boolean) => {
      focused = next;
      for (const l of listeners) l();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});
vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => useSyncExternalStore(focus.subscribe, focus.get),
}));

import { Freeze, frozenWhenBlurred } from '../../../navigation/freeze-when-blurred';

const PROFILE = 'p-home-freeze';
let homeRenders = 0;

function HomeProbe(): ReactElement {
  homeRenders += 1;
  const snap = useProgressStore((s) => s.byProfile[PROFILE]);
  return <Text testID="home-progress">{String(Object.keys((snap as unknown as { quests?: object } | undefined)?.quests ?? {}).length)}</Text>;
}
HomeProbe.displayName = 'HomeScreen';

/** A progress write of one more finished quest (what a quest step's save changes: the learner's snapshot). */
function writeProgress(n: number): void {
  act(() => {
    useProgressStore.setState((s) => {
      const before = (s.byProfile[PROFILE] as unknown as { quests?: Record<string, unknown> } | undefined) ?? {};
      const quests = { ...(before.quests ?? {}), [`quest:probe-${n}`]: { stars: 1 } };
      return { byProfile: { ...s.byProfile, [PROFILE]: { ...before, quests } as unknown as ProgressSnapshot } };
    });
  });
}

const blur = (): void => {
  act(() => focus.set(false));
};
const refocus = (): void => {
  act(() => focus.set(true));
};
const Home = frozenWhenBlurred(HomeProbe);

afterEach(() => {
  useProgressStore.setState((s) => {
    const { [PROFILE]: _gone, ...rest } = s.byProfile;
    return { byProfile: rest };
  });
});

describe('Home under a running quest (row FN-5)', () => {
  it('does not re-render while the quest and its Results write progress, and is up to date when the learner is back', async () => {
    homeRenders = 0;
    focus.set(true);
    const r = await render(<Home />);
    expect(textOf(byTestId(r.root, 'home-progress')[0]!)).toBe('0');
    // The quest opens over the tabs: Home is no longer focused, and the blur itself redraws nothing of it.
    const before = homeRenders;
    blur();
    expect(homeRenders).toBe(before);
    for (let n = 1; n <= 6; n += 1) writeProgress(n);
    expect(homeRenders).toBe(before);
    // Back home: one render with the progress as it is now.
    refocus();
    expect(homeRenders).toBe(before + 1);
    expect(textOf(byTestId(r.root, 'home-progress')[0]!)).toBe('6');
    // Focused again, it follows every write as before.
    writeProgress(7);
    expect(textOf(byTestId(r.root, 'home-progress')[0]!)).toBe('7');
    expect(homeRenders).toBe(before + 2);
  });

  it('first mounted while not focused (the first quest opens over a Home never shown): nothing renders until it is focused', async () => {
    homeRenders = 0;
    focus.set(false);
    const r = await render(<Home />);
    writeProgress(1);
    expect(homeRenders).toBe(0);
    expect(byTestId(r.root, 'home-progress')).toHaveLength(0);
    refocus();
    expect(homeRenders).toBe(1);
    expect(textOf(byTestId(r.root, 'home-progress')[0]!)).toBe('1');
  });

  it('iOS and Android keep drawing it (a screen under a sheet or a back swipe can be seen there)', async () => {
    setPlatform('ios');
    try {
      homeRenders = 0;
      focus.set(true);
      const r = await render(<Home />);
      blur();
      const before = homeRenders;
      writeProgress(1);
      expect(homeRenders).toBe(before + 1);
      expect(textOf(byTestId(r.root, 'home-progress')[0]!)).toBe('1');
    } finally {
      resetPlatform();
    }
  });

  it('names the screen it wraps', () => {
    expect(Home.displayName).toBe('FrozenWhenBlurred(HomeScreen)');
  });

  it('every learner tab screen is frozen while it is not focused (tabs.tsx)', () => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'navigation', 'tabs.tsx'), 'utf8');
    for (const screen of ['HomeScreen', 'JourneyScreen', 'LibraryScreen', 'MyRouteTabScreen']) expect(source).toContain(`frozenWhenBlurred(${screen})`);
  });
});

describe('Freeze', () => {
  it('keeps the last output and renders nothing of its children while frozen; thawed, it renders them again', async () => {
    let renders = 0;
    function Child({ label }: { label: string }): ReactElement {
      renders += 1;
      return <Text testID="child">{label}</Text>;
    }
    const r = await render(
      <Freeze frozen={false}>
        <Child label="a" />
      </Freeze>,
    );
    expect(renders).toBe(1);
    await act(async () =>
      r.update(
        <Freeze frozen>
          <Child label="b" />
        </Freeze>,
      ),
    );
    expect(renders).toBe(1);
    await act(async () =>
      r.update(
        <Freeze frozen={false}>
          <Child label="c" />
        </Freeze>,
      ),
    );
    expect(renders).toBe(2);
    expect(textOf(byTestId(r.root, 'child')[0]!)).toBe('c');
  });
});
