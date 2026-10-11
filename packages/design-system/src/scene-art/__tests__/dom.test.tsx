import React from 'react';
import { describe, expect, it } from 'vitest';
import { SceneSvg } from '../dom';
import { hoyaItem } from '../hoya';
import { resolveColor } from '../tokens-map';
import { makeArt, makeRegistry } from './fixtures';

/** Function components without hooks: call them and read the element tree, no DOM needed. */
function el(node: React.ReactNode): React.ReactElement<Record<string, unknown>> {
  return node as React.ReactElement<Record<string, unknown>>;
}
function children(node: React.ReactElement<Record<string, unknown>>): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node.props.children as React.ReactNode) as React.ReactElement<Record<string, unknown>>[];
}
/** Resolve one level of function components (the Item wrapper) into plain svg elements. */
function flat(node: React.ReactElement<Record<string, unknown>>): React.ReactElement<Record<string, unknown>> {
  return typeof node.type === 'function' ? el((node.type as (p: unknown) => React.ReactNode)(node.props)) : node;
}

const registry = makeRegistry([hoyaItem('waving')]);
const art = makeArt({ layers: [{ ref: 'hoya:waving', x: 200, y: 250 }], altEn: 'Hoya waves hello in the hall.' });

describe('SceneSvg', () => {
  it('draws one svg element per item inside a 400 x 300 viewBox', () => {
    const svg = SceneSvg({ art, registry, width: 200 });
    expect(svg.type).toBe('svg');
    expect(svg.props).toMatchObject({ width: 200, height: 150, viewBox: '0 0 400 300', role: 'img', 'aria-label': 'Hoya waves hello in the hall.', 'data-state': 'scene' });
    const kids = children(el(svg)).map(flat);
    expect(kids.length).toBeGreaterThan(10);
    expect(new Set(kids.map((k) => k.type))).toEqual(new Set(['rect', 'circle', 'ellipse', 'line', 'path']));
    const first = kids[0]!;
    expect(first.props).toMatchObject({ fill: resolveColor('surface.canvas'), transform: expect.stringMatching(/^matrix\(/) });
  });

  it('uses the shipped registry by default', () => {
    const svg = SceneSvg({ art: makeArt({ setting: 'scene:hall', layers: [] }) });
    expect(svg.props['data-state']).toBe('fallback'); // no settings are registered yet
  });

  it('shows a tinted panel instead of a broken picture', () => {
    const svg = SceneSvg({ art: undefined, theme: 'nature', registry });
    const [panel] = children(el(svg));
    expect(svg.props).toMatchObject({ 'data-state': 'fallback', width: 320, height: 240, role: undefined, 'aria-label': undefined });
    expect(panel!.type).toBe('rect');
    expect(panel!.props).toMatchObject({ fill: resolveColor('theme.nature'), opacity: 0.15, width: 400, height: 300 });
  });

  it('is hidden from assistive technology when decorative', () => {
    const svg = SceneSvg({ art, registry, decorative: true });
    expect(svg.props).toMatchObject({ role: undefined, 'aria-label': undefined, 'aria-hidden': true });
  });

  it('marks where a card picture sits, without drawing text', () => {
    const svg = SceneSvg({ art: makeArt({ layers: [{ ref: 'card:book', x: 200, y: 250 }] }), registry });
    const card = children(el(svg)).map(flat).find((k) => k.props['data-card'] === 'card:book')!;
    expect(card.type).toBe('rect');
    expect(card.props).toMatchObject({ width: 80, height: 80, fill: 'none' });
    expect(JSON.stringify(children(card))).toContain('card:book - shown in the app');
  });
});
