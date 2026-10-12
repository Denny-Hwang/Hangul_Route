import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * All lessons never writes learner data (F-BROWSE-001 section 4.10, BD3 layer
 * 5): browse code may not import a learner store, the learner boot, the
 * Results screens or the learner quest player. A source scan of every browse
 * path; a hit fails with the file and line. The gate writer
 * (`platform/browse-handoff.web.ts`) runs in the learner app, after the PIN,
 * and is not browse code.
 */

const SRC = join(__dirname, '..', '..', '..');
const APP_ROOT = join(SRC, '..');

const FORBIDDEN_STORES = [
  'progress-store',
  'profile-store',
  'sync-store',
  'plan-store',
  'membership-store',
  'tier-store',
  'account-store',
  'story-store',
  // `hydrateLearnerData`, which Browse never runs (BD1).
  'bootstrap',
];

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|vi\.mock\s*\(\s*)['"]([^'"]+)['"]/g;

/** Drops an extension, a trailing `/index` and a trailing slash, so every spelling of a path compares equal. */
function normalise(specifier: string): string {
  return specifier
    .replace(/\.(tsx?|jsx?)$/, '')
    .replace(/\/index$/, '')
    .replace(/\/$/, '');
}

function forbiddenSpecifier(raw: string): boolean {
  const specifier = normalise(raw);
  // The `store` barrel (`store/index.ts`) re-exports the profile and progress stores.
  if (/(^|\/)store$/.test(specifier)) return true;
  if (FORBIDDEN_STORES.some((name) => specifier === `store/${name}` || specifier.endsWith(`/store/${name}`))) return true;
  // Every Results screen (it records the quest and unlocks cards), and the learner quest player (it starts a session).
  if (/(^|\/)screens\/results(\/|$)/.test(specifier) || /^\.\.?\/results(\/|$)/.test(specifier)) return true;
  return /(^|\/)(screens\/)?quest\/QuestPlayerScreen$/.test(specifier) || /^\.\/QuestPlayerScreen$/.test(specifier);
}

export function scanSource(file: string, source: string): string[] {
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

const existing = (paths: string[]): string[] => paths.filter((p) => existsSync(p));

function browseFiles(): string[] {
  const platform = readdirSync(join(SRC, 'platform'))
    .filter((name) => name.startsWith('browse') && !name.startsWith('browse-handoff') && /\.tsx?$/.test(name))
    .map((name) => join(SRC, 'platform', name));
  return [
    ...sourceFiles(join(SRC, 'screens', 'browse')),
    ...sourceFiles(join(SRC, 'logic', 'browse')),
    ...existing([join(SRC, 'navigation', 'browse.tsx'), join(SRC, 'BrowseApp.tsx'), join(APP_ROOT, 'BrowseApp.tsx')]),
    ...platform,
  ];
}

/**
 * Every app module a file reaches through relative imports (type imports
 * included, the stricter reading), with the chain that reaches it. A
 * specifier that names a platform module reaches both variants
 * (`storage.ts` and `storage.web.ts`).
 */
export function reachable(starts: readonly string[]): Map<string, string[]> {
  const chains = new Map<string, string[]>();
  const queue: [string, string[]][] = starts.map((file) => [file, [file]]);
  while (queue.length > 0) {
    const [file, chain] = queue.shift() as [string, string[]];
    if (chains.has(file)) continue;
    chains.set(file, chain);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1] as string;
      if (!specifier.startsWith('.')) continue;
      const base = resolve(dirname(file), specifier);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.web.ts`, `${base}.web.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
        if (/\.tsx?$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) queue.push([candidate, [...chain, candidate]]);
      }
    }
  }
  return chains;
}

/** Pure browse logic and the browse platform modules reach no store, screen, component, navigator or app root, however indirectly. */
function forbiddenReach(file: string): boolean {
  return /^(store|screens|components|navigation)\//.test(relative(SRC, file)) || /^(App|BrowseApp)\.tsx$/.test(relative(SRC, file));
}

function pureBrowseFiles(): string[] {
  return browseFiles().filter((file) => file.includes(join('logic', 'browse')) || file.includes(join('src', 'platform')));
}

describe('browse isolation (F-BROWSE-001 section 4.10)', () => {
  it('no browse file imports a learner store, the learner boot, Results or the learner quest player', () => {
    const files = browseFiles();
    expect(files.some((f) => f.includes(join('logic', 'browse')))).toBe(true);
    const hits = files.flatMap((file) => scanSource(relative(APP_ROOT, file), readFileSync(file, 'utf8')));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('logic/browse and platform/browse* reach no store, screen, component or navigator through any chain of imports', () => {
    const chains = reachable(pureBrowseFiles());
    expect(chains.size).toBeGreaterThan(pureBrowseFiles().length); // the walk follows imports
    const hits = [...chains].filter(([file]) => forbiddenReach(file)).map(([, chain]) => chain.map((f) => relative(APP_ROOT, f)).join(' -> '));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('the import walk names the chain that reaches a forbidden module', () => {
    const fixtureRoot = join(SRC, 'logic', 'browse', '__tests__');
    const chains = reachable([join(fixtureRoot, 'browse-fixture.ts')]);
    const story = [...chains.keys()].find((f) => f.endsWith(join('story', 'story-index.ts')));
    expect(story).toBeDefined();
    expect(chains.get(story as string)?.[0]).toBe(join(fixtureRoot, 'browse-fixture.ts'));
    expect(forbiddenReach(join(SRC, 'store', 'progress-store.ts'))).toBe(true);
    expect(forbiddenReach(join(SRC, 'screens', 'quest', 'QuestPlayerScreen.tsx'))).toBe(true);
    expect(forbiddenReach(join(SRC, 'navigation', 'browse.tsx'))).toBe(true);
    expect(forbiddenReach(join(SRC, 'logic', 'story', 'story-index.ts'))).toBe(false);
  });

  it('flags every forbidden import, with file and line', () => {
    const source = [
      "import { useProgressStore } from '../../store/progress-store';",
      "import type { P } from '../store/profile-store';",
      "const s = import('../../store/sync-store');",
      "import '../store/plan-store';",
      "vi.mock('../../../store/membership-store', () => ({}));",
      "export { t } from '../../store/tier-store';",
      "const a = require('../store/account-store');",
      "import { useStoryStore } from 'store/story-store';",
      "import { hydrateLearnerData } from '../../store/bootstrap';",
      "import { useProfileStore } from '../../store';",
      "import { x } from '../../store/index.ts';",
      "import { ResultsScreen } from '../results/ResultsScreen';",
      "import { RewardView } from '../../screens/results/RewardView.tsx';",
      "import { QuestPlayerScreen } from '../quest/QuestPlayerScreen';",
      "import QuestPlayer from '../../screens/quest/QuestPlayerScreen.tsx';",
      "import { useProgressStore as p2 } from '../store/progress-store.ts';",
    ].join('\n');
    const hits = scanSource('screens/browse/x.tsx', source);
    expect(hits).toHaveLength(16);
    expect(hits[0]).toBe('screens/browse/x.tsx:1 imports ../../store/progress-store');
    expect(hits[13]).toBe('screens/browse/x.tsx:14 imports ../quest/QuestPlayerScreen');
  });

  it('allows what Browse may use', () => {
    const allowed = [
      "import { useAudioStore } from '../../store/audio-store';",
      "import { useLocaleStore } from '../../store/locale-store';",
      "import { useQuestRunStore } from '../../store/quest-run-store';",
      "import { QuestPlayerView } from '../quest/QuestPlayerView';",
      "import { MinigameScreen } from '../minigames/MinigameScreen';",
      "import { readJson } from '../../platform/storage';",
      "import { itemAccess } from '../../logic/browse/access';",
      "import { resultsCopy } from '../../logic/results-copy';",
      "import { storyById } from '../../content/stories';",
      "import { shelf } from '../storefront/index';",
    ].join('\n');
    expect(scanSource('x.ts', allowed)).toEqual([]);
  });
});
