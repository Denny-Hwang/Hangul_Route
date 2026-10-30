/**
 * The clip packs (AMENDMENTS-AUDIO-CLIPS AC-B6), the one list: the unit a pack PR ships, the build ceiling
 * (`flags.audioClipPacks`, `EXPO_PUBLIC_AUDIO_CLIP_PACKS`) and the runtime switch `audioPack.<pack>` (AC-B8) name.
 * Order is the AC-B6 table's: a text used by two packs belongs to the first.
 */
export const AUDIO_PACKS = [
  'jamo-s1',
  'jamo-wb',
  'stage1',
  'placement',
  'stage2',
  'stage3',
  'stage4',
  'stage6',
  'stage7',
  'vocab',
  'stories',
  'review',
  'cards',
] as const;

export type AudioPack = (typeof AUDIO_PACKS)[number];
