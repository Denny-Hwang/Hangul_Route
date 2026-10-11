// Types for the content tests in packages/content-schema (F-PLC-001 PR P-4); the script itself is dependency-free JS.
import type { PlacementBank, PlacementTemplate } from '../packages/content-schema/src/index';

export const GENERATED_HEADER: string;
export function shapeTemplate(template: unknown, where: string, fileStrand?: string): PlacementTemplate;
export function buildPlacementBank(input: { index: unknown; files: Record<string, unknown> }): { bank: PlacementBank; warmup: PlacementTemplate };
export function loadModel(root: string): { bank: PlacementBank; warmup: PlacementTemplate };
export function renderBank(model: { bank: PlacementBank; warmup: PlacementTemplate }): string;
export function main(argv: string[], root: string): number;
