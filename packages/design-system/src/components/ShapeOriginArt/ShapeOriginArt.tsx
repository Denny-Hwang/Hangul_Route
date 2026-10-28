import type { ComponentType, ReactElement } from 'react';
import { Svg, Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';
import { drawProp, type DrawItem } from '../../scene-art/draw';
import { SHAPE_ORIGIN_REGISTRY } from '../../scene-art/shape-origin-registry';

/**
 * ShapeOriginArt — one of Match Shape's origin pictures (F-CURR-002 row CM-33; design/screens/minigame-variety/ D6):
 * the registered prop drawn at its 200 x 160 box. The picture is the round's prompt, so it is an image named by the
 * caller (the sourced line in the UI language), not decoration. Never exported by the package barrel: the Match
 * Shape chunk loads it by this file's path, so the start bundle carries none of the drawings. `null` for an unknown
 * ref, so the round shows its line alone (the wireframe's "art missing" state), never a broken image.
 */

const TAGS = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon } as const;

export interface ShapeOriginArtProps {
  /** `prop:shape-origin-<letter>` */
  refId: string;
  width: number;
  accessibilityLabel: string;
  testID?: string;
}

export function hasShapeOriginArt(refId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SHAPE_ORIGIN_REGISTRY, refId);
}

export function ShapeOriginArt({ refId, width, accessibilityLabel, testID }: ShapeOriginArtProps): ReactElement | null {
  const drawn = drawProp(refId, SHAPE_ORIGIN_REGISTRY);
  if (!drawn) return null;
  const item = SHAPE_ORIGIN_REGISTRY[refId] as { box: { w: number; h: number } };
  return (
    <Svg
      width={width}
      height={(width * item.box.h) / item.box.w}
      viewBox={drawn.viewBox}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      role="img"
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {drawn.items.map((d: DrawItem) => {
        if (d.tag === 'card') return null;
        const Tag = TAGS[d.tag] as ComponentType<Record<string, unknown>>;
        return <Tag key={d.key} {...d.geometry} {...d.paint} transform={d.transform} />;
      })}
    </Svg>
  );
}
