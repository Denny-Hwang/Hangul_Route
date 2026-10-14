import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Class runs never write learner progress (F-TCH-004 §3.9). The presenter's
 * code may not import the learner stores or the minigame screens (which read
 * `useQuestRunStore` and call `answerRound`). A source scan of the presenter
 * paths; a hit fails with the file and line.
 */

const SRC = join(__dirname, '..', '..', '..');

const FORBIDDEN_STORES = [
  'progress-store',
  'quest-run-store',
  'profile-store',
  'sync-store',
  'plan-store',
  'membership-store',
  'tier-store',
  'account-store',
  'pwa-store',
];

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|vi\.mock\s*\(\s*)['"]([^'"]+)['"]/g;

/** `store/bootstrap` runs `hydrateLearnerData`, which the presenter never calls. */
const FORBIDDEN_STORE_FILES = [...FORBIDDEN_STORES, 'bootstrap'];

/** Drops an extension, a trailing `/index` and a trailing slash, so every spelling of a path compares equal. */
function normalise(specifier: string): string {
  return specifier
    .replace(/\.(tsx?|jsx?)$/, '')
    .replace(/\/index$/, '')
    .replace(/\/$/, '');
}

function forbiddenSpecifier(raw: string): boolean {
  const specifier = normalise(raw);
  // The `store` barrel (`store/index.ts`) re-exports the profile, progress and quest-run stores.
  if (/(^|\/)store$/.test(specifier)) return true;
  if (FORBIDDEN_STORE_FILES.some((name) => specifier === `store/${name}` || specifier.endsWith(`/store/${name}`))) return true;
  // Every minigame screen, and the screen and host that mount them.
  return /(^|\/)minigames\/([A-Za-z]+Game|MinigameScreen|host)$/.test(specifier);
}

function scanSource(file: string, source: string): string[] {
  const hits: string[] = [];
  source.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(IMPORT_SPECIFIER)) {
      if (forbiddenSpecifier(match[1]!)) hits.push(`${file}:${i + 1} imports ${match[1]}`);
    }
  });
  return hits;
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function presenterFiles(): string[] {
  const platform = readdirSync(join(SRC, 'platform'))
    .filter((name) => name.startsWith('presenter') && /\.tsx?$/.test(name))
    .map((name) => join(SRC, 'platform', name));
  // The presenter root and the shared component its letter slide draws.
  const roots = [join(SRC, '..', 'PresenterApp.tsx'), join(SRC, 'components', 'StrokeHint.tsx')];
  return [...sourceFiles(join(SRC, 'screens', 'presenter')), ...sourceFiles(join(SRC, 'logic', 'lecture')), ...platform, ...roots];
}

describe('presenter isolation (F-TCH-004 §3.9)', () => {
  it('no presenter file imports a learner store or a minigame screen', () => {
    const files = presenterFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const root of ['PresenterApp.tsx', 'StrokeHint.tsx']) expect(files.some((f) => f.endsWith(root) && existsSync(f)), root).toBe(true);
    const hits = files.flatMap((file) => scanSource(relative(SRC, file), readFileSync(file, 'utf8')));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('flags every forbidden store and minigame screen, with file and line', () => {
    const source = [
      "import { useProgressStore } from '../../store/progress-store';",
      "import type { X } from '../store/quest-run-store';",
      "const p = import('../../store/profile-store');",
      "import '../store/sync-store';",
      "vi.mock('../../../store/plan-store', () => ({}));",
      "export { m } from '../../store/membership-store';",
      "const t = require('../store/tier-store');",
      "import { a } from 'store/account-store';",
      "import { usePwaStore } from '../../store/pwa-store';",
      "import CultureQuizGame from '../minigames/CultureQuizGame';",
      "import { MatchSoundGame } from '../../screens/minigames/MatchSoundGame.tsx';",
      "import { useProgressStore } from '../../store';",
      "import { useUiStore } from '../../store/';",
      "import { useProfileStore } from '../../store/index';",
      "import { useQuestRunStore } from '../store/index.ts';",
      "import { useProgressStore as p2 } from '../store/progress-store.ts';",
      "import { s } from 'store';",
      "import { hydrateLearnerData } from '../../store/bootstrap';",
      "import { MinigameScreen } from '../../screens/minigames/MinigameScreen';",
      "import { gameHost } from '../minigames/host.ts';",
    ].join('\n');
    const hits = scanSource('logic/lecture/x.ts', source);
    expect(hits).toHaveLength(20);
    expect(hits[0]).toBe('logic/lecture/x.ts:1 imports ../../store/progress-store');
    expect(hits[10]).toBe('logic/lecture/x.ts:11 imports ../../screens/minigames/MatchSoundGame.tsx');
  });

  it('allows the stores and leaves the presenter may read', () => {
    const allowed = [
      "import { useAudioStore } from '../../store/audio-store';",
      "import { readJson } from '../../platform/storage';",
      "import { StrokeHint } from '../minigames/StrokeHint';",
      "import { buildMatchSoundRounds } from '../round-builder';",
      "import { progressStore } from './progress-store-like';",
      "import { useAudioStore as a2 } from '../store/audio-store.ts';",
      "import { useLocaleStore } from '../../store/locale-store';",
      "import { restore } from '../restore';",
      "import { shelf } from '../storefront/index';",
      "import { host } from '../audio/host';",
    ].join('\n');
    expect(scanSource('x.ts', allowed)).toEqual([]);
  });
});
