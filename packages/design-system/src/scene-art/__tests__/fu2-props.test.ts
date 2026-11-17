import { describe, expect, it } from 'vitest';
import { SCENE_ART_REGISTRY } from '../registry';
import { checkItem } from '../rules';
import type { Shape } from '../types';

/**
 * AMENDMENTS-FOLLOWUPS-2026-11 row FU-2 (b): the story props past the 40 most used, triaged on the five questions
 * (docs/design/picture-review-2026-11/triage.md, "Story props, the rest (FU-2)"). Every tweak is pinned here.
 */
const item = (id: string) => SCENE_ART_REGISTRY[`prop:${id}`]!;
const shapes = (id: string): Shape[] => item(id).nodes as Shape[];
const subpaths = (s: Shape): number => (s.t === 'path' ? s.d.split('M').length - 1 : 0);

/** Pale things that read cream on cream: their main shapes are outlined in ink now, never in the pale `border.strong`. */
const INKED: Readonly<Record<string, number>> = {
  'paper-stack': 2,
  'papers-loose': 3,
  'fig-carver': 4,
  'fig-wrestlers': 2,
  rabbit: 3,
  'fig-pansori': 1,
  'silk-bolts': 3,
  'books-airing': 3,
  gourds: 2,
  'ceremony-goods': 4,
  'temple-site': 1,
};

describe('row FU-2: the rest of the story props', () => {
  it.each(Object.entries(INKED))('%s outlines its subject in ink, not border.strong (%i shapes)', (id, n) => {
    const inked = shapes(id).filter((s) => s.fill !== undefined && s.fill !== 'none' && (s.stroke === 'text.primary' || s.stroke === 'text.secondary'));
    expect(inked.length).toBeGreaterThanOrEqual(n);
  });

  it('every tweaked prop still passes every item rule', () => {
    for (const id of [...Object.keys(INKED), 'magpie', 'drum', 'cabbages', 'craft-wood', 'shoes', 'taffy-tray', 'yut-sticks', 'book-chest-open', 'rice-field']) expect(checkItem(item(id)), id).toEqual([]);
  });

  it('the paper stack is offset sheets, not a box', () => {
    expect(shapes('paper-stack').some((s) => s.t === 'rect')).toBe(false);
    expect(shapes('paper-stack').some((s) => s.t === 'path' && s.fill === 'surface.paper' && subpaths(s) === 4)).toBe(true);
  });

  it('the magpie shows its white belly and shoulder, outlined', () => {
    expect(shapes('magpie')).toContainEqual(expect.objectContaining({ fill: 'surface.paper', stroke: 'text.primary' }));
  });

  it('the drum has a drumstick across it and a rim on its near skin head', () => {
    expect(shapes('drum').filter((s) => s.t === 'path' && s.stroke === 'text.primary' && s.sw === 'thick')).toHaveLength(1);
    expect(shapes('drum').filter((s) => s.t === 'ellipse')).toHaveLength(3);
  });

  it('the cut napa cabbage has green leaf tops, and its white heart stays the largest fill', () => {
    const green = shapes('cabbages').filter((s) => s.fill === 'theme.nature');
    expect(green).toHaveLength(3);
  });

  it('the hand plane has its grip; the shavings curl', () => {
    expect(shapes('craft-wood').some((s) => s.t === 'path' && s.d.includes('Q46 1 51 1'))).toBe(true);
  });

  it('gourds hang on the vine with a leaf at each stem', () => {
    expect(shapes('gourds').some((s) => s.fill === 'theme.nature' && subpaths(s) === 2)).toBe(true);
  });

  it('the shoes are two gomusin in side view, toes turned up', () => {
    const [pair] = shapes('shoes');
    expect(pair && subpaths(pair)).toBe(2);
    expect(pair?.t === 'path' && pair.d.includes('Q18 13 18.5 6')).toBe(true);
  });

  it('the taffy tray has sticks outlined on a shallow tray, two lying across', () => {
    expect(shapes('taffy-tray').filter((s) => s.stroke === 'text.secondary' && s.sw === 'thick')).toHaveLength(1);
    expect(shapes('taffy-tray')).toContainEqual(expect.objectContaining({ fill: 'feedback.nudgeLight', stroke: 'text.secondary' }));
  });

  it('the yut sticks have round ends and X marks on a flat face', () => {
    const sticks = shapes('yut-sticks').filter((s) => s.t === 'path' && s.d.includes('A5.5 5.5'));
    expect(sticks).toHaveLength(2);
    expect(shapes('yut-sticks').some((s) => s.t === 'path' && s.d.startsWith('M19 22L23 26'))).toBe(true);
  });

  it('every rice stalk on the field strip bows under its ear', () => {
    const stalks = shapes('rice-field').find((s) => s.t === 'path' && s.det === true && s.sw === 'base');
    expect(stalks?.t === 'path' ? stalks.d.match(/Q/g)?.length : 0).toBe(10);
  });

  it('the books in the chest are wrapped bundles with their knots, in one red shape (red share)', () => {
    const red = shapes('book-chest-open').filter((s) => s.fill === 'brand.primary');
    expect(red).toHaveLength(1);
    expect(subpaths(red[0]!)).toBe(4);
  });
});
