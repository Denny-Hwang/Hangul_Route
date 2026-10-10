import type { AvatarKind } from '@hangul-route/content-schema';

/**
 * Avatar catalog — F-PROF-001 §3.2.
 *
 * Five preset Hoya tiger cubs, one per culture-theme Pillar of the Heritage
 * Journey grid. The Korean Pillar name is the *illustration's* name, never a
 * learner's, and never surfaced as UI chrome — UI stays English (CLAUDE.md §8).
 *
 * The avatar *name* (`hoya-blue`) decides the cub's colour (F-LEARN-001 L11, see
 * ./profile-avatar.ts); `theme` below is catalogue data and colours nothing.
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
  /** English gloss — the short label shown under the cub in the picker. */
  label: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { kind: 'hoya-orange', pillarName: '글이', romanization: 'Geuri', theme: 'letters', label: 'Book Tiger' },
  { kind: 'hoya-blue', pillarName: '살이', romanization: 'Sari', theme: 'life', label: 'Home Tiger' },
  { kind: 'hoya-green', pillarName: '예리', romanization: 'Yeri', theme: 'rites', label: 'Feast Tiger' },
  { kind: 'hoya-purple', pillarName: '솔이', romanization: 'Sori', theme: 'nature', label: 'Mountain Tiger' },
  { kind: 'hoya-pink', pillarName: '솜이', romanization: 'Somi', theme: 'crafts', label: 'Craft Tiger' },
] as const;

export const DEFAULT_AVATAR: AvatarKind = 'hoya-orange';

export function findAvatar(kind: AvatarKind): AvatarPreset | null {
  return AVATAR_PRESETS.find((a) => a.kind === kind) ?? null;
}

/**
 * English label of a cub ("Book Tiger") — the visible text under a picker tile
 * and the second cue next to the colour (WCAG 1.4.1). `null` for a value this
 * build does not know. When F-I18N-001 PR 5 lands the label moves to the
 * locale catalogue, keyed by `AvatarKind`.
 */
export function avatarLabel(kind: AvatarKind): string | null {
  return findAvatar(kind)?.label ?? null;
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
