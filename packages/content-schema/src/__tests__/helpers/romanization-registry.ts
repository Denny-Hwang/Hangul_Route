/**
 * Registry of every source that puts Korean in front of a learner (F-CNT-002 §3.4),
 * and of the Hangul-bearing files that are deliberately not scanned
 * (`ROMANIZATION_SCAN_IGNORE`). `romanization-coverage.test.ts` walks the repo and
 * fails on a Hangul-bearing file that is in neither list, so adding Korean to a new
 * file forces its author to register it in the same PR.
 *
 * Test support only: nothing here ships. Paths are repo-relative with `/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type SourceClass = 'A' | 'B1' | 'B2' | 'B3' | 'C';

export interface RegisteredSource {
  path: string;
  cls: SourceClass;
  /** The suite that enforces it (repo-relative). */
  suite: string;
  /** Text the suite's source must contain, proving the suite really reads this file. */
  needle: string;
}

const MOBILE_SUITE = 'apps/mobile/src/content/__tests__/romanization.test.ts';
const WEB_DATA_SUITE = 'apps/web/src/data/__tests__/romanization.test.ts';
const WEB_SOURCES_SUITE = 'apps/web/src/__tests__/romanization-sources.test.ts';
const BACKEND_SUITE = 'packages/backend/src/__tests__/content-route.test.ts';
/** Class A has no per-file entry: every `content/**\/*.json` (outside the skipped dirs) is scanned. */
export const CONTENT_SUITE = 'packages/content-schema/src/__tests__/romanization-content.test.ts';

export const REGISTERED_SOURCES: readonly RegisteredSource[] = [
  // B1. TS data, mobile
  { path: 'apps/mobile/src/content/heritage-cards.ts', cls: 'B1', suite: MOBILE_SUITE, needle: '../heritage-cards' },
  { path: 'apps/mobile/src/content/jamo.ts', cls: 'B1', suite: MOBILE_SUITE, needle: '../jamo' },
  { path: 'apps/mobile/src/content/quests.ts', cls: 'B1', suite: MOBILE_SUITE, needle: '../quests' },
  { path: 'apps/mobile/src/logic/minigame-config.ts', cls: 'B1', suite: MOBILE_SUITE, needle: 'logic/minigame-config' },
  { path: 'apps/mobile/src/logic/profiles/avatar-catalog.ts', cls: 'B1', suite: MOBILE_SUITE, needle: 'profiles/avatar-catalog' },
  // B2. TS data, web
  { path: 'apps/web/src/data/stage1-cards.ts', cls: 'B2', suite: WEB_DATA_SUITE, needle: '../stage1-cards' },
  // B3. TS data, API (isolated jamo only: R7)
  { path: 'packages/backend/src/routes/content.ts', cls: 'B3', suite: BACKEND_SUITE, needle: 'routes/content' },
  // C. Inline literals in pages
  { path: 'apps/web/src/components/landing/MeetHoya.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'landing/MeetHoya.tsx' },
  { path: 'apps/web/src/app/design-preview/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'design-preview/page.tsx' },
  { path: 'apps/web/src/app/design-preview/cards/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'design-preview/cards/page.tsx' },
  { path: 'apps/web/src/app/design-preview/components/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'design-preview/components/page.tsx' },
  { path: 'apps/web/src/app/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'src/app/page.tsx' },
  { path: 'apps/mobile/src/screens/minigames/VoiceEchoGame.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'minigames/VoiceEchoGame.tsx' },
];

export interface ScanIgnore {
  /**
   * An exact file, a directory prefix ending in `/`, or a suffix pattern `*.ext`.
   * Every entry must match something that exists.
   */
  path: string;
  reason: string;
}

/** Hangul-bearing files that are not learner content (F-CNT-002 §3.4 class D and the zod/i18n/doc files). */
export const ROMANIZATION_SCAN_IGNORE: readonly ScanIgnore[] = [
  { path: 'packages/design-system/src/tokens.ts', reason: 'comments naming colours (단청, 한지)' },
  { path: 'packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx', reason: 'comments on the SVG glyph paths' },
  { path: 'apps/mobile/src/content/jamo-strokes.ts', reason: 'isolated jamo and stroke coordinates, no words' },
  { path: 'apps/mobile/src/logic/stage1/spoken.ts', reason: 'comments only since F-AUDIO-004 A-2: the spoken forms live on the jamo records, which the jamo.ts check covers (spokenKo, spokenRomanization)' },
  { path: 'apps/mobile/src/logic/audio/voice-rank.ts', reason: 'speech-synthesis voice names (유나, 프리미엄, 향상됨) matched by regex, never shown' },
  { path: 'apps/mobile/src/logic/profiles/profile-model.ts', reason: 'character-class regex and a comment for the allowed name characters' },
  { path: 'packages/content-schema/src/romanization/', reason: 'the converter: golden-vector comments and doc examples, no shipped content' },
  { path: 'packages/content-schema/src/schemas/jamo.ts', reason: 'Hangul character-class regexes and comments' },
  { path: 'packages/content-schema/src/schemas/story-check.ts', reason: 'the Hangul detection regex' },
  { path: 'packages/content-schema/src/schemas/vocab.ts', reason: 'Hangul character-class regex and comments' },
  { path: 'packages/content-schema/src/__fixtures__/', reason: 'zod and lint fixtures for schema tests, several deliberately broken' },
  { path: 'packages/i18n/src/banned-words.json', reason: 'Korean banned-word list for the UI-copy lint (F-I18N-001), not taught content' },
  { path: 'packages/i18n/src/audience.ts', reason: 'Korean kids-only-framing patterns for the audience guard (F-I18N-001 §3.8), not taught content' },
  { path: 'packages/i18n/src/banned.ts', reason: 'comments for the banned-word matcher (F-I18N-001)' },
  { path: 'packages/i18n/src/format.ts', reason: 'Korean UI locale date words (일, 월, 년); the Korean UI locale is F-I18N-001, not taught Korean' },
  { path: 'packages/i18n/src/locales.ts', reason: 'the Korean locale endonym (한국어) in the locale table (F-I18N-001)' },
  { path: 'content/stories/research/', reason: 'provenance data: `rr` keys and a hyphenated romanization R2 would reject (same skip as SKIPPED_DIRS in scripts/validate-content.mjs)' },
  { path: '*.md', reason: 'documentation, not shipped content' },
  // Generated from class A JSON; listed so they do not trip the check when stories and vocabulary ship.
  { path: 'apps/mobile/src/content/stories.generated.ts', reason: 'generated from content/stories/*.json (scanned as class A) by scripts/build-stories.mjs' },
  { path: 'apps/mobile/src/content/__generated__/vocab.ts', reason: 'generated from content/vocab/*.json (scanned as class A) by scripts/build-vocab.mjs' },
  { path: 'apps/web/src/data/vocab-catalog.ts', reason: 'generated from content/vocab/*.json (scanned as class A) by scripts/build-vocab.mjs' },
  { path: 'apps/mobile/src/content/placement.generated.ts', reason: 'generated from content/placement/*.json (scanned as class A) by scripts/build-placement-bank.mjs' },
  // Scene-art library (F-STORY-002 PR 2.3b): Korean appears only in sourceRef citations (the cited page title and publisher, as in a fact source); alt and accuracyNote are Hangul-free, enforced by packages/design-system/src/scene-art/__tests__/registry.test.ts.
  { path: 'packages/design-system/src/scene-art/props/', reason: 'sourceRef citation titles and publishers (the cited Korean page), never drawn or taught; alt and accuracyNote stay Hangul-free (scene-art registry.test.ts)' },
  { path: 'packages/design-system/src/scene-art/settings/', reason: 'sourceRef citation titles and publishers (the cited Korean page), never drawn or taught; alt and accuracyNote stay Hangul-free (scene-art registry.test.ts)' },
];

/** The directories the content scan skips; kept equal to SKIPPED_DIRS in scripts/validate-content.mjs. */
export const CONTENT_SKIPPED_DIRS: readonly string[] = ['content/stories/research'];

/** Absolute path of the repository root (this file is packages/content-schema/src/__tests__/helpers/). */
export const REPO_ROOT = new URL('../../../../../', import.meta.url).pathname;

const WALK_ROOTS = ['apps', 'packages', 'content'];
const SKIPPED_NAMES = new Set(['node_modules', '.next', 'coverage', '__tests__', 'dist', '.turbo', '.wrangler', '.expo']);
const TEXT_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|json|md)$/;
const HANGUL_SYLLABLE = /[가-힣]/;

function walk(root: string, dir: string, underSrc: boolean, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    if (SKIPPED_NAMES.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(root, full, underSrc || name === 'src', out);
    } else if (underSrc && TEXT_FILE.test(name)) {
      out.push(relative(root, full).split('\\').join('/'));
    }
  }
}

/** Repo-relative paths of the text files under `apps/**\/src`, `packages/**\/src` and `content/**` (excluding node_modules, .next, coverage, __tests__). */
export function scannedFiles(root: string = REPO_ROOT): string[] {
  const out: string[] = [];
  for (const top of WALK_ROOTS) {
    const dir = join(root, top);
    if (!existsSync(dir)) continue;
    // content/ is scanned whole; apps/ and packages/ only below a `src` directory.
    walk(root, dir, top === 'content', out);
  }
  return out;
}

/** Every scanned file that contains a Hangul syllable block `[가-힣]`. */
export function hangulFiles(root: string = REPO_ROOT): string[] {
  return scannedFiles(root).filter((f) => HANGUL_SYLLABLE.test(readFileSync(join(root, f), 'utf8')));
}

export function isIgnored(path: string): ScanIgnore | undefined {
  return ROMANIZATION_SCAN_IGNORE.find((e) =>
    e.path.startsWith('*') ? path.endsWith(e.path.slice(1)) : e.path.endsWith('/') ? path.startsWith(e.path) : path === e.path,
  );
}

/** True for `content/**\/*.json` outside the skipped dirs: class A, scanned by the content suite. */
export function isClassA(path: string): boolean {
  return path.startsWith('content/') && path.endsWith('.json') && !CONTENT_SKIPPED_DIRS.some((d) => path.startsWith(`${d}/`));
}

/** Every `content/**\/*.json` outside the skipped dirs, sorted. */
export function contentJsonFiles(root: string = REPO_ROOT): string[] {
  return scannedFiles(root).filter(isClassA);
}

function isDirPrefix(entry: string): boolean {
  return entry.endsWith('/');
}

/**
 * Findings of the coverage check (F-CNT-002 §3.4): a Hangul-bearing file that is neither
 * registered, scanned as class A nor ignored; a registered file or suite that is gone (or a
 * suite that no longer mentions the file); an ignore entry with no reason or no match.
 */
export function coverageProblems(root: string = REPO_ROOT): string[] {
  const problems: string[] = [];
  const scanned = scannedFiles(root);
  const registered = new Set(REGISTERED_SOURCES.map((s) => s.path));
  for (const f of scanned.filter((p) => HANGUL_SYLLABLE.test(readFileSync(join(root, p), 'utf8')))) {
    if (isClassA(f) || registered.has(f) || isIgnored(f) !== undefined) continue;
    problems.push(
      `::error file=${f}::romanization-coverage: contains Hangul but is not registered; add it to REGISTERED_SOURCES (with the suite that checks it) or to ROMANIZATION_SCAN_IGNORE (with a reason) in packages/content-schema/src/__tests__/helpers/romanization-registry.ts`,
    );
  }
  for (const s of REGISTERED_SOURCES) {
    if (!existsSync(join(root, s.path))) {
      problems.push(`::error file=${s.path}::romanization-coverage: registered file is missing; remove or update its REGISTERED_SOURCES entry`);
    }
    const suitePath = join(root, s.suite);
    if (!existsSync(suitePath)) {
      problems.push(`::error file=${s.suite}::romanization-coverage: suite for ${s.path} is missing`);
    } else if (!readFileSync(suitePath, 'utf8').includes(s.needle)) {
      problems.push(`::error file=${s.suite}::romanization-coverage: suite does not mention "${s.needle}", so it does not check ${s.path}`);
    }
  }
  for (const e of ROMANIZATION_SCAN_IGNORE) {
    if (e.reason.trim() === '') problems.push(`::error file=${e.path}::romanization-coverage: ignore entry has no reason`);
    const matches = e.path.startsWith('*')
      ? scanned.some((f) => f.endsWith(e.path.slice(1)))
      : isDirPrefix(e.path)
        ? existsSync(join(root, e.path))
        : existsSync(join(root, e.path));
    if (!matches) problems.push(`::error file=${e.path}::romanization-coverage: ignore entry matches nothing; remove it`);
  }
  return problems;
}

/** The Korean strings of `exceptions` that appear in a registered source or in the content JSON (R8 input). */
export function seenExceptionKo(exceptions: ReadonlyArray<{ ko: string }>, root: string = REPO_ROOT): string[] {
  const texts = [...REGISTERED_SOURCES.map((s) => s.path), ...contentJsonFiles(root)]
    .filter((p) => existsSync(join(root, p)))
    .map((p) => readFileSync(join(root, p), 'utf8'));
  return exceptions.map((e) => e.ko).filter((ko) => texts.some((t) => t.includes(ko)));
}
