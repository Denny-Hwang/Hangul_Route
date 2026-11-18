import type { ComponentType } from 'react';
import App from '../../App';
import type { AppRoot } from '../platform/app-root';
import { withLessonContent, type LazyRoot } from './lesson-content';

/**
 * The root each boot mounts (F-APP-001 sections 3.4 and 3.9, F-BROWSE-001 section 4.1). `index.ts` reaches this
 * module only through a `require()` that runs once the story shelf is in (F-CURR-002 §10, row CM-8b), because the
 * learner app and the grown-up roots read the stories when their modules first run.
 *
 * The grown-up roots are chunks of their own (F-CURR-002 §10): a learner's start bundle carries neither the
 * presenter nor All lessons, and the web build emits each as a precached bundle (`PresenterApp-<md5>.js`,
 * `BrowseApp-<md5>.js`) that `withLessonContent` loads with the content the root reads. Literal `import()`s
 * only: a static import would pull a root back into the start bundle (the post-build check fails on its marker).
 */
const PresenterRoot: LazyRoot<object> = { name: 'PresenterApp', load: () => import('../../PresenterApp') };
const BrowseRoot: LazyRoot<object> = { name: 'BrowseApp', load: () => import('../../BrowseApp') };

/**
 * All lessons reads the whole lesson catalogue (lesson facts), so it mounts once every lesson chunk and its own code
 * are in (F-CURR-002 §10). The presenter lists its home from the manifests and a deck loads its own cells when chosen
 * ([FN] AMENDMENTS-FINISH-2026-11 row FN-4), so it mounts on its code, the titles and the device locale's text. The
 * learner app loads a lesson's chunk when it opens.
 */
export function rootComponent(root: Exclude<AppRoot, 'grown-up-bounce'>): ComponentType<object> {
  if (root === 'presenter') return withLessonContent(PresenterRoot, { content: 'manifest' });
  if (root === 'browse') return withLessonContent(BrowseRoot);
  return App;
}
