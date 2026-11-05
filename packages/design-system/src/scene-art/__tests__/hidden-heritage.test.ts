import { describe, expect, it } from 'vitest';
import { FOOD_MARKET_SCENE } from '../hidden-heritage/food-market';
import { HIDDEN_HERITAGE_LIMITS, checkHiddenHeritageRound, checkHiddenHeritageScene, sceneRegistry } from '../hidden-heritage/profile';
import { HIDDEN_HERITAGE_RINGS, type HiddenHeritageScene } from '../hidden-heritage/types';
import { drawScene } from '../draw';
import { SCENE_ART_REGISTRY } from '../registry';
import { serializedBytes } from '../rules';

/**
 * The Hidden Heritage scene profile (F-CURR-002 §7.1 F7, row CM-36; the scene style guide of
 * design/wireframes/minigame/hidden-heritage.md) on the first scene, the Food market stall, and on broken copies of it.
 */

const clone = (): HiddenHeritageScene => JSON.parse(JSON.stringify(FOOD_MARKET_SCENE)) as HiddenHeritageScene;
const rules = (findings: Array<{ rule: string }>): string[] => [...new Set(findings.map((f) => f.rule))].sort();

describe('the Food market scene (row CM-36)', () => {
  it('passes every rule of the hidden-heritage profile', () => {
    expect(checkHiddenHeritageScene(FOOD_MARKET_SCENE)).toEqual([]);
  });

  it('is 25,000 B or less as its chunk carries it (§10 ceilings table)', () => {
    const bytes = serializedBytes(FOOD_MARKET_SCENE);
    expect(HIDDEN_HERITAGE_LIMITS.chunkBytes).toBe(25_000);
    expect(bytes).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.chunkBytes);
    const fat = clone();
    fat.note = { ...fat.note, accuracyNote: 'x'.repeat(25_000) };
    expect(rules(checkHiddenHeritageScene(fat))).toEqual(['H-budget']);
  });

  it('draws with its own items over the shared registry, which it leaves unchanged', () => {
    const drawn = drawScene(FOOD_MARKET_SCENE.art, sceneRegistry(FOOD_MARKET_SCENE));
    expect(drawn.issues).toEqual([]);
    expect(drawn.items.length).toBeGreaterThan(20);
    for (const item of FOOD_MARKET_SCENE.items) expect(SCENE_ART_REGISTRY[item.id], item.id).toBeUndefined();
    expect(drawScene(FOOD_MARKET_SCENE.art, SCENE_ART_REGISTRY).issues.length).toBeGreaterThan(0);
  });

  it('names its eight things with Korean words: four targets with a bundled picture, four other things (row CM-43 S2)', () => {
    const { round, things } = FOOD_MARKET_SCENE;
    expect(round.targets.map((t) => t.word.ko)).toEqual(['밥', '김치', '떡', '젓가락']);
    expect(round.targets.map((t) => t.picture)).toEqual(['card:rice', 'card:kimchi', 'word:food-tteok', 'card:chopsticks']);
    expect(round.others.map((t) => t.word.ko)).toEqual(['국', '숟가락', '항아리', '바구니']);
    expect(Object.keys(things).sort()).toEqual([...round.targets, ...round.others].map((t) => t.id).sort());
  });

  it('carries no text in the picture and an alt text that names the setting only', () => {
    expect(JSON.stringify(FOOD_MARKET_SCENE.items)).not.toMatch(/[가-힣]/);
    for (const target of FOOD_MARKET_SCENE.round.targets) expect(FOOD_MARKET_SCENE.art.altEn.toLowerCase()).not.toContain(target.word.en);
  });

  it('cites an allowlisted institution with its URL, access date and quoted words for every fact; reviewed by MAR in 3 passes or more, a reviser among them', () => {
    const allow = ['National Museum of Korea', 'National Folk Museum of Korea', 'Korea Heritage Service', 'National Institute of Korean Language'];
    for (const fact of FOOD_MARKET_SCENE.note.facts) {
      expect(fact.sources.length, fact.id).toBeGreaterThan(0);
      for (const s of fact.sources) {
        expect(allow).toContain(s.institution);
        expect(s.url).toMatch(/^https:\/\/(www\.museum\.go\.kr|stdict\.korean\.go\.kr)\//);
        expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.quote.length).toBeGreaterThan(10);
      }
    }
    expect(FOOD_MARKET_SCENE.review).toMatchObject({ reviewedBy: 'MAR' });
    expect(FOOD_MARKET_SCENE.review.passes).toBeGreaterThanOrEqual(3);
    expect(FOOD_MARKET_SCENE.review.notes).toHaveLength(FOOD_MARKET_SCENE.review.passes);
    expect(FOOD_MARKET_SCENE.review.notes.some((n) => n.startsWith('Pass 4 (reviser)'))).toBe(true);
    expect(JSON.stringify(FOOD_MARKET_SCENE.review)).not.toMatch(/native speaker|native-speaker|expert/i);
  });
});

describe('the profile catches a broken scene', () => {
  it('H-1, H-2, H-3 and H-4 on the round', () => {
    const s = clone();
    s.round.others[1]!.spot = { x: 40, y: 58, w: 70, h: 92 };
    expect(rules(checkHiddenHeritageRound(s, s.round))).toContain('H-1');
    const t = clone();
    t.round.others[0]!.spot = { x: 100, y: 168, w: 82, h: 90 };
    expect(rules(checkHiddenHeritageRound(t, t.round))).toEqual(['H-2', 'H-3']);
    const u = clone();
    u.round.others[2]!.spot = { x: 330, y: 58, w: 82, h: 92 };
    expect(rules(checkHiddenHeritageRound(u, u.round))).toContain('H-4');
  });

  it('every thing of the scene named once, the counts, and a target in each half', () => {
    const s = clone();
    s.round.others = s.round.others.slice(0, 2);
    expect(rules(checkHiddenHeritageRound(s, s.round))).toEqual(['H-count', 'H-named']);
    const t = clone();
    t.round.others = [...t.round.others, { id: 'spoon', word: { ko: '숟가락', romanization: 'sutgarak', en: 'spoon' }, spot: { x: 160, y: 40, w: 80, h: 80 } }];
    expect(rules(checkHiddenHeritageRound(t, t.round))).toContain('H-named');
    const u = clone();
    const [bap, gimchi, tteok, chopsticks] = u.round.targets;
    u.round.others = [{ ...u.round.others[0]!, id: 'gimchi' }, ...u.round.others.slice(1)];
    // Swapping two spots' names keeps every rule but H-3 (the spot of guk is the kimchi's, and the reverse).
    expect(rules(checkHiddenHeritageRound(u, { ...u.round, targets: [bap!, { ...gimchi!, id: 'guk' }, tteok!, chopsticks!] }))).toEqual(['H-3']);
    const v = clone();
    v.round.targets = v.round.targets.map((x) => ({ ...x, spot: { ...x.spot, x: Math.min(x.spot.x, 100) } }));
    expect(rules(checkHiddenHeritageRound(v, v.round))).toContain('H-focal');
  });

  it('rings without their casing do not read on a gold thing (feedback.nudge is theme.life)', () => {
    const { casing: _drop, ...bare } = HIDDEN_HERITAGE_RINGS;
    expect(rules(checkHiddenHeritageRound(FOOD_MARKET_SCENE, FOOD_MARKET_SCENE.round, SCENE_ART_REGISTRY, bare))).toEqual(['H-rings']);
  });

  it('a ring or focus token in the scene, more than 8 colours, a missing outline, a thin target', () => {
    const s = clone();
    const rice = s.items.find((i) => i.id === 'prop:hh-rice-bowl')!;
    rice.nodes = [{ t: 'rect', x: 2, y: 26, w: 68, h: 36, fill: 'feedback.success' }];
    expect(rules(checkHiddenHeritageScene(s))).toEqual(expect.arrayContaining(['H-tokens', 'H-palette', 'H-outline', 'H-thumb']));
  });

  it('a target with the colour of what is behind it', () => {
    const s = clone();
    const rice = s.items.find((i) => i.id === 'prop:hh-rice-bowl')!;
    rice.nodes = rice.nodes.map((n) => (n.fill === undefined ? n : ({ ...n, fill: 'surface.sunken' } as typeof n)));
    expect(rules(checkHiddenHeritageRound(s, s.round))).toEqual(['H-camouflage']);
  });

  it('a Hoya at the wrong scale or as a thing, a shared item id, a layer off the canvas, a bad alt', () => {
    const s = clone();
    s.art.layers.push({ ref: 'hoya:idle', x: 200, y: 140, s: 1 });
    s.things = { ...s.things, hoya: s.art.layers.length - 1 };
    s.items = [...s.items, { ...SCENE_ART_REGISTRY['prop:basket']! }];
    s.art.layers[0] = { ...s.art.layers[0]!, x: 450 };
    s.art.altEn = 'Image of a market';
    s.round.sceneId = 'scene:other';
    expect(rules(checkHiddenHeritageScene(s))).toEqual(expect.arrayContaining(['H-alt', 'H-canvas', 'H-hoya', 'H-item', 'H-named', 'H-round']));
  });
});
