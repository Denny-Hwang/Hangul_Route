import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { borderWidth, colors } from '../../../tokens';
import { wordArtModel } from '../../../word-art/model';
import type { WordArtModel } from '../../../word-art/model';

/**
 * The paint layer of `WordArt` (design/components/WordArt/spec.md): the model
 * mapped onto elements. react-native and react-native-svg do not load in
 * node, so they are replaced by plain host names here; `WordArtView` has no
 * hooks, so it is called directly and its element tree is read.
 */
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Circle: 'Circle', Ellipse: 'Ellipse', Rect: 'Rect', Path: 'Path' }));

const { WordArtView } = await import('../WordArt');

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;
const childrenOf = (el: El): El[] => React.Children.toArray(el.props.children as React.ReactNode) as El[];

/** The outer view, the svg, and each shape element rendered to its host props. */
function paint(model: WordArtModel, testID?: string): { view: El; svg: El; shapes: { tag: string; props: Props }[] } {
  const view = WordArtView({ model, testID }) as El;
  const [svg] = childrenOf(view) as [El];
  const shapes = childrenOf(svg).map((child) => {
    const host = (child.type as (p: Props) => El)(child.props);
    return { tag: host.type as string, props: host.props };
  });
  return { view, svg, shapes };
}

const named = (artKey: string, size = 48): WordArtModel => wordArtModel({ artKey, size, accessibilityLabel: 'apple' })!;

describe('WordArtView', () => {
  it('draws one element per shape, with the geometry and paint of the render list', () => {
    const model = named('food-apple');
    const { shapes } = paint(model);
    expect(shapes).toHaveLength(model.shapes.length);
    shapes.forEach(({ tag, props }, i) => {
      const s = model.shapes[i]!;
      expect(tag.toLowerCase()).toBe(s.tag);
      expect(props).toMatchObject({ ...s.geometry, fill: s.fill, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: s.opacity });
      expect(props.stroke).toBe(s.stroke);
      expect(props.strokeWidth).toBe(s.strokeWidth);
    });
  });

  it("passes fill 'none' through for a stroke-only shape", () => {
    const model = named('food-apple');
    const strokeOnly = model.shapes.findIndex((s) => s.fill === 'none');
    expect(strokeOnly).toBeGreaterThanOrEqual(0);
    expect(paint(model).shapes[strokeOnly]!.props.fill).toBe('none');
  });

  it('is a square svg of the requested size on the 100-unit viewBox, with the testID on the view', () => {
    const { view, svg } = paint(named('food-apple', 64), 'tile');
    expect(view.props).toMatchObject({ testID: 'tile', style: { width: 64, height: 64 } });
    expect(svg.props).toMatchObject({ width: 64, height: 64, viewBox: '0 0 100 100' });
  });

  it('names a picture that carries the meaning: one image element with its label, not hidden', () => {
    const { view } = paint(named('food-apple'));
    expect(view.props).toMatchObject({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'apple' });
    expect(view.props['aria-hidden']).toBeUndefined();
    expect(view.props.importantForAccessibility).toBeUndefined();
  });

  it('hides a decorative picture on the web (aria-hidden) and on iOS and Android', () => {
    const { view } = paint(wordArtModel({ artKey: 'food-apple', size: 160, decorative: true })!);
    expect(view.props).toMatchObject({
      accessible: false,
      'aria-hidden': true,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(view.props.accessibilityRole).toBeUndefined();
    expect(view.props.accessibilityLabel).toBeUndefined();
  });

  it('frames a flagged picture (a blank label, in development) with a dashed border, and nothing else otherwise', () => {
    const unlabelled = wordArtModel({ artKey: 'food-apple', size: 48, accessibilityLabel: ' ' })!;
    expect(unlabelled.unlabelled).toBe(true);
    const flagged = WordArtView({ model: unlabelled, flagged: true }) as El;
    expect(flagged.props.style).toEqual({ width: 48, height: 48, borderWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.strong });
    expect(paint(named('food-apple')).view.props.style).toEqual({ width: 48, height: 48 });
  });

  it('paints the silhouette in border.strong', () => {
    const { shapes } = paint(wordArtModel({ artKey: 'animal-cat', size: 64, mono: true, decorative: true })!);
    for (const { props } of shapes) {
      if (props.fill !== 'none') expect(props.fill).toBe(colors.border.strong);
      if (props.stroke !== undefined) expect(props.stroke).toBe(colors.border.strong);
    }
  });
});

describe('WordArt', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is the memoised wrapper over WordArtView', async () => {
    const { WordArt } = await import('../WordArt');
    expect((WordArt as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });
});
