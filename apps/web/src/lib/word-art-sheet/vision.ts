/**
 * Colour-vision simulation filters for the contact sheet's strip (F-VOC-002
 * §3.10): the Machado, Oliveira and Fernandes (2009) matrices at severity 1,
 * read from the design system's colour science (the source of
 * `COLOR_CONFUSION_PAIRS`, never a copy), as SVG `feColorMatrix` values. SVG filters work in linear RGB by default, which is the space the
 * matrices are defined in. A review aid on the preview page only: filters are
 * never part of the art.
 */
import { MACHADO_MATRICES, VISIONS, type VisionMatrix } from '@hangul-route/design-system/word-art/color-science';

export type SimulatedVision = (typeof VISIONS)[number];

const toColorMatrix = (m: VisionMatrix): string =>
  [m[0], m[1], m[2], 0, 0, m[3], m[4], m[5], 0, 0, m[6], m[7], m[8], 0, 0, 0, 0, 0, 1, 0].join(' ');

export const VISION_FILTERS: ReadonlyArray<{ vision: SimulatedVision; values: string }> = VISIONS.map((vision) => ({ vision, values: toColorMatrix(MACHADO_MATRICES[vision]) }));

export function visionFilterId(vision: SimulatedVision): string {
  return `word-art-${vision}`;
}
