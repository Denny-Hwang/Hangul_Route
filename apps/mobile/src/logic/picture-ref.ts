/**
 * Picture refs (F-QUEST-002 §3.11): `card:<id>` is heritage card art,
 * `swatch:<token>` a colour chip, `word:<key>` a WordArt picture (F-VOC-002
 * §3.7, W-7). An unresolved or absent ref falls back to a text tile showing
 * the gloss, so a picture is never a blank. Pure; `PictureArt.tsx` renders
 * the answer.
 */
export type ResolvedPicture =
  | { kind: 'card'; cardId: string }
  | { kind: 'word'; key: string }
  | { kind: 'swatch'; token: string; color: string }
  | { kind: 'text' };

export interface PictureContext {
  /** Card ids the art can draw (`supportedCardIds` of the design system). */
  supportedCardIds: readonly string[];
  /** Colour chips by token (`swatchColors(colors)`). */
  swatches: Readonly<Record<string, string>>;
  /** WordArt keys the art can draw, without the `word:` prefix (`WORD_ART_KEYS` of the design system). */
  wordArtKeys: readonly string[];
}

/**
 * Groups that are never a quest swatch: WordArt's content tones are drawn only
 * inside WordArt, outlined and paired with an object (F-VOC-002 §3.4, W4); a
 * bare chip in one of them would make colour the only cue.
 */
const NON_SWATCH_GROUPS: ReadonlySet<string> = new Set(['vocab']);

const kebab = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `{ brand: { primaryLight } }` -> `{ 'brand-primary-light': value }`; only string leaves one group deep, minus `NON_SWATCH_GROUPS`. */
export function swatchColors(colors: Readonly<Record<string, unknown>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [group, entries] of Object.entries(colors)) {
    if (typeof entries !== 'object' || entries === null || NON_SWATCH_GROUPS.has(group)) continue;
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'string') out[`${kebab(group)}-${kebab(key)}`] = value;
    }
  }
  return out;
}

export function resolvePicture(ref: string | undefined, ctx: PictureContext): ResolvedPicture {
  if (ref?.startsWith('card:') && ctx.supportedCardIds.includes(ref)) {
    return { kind: 'card', cardId: ref };
  }
  if (ref?.startsWith('word:')) {
    const key = ref.slice('word:'.length);
    if (ctx.wordArtKeys.includes(key)) return { kind: 'word', key };
  }
  if (ref?.startsWith('swatch:')) {
    const token = ref.slice('swatch:'.length);
    const color = ctx.swatches[token];
    if (color !== undefined) return { kind: 'swatch', token, color };
  }
  return { kind: 'text' };
}

/**
 * What `PictureArt` draws for a ref and its gloss. A word picture is the only
 * carrier of meaning where it is shown, so it must be named: with a blank
 * gloss it would be neither named nor hidden (WordArt's `unlabelled`), and the
 * text tile is shown instead (F-VOC-002 §3.7), named by `pictureName` so it is
 * never empty.
 */
export function resolvePictureArt(ref: string | undefined, gloss: string, ctx: PictureContext): ResolvedPicture {
  const picture = resolvePicture(ref, ctx);
  return picture.kind === 'word' && gloss.trim() === '' ? { kind: 'text' } : picture;
}

/**
 * Whether `PictureArt`, given this ref and gloss, draws a picture rather than
 * its text tile. Screens that show a picture only when there is one ask this,
 * with the gloss they will pass, so the answer matches what is drawn.
 */
export function hasPicture(ref: string | undefined, gloss: string, ctx: PictureContext): boolean {
  return resolvePictureArt(ref, gloss, ctx).kind !== 'text';
}

/**
 * The name of a picture and the text of its text tile: the gloss, or
 * `fallback` (the localized "Picture") when the gloss is blank, so a tile is
 * never empty and a picture is never unnamed.
 */
export function pictureName(gloss: string, fallback: string): string {
  return gloss.trim() === '' ? fallback : gloss;
}

export interface PictureTileMetrics {
  /** Padding plus border of the neutral tile, per side. */
  inset: number;
  /** The smallest the art is drawn: 48, the tested minimum (F-VOC-002 §3.7). */
  minArt: number;
}

/**
 * The neutral tile round card art and WordArt. The art sits inside the
 * requested side; when that would draw it below `minArt`, the art stays at
 * `minArt` and the tile grows outward instead.
 */
export function pictureTile(size: number, metrics: PictureTileMetrics): { tile: number; art: number } {
  const art = Math.max(size - 2 * metrics.inset, metrics.minArt);
  return { tile: art + 2 * metrics.inset, art };
}
