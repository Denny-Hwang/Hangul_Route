import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESENTER_MOUNTED } from '../presenter-mount';

/**
 * F-TCH-004 TD1 and F-BROWSE-001 BR-13: `PRESENTER_MOUNTED` must say exactly what `index.ts`
 * does. While `index.ts` sends the presenter root to the learner `App`, the flag is false and
 * [ Present this ] stays hidden; the PR that mounts `PresenterApp` turns this test red until it
 * sets the flag to true.
 */
const APP_DIR = join(__dirname, '..', '..', '..');

/** True when `index.ts` imports `PresenterApp` and hands it to `registerRootComponent`. */
function indexMountsPresenter(indexSource: string, presenterFileExists: boolean): boolean {
  if (!presenterFileExists) return false;
  const imported = /^import\s+PresenterApp\s+from\s+'\.\/PresenterApp';?$/m.test(indexSource);
  const registered = /registerRootComponent\([^;]*\bPresenterApp\b[^;]*\)/s.test(indexSource);
  return imported && registered;
}

describe('platform/presenter-mount', () => {
  it('matches the real mount in index.ts', () => {
    const source = readFileSync(join(APP_DIR, 'index.ts'), 'utf8');
    const fileExists = existsSync(join(APP_DIR, 'PresenterApp.tsx'));
    expect(PRESENTER_MOUNTED).toBe(indexMountsPresenter(source, fileExists));
  });

  it('counts a mount only when index.ts imports PresenterApp and registers it', () => {
    const today = "import App from './App';\nregisterRootComponent(root === 'browse' ? BrowseApp : App);\n";
    const mounted = "import App from './App';\nimport PresenterApp from './PresenterApp';\nregisterRootComponent(root === 'presenter' ? PresenterApp : root === 'browse' ? BrowseApp : App);\n";
    const importedOnly = "import PresenterApp from './PresenterApp';\nregisterRootComponent(root === 'browse' ? BrowseApp : App);\n";
    expect(indexMountsPresenter(today, true)).toBe(false);
    expect(indexMountsPresenter(importedOnly, true)).toBe(false);
    expect(indexMountsPresenter(mounted, true)).toBe(true);
    expect(indexMountsPresenter(mounted, false)).toBe(false);
  });
});
