import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, startGraph } from '../../test-support/start-graph';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7 (finding F4): what the web start bundle carries, read from the sources the way the
 * build folds them (`test-support/start-graph.ts`: static imports from `index.ts`, plus what two chunks share). Each step
 * of the row that moves code out of the start bundle pins it here; the build's post-build check pins each chunk's marker
 * (`scripts/pwa/lesson-chunks.mjs`) and the start bundle's size.
 */

const graph = startGraph();
const reached = (file: string): string | undefined => graph.files.get(file)?.join(' -> ');

describe('the start bundle (AMENDMENTS-FINISH-2026-11 FN-7)', () => {
  it('walks the whole start bundle: the app, its navigation and its packages', () => {
    expect(graph.files.has('apps/mobile/App.tsx')).toBe(true);
    expect(graph.files.has('apps/mobile/src/navigation/root.tsx')).toBe(true);
    expect(graph.files.has('packages/content-schema/src/index.ts')).toBe(true);
    expect(graph.files.size).toBeGreaterThan(900);
    // The presenter and All lessons are chunks; what they share is in the start bundle (Expo's serializer).
    expect(graph.chunks.has('apps/mobile/PresenterApp.tsx')).toBe(true);
    expect(graph.shared.size).toBeGreaterThan(0);
  });

  it('step 1: the level check\'s bank is a chunk of its own; the start bundle reads its meta only', () => {
    expect(reached('apps/mobile/src/content/placement.generated.ts')).toBeUndefined();
    expect(reached('apps/mobile/src/content/placement-bank-chunk.ts')).toBeUndefined();
    expect(graph.chunks.has('apps/mobile/src/content/placement-bank-chunk.ts')).toBe(true);
    expect(graph.files.has('apps/mobile/src/content/placement-meta.generated.ts')).toBe(true);
  });

  it('step 2: the content linters are not in it (the content-schema barrel no longer carries them)', () => {
    expect(reached('packages/content-schema/src/story-lint.ts')).toBeUndefined();
    expect(reached('packages/content-schema/src/lesson-cell-lint.ts')).toBeUndefined();
    expect(reached('packages/content-schema/src/lesson-lint.ts')).toBeUndefined();
  });

  it('step 3: more learner screens are chunks of their own, reached through their doors', () => {
    const screens: Record<string, string> = {
      'apps/mobile/src/screens/minigames/writing-chunk.tsx': 'apps/mobile/src/screens/minigames/TypeHangulGame.tsx',
      'apps/mobile/src/screens/minigames/trace-word-chunk.tsx': 'apps/mobile/src/screens/minigames/TraceWordGame.tsx',
      'apps/mobile/src/screens/minigames/sentence-builder-chunk.tsx': 'apps/mobile/src/screens/minigames/SentenceBuilderGame.tsx',
      'apps/mobile/src/screens/story/reader-chunk.tsx': 'apps/mobile/src/screens/story/StoryReaderView.tsx',
      'apps/mobile/src/screens/vocab/speed-round-chunk.tsx': 'apps/mobile/src/screens/vocab/VocabSpeedRoundScreen.tsx',
      'apps/mobile/src/screens/route/route-proposal-chunk.tsx': 'apps/mobile/src/screens/route/RouteProposalScreen.tsx',
      'apps/mobile/src/screens/sync/join-space-chunk.tsx': 'apps/mobile/src/screens/sync/JoinSpaceScreen.tsx',
      'apps/mobile/src/screens/placement/placement-chunk.tsx': 'apps/mobile/src/screens/placement/PlacementScreen.tsx',
    };
    for (const [chunk, screen] of Object.entries(screens)) {
      expect(graph.chunks.has(chunk), chunk).toBe(true);
      expect(reached(chunk), chunk).toBeUndefined();
      expect(reached(screen), screen).toBeUndefined();
    }
    // Write Frame rides with Type Hangul; what only the games use leaves with them.
    for (const file of [
      'apps/mobile/src/screens/minigames/WriteFrameGame.tsx',
      'apps/mobile/src/logic/type-hangul/flow.ts',
      'apps/mobile/src/logic/trace-word/flow.ts',
      'apps/mobile/src/logic/sentence-builder/reducer.ts',
      'apps/mobile/src/logic/story/reader-state.ts',
      'apps/mobile/src/screens/placement/ItemScreen.tsx',
      'apps/mobile/src/screens/sync/JoinBatch.tsx',
    ]) {
      expect(reached(file), file).toBeUndefined();
    }
  });

  it('step 4: the public site\'s strings (`landing`) are not in it; the app reads none of them', () => {
    expect(reached('packages/i18n/src/messages/en/landing.ts')).toBeUndefined();
    expect(graph.files.has('packages/i18n/src/messages/en/index.web.ts')).toBe(true);
    expect(graph.files.has('packages/i18n/src/messages/en/learner.ts')).toBe(true);
    // The twin's `landing` is empty, so no source of the web build, start bundle or chunk, may read it (comments aside).
    const APP = join(REPO, 'apps', 'mobile');
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sources(path);
        return /\.tsx?$/.test(name) && !/\.(test|native)\.tsx?$/.test(name) ? [path] : [];
      });
    const files = [...sources(join(APP, 'src')), ...['index.ts', 'App.tsx', 'PresenterApp.tsx', 'BrowseApp.tsx'].map((f) => join(APP, f))];
    expect(files.length).toBeGreaterThan(1000);
    const readers = files
      .filter((file) => {
        const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        return /\.landing\b|\[['"]landing['"]\]/.test(code);
      })
      .map((file) => relative(APP, file));
    expect(readers).toEqual([]);
  });
});
