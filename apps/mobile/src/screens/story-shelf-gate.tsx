import { Body, Screen } from '@hangul-route/design-system';
import { useEffect, useState, type ComponentType, type ReactElement } from 'react';
import { View } from 'react-native';
import { ensureStoryShelf, isStoryShelfIn } from '../content/story-shelf';
import { useMessages } from '../i18n/use-messages';
import { isStoryShelfNewBuildError } from '../logic/story/story-shelf-load';
import { isNewBuildAnswer, reloadForNewBuild } from '../platform/new-build-reload';
import { OopsScreen } from './system/OopsScreen';

/**
 * The story shelf before the first screen (F-CURR-002 §10, row CM-8b). On the web the shelf is a precached chunk
 * of its own, and every module that reads the stories derives its lists from it when it first runs, so `index.ts`
 * hands this gate a function that requires the roots (a `require()` inside a function: the app's modules stay in
 * the start bundle but run only when it is called) and the gate calls it once the shelf is in. Native builds and
 * the tests have the shelf from the start: the gate returns the root itself and nothing waits.
 * - While the shelf loads: a blank screen, then the calm status line the lessons' waiting state shows (a load from
 *   the precache takes a frame or two, so the line never flashes).
 * - A shelf of a newer build (what the chunk held, or what its URL answers when asked again) reloads the page once
 *   (online, at most once a minute); any other failure shows the crash screen, whose Try again loads it again.
 * This module may import nothing that reads the stories (`content/__tests__/story-shelf-boot.test.ts` walks the
 * imports of `index.ts`).
 */

export interface StoryShelfGateDeps {
  isIn: () => boolean;
  ensure: () => Promise<void>;
  /** Reloads the page for a newer build (online, at most once a minute); false when it did not. */
  reloadForNewBuild: () => boolean;
  /** Asks a failed chunk's URL again: true when the host answers for a newer build (404, or its HTML page refused as a script). */
  isNewBuildAnswer: (error: unknown) => Promise<boolean>;
}

/** Shown after this long without the shelf, so a load from the precache never flashes a line (as `LESSON_WAITING_LINE_MS`). */
export const SHELF_WAITING_LINE_MS = 500;

function ShelfWaiting(): ReactElement {
  const m = useMessages();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), SHELF_WAITING_LINE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite" testID="story-shelf-waiting">
        {late ? (
          <Body tone="secondary" align="center">
            {m.learner.presenter.state.loading}
          </Body>
        ) : null}
      </View>
    </Screen>
  );
}

export function storyShelfGateBindings({ isIn, ensure, reloadForNewBuild: reload, isNewBuildAnswer: newBuildAnswer }: StoryShelfGateDeps) {
  const isNewer = async (error: unknown): Promise<boolean> => isStoryShelfNewBuildError(error) || (await newBuildAnswer(error).catch(() => false));

  /**
   * The root to register: `resolveRoot()` itself when the shelf is in already (native, the tests), else a root that
   * loads the shelf, then calls `resolveRoot()` once and draws what it returns.
   */
  function withStoryShelf<P extends object>(resolveRoot: () => ComponentType<P>): ComponentType<P> {
    if (isIn()) return resolveRoot();
    let Resolved: ComponentType<P> | null = null;
    const resolved = (): ComponentType<P> => {
      Resolved ??= resolveRoot();
      return Resolved;
    };
    // The load starts now, while the start bundle runs, not when the root first draws: the shelf's script is then
    // asked for before the page's load event, and the roots run (and open their storage) as soon as it is in, as they
    // did when they ran with the start bundle. A failed start is kept for the root to show; Try again starts another.
    const start = (): Promise<void> =>
      ensure().then(() => {
        resolved();
      });
    let started = start();
    started.catch(() => undefined);
    function StoryShelfRoot(props: P): ReactElement {
      const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() => (Resolved !== null ? 'ready' : 'loading'));
      useEffect(() => {
        if (state !== 'loading') return undefined;
        let live = true;
        started.then(
          () => {
            if (live) setState('ready');
          },
          async (error: unknown) => {
            if (!live) return;
            const newer = await isNewer(error);
            if (live && !(newer && reload())) setState('failed');
          },
        );
        return () => {
          live = false;
        };
      }, [state]);
      if (state === 'ready') {
        const Root = resolved();
        return <Root {...props} />;
      }
      const retry = (): void => {
        started = start();
        started.catch(() => undefined);
        setState('loading');
      };
      if (state === 'failed') return <OopsScreen onRetry={retry} />;
      return <ShelfWaiting />;
    }
    StoryShelfRoot.displayName = 'WithStoryShelf';
    return StoryShelfRoot;
  }

  return { withStoryShelf };
}

export const { withStoryShelf } = storyShelfGateBindings({
  isIn: isStoryShelfIn,
  ensure: ensureStoryShelf,
  reloadForNewBuild: () => reloadForNewBuild(),
  isNewBuildAnswer: (error) => isNewBuildAnswer(error),
});
