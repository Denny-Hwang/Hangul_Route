import { registerRootComponent } from 'expo';
import App from './App';
import BrowseApp from './BrowseApp';
import PresenterApp from './PresenterApp';
import { bootRoot } from './src/platform/app-root';

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
registerRootComponent(
  root === 'grown-up-bounce' ? GrownUpBounce : root === 'presenter' ? PresenterApp : root === 'browse' ? BrowseApp : App,
);
