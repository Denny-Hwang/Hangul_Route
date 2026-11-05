// First of all: Metro's bundle loader, for the lesson chunks (F-CURR-002 §10).
import './src/async-bundles';
import { registerRootComponent } from 'expo';
import { bootRoot } from './src/platform/app-root';
import { withStoryShelf } from './src/screens/story-shelf-gate';

/**
 * The root is chosen, and its boot step run, before anything mounts (F-APP-001 sections 3.4 and
 * 3.9, F-BROWSE-001 section 4.1; `src/platform/app-root.web.ts`). The learner app clears the
 * grown-up unlock of its tab and reads its boot intent there; `/browse` mounts All lessons
 * (`BrowseApp`, F-BROWSE-001 BR-6), which runs none of the learner boot; `/present` mounts the
 * lecture presenter (`PresenterApp`, F-TCH-004 PR 6), which runs none of it either; a grown-up URL the host
 * has no file for bounces to its persona entry and mounts nothing. Native builds always mount the
 * learner app.
 */
function GrownUpBounce(): null {
  return null;
}

/**
 * The story shelf comes before the roots (F-CURR-002 §10, row CM-8b): every module that reads the stories derives
 * its lists from the shelf when it first runs, and on the web the shelf is a precached chunk of its own. So the
 * roots (`src/screens/app-roots.tsx`: the learner app, the presenter, All lessons) are required inside a function
 * that `withStoryShelf` calls once the shelf is in: Metro keeps them in the start bundle and runs them then. A static
 * import here would run them before the shelf (the shelf's reader throws, and
 * `src/content/__tests__/story-shelf-boot.test.ts` walks these imports). Native builds have the shelf from the start.
 */
const root = bootRoot();
registerRootComponent(
  root === 'grown-up-bounce'
    ? GrownUpBounce
    : withStoryShelf(() => (require('./src/screens/app-roots') as typeof import('./src/screens/app-roots')).rootComponent(root)),
);
