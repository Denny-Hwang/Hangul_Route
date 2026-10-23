import { describe, expect, it } from 'vitest';
import { drawScene } from '../draw';
import { LETTERS_SCHOOL_SCENE } from '../hidden-heritage/letters-school';
import { FOOD_MARKET_SCENE } from '../hidden-heritage/food-market';
import { HIDDEN_HERITAGE_LIMITS, checkHiddenHeritageRound, checkHiddenHeritageScene, sceneRegistry } from '../hidden-heritage/profile';
import type { HiddenHeritageScene } from '../hidden-heritage/types';
import { SCENE_ART_REGISTRY } from '../registry';
import { resolveScene } from '../resolve';
import { cappedPalette, serializedBytes } from '../rules';

/**
 * The Letters Hidden Heritage scene (F-CURR-002 §5.2 and §7.1 F7, row CM-37 part 1; the scene style guide of
 * design/wireframes/minigame/hidden-heritage.md): a school room of earlier times, run through the CM-36 profile.
 */

const SCENE = LETTERS_SCHOOL_SCENE;
const clone = (): HiddenHeritageScene => JSON.parse(JSON.stringify(SCENE)) as HiddenHeritageScene;
const rules = (findings: Array<{ rule: string }>): string[] => [...new Set(findings.map((f) => f.rule))].sort();

describe('the Letters school room scene (row CM-37)', () => {
  it('passes every rule of the hidden-heritage profile', () => {
    expect(checkHiddenHeritageScene(SCENE)).toEqual([]);
  });

  it('is 25,000 B or less as its chunk carries it (§10 ceilings table), and within 14 layers, 240 shapes and 8 colours', () => {
    expect(serializedBytes(SCENE)).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.chunkBytes);
    const resolved = resolveScene(SCENE.art, sceneRegistry(SCENE));
    expect(SCENE.art.layers.length).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.layers);
    expect(resolved.stats.shapes).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.shapes);
    expect(cappedPalette(resolved).length).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.colors);
    // Theme tokens only, never a ring, feedback or focus token.
    for (const token of resolved.stats.colors) expect(token, token).toMatch(/^(surface|text|border|theme)\./);
    expect(resolved.stats.colors).not.toContain('border.focus');
  });

  it('draws with its own items over the shared registry, which it leaves unchanged; its ids clash with no other scene', () => {
    const drawn = drawScene(SCENE.art, sceneRegistry(SCENE));
    expect(drawn.issues).toEqual([]);
    expect(drawn.items.length).toBeGreaterThan(20);
    const food = new Set(FOOD_MARKET_SCENE.items.map((i) => i.id));
    for (const item of SCENE.items) {
      expect(SCENE_ART_REGISTRY[item.id], item.id).toBeUndefined();
      expect(food.has(item.id), item.id).toBe(false);
    }
    expect(SCENE.id).not.toBe(FOOD_MARKET_SCENE.id);
  });

  it('names its six things with taught Letters words: three targets with a bundled picture, three other things', () => {
    const { round, things } = SCENE;
    expect(round.targets.map((t) => t.word.ko)).toEqual(['책', '붓', '나무']);
    expect(round.targets.map((t) => t.picture)).toEqual(['card:book', 'card:brush', 'word:nature-tree']);
    expect(round.others.map((t) => t.word.ko)).toEqual(['산', '새', '꽃']);
    expect(Object.keys(things).sort()).toEqual([...round.targets, ...round.others].map((t) => t.id).sort());
    // A target in each half; the reference round is the scene's own.
    expect(round.sceneId).toBe(SCENE.id);
    expect(SCENE.art.altEn).toBe(round.altEn);
  });

  it('carries no text in the picture and an alt text that names the setting only', () => {
    expect(JSON.stringify(SCENE.items)).not.toMatch(/[가-힣]/);
    const alt = SCENE.art.altEn.toLowerCase();
    for (const thing of [...SCENE.round.targets, ...SCENE.round.others]) expect(alt).not.toContain(thing.word.en);
    expect(SCENE.art.altEn.length).toBeLessThanOrEqual(140);
  });

  it('cites an allowlisted institution with its URL, access date and quoted words for every fact; reviewed by MAR in 3 or more passes', () => {
    const allow = ['National Museum of Korea', 'National Institute of Korean Language', 'National Hangeul Museum', 'Cheongju Early Printing Museum', 'UNESCO'];
    expect(SCENE.note.facts.length).toBeGreaterThanOrEqual(2);
    for (const fact of SCENE.note.facts) {
      expect(fact.sources.length, fact.id).toBeGreaterThan(0);
      expect(fact.claimEn, fact.id).not.toMatch(/[가-힣]/);
      for (const s of fact.sources) {
        expect(allow).toContain(s.institution);
        expect(s.url).toMatch(/^https:\/\/(www\.museum\.go\.kr|stdict\.korean\.go\.kr)\//);
        expect(s.accessed).toBe('2026-10-23');
        expect(s.quote.length).toBeGreaterThan(10);
      }
    }
    expect(SCENE.review.reviewedBy).toBe('MAR');
    expect(SCENE.review.passes).toBeGreaterThanOrEqual(3);
    expect(SCENE.review.notes.length).toBe(SCENE.review.passes);
    expect(JSON.stringify(SCENE.review)).not.toMatch(/native speaker|native-speaker|expert/i);
  });
});

describe('the profile catches a broken Letters scene', () => {
  it('a spot under 75 units, two spots too close, a spot off the canvas', () => {
    const s = clone();
    s.round.others[1]!.spot = { ...s.round.others[1]!.spot, w: 70 };
    expect(rules(checkHiddenHeritageRound(s, s.round))).toContain('H-1');
    const t = clone();
    t.round.targets[1]!.spot = { ...t.round.targets[1]!.spot, x: 104 };
    expect(rules(checkHiddenHeritageRound(t, t.round))).toContain('H-2');
    const u = clone();
    u.round.others[1]!.spot = { ...u.round.others[1]!.spot, x: 340 };
    expect(rules(checkHiddenHeritageRound(u, u.round))).toContain('H-4');
  });

  it('a target that takes the colour of the wall behind it', () => {
    const s = clone();
    const books = s.items.find((i) => i.id === 'prop:hh-bound-books')!;
    books.nodes = books.nodes.map((n) => (n.fill === 'theme.life' ? ({ ...n, fill: 'surface.sunken' } as typeof n) : n));
    expect(rules(checkHiddenHeritageRound(s, s.round))).toContain('H-camouflage');
  });

  it('every target on the left would leave the right half without one', () => {
    const s = clone();
    s.round.targets = s.round.targets.map((x) => ({ ...x, spot: { ...x.spot, x: Math.min(x.spot.x, 100) } }));
    expect(rules(checkHiddenHeritageRound(s, s.round))).toContain('H-focal');
  });
});
