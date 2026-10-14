import { hoyaFigure, hoyaPaintProps, type HoyaFur, type HoyaPart, type HoyaPose } from '@hangul-route/design-system/scene-art';
import { hoyaVariantColors, type HoyaVariant } from '@hangul-route/design-system/tokens';

/**
 * The shipped Hoya as inline web SVG: `hoyaFigure(pose)` from
 * packages/design-system/src/scene-art/hoya.ts, the one drawing that Hoya.tsx
 * renders too (F-STORY-002 §3.9.4), mapped part for part to DOM SVG elements.
 * Paint comes from `hoyaPaintProps`, the mapper Hoya.tsx uses too: tokens
 * only, with the gold cub's fur pair swapped for the variant. Shared by
 * /design-preview (the Hoya section) and /design-preview/scenes/library, where
 * it stands beside the scene-art form (`hoyaNodes`) for the parity check.
 */

export type { HoyaPose };

type Fur = HoyaFur;

function renderPart(part: HoyaPart, key: number, fur: Fur): JSX.Element {
  const paint = hoyaPaintProps(part, fur);
  switch (part.t) {
    case 'group':
      return (
        <g key={key} {...paint}>
          {part.kids.map((kid, i) => renderPart(kid, i, fur))}
        </g>
      );
    case 'rect':
      return <rect key={key} x={part.x} y={part.y} width={part.w} height={part.h} {...(part.r === undefined ? {} : { rx: part.r, ry: part.r })} {...paint} />;
    case 'circle':
      return <circle key={key} cx={part.cx} cy={part.cy} r={part.r} {...paint} />;
    case 'ellipse':
      return <ellipse key={key} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...paint} />;
    case 'line':
      return <line key={key} x1={part.x1} y1={part.y1} x2={part.x2} y2={part.y2} {...paint} />;
    case 'path':
      return <path key={key} d={part.d} {...paint} />;
    default: {
      // A new HoyaPart geometry kind fails typecheck here until it is mapped.
      const unmapped: never = part;
      return unmapped;
    }
  }
}

export function HoyaSvg({
  pose,
  size = 96,
  variant = 'orange',
}: {
  pose: HoyaPose;
  size?: number;
  variant?: HoyaVariant;
}): JSX.Element {
  const fur = hoyaVariantColors(variant);
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-label={`Hoya ${pose}`}>
      {hoyaFigure(pose).map((part, i) => renderPart(part, i, fur))}
    </svg>
  );
}
