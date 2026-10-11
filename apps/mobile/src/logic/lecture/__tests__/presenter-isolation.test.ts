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

function forbiddenSpecifier(specifier: string): boolean {
  if (FORBIDDEN_STORES.some((name) => specifier === `store/${name}` || specifier.endsWith(`/store/${name}`))) return true;
  return /(^|\/)minigames\/[A-Za-z]+Game(\.tsx)?$/.test(specifier);
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
  return [...sourceFiles(join(SRC, 'screens', 'presenter')), ...sourceFiles(join(SRC, 'logic', 'lecture')), ...platform];
}

describe('presenter isolation (F-TCH-004 §3.9)', () => {
  it('no presenter file imports a learner store or a minigame screen', () => {
    const files = presenterFiles();
    expect(files.length).toBeGreaterThan(0);
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
    ].join('\n');
    const hits = scanSource('logic/lecture/x.ts', source);
    expect(hits).toHaveLength(11);
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
    ].join('\n');
    expect(scanSource('x.ts', allowed)).toEqual([]);
  });
});
