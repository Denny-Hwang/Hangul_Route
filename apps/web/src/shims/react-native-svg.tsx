/**
 * `react-native-svg` for the web console: the design system's
 * HeritageCardArt is written against react-native-svg, whose shapes take the
 * same props as DOM SVG. next.config.js, vitest.config.ts and tsconfig.json
 * point `react-native-svg` here, so the WordArt contact sheet can draw the
 * real card art beside the words that reuse it (F-VOC-002 §3.11) without
 * react-native. Only the elements HeritageCardArt uses are mapped; nothing
 * else in apps/web imports react-native-svg.
 */
import type { ReactNode, SVGProps } from 'react';

type ShapeProps<E extends SVGElement> = SVGProps<E> & { children?: ReactNode };

export interface SvgProps extends ShapeProps<SVGSVGElement> {
  testID?: string;
  accessibilityLabel?: string;
}

export default function Svg({ testID, accessibilityLabel, ...rest }: SvgProps): JSX.Element {
  return <svg {...rest} data-testid={testID} role={accessibilityLabel === undefined ? undefined : 'img'} aria-label={accessibilityLabel} />;
}

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
