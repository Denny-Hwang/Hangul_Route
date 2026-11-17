/**
 * [PX] R4 (AMENDMENTS-PICTURES-2026-11 PX-4): WordArt's vocab tones as scene-art colour paths, so a thing inside a
 * hidden-heritage scene can be drawn in its real colour (kimchi is red). The tones are read here, inside the folder the
 * import guard (`word-art/__tests__/import-guard.test.ts`) allows, and nowhere else in scene art: `tokens-map.ts`
 * looks a tone up in this table so the shared renderer can draw it, and `checkItem` refuses one unless the
 * hidden-heritage profile asks for it. Tiny on purpose: the renderer, and so the start bundle, imports it.
 */
import { colors } from '../../tokens';
import type { VocabColorToken } from '../types';

export const VOCAB_TONES: Readonly<Record<VocabColorToken, string>> = Object.freeze(
  Object.fromEntries(Object.entries(colors.vocab).map(([name, hex]) => [`vocab.${name}`, hex])) as Record<VocabColorToken, string>,
);
