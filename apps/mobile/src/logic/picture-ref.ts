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
 * text tile is shown instead (F-VOC-002 §3.7).
 */
export function resolvePictureArt(ref: string | undefined, gloss: string, ctx: PictureContext): ResolvedPicture {
  const picture = resolvePicture(ref, ctx);
  return picture.kind === 'word' && gloss.trim() === '' ? { kind: 'text' } : picture;
}
