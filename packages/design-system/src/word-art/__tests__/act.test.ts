import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANIMAL_GLYPHS } from '../glyphs/animal';
import { ACT_GLYPHS, loadActWordArt } from '../glyphs/act';
import { parsePath } from '../path';
import { ACT_FAMILIES, ACT_KEYS, WORD_ART, WORD_ART_FAMILIES, WORD_ART_KEYS, WORD_ART_KEY_RE, WORD_ART_PLAN, addWordArt, getWordArt } from '../registry';
import { isWordArtTone } from '../tones';
import type { WordArtGlyph, WordArtShape } from '../types';
import { fillTones, glyphViolations } from './glyph-checks';

/**
 * [PV] The level check's action pictures (AMENDMENTS-PLC-VALIDITY S3, S5, row PV-1a; F-VOC-002 §3.9): the `act`
 * family. Every key is `reserved`, outside the family plan (`WORD_ART_PLAN.act = 0`) and outside the start registry:
 * the glyphs load with the level check's chunk, which hands them to `addWordArt` (§3.8's split), so the start bundle
 * carries only `ACT_KEYS`. Every §3.5 rule of a hand glyph holds for them, and each picture shows its action by the
 * cue S3 names.
 */

const VOCAB_DIR = join(__dirname, '..', '..', '..', '..', '..', 'content', 'vocab');
const topicVisuals = readdirSync(VOCAB_DIR)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .flatMap((name) => (JSON.parse(readFileSync(join(VOCAB_DIR, name), 'utf8')) as { items: { visual: string }[] }).items.map((i) => i.visual));

const PAINT_KEYS = new Set(['f', 's', 'sw', 'o']);
const GEOMETRY: Record<string, readonly string[]> = { circle: ['t', 'x', 'y', 'r'], ellipse: ['t', 'x', 'y', 'rx', 'ry'], rect: ['t', 'x', 'y', 'w', 'h', 'r'], path: ['t', 'd'] };
const predicateOf = (key: string): string => key.split('-')[1]!;
const nounOf = (key: string): string => key.split('-')[2]!;
const glyphs = Object.entries(ACT_GLYPHS);

/** An open eye: a small ink-filled circle with no stroke (`face()`, the side views' eye, the fish's eye). */
const openEyes = (g: WordArtGlyph): WordArtShape[] => g.filter((s) => s.t === 'circle' && s.f === 'text.primary' && s.s === undefined && s.r <= 3.5);
const hasShadow = (g: WordArtGlyph): boolean => g.some((s) => s.f === 'hoya.furDark' && (s.o ?? 1) < 0.5);
/** The crescent moon: the one `hoya.fur` path drawn with two arcs. */
const hasMoon = (g: WordArtGlyph): boolean => g.some((s) => s.t === 'path' && s.f === 'hoya.fur' && (s.d.match(/ A /g) ?? []).length === 2);
/** Motion lines: an ink detail path of horizontal strokes only. */
const hasSpeedLines = (g: WordArtGlyph): boolean => g.some((s) => s.t === 'path' && s.f === undefined && s.s === 'text.primary' && /^M [\d.]+ [\d.]+ H [\d.]+( M [\d.]+ [\d.]+ H [\d.]+)+$/.test(s.d));

describe('the act family in the registry', () => {
  it('is a family of the key grammar with a plan of 0', () => {
    expect(WORD_ART_FAMILIES).toContain('act');
    expect(WORD_ART_PLAN.act).toBe(0);
  });

  // Runs before any load in this file: vitest isolates each test file's modules (the default), so the registry's late
  // store starts empty here even though registry-lessons.test.ts loads the glyphs in its own file.
  it('has no glyph in the start registry, and no glyph until its chunk hands them over', () => {
    expect(WORD_ART_KEYS.filter((k) => k.startsWith('act-'))).toEqual([]);
    expect(Object.keys(WORD_ART).some((k) => k.startsWith('act-'))).toBe(false);
    for (const key of ACT_KEYS) expect(getWordArt(key), key).toBeUndefined();
  });

  it('loads every declared key, reserved and waiting for review, frozen, and a second load changes nothing', () => {
    const first = loadActWordArt();
    expect(Object.keys(first).sort()).toEqual([...ACT_KEYS].sort());
    for (const key of ACT_KEYS) {
      expect(first[key]!.meta, key).toEqual({ family: 'act', status: 'review', reserved: true });
      expect(getWordArt(key), key).toBe(first[key]!.glyph);
      expect(Object.isFrozen(first[key]!.glyph) && first[key]!.glyph.every((s) => Object.isFrozen(s)), key).toBe(true);
    }
    const second = loadActWordArt();
    for (const key of ACT_KEYS) expect(second[key]!.glyph, key).toBe(first[key]!.glyph);
  });

  it('refuses a family that does not load late, and glyphs that do not match the declared keys', () => {
    expect(() => addWordArt(['food', {}])).toThrow(/does not load late/);
    const { 'act-run-bear': _bear, ...rest } = ACT_GLYPHS;
    expect(() => addWordArt(['act', rest])).toThrow(/declared keys/);
    expect(() => addWordArt(['act', { ...ACT_GLYPHS, 'act-run-fox': ACT_GLYPHS['act-run-bear']! }])).toThrow(/declared keys/);
  });

  it('is used by no vocabulary topic (so every key may be reserved)', () => {
    expect(topicVisuals.filter((v) => v.startsWith('word:act-'))).toEqual([]);
  });
});

describe('the families (S5)', () => {
  it('are at least ten nouns of three different predicates, with at least five predicates in all', () => {
    const nouns = Object.keys(ACT_FAMILIES);
    expect(nouns.length).toBeGreaterThanOrEqual(10);
    for (const [noun, predicates] of Object.entries(ACT_FAMILIES)) expect(new Set(predicates).size, noun).toBe(3);
    expect(new Set(Object.values(ACT_FAMILIES).flat()).size).toBeGreaterThanOrEqual(5);
  });

  it('name every key act-<predicate>-<noun>: exactly three hyphen-free parts, in the key grammar', () => {
    expect(ACT_KEYS).toHaveLength(30);
    for (const key of ACT_KEYS) {
      expect(key).toMatch(/^act-[a-z]+-[a-z]+$/);
      expect(key).toMatch(WORD_ART_KEY_RE);
      expect(ACT_FAMILIES[nounOf(key)]).toContain(predicateOf(key));
    }
  });

  it('keep no predicate in more than 40 % of the pictures, so no action is the typical answer', () => {
    const per = new Map<string, number>();
    for (const key of ACT_KEYS) per.set(predicateOf(key), (per.get(predicateOf(key)) ?? 0) + 1);
    for (const [predicate, count] of per) expect(count / ACT_KEYS.length, predicate).toBeLessThanOrEqual(0.4);
  });

  it('draw exactly the declared keys', () => {
    expect(Object.keys(ACT_GLYPHS).sort()).toEqual([...ACT_KEYS].sort());
  });
});

describe.each(glyphs)('%s (§3.5)', (key, glyph) => {
  it('passes every rule of a hand glyph: tones, widths, at most 4 fill tones, 32 shapes, inside the frame, 60-70 % and centred', () => {
    expect(glyphViolations(glyph, {}, isWordArtTone)).toEqual([]);
  });

  it('uses only the shape kinds and fields of §3.1, writes every path in the grammar and rounds every coordinate to one decimal', () => {
    for (const s of glyph) {
      expect(Object.keys(s).every((k) => GEOMETRY[s.t]!.includes(k) || PAINT_KEYS.has(k)), JSON.stringify(s)).toBe(true);
      if (s.t === 'path') expect(parsePath(s.d), s.d).not.toBeNull();
      for (const [k, v] of Object.entries(s)) if (k !== 'sw' && k !== 'o' && typeof v === 'number') expect(Math.abs(v * 10 - Math.round(v * 10)), `${key}: ${k} ${v}`).toBeLessThan(1e-9);
    }
  });

  it('uses the content tones only as pictures do: never feedback.danger, and only highlight or shadow opacity', () => {
    for (const s of glyph) {
      expect([s.f, s.s]).not.toContain('feedback.danger');
      if (s.o !== undefined) expect(s.o === 0.18 || s.o === 0.55, key).toBe(true);
    }
  });
});

describe('each picture shows its action by the cue S3 names', () => {
  it.each(glyphs.filter(([k]) => predicateOf(k) === 'sleep'))('%s: asleep, eyes closed, a crescent moon', (_key, glyph) => {
    expect(openEyes(glyph)).toEqual([]);
    expect(hasMoon(glyph)).toBe(true);
  });

  it.each(glyphs.filter(([k]) => predicateOf(k) !== 'sleep'))('%s: awake, eyes open, no moon', (_key, glyph) => {
    expect(openEyes(glyph).length).toBeGreaterThan(0);
    expect(hasMoon(glyph)).toBe(false);
  });

  it.each(glyphs.filter(([k]) => predicateOf(k) === 'swim'))('%s: in the water (sky-blue), no ground shadow', (_key, glyph) => {
    expect(fillTones(glyph)).toContain('vocab.skyBlue');
    expect(hasShadow(glyph)).toBe(false);
  });

  it.each(glyphs.filter(([k]) => predicateOf(k) === 'run'))('%s: on the ground with motion lines behind', (_key, glyph) => {
    expect(hasShadow(glyph)).toBe(true);
    expect(hasSpeedLines(glyph)).toBe(true);
  });

  it.each(glyphs.filter(([k]) => predicateOf(k) === 'fly'))('%s: in the air over a paper cloud, no ground shadow', (_key, glyph) => {
    expect(fillTones(glyph)).toContain('surface.paper');
    expect(hasShadow(glyph)).toBe(false);
  });

  /** What each eater holds at its mouth, by its tone: a carrot, a fish, a banana, seeds, a bowl of rice. */
  const FOOD: Readonly<Record<string, string>> = { rabbit: 'vocab.orange', cat: 'vocab.skyBlue', monkey: 'vocab.yellow', bird: 'vocab.brown', sibling: 'vocab.red', friend: 'vocab.red' };

  it.each(glyphs.filter(([k]) => predicateOf(k) === 'eat'))('%s: still, on the ground, the food in its tone', (key, glyph) => {
    expect(hasShadow(glyph)).toBe(true);
    expect(hasSpeedLines(glyph)).toBe(false);
    expect(fillTones(glyph)).toContain(FOOD[nounOf(key)]);
  });
});

describe('one noun, one look (S5: the noun-only reader finds the three pictures of the noun)', () => {
  it('no two pictures have identical data (C8)', () => {
    const seen = new Set(glyphs.map(([, g]) => JSON.stringify(g)));
    expect(seen.size).toBe(glyphs.length);
  });

  const FUR: Readonly<Record<string, string>> = { bear: 'vocab.brown', tiger: 'hoya.fur', puppy: 'stage.stage2', rabbit: 'vocab.white', cat: 'vocab.orange', monkey: 'vocab.brown', bird: 'vocab.blue', duck: 'vocab.yellow' };

  it.each(Object.entries(FUR))('every %s picture wears the fur (%s) of its word picture', (noun, fur) => {
    expect(fillTones(ANIMAL_GLYPHS[`animal-${noun}`]!)).toContain(fur);
    for (const p of ACT_FAMILIES[noun]!) expect(fillTones(ACT_GLYPHS[`act-${p}-${noun}`]!), `${p} ${noun}`).toContain(fur);
  });

  it('the two people are told apart by hair and clothes, and each keeps them in all three pictures', () => {
    const look = (noun: string): string[][] => ACT_FAMILIES[noun]!.map((p) => fillTones(ACT_GLYPHS[`act-${p}-${noun}`]!));
    for (const tones of look('sibling')) expect(tones).toContain('vocab.green');
    for (const tones of look('friend')) expect(tones).toEqual(expect.arrayContaining(['brand.secondary', 'vocab.brown']));
  });
});
