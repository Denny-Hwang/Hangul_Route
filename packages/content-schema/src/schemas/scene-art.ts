import { z } from 'zod';

/**
 * Data shape of a scene's illustration (F-STORY-001 §3.2.3). Token-only: no
 * raster or emoji field exists (D7). Meaning and renderer: F-STORY-002 §3.9.
 */
export const ART_CANVAS = { width: 400, height: 300 } as const; // 4:3, shared by renderer and schema

export const ArtLayerSchema = z.object({
  /** Same grammar as F-STORY-003 `ArtRef` minus `scene:`. */
  ref: z.string().regex(/^(hoya|prop|card):[a-z0-9-]+$/),
  /** Anchor point (bottom-centre of the item). */
  x: z.number().min(0).max(ART_CANVAS.width),
  y: z.number().min(0).max(ART_CANVAS.height),
  s: z.number().min(0.2).max(3).default(1),
  flip: z.boolean().optional(),
  /** Default comes from the registry. */
  z: z.enum(['back', 'mid', 'front']).optional(),
  /** A colour-token path, e.g. "theme.rites"; validated against the token table by F-STORY-002. */
  tint: z
    .string()
    .regex(/^[a-z]+\.[A-Za-z0-9]+$/)
    .optional(),
});
export type ArtLayer = z.infer<typeof ArtLayerSchema>;

export const SceneArtSchema = z
  .object({
    /** The background set (registry in F-STORY-002). */
    setting: z.string().regex(/^scene:[a-z0-9-]+$/),
    layers: z.array(ArtLayerSchema).max(8),
    /** Required: this is the screen-reader description. */
    altEn: z.string().trim().min(1).max(140),
  })
  .strict();
export type SceneArt = z.infer<typeof SceneArtSchema>;
