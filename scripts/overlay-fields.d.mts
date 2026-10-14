// Types for packages/content-schema/src/__tests__/locale-overlay-mirror.test.ts; the script is dependency-free JS.
export type OverlayPath = (string | number)[];
export const OVERLAY_LOCALES: readonly string[];
export const OVERLAY_ENTITY_ID: RegExp;
export const OVERLAY_FIELDS: Readonly<Record<string, readonly string[]>>;
export const NEVER_OVERRIDABLE_FIELDS: readonly string[];
export const TS_RESIDENT_PREFIXES: readonly string[];
export function overlayPrefix(entityId: string): string;
export function isOverlayFieldAllowed(entityId: string, field: string): boolean;
export function overlayElementKey(element: unknown, index: number): string;
export function overlayTargets(entity: unknown, field: string): OverlayPath[];
export function missingSelector(entity: unknown, field: string): { collection: string; key: string } | null;
export function translatableFields(entityId: string, entity: unknown): Array<{ field: string; path: OverlayPath; source: string; alternates?: string[] }>;
