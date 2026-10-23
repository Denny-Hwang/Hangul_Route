import { describe, expect, it } from 'vitest';
import { HIDDEN_HERITAGE_LIMITS, checkHiddenHeritageRound, checkHiddenHeritageScene, sceneRegistry } from '../hidden-heritage/profile';
import { SEOLLAL_ROOM_SCENE } from '../hidden-heritage/seollal-room';
import type { HiddenHeritageScene } from '../hidden-heritage/types';
import { drawScene } from '../draw';
import { SCENE_ART_REGISTRY } from '../registry';
import { resolveScene } from '../resolve';
import { serializedBytes } from '../rules';

/**
 * The Holidays & Traditions Hidden Heritage scene (F-CURR-002 §7.1 F7, §5.4 and OD-10, row CM-37 part 2): a hanok room
 * on Seollal morning, checked by the `hidden-heritage` profile of the scene style guide
 * (design/wireframes/minigame/hidden-heritage.md).
 */

const scene = SEOLLAL_ROOM_SCENE;
const clone = (): HiddenHeritageScene => JSON.parse(JSON.stringify(scene)) as HiddenHeritageScene;
const rules = (findings: Array<{ rule: string }>): string[] => [...new Set(findings.map((f) => f.rule))].sort();

describe('the Seollal room scene (row CM-37)', () => {
  it('passes every rule of the hidden-heritage profile', () => {
    expect(checkHiddenHeritageScene(scene)).toEqual([]);
  });

  it('is 25,000 B or less as its chunk carries it (§10 ceilings table), overlays included', () => {
    expect(serializedBytes(scene)).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.chunkBytes);
    const fat = clone();
    fat.note = { ...fat.note, accuracyNote: 'x'.repeat(25_000) };
    expect(rules(checkHiddenHeritageScene(fat))).toEqual(['H-budget']);
  });

  it('draws with its own items over the shared registry, which it leaves unchanged', () => {
    const drawn = drawScene(scene.art, sceneRegistry(scene));
    expect(drawn.issues).toEqual([]);
    expect(drawn.items.length).toBeGreaterThan(20);
    for (const item of scene.items) expect(SCENE_ART_REGISTRY[item.id], item.id).toBeUndefined();
  });

  it('keeps within the composition limits: 14 layers, 240 shapes, 8 colours and none of the ring or focus tokens', () => {
    const resolved = resolveScene(scene.art, sceneRegistry(scene));
    expect(scene.art.layers.length).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.layers);
    expect(resolved.stats.shapes).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.shapes);
    expect(resolved.stats.colors.length).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.colors);
    for (const token of resolved.stats.colors) expect(token.startsWith('feedback.') || token === 'border.focus', token).toBe(false);
  });

  it('targets three taught Stage 2 Holidays words with their bundled card pictures, among three other things', () => {
    const { round, things } = scene;
    expect(round.targets.map((t) => t.word.ko)).toEqual(['한복', '떡국', '연']);
    expect(round.targets.map((t) => t.picture)).toEqual(['card:hanbok', 'card:tteokguk', 'card:kite']);
    expect(round.others.map((t) => t.word.ko)).toEqual(['복주머니', '방석', '윷']);
    expect(Object.keys(things).sort()).toEqual([...round.targets, ...round.others].map((t) => t.id).sort());
  });

  it('every hit area is at least 75 x 75 units, 11 apart, inside the canvas and over its drawn thing (H-1 to H-4)', () => {
    expect(checkHiddenHeritageRound(scene, scene.round)).toEqual([]);
    const tight = clone();
    tight.round.others[1]!.spot = { ...tight.round.others[1]!.spot, x: 166 };
    expect(rules(checkHiddenHeritageRound(tight, tight.round))).toContain('H-2');
    const small = clone();
    small.round.targets[2]!.spot = { ...small.round.targets[2]!.spot, w: 70 };
    expect(rules(checkHiddenHeritageRound(small, small.round))).toEqual(expect.arrayContaining(['H-1', 'H-3']));
  });

  it('draws one holiday only and no ancestral-rite table, screen or writing (OD-9; style guide rule 1)', () => {
    const drawn = JSON.stringify(scene.items.map((i) => [i.alt, i.nodes]));
    expect(drawn).not.toMatch(/[가-힣]/);
    expect(drawn).not.toMatch(/songpyeon|ogokbap|folding screen|offering|altar/i);
    for (const target of scene.round.targets) expect(scene.art.altEn.toLowerCase()).not.toContain(target.word.en);
  });

  it('carries es and ko text for its alt text, every thing and every fact, none of it blank', () => {
    const ids = [...scene.round.targets, ...scene.round.others].map((t) => t.id).sort();
    for (const locale of ['es', 'ko'] as const) {
      const o = scene.overlays?.[locale];
      expect(o, locale).toBeDefined();
      expect(o!.alt.trim().length).toBeGreaterThan(0);
      expect(Object.keys(o!.things).sort()).toEqual(ids);
      expect(Object.keys(o!.facts).sort()).toEqual(scene.note.facts.map((f) => f.id).sort());
      for (const value of [o!.alt, ...Object.values(o!.things), ...Object.values(o!.facts)]) expect(value.trim(), locale).not.toBe('');
    }
    expect(scene.overlays!.ko!.alt).toMatch(/[가-힣]/);
  });

  it('cites a public source for every fact with its URL, access date and quoted words; reviewed by MAR in 3 or more passes', () => {
    const allow = ['National Folk Museum of Korea', 'Korea Heritage Service', 'Korea Astronomy and Space Science Institute', 'UNESCO', 'National Institute of Korean Language'];
    for (const fact of scene.note.facts) {
      expect(fact.sources.length, fact.id).toBeGreaterThan(0);
      for (const s of fact.sources) {
        expect(allow).toContain(s.institution);
        expect(s.url).toMatch(/^https:\/\/(folkency\.nfm\.go\.kr|www\.heritage\.go\.kr|www\.khs\.go\.kr|astro\.kasi\.re\.kr)\//);
        expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.quote.length).toBeGreaterThan(10);
      }
    }
    for (const item of scene.items.filter((i) => i.tags?.heritage)) expect(item.sourceRef?.url, item.id).toMatch(/^https:\/\//);
    expect(scene.review.reviewedBy).toBe('MAR');
    expect(scene.review.passes).toBeGreaterThanOrEqual(3);
    expect(scene.review.notes.length).toBeGreaterThanOrEqual(scene.review.passes);
    expect(JSON.stringify(scene.review)).not.toMatch(/native speaker|native-speaker|expert/i);
  });
});
