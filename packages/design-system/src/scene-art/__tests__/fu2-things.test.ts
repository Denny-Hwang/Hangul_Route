import { describe, expect, it } from 'vitest';
import { FOUR_SEASONS_SCENE } from '../hidden-heritage/four-seasons';
import { SCENE_ART_REGISTRY } from '../registry';
import type { ArtColorToken, Shape } from '../types';

/**
 * AMENDMENTS-FOLLOWUPS-2026-11 row FU-2 (a): the scene things the PX-4 review left weakest. The six-armed snowflakes
 * of the four-season scene get branched arms and grow, the glow burst loses the halo disc that read as a pale sun, and
 * the yangban mask is drawn larger so its marks read at thumb size.
 */
const leaves = (shapes: readonly Shape<ArtColorToken>[]): Shape<ArtColorToken>[] => shapes.flatMap((s) => (s.t === 'group' ? leaves(s.kids) : [s]));

describe('row FU-2: the weakest scene things', () => {
  it('the winter snowflakes have six arms through the centre and a pair of branches on every arm', () => {
    const ref = FOUR_SEASONS_SCENE.art.layers[FOUR_SEASONS_SCENE.things['nun']!]!.ref;
    const snow = FOUR_SEASONS_SCENE.items.find((i) => i.id === ref)!;
    const dark = leaves(snow.nodes).filter((s) => s.t === 'path' && s.stroke === 'text.secondary' && s.sw === 'thick' && s.fill === undefined);
    const subpaths = dark.map((s) => (s.t === 'path' ? s.d.split('M').length - 1 : 0));
    // three lines through each of two flakes, and one V of branches on each of six arms of each flake
    expect(subpaths).toEqual([6, 6, 6]);
    // the big flake spans 30 units (it was 28 with bare arms)
    expect(dark[0]!.t === 'path' && dark[0]!.d.startsWith('M24 7L24 37')).toBe(true);
  });

  it('the glow burst has no halo disc: rays and glints round an empty centre', () => {
    const glow = SCENE_ART_REGISTRY['prop:glow-burst']!;
    expect(glow.nodes.some((s) => s.t === 'circle' || s.t === 'ellipse')).toBe(false);
    const rays = glow.nodes.filter((s) => s.t === 'path' && s.fill === undefined);
    expect(rays.reduce((n, s) => n + (s.t === 'path' ? s.d.split('M').length - 1 : 0), 0)).toBe(12);
  });

  it('the yangban mask is a 12 by 13 face with ink slit eyes and jaw line', () => {
    const mask = SCENE_ART_REGISTRY['prop:fig-yangban-mask']!;
    expect(mask.nodes).toContainEqual(expect.objectContaining({ t: 'ellipse', rx: 12, ry: 13, fill: 'surface.paper' }));
    expect(mask.nodes.filter((s) => s.t === 'path' && s.stroke === 'text.primary' && s.sw === 'thick')).toHaveLength(2);
  });
});
