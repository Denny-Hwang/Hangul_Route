import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LectureDeckSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes } from '../../../content';
import type { SlideKind } from '../build-steps';
import { lectureBundle } from '../content';
import { expandDeck, type Slide } from '../deck-builder';
import { SHELL_SLIDE_KINDS } from '../shell';
import { slideHasTargets } from '../stage-gesture';

/**
 * Content targets (AMENDMENTS-PRESENTER-NAV section 7.1, row PN-2): the slide kinds the room points
 * at, exactly, and a source scan holding every list item the target slides draw to a
 * `stageTarget` marker (options with their number), so a tap there never steps.
 */

/** Section 7.1, exhaustive: a new slide kind must say here whether it has targets. */
const HAS_TARGETS: Readonly<Record<SlideKind, boolean>> = {
  title: false,
  letter: false,
  syllable: false,
  vocab: false,
  sequence: true,
  card: false,
  quiz: true,
  activity: false,
  story: false,
  end: false,
  sentence: false,
  pattern: false,
  'read-along': false,
  realia: false,
  'sentence-build': true,
  'write-together': true,
  // The Role Play turn's replies are the quiz's option rows (`OptionRows`, each with its `stageTarget` marker).
  'role-play': true,
  // Hidden Heritage is a scene the room points at in the room; nothing on it is pointable on the stage.
  'hidden-heritage': false,
};

describe('slideHasTargets (section 7.1)', () => {
  it('is true for exactly the quiz, sequence, sentence-build, write-together and role-play kinds', () => {
    for (const kind of SHELL_SLIDE_KINDS) expect(slideHasTargets({ kind }), kind).toBe(HAS_TARGETS[kind]);
    expect(Object.keys(HAS_TARGETS).sort()).toEqual([...SHELL_SLIDE_KINDS].sort());
  });

  it('every slide of every grid episode deck follows its kind, whatever the build it shows', () => {
    const bundle = lectureBundle('en');
    const seen = new Set<SlideKind>();
    for (const episode of gridEpisodes(episodesAll)) {
      const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:targets', title: 'Targets', createdAt: '2026-10-29T00:00:00Z', seed: 1, blocks: [{ kind: 'episode', id: episode.id }] });
      for (const slide of expandDeck(deck, bundle, { canPlayKorean: true }).slides as Slide[]) {
        seen.add(slide.kind);
        // The rule reads the slide's kind only: each of its builds gives the same answer.
        for (let build = 0; build < slide.builds.length; build++) expect(slideHasTargets(slide), `${slide.key} build ${build}`).toBe(HAS_TARGETS[slide.kind]);
      }
    }
    // The walk reaches every target kind (and the common target-free ones).
    for (const kind of ['quiz', 'sequence', 'sentence-build', 'write-together', 'title', 'letter', 'vocab'] as const) expect(seen.has(kind), kind).toBe(true);
  });
});

const SLIDES = join(__dirname, '..', '..', '..', 'screens', 'presenter', 'slides');

/** Every JSX opening tag that carries `role="listitem"`, whole (braces, strings and arrows inside it included). */
function listItemTags(source: string): string[] {
  const tags: string[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf('role="listitem"', from);
    if (at < 0) return tags;
    const start = source.lastIndexOf('<', at);
    let depth = 0;
    let quote: string | null = null;
    let end = start + 1;
    for (; end < source.length; end++) {
      const c = source[end]!;
      if (quote !== null) {
        if (c === quote) quote = null;
        continue;
      }
      // A line comment inside the tag (an apostrophe in it is no quote).
      if (c === '/' && source[end + 1] === '/') end = source.indexOf('\n', end);
      else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(source.slice(start, end + 1));
    from = at + 1;
  }
}

describe('every list item a target slide draws is a content target (section 7.1 source scan)', () => {
  const read = (file: string): string => readFileSync(join(SLIDES, file), 'utf8');

  it('QuizParts: each option card and row carries its option number (option:1 to option:4)', () => {
    const tags = listItemTags(read('QuizParts.tsx'));
    expect(tags).toHaveLength(2);
    for (const tag of tags) expect(tag).toContain('stageTarget: optionTarget(index)');
  });

  it('SequenceSlide: each step is a step target', () => {
    const tags = listItemTags(read('SequenceSlide.tsx'));
    expect(tags).toHaveLength(1);
    for (const tag of tags) expect(tag).toContain("stageTarget: 'step'");
  });

  it('WriteTogetherSlide: each word chip and table cell is a chip target', () => {
    const tags = listItemTags(read('WriteTogetherSlide.tsx'));
    expect(tags).toHaveLength(2);
    for (const tag of tags) expect(tag).toContain("stageTarget: 'chip'");
  });

  it("RolePlaySlide: its replies are QuizParts' option rows (option targets); its chat bubbles are lines to read, not targets", () => {
    const source = read('RolePlaySlide.tsx');
    expect(source).toContain('<OptionRows');
    expect(source).not.toContain('stageTarget');
    expect(listItemTags(source)).toHaveLength(1);
  });

  it('HiddenHeritageSlide draws no list item and no target (the room points at the scene in the room)', () => {
    const source = read('HiddenHeritageSlide.tsx');
    expect(listItemTags(source)).toEqual([]);
    expect(source).not.toContain('stageTarget');
  });

  it('the scan reads a whole tag, a style with an arrow or a comparison inside it included', () => {
    expect(listItemTags('<View a={(x) => x > 1} role="listitem" s="a>b">x</View>')).toEqual(['<View a={(x) => x > 1} role="listitem" s="a>b">']);
    expect(listItemTags("<View style={{\n  // the block's padding\n  a: 1 }} role=\"listitem\">")).toEqual(["<View style={{\n  // the block's padding\n  a: 1 }} role=\"listitem\">"]);
    expect(listItemTags('<View>none</View>')).toEqual([]);
  });
});
