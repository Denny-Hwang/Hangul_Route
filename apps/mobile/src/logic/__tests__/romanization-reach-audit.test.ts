import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.8 (row RF-1c): taught Korean always has its romanization, and a folded one is
 * reachable by (a) a reveal control, (b) the tap the surface already reveals on, (c) the answer, or (d) the screen one tap
 * opens. This is the reach audit as a source scan, so a new surface cannot fold without a way.
 *
 * A surface folds when its source decides the line from the learner's mode: `mode === 'always'`, or a call of
 * `romanizationShown(mode, false)` with the reveal argument fixed at `false`. Every such site under `src/` is listed below with
 * its way and its evidence (a test or the line that shows it). A new site that is not listed fails here: add it with its way,
 * or give it a reveal first. The presenter (`logic/lecture/`), the level check (`logic/placement/`, its own `revealMode`) and
 * All lessons (`HomeSections.tsx`, an override that no learner `auto` reaches) are out of the audit (section 3.8).
 */
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === '__generated__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
  });
}

const OUT_OF_AUDIT = [/^logic\/lecture\//, /^logic\/placement\//, /^logic\/locale\//, /^logic\/transfers\//, /^screens\/browse\/HomeSections\.tsx$/];

const FOLD = [/===\s*'always'/, /\b(?:romanizationShown|showRomanization)\([^()]*(?:\([^()]*\))?[^()]*,\s*false\)/];

const isCommentLine = (line: string): boolean => /^\s*(\*|\/\/|\/\*)/.test(line);

/** The folding sites of a source file: its code lines (comments left out) that match a fold pattern. */
function foldSites(source: string): string[] {
  return source.split('\n').filter((line) => !isCommentLine(line) && FOLD.some((re) => re.test(line)));
}

type Way = 'a' | 'b' | 'c' | 'd';
interface Evidence {
  /** A test or source file under `src/`. */
  file: string;
  /** Text the file must contain: the test's name, or the line that gives the way. */
  contains: string;
}
interface Audited {
  /** How many folding sites the file has. */
  sites: number;
  /** Which of (a) to (d) holds for them, one per site in source order. */
  ways: Way[];
  /** What the sites fold, and where the learner reaches it. */
  note: string;
  evidence: Evidence[];
}

const REACH_TEST = 'screens/__tests__/romanization-reach.test.tsx';
const VOCAB_REACH_TEST = 'screens/vocab/__tests__/vocab-romanization-reach.test.tsx';

const AUDIT: Record<string, Audited> = {
  'logic/pic-word-flow.ts': {
    sites: 1,
    ways: ['b'],
    note: 'A word tile: shown when selected, and every tile ends matched (the board resolves with every word shown).',
    evidence: [{ file: 'logic/__tests__/pic-word-flow.test.ts', contains: 'tap mode: a touched word has a line to wait for' }],
  },
  'logic/realia-read-flow.ts': {
    sites: 4,
    ways: ['a', 'c', 'c', 'b'],
    note: 'A line: its tap reveals it (a). The title and the key word: the answer shows them (c, RF-1c). An option: the touched one.',
    evidence: [
      { file: 'logic/__tests__/realia-read-flow.test.ts', contains: 'a line tap plays the line and reveals it' },
      { file: REACH_TEST, contains: 'the title and the key word fold while the question is open and show with the answer' },
    ],
  },
  'logic/listen-pick-flow.ts': {
    sites: 1,
    ways: ['c'],
    note: 'An option: the touched one, and every option once the round resolves on a host that is no Check (RF-1b).',
    evidence: [{ file: 'logic/__tests__/listen-pick-flow.test.ts', contains: 'every non-Check host shows every option once resolved' }],
  },
  'logic/sentence-builder/view.ts': {
    sites: 1,
    ways: ['c'],
    note: 'The tray and line tiles: the built sentence is drawn in full with its romanization on the done panel (c).',
    evidence: [{ file: REACH_TEST, contains: 'the done panel draws the whole sentence with its romanization' }],
  },
  'logic/vocab/topic-view.ts': {
    sites: 1,
    ways: ['d'],
    note: 'A topic tile: the topic page it opens folds the title too and has Show how to say it (d).',
    evidence: [
      { file: VOCAB_REACH_TEST, contains: 'the Korean title folds, Show how to say it shows it' },
      { file: 'screens/vocab/VocabTopicScreen.tsx', contains: 'testID="vocab-topic-reveal"' },
    ],
  },
  'logic/cloze-pick/view.ts': {
    sites: 1,
    ways: ['c'],
    note: "The sentence's romanization waits for the answer (c), the same line the held Check shows.",
    evidence: [{ file: 'logic/cloze-pick/view.ts', contains: "ctx.romanizationMode === 'always' || found ?" }],
  },
  'screens/minigames/HiddenHeritageGame.tsx': {
    sites: 2,
    ways: ['a', 'c'],
    note: 'The asked word: its tap hears it and shows it (a). The found slots: the end panel lists every found word with its romanization (c, RF-1c).',
    evidence: [
      { file: REACH_TEST, contains: 'the end panel shows every found word with its romanization' },
      { file: 'screens/minigames/HiddenHeritageGame.tsx', contains: "romanizationShown={romanizationMode === 'always' || revealed}" },
    ],
  },
  'screens/library/StoryTileGrid.tsx': {
    sites: 1,
    ways: ['d'],
    note: 'A story tile: the episode page it opens makes the title a button that hears it and shows it (d).',
    evidence: [{ file: 'logic/story/__tests__/story-episode.test.ts', contains: 'hide-until-tap (D2): hidden until tapped, and the tap stays' }],
  },
  'screens/vocab/VocabCardsScreen.tsx': {
    sites: 1,
    ways: ['c'],
    note: "The Check question's word: the answer shows it (c).",
    evidence: [{ file: 'logic/vocab/__tests__/question-view.test.ts', contains: 'once over: the answer word under the picture' }],
  },
  'screens/vocab/VocabSpeedRoundScreen.tsx': {
    sites: 1,
    ways: ['c'],
    note: "A question's word: the reveal beat after the answer shows it (c); the words to see again show it on the results screen (c, RF-1c).",
    evidence: [
      { file: 'logic/vocab/__tests__/question-view.test.ts', contains: 'once over: the answer word under the picture' },
      { file: VOCAB_REACH_TEST, contains: 'every word to see again shows its romanization' },
    ],
  },
  'screens/quest/quest-review-chunk.tsx': {
    sites: 1,
    ways: ['c'],
    note: 'The warm-up and Try these again (practice): the answer shows it (right or missed).',
    evidence: [{ file: 'screens/quest/quest-review-chunk.tsx', contains: "romanizationMode === 'always' || right || missed" }],
  },
};

describe('the reach audit (AMENDMENTS-ROMANIZATION-FADE section 3.8, row RF-1c)', () => {
  const files = sourceFiles(SRC)
    .map((f) => ({ rel: relative(SRC, f).split('\\').join('/'), source: readFileSync(f, 'utf8') }))
    .filter((f) => !OUT_OF_AUDIT.some((re) => re.test(f.rel)));
  const found = new Map(files.map((f) => [f.rel, foldSites(f.source).length] as const).filter(([, n]) => n > 0));

  it('scans the source', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it('every file that folds a romanization is in the audit, with the number of sites it has', () => {
    const actual = Object.fromEntries([...found].sort(([a], [b]) => a.localeCompare(b)));
    const listed = Object.fromEntries(Object.entries(AUDIT).map(([file, a]) => [file, a.sites]).sort(([a], [b]) => String(a).localeCompare(String(b))));
    expect(actual).toEqual(listed);
  });

  it.each(Object.entries(AUDIT))('%s: one way per site, each (a) to (d), and its evidence exists', (file, audited) => {
    expect(audited.ways).toHaveLength(audited.sites);
    for (const way of audited.ways) expect(['a', 'b', 'c', 'd']).toContain(way);
    expect(audited.note.length).toBeGreaterThan(0);
    expect(audited.evidence.length).toBeGreaterThan(0);
    for (const e of audited.evidence) {
      const path = join(SRC, e.file);
      expect(existsSync(path), `${file}: ${e.file}`).toBe(true);
      expect(readFileSync(path, 'utf8'), `${file}: ${e.file}`).toContain(e.contains);
    }
  });

  describe('the scan', () => {
    it.each([
      ['a mode test', "const shown = context.romanizationMode === 'always' || touched ? r : '';"],
      ['a hook test', "const romanizationShown = useRomanizationMode() === 'always';"],
      ['a call with the reveal fixed at false', 'const s = romanizationShown(i.romanizationMode, false);'],
      ['a call under another name', 'const s = showRomanization(useRomanizationMode(), false);'],
    ])('catches %s', (_, line) => {
      expect(foldSites(line)).toHaveLength(1);
    });

    it.each([
      ['a call with a reveal flag', 'const s = romanizationShown(mode, revealed);'],
      ['a call with the answer', 'const s = romanizationShown(romanizationMode, answered);'],
      ['a comment', " * so every consumer that tests `=== 'always'` keeps its type"],
      ['the shown default', '<KoreanText ko={k} romanization={r} />'],
    ])('lets %s through', (_, line) => {
      expect(foldSites(line)).toHaveLength(0);
    });
  });
});
