import { Caption, Icon, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { canSwitchProfileFrom } from '../logic/profiles/session';
import { useProfileStore } from '../store/profile-store';
import { learnerProfiles, switchOffered } from '../store/who-chooser';

/** The glyph over the word (OA-0b design D7: the shipped two-person `parent` glyph). */
const GLYPH = 32;

/**
 * [OA] The Home **Switch** button (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.2 and 14, row OA-4a; OA-0b design D7,
 * `design/screens/profiles/who-is-using.md` board 13): its own button in the Home header trail, between Display and
 * Profile, the glyph over the word, at least 44 x 44 (64 high). Named by the word, with the chooser's title as its
 * hint. Shown only with the chooser flag on and 2 or more learner profiles (the known uses join with OA-4b), and only
 * where a switch is offered (Home, `canSwitchProfileFrom('home')`); nothing otherwise.
 */
export function WhoSwitchButton({ onPress }: { onPress: () => void }): React.ReactElement | null {
  const w = useMessages().learner.who;
  const profiles = useProfileStore((s) => s.profiles);
  if (!canSwitchProfileFrom('home') || !switchOffered(learnerProfiles(profiles).length)) return null;
  return (
    <Pressable
      testID="home-who-switch"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={w.switch}
      accessibilityHint={w.title}
      hitSlop={spacing.xs}
      style={{ alignItems: 'center', justifyContent: 'center', minWidth: touchTarget.min, minHeight: touchTarget.min, gap: spacing.xxs }}
    >
      <Icon name="parent" size={GLYPH} color={colors.text.secondary} />
      <Caption tone="secondary" weight="semibold">
        {w.switch}
      </Caption>
    </Pressable>
  );
}
