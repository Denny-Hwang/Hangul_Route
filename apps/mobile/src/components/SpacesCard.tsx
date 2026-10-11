import { Body, Button, Caption, Card, Heading, Spacer, spacing } from '@hangul-route/design-system';
import type { LearnerMembership, Profile } from '@hangul-route/content-schema';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { confirm } from '../platform/dialog';
import { useAudience } from '../store/audience';
import { useMembershipStore } from '../store/membership-store';

export interface SpacesCardProps {
  profile: Profile;
  onJoin: () => void;
}

/** Settings card: the learner's classes and family, with Join / Leave (F-SPACE-001 §3.5). */
export function SpacesCard({ profile, onJoin }: SpacesCardProps): React.ReactElement {
  const { copy } = useAudience();
  const messages = useMessages();
  const m = messages.caregiver.spaces;
  const rows = useMembershipStore((s) => s.byLearner[profile.id]) ?? [];
  const hydrate = useMembershipStore((s) => s.hydrate);
  const refresh = useMembershipStore((s) => s.refresh);
  const leave = useMembershipStore((s) => s.leave);

  useEffect(() => {
    void hydrate(profile.id).then(() => refresh(profile.id));
  }, [profile.id, hydrate, refresh]);

  const leaveSpace = async (row: LearnerMembership): Promise<void> => {
    const yes = await confirm({
      title: m.leave.confirmTitle(row.name),
      message: m.leave.confirmMessage,
      confirmLabel: m.leave.cta,
      cancelLabel: m.leave.stay,
      destructive: true,
    });
    if (yes) await leave(profile.id, row.spaceId);
  };

  return (
    <Card padding="md" testID="spaces-card">
      <Heading level="prompt">{m.title}</Heading>
      <Spacer size="xs" />
      {rows.length === 0 ? (
        <Caption tone="muted">{copy.spacesNoClass}</Caption>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.map((row) => (
            <View key={row.spaceId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{row.name}</Body>
                <Caption tone="muted">{m.kind[row.kind]}</Caption>
              </View>
              <Button label={m.leave.cta} tone="ghost" size="sm" accessibilityLabel={messages.a11y.leaveSpace(row.name)} onPress={() => void leaveSpace(row)} />
            </View>
          ))}
        </View>
      )}
      <Spacer size="md" />
      <Button label={m.join.cta} tone="secondary" size="md" onPress={onJoin} />
    </Card>
  );
}
