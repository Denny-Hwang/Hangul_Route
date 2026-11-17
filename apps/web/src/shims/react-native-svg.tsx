/**
 * `react-native-svg` for the web console: the design system's
 * HeritageCardArt is written against react-native-svg, whose shapes take the
 * same props as DOM SVG. next.config.js, vitest.config.ts and tsconfig.json
 * point `react-native-svg` here, so the contact sheets can draw the real card
 * art (/design-preview/cards, AMENDMENTS-PICTURES-2026-11 PX-0; F-VOC-002
 * §3.11) without react-native. Only the elements HeritageCardArt and
 * UpperCellArt use are mapped; nothing else in apps/web imports
 * react-native-svg.
 */
import type { ReactNode, SVGProps } from 'react';

type ShapeProps<E extends SVGElement> = SVGProps<E> & { children?: ReactNode };

export interface SvgProps extends ShapeProps<SVGSVGElement> {
  testID?: string;
  accessibilityLabel?: string;
}

// Named as well as default, as react-native-svg exports it: the design system imports `{ Svg }` by name.
export function Svg({ testID, accessibilityLabel, ...rest }: SvgProps): JSX.Element {
  return <svg {...rest} data-testid={testID} role={accessibilityLabel === undefined ? undefined : 'img'} aria-label={accessibilityLabel} />;
}

export default Svg;

export function G(props: ShapeProps<SVGGElement>): JSX.Element {
  return <g {...props} />;
}

export function Circle(props: ShapeProps<SVGCircleElement>): JSX.Element {
  return <circle {...props} />;
}

export function Ellipse(props: ShapeProps<SVGEllipseElement>): JSX.Element {
  return <ellipse {...props} />;
}

export function Line(props: ShapeProps<SVGLineElement>): JSX.Element {
  return <line {...props} />;
}

export function Path(props: ShapeProps<SVGPathElement>): JSX.Element {
  return <path {...props} />;
}

export function Polygon(props: ShapeProps<SVGPolygonElement>): JSX.Element {
  return <polygon {...props} />;
}

export function Rect(props: ShapeProps<SVGRectElement>): JSX.Element {
  return <rect {...props} />;
}

/** The upper-cell card art draws a card's own word with `Text` (`UpperCellArt.tsx`); the card-art sheet shows it. */
export function Text(props: ShapeProps<SVGTextElement>): JSX.Element {
  return <text {...props} />;
}
