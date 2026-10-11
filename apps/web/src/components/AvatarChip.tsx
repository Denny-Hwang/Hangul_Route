import { borderWidth, colors, radii } from '@hangul-route/design-system/tokens';
import { avatarChipModel } from '@/lib/console/avatar-chip';

/**
 * A learner's cub as a small colour chip on the console roster (F-LEARN-001 §3.6).
 * Design reference: design/components/ProfileAvatar/spec.md ("Web console roster").
 *
 * Colour comes from the avatar's name; the English cub name is the accessible
 * name, so colour is never the only cue. The chip holds no text, so neither a
 * name nor an initial can appear on it, including when the class hides names
 * (`anonymizeRoster`). No Hoya SVG on the console.
 */
export const AVATAR_CHIP_SIZE = 28;

export function AvatarChip({ avatar }: { avatar: string }): JSX.Element {
  const { label, fill } = avatarChipModel(avatar);
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: AVATAR_CHIP_SIZE,
        height: AVATAR_CHIP_SIZE,
        borderRadius: radii.pill,
        backgroundColor: fill,
        border: label ? 'none' : `${borderWidth.thin}px solid ${colors.border.subtle}`,
        boxSizing: 'border-box',
      }}
    />
  );
}
