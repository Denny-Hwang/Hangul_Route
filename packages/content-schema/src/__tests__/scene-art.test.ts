import { describe, expect, it } from 'vitest';
import { ART_CANVAS, ArtLayerSchema, SceneArtSchema } from '../index';

const layer = { ref: 'hoya:wave', x: 200, y: 280 };
const art = { setting: 'scene:hanok-gate', layers: [layer], altEn: 'Hoya waves at a hanok gate.' };

describe('ART_CANVAS', () => {
  it('is the 4:3 canvas shared by the renderer and the schema', () => {
    expect(ART_CANVAS).toEqual({ width: 400, height: 300 });
  });
});

describe('ArtLayerSchema (F-STORY-001 §3.2.3)', () => {
  it('defaults the scale to 1 and leaves the optional fields absent', () => {
    expect(ArtLayerSchema.parse(layer)).toEqual({ ...layer, s: 1 });
  });

  it('accepts every optional field', () => {
    const full = { ...layer, s: 1.5, flip: true, z: 'front', tint: 'theme.rites' };
    expect(ArtLayerSchema.parse(full)).toEqual(full);
  });

  it.each(['hoya:wave', 'prop:rice-cake', 'card:hanbok-2'])('accepts ref %s', (ref) => {
    expect(ArtLayerSchema.safeParse({ ...layer, ref }).success).toBe(true);
  });

  it.each(['scene:hanok-gate', 'word:tiger', 'hoya:Wave', 'hoya:', 'wave'])(
    'rejects ref %s',
    (ref) => {
      expect(ArtLayerSchema.safeParse({ ...layer, ref }).success).toBe(false);
    },
  );

  it('keeps the anchor point inside the canvas', () => {
    expect(ArtLayerSchema.safeParse({ ...layer, x: 0, y: 0 }).success).toBe(true);
    expect(ArtLayerSchema.safeParse({ ...layer, x: 400, y: 300 }).success).toBe(true);
    expect(ArtLayerSchema.safeParse({ ...layer, x: -1 }).success).toBe(false);
    expect(ArtLayerSchema.safeParse({ ...layer, x: 401 }).success).toBe(false);
    expect(ArtLayerSchema.safeParse({ ...layer, y: -1 }).success).toBe(false);
    expect(ArtLayerSchema.safeParse({ ...layer, y: 301 }).success).toBe(false);
  });

  it('bounds the scale to 0.2 - 3', () => {
    expect(ArtLayerSchema.safeParse({ ...layer, s: 0.2 }).success).toBe(true);
    expect(ArtLayerSchema.safeParse({ ...layer, s: 3 }).success).toBe(true);
    expect(ArtLayerSchema.safeParse({ ...layer, s: 0.19 }).success).toBe(false);
    expect(ArtLayerSchema.safeParse({ ...layer, s: 3.01 }).success).toBe(false);
  });

  it('accepts back, mid and front only for z', () => {
    for (const z of ['back', 'mid', 'front']) {
      expect(ArtLayerSchema.safeParse({ ...layer, z }).success).toBe(true);
    }
    expect(ArtLayerSchema.safeParse({ ...layer, z: 'top' }).success).toBe(false);
  });

  it('accepts a colour-token path as a tint and nothing else', () => {
    expect(ArtLayerSchema.safeParse({ ...layer, tint: 'theme.rites' }).success).toBe(true);
    expect(ArtLayerSchema.safeParse({ ...layer, tint: 'brand.Primary500' }).success).toBe(true);
    expect(ArtLayerSchema.safeParse({ ...layer, tint: '#ff0000' }).success).toBe(false);
    expect(ArtLayerSchema.safeParse({ ...layer, tint: 'theme' }).success).toBe(false);
  });
});

describe('SceneArtSchema', () => {
  it('parses a minimal scene art and fills the layer scale', () => {
    expect(SceneArtSchema.parse(art)).toEqual({ ...art, layers: [{ ...layer, s: 1 }] });
  });

  it('requires a scene: setting', () => {
    expect(SceneArtSchema.safeParse({ ...art, setting: 'hoya:wave' }).success).toBe(false);
    expect(SceneArtSchema.safeParse({ ...art, setting: 'scene:' }).success).toBe(false);
  });

  it('allows 0 to 8 layers', () => {
    expect(SceneArtSchema.safeParse({ ...art, layers: [] }).success).toBe(true);
    expect(SceneArtSchema.safeParse({ ...art, layers: Array(8).fill(layer) }).success).toBe(true);
    expect(SceneArtSchema.safeParse({ ...art, layers: Array(9).fill(layer) }).success).toBe(false);
  });

  it('requires a trimmed altEn of at most 140 characters', () => {
    expect(SceneArtSchema.safeParse({ ...art, altEn: '' }).success).toBe(false);
    expect(SceneArtSchema.safeParse({ ...art, altEn: '   ' }).success).toBe(false);
    expect(SceneArtSchema.safeParse({ ...art, altEn: 'a'.repeat(140) }).success).toBe(true);
    expect(SceneArtSchema.safeParse({ ...art, altEn: 'a'.repeat(141) }).success).toBe(false);
    const { altEn: _omitted, ...rest } = art;
    expect(SceneArtSchema.safeParse(rest).success).toBe(false);
  });

  it('is strict: no raster or emoji field can sneak in', () => {
    expect(SceneArtSchema.safeParse({ ...art, emoji: 'x' }).success).toBe(false);
    expect(SceneArtSchema.safeParse({ ...art, image: 'a.png' }).success).toBe(false);
  });
});
