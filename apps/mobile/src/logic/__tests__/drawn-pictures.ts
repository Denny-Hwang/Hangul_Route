import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { colors } from '@hangul-route/design-system/tokens';
import { WORD_ART_KEYS } from '@hangul-route/design-system/word-art';
import { resolvePicture, swatchColors, type PictureContext } from '../picture-ref';

/**
 * Test-only: the art the app can draw today, from the same design-system
 * sources as `PICTURE_CONTEXT` in `screens/minigames/PictureArt.tsx` (which a
 * node test cannot import: it pulls in react-native). Read through the
 * design-system subpaths, which vitest resolves and the app bundle never sees.
 */
export const DRAWN_PICTURES: PictureContext = {
  supportedCardIds,
  swatches: swatchColors(colors),
  wordArtKeys: WORD_ART_KEYS,
};

/** The learner picker's T8 check (`canRenderPicture` of `screens/vocab/topic-data.ts`) on the real art. */
export function canDrawPicture(visual: string): boolean {
  return resolvePicture(visual, DRAWN_PICTURES).kind !== 'text';
}
