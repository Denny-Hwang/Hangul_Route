import type { Profile } from '@hangul-route/content-schema';
import { Body, Card, Heading, Icon, Spacer, borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useMessages } from '../../i18n/use-messages';
import { useLocks } from '../../store/profile-locks';

/** The cub beside each name (design/screens/profiles/people-on-device.md, D17). */
const AVATAR_SIZE = 40;
/** The lock glyph and the chevron. */
const GLYPH = 20;

/**
 * [OA] **People on this device** (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 10.1, 10.4, row OA-7a; wireframe
 * `profiles/people-on-device.md` Panel A, mock boards 1 and 2): the Grown-up area lists **every** learner on the
 * device (F-PAR-001 section 3.5), one row each in creation order: the cub, the name, the lock glyph for a locked
 * profile and a chevron, at least 64 high. A tap opens the person page (lock switch, Edit profile, Remove from this
 * device) without asking the PIN, so a locked row is named "<name>, locked" (`a11y.who.lockedRow`), never "a PIN
 * opens it". The caller draws it only while `EXPO_PUBLIC_WHO_CHOOSER` is on.
 */
export function PeopleOnDeviceCard({ profiles, onOpen }: { profiles: readonly Profile[]; onOpen: (profileId: string) => void }): React.ReactElement | null {
  const messages = useMessages();
  const learners = profiles.filter((p) => p.role === 'learner');
  const { locked } = useLocks(profiles);
  if (learners.length === 0) return null;
  return (
    <Card padding="md" testID="people-on-device">
      <Heading level="prompt">{messages.caregiver.people.title}</Heading>
      <Spacer size="xs" />
      {learners.map((p, i) => {
        const isLocked = locked.has(p.id);
        return (
          <Pressable
            key={p.id}
            onPress={() => onOpen(p.id)}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? messages.a11y.who.lockedRow(p.displayName) : p.displayName}
            testID={`people-row-${p.id}`}
            style={({ pressed }) => ({
              minHeight: touchTarget.min,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              borderTopWidth: i === 0 ? 0 : borderWidth.thin,
              borderTopColor: colors.border.subtle,
              backgroundColor: pressed ? colors.surface.sunken : 'transparent',
            })}
          >
            <ProfileAvatar avatar={p.avatar} size={AVATAR_SIZE} />
            <Body weight="semibold" style={{ flex: 1 }}>
              {p.displayName}
            </Body>
            {isLocked ? (
              <View testID={`people-row-lock-${p.id}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <Icon name="lock" size={GLYPH} color={colors.text.primary} />
              </View>
            ) : null}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
              <Icon name="arrow-right" size={GLYPH} color={colors.text.muted} />
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
