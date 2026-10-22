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
  // F-STORY-006 §3.8: the collection cards' Korean words (checked with checkRomanization there).
  { path: 'apps/mobile/src/content/story-sets.ts', cls: 'B1', suite: 'apps/mobile/src/content/__tests__/card-award-integrity.test.ts', needle: '../story-sets' },
  { path: 'apps/mobile/src/content/jamo.ts', cls: 'B1', suite: MOBILE_SUITE, needle: '../jamo' },
  { path: 'apps/mobile/src/content/quests.ts', cls: 'B1', suite: MOBILE_SUITE, needle: '../quests' },
  { path: 'apps/mobile/src/logic/minigame-config.ts', cls: 'B1', suite: MOBILE_SUITE, needle: 'logic/minigame-config' },
  { path: 'apps/mobile/src/logic/profiles/avatar-catalog.ts', cls: 'B1', suite: MOBILE_SUITE, needle: 'profiles/avatar-catalog' },
  { path: 'apps/mobile/src/logic/lecture/content.ts', cls: 'B1', suite: MOBILE_SUITE, needle: 'lecture/content' },
  // F-QUEST-002 §3.9: the Hangul Check's five words and its final-syllable distractors.
  { path: 'apps/mobile/src/logic/stage1/hangul-check.ts', cls: 'B1', suite: MOBILE_SUITE, needle: 'stage1/hangul-check' },
  // F-CURR-001 §3.10: the generated lesson modules (built from content/episodes/stage-<n>/*.json, which class A scans).
  { path: 'apps/mobile/src/content/__generated__/lessons-index.ts', cls: 'B1', suite: MOBILE_SUITE, needle: '__generated__/lessons-index' },
  // F-CURR-002 §10: every cell's body chunk and the es / ko title chunks, one folder (a path ending in `/` covers the files below it).
  { path: 'apps/mobile/src/content/__generated__/lesson-chunks/', cls: 'B1', suite: MOBILE_SUITE, needle: 'ALL_LESSON_STEPS' },
  // B2. TS data, web
  { path: 'apps/web/src/data/stage1-cards.ts', cls: 'B2', suite: WEB_DATA_SUITE, needle: '../stage1-cards' },
  // B3. TS data, API (isolated jamo only: R7)
  { path: 'packages/backend/src/routes/content.ts', cls: 'B3', suite: BACKEND_SUITE, needle: 'routes/content' },
  // C. Inline literals in pages
  { path: 'apps/web/src/app/(console)/design-preview/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'design-preview/page.tsx' },
  { path: 'apps/web/src/app/(console)/design-preview/cards/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'design-preview/cards/page.tsx' },
  { path: 'apps/web/src/app/(console)/design-preview/components/page.tsx', cls: 'C', suite: WEB_SOURCES_SUITE, needle: 'design-preview/components/page.tsx' },
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
  { path: 'apps/mobile/src/logic/type-hangul/e2e-rounds.ts', reason: 'test-only Type Hangul rounds played by the fixture-build e2e (F-CURR-001 G-3), never shipped; their romanization is still checked by apps/mobile/src/logic/type-hangul/__tests__/e2e-rounds.test.ts' },
  { path: 'apps/mobile/src/logic/write-frame/e2e-rounds.ts', reason: 'test-only Write Frame rounds played by the fixture-build e2e and the component tests (F-CURR-001 G-5), never shipped; their romanization is still checked by apps/mobile/src/logic/write-frame/__tests__/e2e-rounds.test.ts' },
  { path: 'apps/mobile/src/logic/write-frame/flow.ts', reason: 'Hangul character-class regex and a comment naming the cast name (F-CURR-001 G-5)' },
  { path: 'apps/mobile/src/logic/write-frame/view.ts', reason: 'Hangul character-class regex and doc examples of the fitted ending (F-CURR-001 G-5)' },
  { path: 'apps/mobile/src/logic/lecture/deck-builder.ts', reason: 'a doc comment on the write-frame slide: the fitted-ending example (observation O2: 밥 with 을/를), no shipped text; the slides read their Korean from the bundle (AMENDMENTS-LECTURE-V2 LV-S2, LV-S4)' },
  { path: 'apps/mobile/src/logic/lecture/stage-constants.ts', reason: 'doc comments on the stage sizes naming the jamo (ㅁ, ㅇ, ㅎ) and a sound-table block (쭈), no shipped text (AMENDMENTS-LECTURE-V2 LV-S4)' },
  { path: 'apps/mobile/src/screens/minigames/WriteFrameGame.tsx', reason: 'the cast name 호야 prefilled in the grown-up preview of the name round (F-CURR-001 §3.7), drawn with the romanization the converter gives' },
  { path: 'apps/mobile/src/logic/profiles/profile-model.ts', reason: 'character-class regex and a comment for the allowed name characters' },
  { path: 'packages/content-schema/src/romanization/', reason: 'the converter: golden-vector comments and doc examples, no shipped content' },
  { path: 'packages/content-schema/src/schemas/jamo.ts', reason: 'Hangul character-class regexes and comments' },
  { path: 'packages/content-schema/src/schemas/story-check.ts', reason: 'the Hangul detection regex' },
  { path: 'packages/content-schema/src/schemas/lecture.ts', reason: 'Hangul character-class regexes for the deck title and picker labels (user data, not taught Korean)' },
  { path: 'packages/content-schema/src/schemas/vocab.ts', reason: 'Hangul character-class regex and comments' },
  { path: 'packages/content-schema/src/lesson-lint.ts', reason: 'the Korean names of the F-CURR-002 §6.6 source allowlist, matched in publisher strings, and doc examples (F-CURR-002 CM-7)' },
  { path: 'packages/content-schema/src/lesson-lint-copy.ts', reason: 'Korean score patterns of the review-copy rule (퍼센트, n 중 m), no shipped text (F-CURR-002 CM-7)' },
  { path: 'packages/content-schema/src/lesson-lint-items.ts', reason: 'the liaison table, a Hangul character-class regex and pronunciation doc examples (F-CURR-002 CM-7)' },
  { path: 'packages/content-schema/src/lesson-lint-reports.ts', reason: 'a Hangul character-class regex, the particle list of story-coverage and the NIKL list title (F-CURR-002 CM-7)' },
  { path: 'packages/content-schema/src/schemas/minigame.ts', reason: 'Hangul character-class regexes and the 어절 comment of the F-CURR-001 round schemas' },
  { path: 'packages/content-schema/src/hangul/', reason: 'the particle-pair table (이/가, 을/를) and the keyboard jamo of F-CURR-001 §3.7: grammar data, no taught words' },
  { path: 'packages/content-schema/src/pillars.ts', reason: 'blueprint 04 sub-theme titles in PILLAR_TAGS: registry data for the console catalogue and analytics, never shown to learners (F-STORY-005 §3.8). The romanization is generated by pillarTagRomanization (catalogue-fields.test.ts checks every tag converts); a render site pairs ko with it (F-PLAN-002)' },
  { path: 'packages/content-schema/src/__fixtures__/', reason: 'zod and lint fixtures for schema tests, several deliberately broken' },
  { path: 'apps/mobile/src/navigation/realia-read-e2e-fixture.ts', reason: 'F-CURR-001 G-2 test fixtures (the four D-2 realia), reached only in the e2e fixture build; realia-read-flow.test.ts checks their Hangul-only texts with checkRomanization' },
  { path: 'packages/i18n/src/banned-words.json', reason: 'Korean banned-word list for the UI-copy lint (F-I18N-001), not taught content' },
  { path: 'packages/i18n/src/audience.ts', reason: 'Korean kids-only-framing patterns for the audience guard (F-I18N-001 §3.8), not taught content' },
  { path: 'packages/i18n/src/banned.ts', reason: 'comments for the banned-word matcher (F-I18N-001)' },
  { path: 'packages/i18n/src/format.ts', reason: 'Korean UI locale date words (일, 월, 년); the Korean UI locale is F-I18N-001, not taught Korean' },
  { path: 'packages/i18n/src/locales.ts', reason: 'the Korean locale endonym (한국어) in the locale table (F-I18N-001)' },
  { path: 'packages/i18n/src/note-text.ts', reason: 'the NOTE_TONE_ALLOW word (뒤처리) and comments of the note text guard (F-FEEDBACK-001 §6.4), not taught content' },
  // Listed file by file, never the directory: a later ko namespace file opts in on purpose, so taught Korean cannot slip past the scan.
  { path: 'packages/i18n/src/messages/ko/console.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10): Korean interface words, never taught Korean; a ko draft that adds keys here re-checks this' },
  { path: 'packages/i18n/src/messages/ko/caregiver.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10): Korean interface words, never taught Korean; a ko draft that adds keys here re-checks this' },
  { path: 'packages/i18n/src/messages/ko/learner.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10): Korean interface words, never taught Korean; a ko draft that adds keys here re-checks this' },
  { path: 'packages/i18n/src/messages/ko/a11y.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10): Korean interface words, never taught Korean; a ko draft that adds keys here re-checks this' },
  { path: 'packages/i18n/src/messages/ko/common.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10): Korean interface words, never taught Korean; a ko draft that adds keys here re-checks this' },
  { path: 'packages/i18n/src/messages/ko/landing.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10, PR 16): Korean site words, never taught Korean (the hero letter and Hoya phrase arrive as arguments)' },
  { path: 'packages/i18n/src/messages/ko/report.ts', reason: 'the whole ko UI overlay file (F-I18N-001 §3.10, PR 16): Korean report words, never taught Korean (letters and words arrive as arguments)' },
  { path: 'packages/i18n/src/messages/ko/index.ts', reason: 'the ko overlay barrel (F-I18N-001 PR 16): a doc comment naming the Korean registers' },
  { path: 'apps/mobile/src/navigation/sentence-builder-e2e-fixtures.ts', reason: 'the Sentence Builder e2e rounds (F-CURR-001 G-1), reached only through the fixture-build e2e hook, never a learner; each pair is still checked R1 to R4 in apps/mobile/src/content/__tests__/romanization.test.ts' },
  { path: 'packages/content-schema/src/schemas/transfer-consent-ko.ts', reason: 'the Korean consent lines (that file only) of a class move (F-SPACE-002 section 4.11, T-6d): Korean UI-locale legal text shown to a guardian, never taught Korean' },
  { path: 'packages/content-schema/src/schemas/class-scope-ko.ts', reason: 'the Korean class-scope update (that file only), [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 3: Korean UI-locale text shown to a guardian, never taught Korean' },
  { path: 'content/stories/research/', reason: 'provenance data: `rr` keys and a hyphenated romanization R2 would reject (same skip as SKIPPED_DIRS in scripts/validate-content.mjs)' },
  { path: '*.md', reason: 'documentation, not shipped content' },
  // Generated from class A JSON; listed so they do not trip the check when stories and vocabulary ship.
  { path: 'apps/mobile/src/content/__generated__/stories-index.ts', reason: 'the story shelf, generated from content/stories/*.json (scanned as class A) by scripts/build-stories.mjs (F-CURR-002 CM-8)' },
  { path: 'apps/mobile/src/content/__generated__/story-chunks/', reason: 'one body chunk per story, generated from content/stories/*.json (scanned as class A) by scripts/build-stories.mjs (F-CURR-002 CM-8)' },
  { path: 'apps/mobile/src/content/__generated__/vocab.ts', reason: 'generated from content/vocab/*.json (scanned as class A) by scripts/build-vocab.mjs' },
  { path: 'apps/web/src/data/vocab-catalog.ts', reason: 'generated from content/vocab/*.json (scanned as class A) by scripts/build-vocab.mjs' },
  { path: 'apps/web/src/data/third-party-notices.json', reason: 'generated open-source notices (scripts/third-party-notices.mjs): a package author\'s name as the package states it, not taught Korean' },
  { path: 'apps/mobile/src/content/placement.generated.ts', reason: 'generated from content/placement/*.json (scanned as class A) by scripts/build-placement-bank.mjs' },
  { path: 'packages/content-schema/src/i18n-overlays.generated.ts', reason: 'generated from content/i18n/<locale>/*.json (scanned as class A) by scripts/build-overlays.mjs; the ko overlays (F-I18N-001 PR 16) carry Korean glosses and sound hints; a ko sound hint quotes only its jamo\'s own example word or spoken syllable, which Discover shows through KoreanText (pinned by apps/mobile/src/content/__tests__/overlays.test.ts)' },
  { path: 'packages/content-schema/src/i18n-overlays-ko.generated.ts', reason: 'the ko table of i18n-overlays.generated.ts on its own (scripts/build-overlays.mjs; the learner PWA\'s Korean locale chunk, F-CURR-002 §10): the same text, under the same reason' },
  // Scene-art library (F-STORY-002 PR 2.3b): Korean appears only in sourceRef citations (the cited page title and publisher, as in a fact source); alt and accuracyNote are Hangul-free, enforced by packages/design-system/src/scene-art/__tests__/registry.test.ts.
  { path: 'packages/design-system/src/scene-art/props/', reason: 'sourceRef citation titles and publishers (the cited Korean page), never drawn or taught; alt and accuracyNote stay Hangul-free (scene-art registry.test.ts)' },
  { path: 'packages/design-system/src/scene-art/settings/', reason: 'sourceRef citation titles and publishers (the cited Korean page), never drawn or taught; alt and accuracyNote stay Hangul-free (scene-art registry.test.ts)' },
  { path: 'apps/web/src/data/catalogue-titles.generated.ts', reason: 'the ko UI-language titles of catalogue ids, generated from content/i18n/ko (AMENDMENTS-LECTURE-V2 LV-3): interface titles in the Korean UI, never taught Korean; the overlay files themselves are checked by the locale overlay rules' },
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

/** A registered file, or a file below a registered folder (an entry ending in `/`, such as the generated lesson chunks). */
export function isRegistered(path: string): boolean {
  return REGISTERED_SOURCES.some((s) => (isDirPrefix(s.path) ? path.startsWith(s.path) : path === s.path));
}

/** The files a registered entry covers: itself, or every scanned file below a registered folder. */
function registeredFiles(root: string): string[] {
  const scanned = REGISTERED_SOURCES.some((s) => isDirPrefix(s.path)) ? scannedFiles(root) : [];
  return REGISTERED_SOURCES.flatMap((s) => (isDirPrefix(s.path) ? scanned.filter((f) => f.startsWith(s.path)) : [s.path]));
}

/**
 * Findings of the coverage check (F-CNT-002 §3.4): a Hangul-bearing file that is neither
 * registered, scanned as class A nor ignored; a registered file or suite that is gone (or a
 * suite that no longer mentions the file); an ignore entry with no reason or no match.
 */
export function coverageProblems(root: string = REPO_ROOT): string[] {
  const problems: string[] = [];
  const scanned = scannedFiles(root);
  for (const f of scanned.filter((p) => HANGUL_SYLLABLE.test(readFileSync(join(root, p), 'utf8')))) {
    if (isClassA(f) || isRegistered(f) || isIgnored(f) !== undefined) continue;
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
  const texts = [...registeredFiles(root), ...contentJsonFiles(root)]
    .filter((p) => existsSync(join(root, p)))
    .map((p) => readFileSync(join(root, p), 'utf8'));
  return exceptions.map((e) => e.ko).filter((ko) => texts.some((t) => t.includes(ko)));
}
