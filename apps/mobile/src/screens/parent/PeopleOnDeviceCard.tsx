import type { Profile } from '@hangul-route/content-schema';
import { Body, Card, Heading, Icon, Spacer, borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React, { Suspense } from 'react';
import { Pressable, View } from 'react-native';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useMessages } from '../../i18n/use-messages';
import { isLiveGuest } from '../../logic/guest/guest-model';
import { useGuestStore } from '../../store/guest-store';
import { useLocks } from '../../store/profile-locks';
import { GuestPeopleRow } from './guest-keep';
import type { GuestRowActions } from './guest-keep-chunk';

export type { GuestRowActions };

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
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2 (row GU-5; mock `design/screens/profiles/who-is-using-guest.md` D13,
 * D14): after the people, one row for an unsaved first quest whenever a live record is kept here, whatever
 * `EXPO_PUBLIC_GUEST_LESSON` says (so a grown-up always sees and can remove the reason for a gate): the default cub
 * and **First quest, not saved**, not a button and no chevron (there is no person page for a guest), then **Keep as a
 * learner** (only with the switch on) and **Remove the first quest**, which asks a fresh PIN first only when a PIN is
 * stored, then its ConfirmSheet (Cancel first and focused, never the danger tone), then the sweep (`removeLiveGuest`).
 * The row is a chunk of its own (`guest-keep-chunk.tsx`), loaded only while a live record is kept here.
 */
export function PeopleOnDeviceCard({
  profiles,
  onOpen,
  guest: actions,
}: {
  profiles: readonly Profile[];
  onOpen: (profileId: string) => void;
  guest: GuestRowActions;
}): React.ReactElement | null {
  const messages = useMessages();
  const learners = profiles.filter((p) => p.role === 'learner');
  const { locked } = useLocks(profiles);
  const record = useGuestStore((s) => s.record);
  const liveGuest = isLiveGuest(record, profiles);
  if (learners.length === 0 && !liveGuest) return null;
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
      {liveGuest ? (
        <Suspense fallback={null}>
          <GuestPeopleRow first={learners.length === 0} actions={actions} />
        </Suspense>
      ) : null}
    </Card>
  );
}

