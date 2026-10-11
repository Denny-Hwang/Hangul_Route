import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { colors } from '../../../tokens';
import { IconSvg } from '../dom';
import { iconGlyphs, iconNames, iconPartProps } from '../glyphs';

/**
 * The plain-DOM Icon for the public site (design/components/Icon/spec.md). It and the
 * react-native-svg `Icon.tsx` both map glyph parts through `iconPartProps`, so the stroke
 * rules (width 2 unless the glyph says otherwise, round caps and joins, fill vs stroke)
 * live in one place.
 */
type Props = Record<string, unknown>;
const svgOf = (node: React.ReactElement): React.ReactElement<Props> => node as React.ReactElement<Props>;
const pathsOf = (svg: React.ReactElement<Props>): Props[] =>
  (React.Children.toArray(svg.props.children as React.ReactNode) as React.ReactElement<Props>[]).map((p) => p.props);

describe('iconPartProps (the shared stroke rules)', () => {
  it('fills a solid part in the tint and nothing else', () => {
    expect(iconPartProps({ kind: 'fill', d: 'M0 0 Z' }, colors.brand.primary)).toEqual({ d: 'M0 0 Z', fill: colors.brand.primary });
  });

  it('strokes an outlined part at width 2 with round caps and joins, unless the glyph sets a width', () => {
    expect(iconPartProps({ kind: 'stroke', d: 'M0 0 L1 1' }, colors.text.primary)).toEqual({
      d: 'M0 0 L1 1',
      fill: 'none',
      stroke: colors.text.primary,
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    });
    expect(iconPartProps({ kind: 'stroke', d: 'M0 0', width: 2.6 }, colors.text.primary)).toMatchObject({ strokeWidth: 2.6 });
  });
});

describe('IconSvg', () => {
  it('draws every glyph part through iconPartProps, for every icon', () => {
    for (const name of iconNames) {
      const svg = svgOf(IconSvg({ name, color: colors.brand.primary }));
      expect(pathsOf(svg).map(({ d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin }) =>
        Object.fromEntries(Object.entries({ d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin }).filter(([, v]) => v !== undefined)),
      ), name).toEqual(iconGlyphs[name].map((part) => iconPartProps(part, colors.brand.primary)));
    }
  });

  it('is a decorative 24-unit svg at the given size', () => {
    const { props } = svgOf(IconSvg({ name: 'speaker', size: 36 }));
    expect(props).toMatchObject({ width: 36, height: 36, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false' });
  });

  it('defaults to 24 px in the primary text colour', () => {
    const svg = svgOf(IconSvg({ name: 'check' }));
    expect(svg.props).toMatchObject({ width: 24, height: 24 });
    expect(pathsOf(svg)[0]).toMatchObject({ stroke: colors.text.primary, strokeWidth: 2.6 });
  });
});

describe('parity with Icon.tsx', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const iconTsx = readFileSync(join(here, '../Icon.tsx'), 'utf8');

  it('the react-native-svg Icon draws its parts through the same iconPartProps', () => {
    expect(iconTsx).toMatch(/\{\.\.\.iconPartProps\(part, tint\)\}/);
    expect(iconTsx).not.toMatch(/strokeWidth|strokeLinecap/);
  });
});
