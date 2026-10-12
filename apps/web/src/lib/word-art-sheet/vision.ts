/**
 * Colour-vision simulation filters for the contact sheet's strip (F-VOC-002
 * §3.10): the Machado, Oliveira and Fernandes (2009) matrices at severity 1,
 * the ones the design system's colour science uses, as SVG `feColorMatrix`
 * values. SVG filters work in linear RGB by default, which is the space the
 * matrices are defined in. A review aid on the preview page only: filters are
 * never part of the art.
 */
export type SimulatedVision = 'protanopia' | 'deuteranopia' | 'tritanopia';

type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

const MACHADO: ReadonlyArray<{ vision: SimulatedVision; m: Matrix3 }> = [
  { vision: 'protanopia', m: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998] },
  { vision: 'deuteranopia', m: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881] },
  { vision: 'tritanopia', m: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039] },
];

const toColorMatrix = (m: Matrix3): string =>
  [m[0], m[1], m[2], 0, 0, m[3], m[4], m[5], 0, 0, m[6], m[7], m[8], 0, 0, 0, 0, 0, 1, 0].join(' ');

export const VISION_FILTERS: ReadonlyArray<{ vision: SimulatedVision; values: string }> = MACHADO.map(({ vision, m }) => ({ vision, values: toColorMatrix(m) }));

export function visionFilterId(vision: SimulatedVision): string {
  return `word-art-${vision}`;
}
