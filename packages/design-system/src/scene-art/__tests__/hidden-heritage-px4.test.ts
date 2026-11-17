import { describe, expect, it } from 'vitest';
import { FOOD_MARKET_SCENE } from '../hidden-heritage/food-market';
import { FOUR_SEASONS_SCENE } from '../hidden-heritage/four-seasons';
import { LETTERS_SCHOOL_SCENE } from '../hidden-heritage/letters-school';
import { PLAY_COURTYARD_SCENE } from '../hidden-heritage/play-courtyard';
import { checkHiddenHeritageScene } from '../hidden-heritage/profile';
import { SEOLLAL_ROOM_SCENE } from '../hidden-heritage/seollal-room';
import type { HiddenHeritageScene } from '../hidden-heritage/types';
import { REALIA_KIND_REGISTRY } from '../realia-kinds-registry';
import { REALIA_REGISTRY } from '../realia-registry';
import { SCENE_ART_REGISTRY } from '../registry';
import { paletteOf } from '../resolve';
import { checkItem } from '../rules';
import type { ArtColorToken, ItemDef, Shape } from '../types';

/**
 * AMENDMENTS-PICTURES-2026-11 row PX-4: the eight weak things inside the hidden-heritage scenes, redrawn as the triage
 * asked (docs/design/picture-review-2026-11/triage.md section 3), and rule R4 (a hidden-heritage thing may use a vocab
 * tone, nothing else in scene art may).
 */

type Item = ItemDef<ArtColorToken>;
const SCENES: readonly HiddenHeritageScene[] = [FOOD_MARKET_SCENE, LETTERS_SCHOOL_SCENE, SEOLLAL_ROOM_SCENE, FOUR_SEASONS_SCENE, PLAY_COURTYARD_SCENE];

const thing = (scene: HiddenHeritageScene, id: string): Item => {
  const ref = scene.art.layers[scene.things[id]!]!.ref;
  return scene.items.find((i) => i.id === ref)!;
};
const leaves = (shapes: readonly Shape<ArtColorToken>[]): Shape<ArtColorToken>[] => shapes.flatMap((s) => (s.t === 'group' ? leaves(s.kids) : [s]));
const CONTENT = 'vocab.';

describe('row PX-4: the redrawn hidden-heritage things', () => {
  it('every scene still passes the whole hidden-heritage profile', () => {
    for (const scene of SCENES) expect(checkHiddenHeritageScene(scene), scene.id).toEqual([]);
  });

  it('kimchi is half a napa cabbage in a real red, with white ribs and green leaf tips, on a plate (R4)', () => {
    const kimchi = thing(FOOD_MARKET_SCENE, 'gimchi');
    const fills = leaves(kimchi.nodes).map((s) => s.fill);
    expect(fills).toContain(`${CONTENT}red`);
    expect(fills).toContain('theme.nature');
    expect(fills.filter((f) => f === 'surface.paper').length).toBeGreaterThanOrEqual(3); // plate, ribs, stem end
    expect(fills).not.toContain('theme.letters');
  });

  it('the rice cake is one round layered cake with a wedge cut out, not stacked slabs', () => {
    const tteok = thing(FOOD_MARKET_SCENE, 'tteok');
    expect(leaves(tteok.nodes).some((s) => s.t === 'rect')).toBe(false);
    expect(leaves(tteok.nodes).filter((s) => s.t === 'ellipse')).toHaveLength(2); // the plate and the cake's top
    expect(new Set(leaves(tteok.nodes).map((s) => s.fill)).size).toBeGreaterThanOrEqual(4); // coloured layers
  });

  it('the letters-school flowers have round petals and the mountain is green with a snow cap', () => {
    const flowers = leaves(thing(LETTERS_SCHOOL_SCENE, 'kkot').nodes);
    expect(flowers.some((s) => s.t === 'poly')).toBe(false);
    expect(flowers.filter((s) => s.t === 'path' && s.d.includes('A')).length).toBe(3);
    const mountain = paletteOf(thing(LETTERS_SCHOOL_SCENE, 'san'));
    expect(mountain).toContain('theme.nature');
    expect(mountain).toContain('surface.paper');
    expect(mountain).not.toContain('theme.crafts');
  });

  it('the seollal yut sticks have rounded ends and the floor cushion its thickness and tassels', () => {
    const sticks = leaves(thing(SEOLLAL_ROOM_SCENE, 'yut').nodes).filter((s) => s.t === 'rect');
    expect(sticks.length).toBeGreaterThanOrEqual(4);
    for (const s of sticks) if (s.t === 'rect') expect(s.r).toBe(s.h / 2);
    const cushion = leaves(thing(SEOLLAL_ROOM_SCENE, 'bangseok').nodes);
    const tassels = cushion.find((s) => s.t === 'path' && s.fill === 'theme.letters');
    expect(tassels?.t === 'path' && tassels.d.split('Z').filter(Boolean)).toHaveLength(4);
  });

  it('the snow has no ringed flakes and lies on a bank; the reel shows its handle and wound string', () => {
    const snow = leaves(thing(FOUR_SEASONS_SCENE, 'nun').nodes);
    expect(snow.some((s) => s.t === 'circle')).toBe(false);
    const reel = thing(PLAY_COURTYARD_SCENE, 'eolle');
    expect(reel.box.h).toBeGreaterThan(reel.box.w);
    expect(leaves(reel.nodes).some((s) => s.t === 'path' && s.stroke === 'text.secondary' && (s.d.match(/M/g) ?? []).length >= 4)).toBe(true);
  });
});

describe('rule R4: the vocab tones stay inside the hidden-heritage things', () => {
  it('no shared story, realia or kind item draws a vocab tone, and checkItem refuses one there', () => {
    for (const registry of [SCENE_ART_REGISTRY, REALIA_REGISTRY, REALIA_KIND_REGISTRY]) {
      for (const item of Object.values(registry)) {
        expect(paletteOf(item).filter((t) => t.startsWith(CONTENT)), item.id).toEqual([]);
      }
    }
    const kimchi = thing(FOOD_MARKET_SCENE, 'gimchi');
    expect(checkItem(kimchi).map((f) => f.rule)).toContain('I-color');
    expect(checkItem(kimchi, { vocabTones: true })).toEqual([]);
  });
});
