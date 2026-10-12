import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
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
  // Writes vocabulary progress through `progress-store` (F-VOC-005): preview never does (section 4.10).
  'vocab-run-store',
  // A learner's level-check run, kept on the device.
  'placement-run-store',
  // Removes a learner and every key of theirs.
  'profile-removal',
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

/**
 * The module a specifier names, as a path under `src/` (`store/progress-store`,
 * `screens/results/ResultsScreen`): a relative specifier is resolved against
 * the importing file, so `../../results/X` from `screens/browse/item/` is
 * `screens/results/X` however deep the importer sits. A bare specifier is kept
 * as written. `file` is relative to the app root (`src/...`) or to `src/`.
 */
export function resolveSpecifier(file: string, raw: string): string {
  const specifier = normalise(raw);
  if (!specifier.startsWith('.')) return specifier;
  return normalise(posix.normalize(posix.join(posix.dirname(file.split(sep).join('/')), specifier))).replace(/^src\//, '');
}

function forbiddenSpecifier(file: string, raw: string): boolean {
  const target = resolveSpecifier(file, raw);
  // The `store` barrel (`store/index.ts`) re-exports the profile and progress stores.
  if (/(^|\/)store$/.test(target)) return true;
  if (FORBIDDEN_STORES.some((name) => target === `store/${name}` || target.endsWith(`/store/${name}`))) return true;
  // Every Results screen (it records the quest and unlocks cards), and the learner quest player (it starts a session).
  return /^screens\/results(\/|$)/.test(target) || target === 'screens/quest/QuestPlayerScreen';
}

/**
 * Every forbidden import in one source, with its line. The whole source is
 * matched at once, so a specifier on the line after its opener (a formatted
 * `import(` or `vi.mock(`) is found too; the line is the opener's.
 */
export function scanSource(file: string, source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].flatMap((match) => {
    const raw = match[1] as string;
    const line = source.slice(0, match.index).split('\n').length;
    return forbiddenSpecifier(file, raw) ? [`${file}:${line} imports ${raw}`] : [];
  });
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

  it('flags every forbidden import, with file and line, however the path is spelled or wrapped', () => {
    const source = [
      "import { useProgressStore } from '../../../store/progress-store';",
      "import type { P } from '../../../store/profile-store';",
      'const s = import(',
      "  '../../../store/sync-store'",
      ');',
      "import '../../../store/plan-store';",
      'vi.mock(',
      "  '../../../store/membership-store',",
      '  () => ({}),',
      ');',
      "export { t } from '../../../store/tier-store';",
      "const a = require('../../../store/account-store');",
      "import { useStoryStore } from 'store/story-store';",
      "import { hydrateLearnerData } from '../../../store/bootstrap';",
      "import { useProfileStore } from '../../../store';",
      "import { x } from '../../../store/index.ts';",
      "import { ResultsScreen } from '../../results/ResultsScreen';",
      "import { RewardView } from '../../../screens/results/RewardView.tsx';",
      "import { QuestPlayerScreen } from '../../quest/QuestPlayerScreen';",
      "import QuestPlayer from '../../../screens/quest/QuestPlayerScreen.tsx';",
      "import { useProgressStore as p2 } from '../../../store/progress-store.ts';",
      "import { useVocabRunStore } from '../../../store/vocab-run-store';",
      "import { usePlacementRunStore } from '../../../store/placement-run-store';",
      "import { removeProfile } from '../../../store/profile-removal';",
    ].join('\n');
    const hits = scanSource('src/screens/browse/item/x.tsx', source);
    expect(hits).toHaveLength(19);
    expect(hits[0]).toBe('src/screens/browse/item/x.tsx:1 imports ../../../store/progress-store');
    // a wrapped dynamic import and a wrapped vi.mock are found, on their opener's line
    expect(hits[2]).toBe('src/screens/browse/item/x.tsx:3 imports ../../../store/sync-store');
    expect(hits[4]).toBe('src/screens/browse/item/x.tsx:7 imports ../../../store/membership-store');
    // a nested browse screen reaching a Results screen through a relative path
    expect(hits[11]).toBe('src/screens/browse/item/x.tsx:17 imports ../../results/ResultsScreen');
    expect(hits[13]).toBe('src/screens/browse/item/x.tsx:19 imports ../../quest/QuestPlayerScreen');
  });

  it('resolves a relative path against the importing file', () => {
    expect(resolveSpecifier('src/screens/browse/item/x.tsx', '../../results/ResultsScreen')).toBe('screens/results/ResultsScreen');
    expect(resolveSpecifier('screens/browse/x.tsx', '../results/index.ts')).toBe('screens/results');
    expect(resolveSpecifier('src/logic/browse/x.ts', '../results-copy')).toBe('logic/results-copy');
    expect(resolveSpecifier('src/logic/browse/x.ts', '@hangul-route/content-schema')).toBe('@hangul-route/content-schema');
  });

  it('allows what Browse may use', () => {
    const allowed = [
      // BrowseApp hydrates the audio settings (section 4.1). The store reaches profile-store only in
      // `bindAudioLevelToProfiles`, which Browse never calls (section 4.1), and only to read; BR-3's write fence holds every write.
      // Reused learner screens are guarded by the ports, the fences and the e2e key-set check, not by this scan (BD3).
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
    expect(scanSource('src/screens/browse/x.tsx', allowed)).toEqual([]);
    // a logic module named like a screen is not one: `logic/results/...` is not `screens/results/...`
    expect(scanSource('src/logic/browse/x.ts', "import { copy } from '../results/copy';")).toEqual([]);
  });
});
