import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withStaticSplashRemoved } from '../../platform/static-splash.web';
import { render, unmount } from '../../test-support/render';

/**
 * AMENDMENTS-FINISH-2026-11 FN-2: the HTML shell's static splash stays until the app's first commit and goes with it,
 * in the layout effect, so the splash and the first frame swap in one paint. The splash is looked up when the root
 * first commits, never before (a root that has not drawn yet keeps it on screen).
 */
afterEach(() => vi.unstubAllGlobals());

describe('the root removes the static splash on its first frame', () => {
  it('removes it once the root has committed, and draws the root unchanged', async () => {
    const remove = vi.fn();
    const looked: string[] = [];
    vi.stubGlobal('document', { getElementById: (id: string) => (looked.push(id), { remove }) });
    function Home() {
      return <Text testID="home">Hi</Text>;
    }
    const Root = withStaticSplashRemoved(Home);
    expect(looked).toEqual([]);
    const renderer = await render(<Root />);
    expect(renderer.root.findByProps({ testID: 'home' })).toBeTruthy();
    expect(looked).toEqual(['hr-splash']);
    expect(remove).toHaveBeenCalledTimes(1);
    // Re-renders do not look again.
    renderer.update(<Root />);
    expect(remove).toHaveBeenCalledTimes(1);
    await unmount(renderer);
  });
});
