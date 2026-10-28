import { isValidElement } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors } from '../../../tokens';
import { albumLegendArtIds, upperCellCardArtIds } from '../upper-card-ids';
import { UpperCellCardArt, hasUpperCellArt } from '../UpperCellArt';

/**
 * The upper-cell drawings (F-CURR-002 §7.2, row CM-23), resolved to their svg element trees with the native hosts
 * replaced by plain tags (as Hoya.test.tsx does): every album card draws a named 200 x 200 picture on its theme tint,
 * in token colours only, with at most five fill colours besides the theme tint and the shadow (heritage-card-art.md).
 */
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', Ellipse: 'Ellipse', G: 'G', Line: 'Line', Path: 'Path', Rect: 'Rect', Text: 'Text' }));

type Node = ReactElement<Record<string, unknown>>;

/** Calls function components until only host tags are left. */
function resolve(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(resolve);
  if (!isValidElement(node)) return node;
  const el = node as Node;
  if (typeof el.type === 'function') return resolve((el.type as (p: unknown) => unknown)(el.props));
  return { type: el.type, props: { ...el.props, children: resolve(el.props.children) } };
}

interface Host {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
}

function walk(node: unknown, visit: (h: Host) => void): void {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object' && 'type' in node) {
    visit(node as Host);
    walk((node as Host).props.children, visit);
  }
}

const TOKEN_COLOURS: ReadonlySet<string> = new Set<string>(
  Object.values(colors).flatMap((group): unknown[] => (typeof group === 'object' ? Object.values(group) : [])).filter((v): v is string => typeof v === 'string'),
);

describe('UpperCellCardArt (row CM-23)', () => {
  it.each([...upperCellCardArtIds, ...albumLegendArtIds])('%s draws a named picture in token colours', (cardId) => {
    const tree = resolve(UpperCellCardArt({ cardId, size: 96, testID: 'art', accessibilityLabel: 'Card art' })) as Host;
    expect(tree.type).toBe('Svg');
    expect(tree.props).toMatchObject({ width: 96, height: 96, viewBox: '0 0 200 200', testID: 'art', accessibilityLabel: 'Card art' });
    const used = new Set<string>();
    const fills = new Set<string>();
    walk(tree, (h) => {
      for (const key of ['fill', 'stroke'] as const) {
        const value = h.props[key];
        if (typeof value === 'string' && value !== 'none') used.add(value);
        if (key === 'fill' && typeof value === 'string' && value !== 'none') fills.add(value);
      }
    });
    for (const c of used) expect(TOKEN_COLOURS.has(c), `${cardId}: ${c}`).toBe(true);
    // Five fill colours at most, besides the frame's own theme tint (the first rect) and the floor shadow. Only that one
    // tint is set aside: hoya.fur and feedback.nudge share theme.life's value, so dropping every theme value would
    // never count a gold fill.
    const frame = (tree.props.children as unknown[]).flat(Infinity).find((n): n is Host => !!n && typeof n === 'object' && (n as Host).type === 'Rect');
    expect(Object.values(colors.theme) as unknown[], cardId).toContain(frame?.props.fill);
    fills.delete(frame?.props.fill as string);
    fills.delete(colors.hoya.furDark);
    expect(fills.size, `${cardId}: ${[...fills].join(' ')}`).toBeLessThanOrEqual(5);
  });

  it('names a picture by its id when no label is given, and draws nothing for an id it does not know', () => {
    const tree = resolve(UpperCellCardArt({ cardId: 'card:norae' })) as Host;
    expect(tree.props).toMatchObject({ width: 200, accessibilityLabel: 'Card art for card:norae' });
    expect(UpperCellCardArt({ cardId: 'card:book' })).toBeNull();
    expect([...upperCellCardArtIds, ...albumLegendArtIds].every(hasUpperCellArt)).toBe(true);
    expect(hasUpperCellArt('card:book')).toBe(false);
  });
});
