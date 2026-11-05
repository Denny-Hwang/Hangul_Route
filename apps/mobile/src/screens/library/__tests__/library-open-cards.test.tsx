import { getMessages } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-test-renderer';
import { buttonsNamed, cleanup, hostNodes, press, render, resetPlatform } from '../../../test-support/render';
import { LibraryScreen } from '../LibraryScreen';

/**
 * Owner request OW-2: Home's Cards chip links to `Library` with `{ section: 'cards' }`. The Library then shows the
 * learner's own cards under the All filter, wherever it was left (a theme filter picked earlier), and clears the link
 * so the same chip works again.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const nav = vi.hoisted(() => ({ params: undefined as { section?: string } | undefined, setParams: vi.fn() }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ navigate: () => undefined, goBack: () => undefined, setParams: nav.setParams }),
    useRoute: () => ({ params: nav.params }),
  };
});

const m = getMessages('en').learner.library;
const selected = (root: Parameters<typeof hostNodes>[0], label: string): boolean | undefined => {
  const node = buttonsNamed(root, label)[0];
  return node?.props['aria-pressed'] as boolean | undefined;
};

beforeEach(() => {
  nav.params = undefined;
  nav.setParams.mockClear();
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('Library opened from the Home Cards chip', () => {
  it('filter chips say which one is on (selected), All first', async () => {
    const r = await render(<LibraryScreen />);
    expect(selected(r.root, m.filterAll)).toBe(true);
  });

  it('a link to the Cards section resets a theme filter to All and clears the link', async () => {
    const r = await render(<LibraryScreen />);
    const themeChip = hostNodes(r.root, (n) => n.props.role === 'button' && n.props['aria-pressed'] === false)[0]!;
    await press(themeChip);
    expect(selected(r.root, m.filterAll)).toBe(false);

    nav.params = { section: 'cards' };
    await act(async () => {
      r.update(<LibraryScreen />);
    });
    expect(selected(r.root, m.filterAll)).toBe(true);
    expect(nav.setParams).toHaveBeenCalledWith({ section: undefined });
  });

  it('the first open through a link starts on All and clears the link', async () => {
    nav.params = { section: 'cards' };
    const r = await render(<LibraryScreen />);
    expect(selected(r.root, m.filterAll)).toBe(true);
    expect(nav.setParams).toHaveBeenCalledWith({ section: undefined });
  });
});
