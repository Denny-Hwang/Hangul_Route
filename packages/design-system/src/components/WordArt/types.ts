/** A picture that carries the meaning is named; a decorative one is hidden and takes no name (F-VOC-002 §3.7, behaviour 5). */
type WordArtLabelling =
  | {
      /** The item's localized gloss: the picture is the only carrier of meaning (a picture option). */
      accessibilityLabel: string;
      decorative?: false;
    }
  | {
      /** Hidden from assistive technology: the same card already names the word (flashcard front and back). */
      decorative: true;
      accessibilityLabel?: never;
    };

export type WordArtProps = {
  /** The part after `word:`, e.g. `food-apple`. */
  artKey: string;
  /** In dp; the art is vector, square, drawn on a 0 0 100 100 viewBox. */
  size: number;
  /** Silhouette in `border.strong` (a word not met yet). */
  mono?: boolean;
  testID?: string;
} & WordArtLabelling;
