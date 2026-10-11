/**
 * Picture refs (F-QUEST-002 §3.11): `card:<id>` is heritage card art,
 * `swatch:<token>` a colour chip, `word:<id>` is WordArt once F-VOC ships. An
 * unresolved or absent ref falls back to a text tile showing the gloss, so a
 * picture is never a blank. Pure; `PictureArt.tsx` renders the answer.
 */
export type ResolvedPicture =
  | { kind: 'card'; cardId: string }
  | { kind: 'swatch'; token: string; color: string }
  | { kind: 'text' };

export interface PictureContext {
  /** Card ids the art can draw (`supportedCardIds` of the design system). */
  supportedCardIds: readonly string[];
  /** Colour chips by token (`swatchColors(colors)`). */
  swatches: Readonly<Record<string, string>>;
}

const kebab = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `{ brand: { primaryLight } }` -> `{ 'brand-primary-light': value }`; only string leaves one group deep. */
export function swatchColors(colors: Readonly<Record<string, unknown>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [group, entries] of Object.entries(colors)) {
    if (typeof entries !== 'object' || entries === null) continue;
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
  if (ref?.startsWith('swatch:')) {
    const token = ref.slice('swatch:'.length);
    const color = ctx.swatches[token];
    if (color !== undefined) return { kind: 'swatch', token, color };
  }
  return { kind: 'text' };
}
