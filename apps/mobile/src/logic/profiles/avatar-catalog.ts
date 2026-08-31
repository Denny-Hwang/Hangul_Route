import type { AvatarKind } from '@hangul-route/content-schema';

/**
 * Avatar catalog — F-PROF-001 §3.2.
 *
 * Five preset Hoya tiger cubs, one per culture-theme Pillar of the Heritage
 * Journey grid. The Korean Pillar name is the *illustration's* name, never a
 * learner's, and never surfaced as UI chrome — UI stays English (CLAUDE.md §8).
 */

export type PillarTheme = 'letters' | 'life' | 'rites' | 'nature' | 'crafts';

export interface AvatarPreset {
  kind: AvatarKind;
  /** Pillar illustration name (content, not UI copy). */
  pillarName: string;
  /** Romanization shown alongside the Korean name wherever it appears. */
  romanization: string;
  /** Culture-theme axis this cub belongs to. */
  theme: PillarTheme;
  /** English gloss — the label a 5-year-old actually reads. */
  label: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { kind: 'hoya-orange', pillarName: '글이', romanization: 'Geuri', theme: 'letters', label: 'Book Tiger' },
  { kind: 'hoya-blue', pillarName: '살이', romanization: 'Sari', theme: 'life', label: 'Home Tiger' },
  { kind: 'hoya-green', pillarName: '례이', romanization: 'Yeri', theme: 'rites', label: 'Feast Tiger' },
  { kind: 'hoya-purple', pillarName: '솔이', romanization: 'Sori', theme: 'nature', label: 'Mountain Tiger' },
  { kind: 'hoya-pink', pillarName: '솜이', romanization: 'Somi', theme: 'crafts', label: 'Craft Tiger' },
] as const;

export const DEFAULT_AVATAR: AvatarKind = 'hoya-orange';

export function findAvatar(kind: AvatarKind): AvatarPreset | null {
  return AVATAR_PRESETS.find((a) => a.kind === kind) ?? null;
}

export function isAvatarKind(value: string): value is AvatarKind {
  return AVATAR_PRESETS.some((a) => a.kind === value);
}

/**
 * VoiceOver label for a picker tile — F-PROF-001 §3.6.
 * "<name>'s tiger, stage <N>. Tap to enter."
 */
export function avatarAccessibilityLabel(displayName: string, stage: number): string {
  return `${displayName}'s tiger, stage ${stage}. Tap to enter.`;
}
