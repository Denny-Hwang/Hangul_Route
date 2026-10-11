/**
 * The WordArt tone vocabulary (F-VOC-002 §3.3): every leaf of `colors` as a
 * `'group.key'` path, minus the reserved destructive red, the scrims and the
 * card-rarity colours. The only place WordArt reads `colors`.
 */
import { colors } from '../tokens';
import type { WordArtTone } from './types';

const EXCLUDED: ReadonlySet<string> = new Set(['feedback.danger', 'feedback.dangerLight', 'surface.overlay', 'surface.inkScrim']);
const EXCLUDED_GROUPS: ReadonlySet<string> = new Set(['rarity']);

const VALUES: ReadonlyMap<string, string> = new Map(
  Object.entries(colors)
    .filter(([group]) => !EXCLUDED_GROUPS.has(group))
    .flatMap(([group, values]) => Object.entries(values as Record<string, string>).map(([key, value]) => [`${group}.${key}`, value] as const))
    .filter(([tone]) => !EXCLUDED.has(tone)),
);

/** Every tone a glyph may use, in `colors` table order. */
export const WORD_ART_TONES: readonly WordArtTone[] = Object.freeze([...VALUES.keys()] as WordArtTone[]);

export function isWordArtTone(s: string): s is WordArtTone {
  return VALUES.has(s);
}

/** The colour value of a tone; throws on an unknown tone (the glyph tests catch it, never a runtime path). */
export function resolveTone(tone: WordArtTone): string {
  const value = VALUES.get(tone);
  if (value === undefined) throw new RangeError(`Unknown WordArt tone: ${String(tone)}`);
  return value;
}
