// First of all: Metro's bundle loader, for the lesson chunks (F-CURR-002 §10).
import './src/async-bundles';
import { registerRootComponent } from 'expo';
import App from './App';
import { bootRoot } from './src/platform/app-root';
import { withLessonContent, type LazyRoot } from './src/screens/lesson-content';

/**
 * The grown-up roots are chunks of their own (F-CURR-002 §10): a learner's start bundle carries neither the
 * presenter nor All lessons, and the web build emits each as a precached bundle (`PresenterApp-<md5>.js`,
 * `BrowseApp-<md5>.js`) that `withLessonContent` loads with the content the root reads. Literal `import()`s
 * only: a static import would pull a root back into the start bundle (the post-build check fails on its marker).
 */
const PresenterRoot: LazyRoot<object> = { name: 'PresenterApp', load: () => import('./PresenterApp') };
const BrowseRoot: LazyRoot<object> = { name: 'BrowseApp', load: () => import('./BrowseApp') };

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

const root = bootRoot();
// The grown-up roots read the whole lesson catalogue (decks, lesson facts), so they mount once every
// lesson chunk and their own code are in (F-CURR-002 §10); the learner app loads a lesson's chunk when it opens.
registerRootComponent(
  root === 'grown-up-bounce'
    ? GrownUpBounce
    : root === 'presenter'
      ? withLessonContent(PresenterRoot)
      : root === 'browse'
        ? withLessonContent(BrowseRoot)
        : App,
);
