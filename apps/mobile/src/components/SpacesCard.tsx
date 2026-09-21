import { Body, Button, Caption, Card, Heading, Spacer, spacing } from '@hangul-route/design-system';
import type { LearnerMembership, Profile } from '@hangul-route/content-schema';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { confirm } from '../platform/dialog';
import { useMembershipStore } from '../store/membership-store';

export interface SpacesCardProps {
  profile: Profile;
  onJoin: () => void;
}

const KIND_LABEL: Record<LearnerMembership['kind'], string> = { family: 'Family', class: 'Class', school: 'School' };

/** Settings card: the learner's classes and family, with Join / Leave (F-SPACE-001 §3.5). */
export function SpacesCard({ profile, onJoin }: SpacesCardProps): React.ReactElement {
  const rows = useMembershipStore((s) => s.byLearner[profile.id]) ?? [];
  const hydrate = useMembershipStore((s) => s.hydrate);
  const refresh = useMembershipStore((s) => s.refresh);
  const leave = useMembershipStore((s) => s.leave);

  useEffect(() => {
    void hydrate(profile.id).then(() => refresh(profile.id));
  }, [profile.id, hydrate, refresh]);

  const leaveSpace = async (row: LearnerMembership): Promise<void> => {
    const yes = await confirm({
      title: `Leave ${row.name}?`,
      message: 'Your cards and stars stay with you. You can join again with the code.',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
      destructive: true,
    });
    if (yes) await leave(profile.id, row.spaceId);
  };

  return (
    <Card padding="md" testID="spaces-card">
      <Heading level="prompt">Classes & family</Heading>
      <Spacer size="xs" />
      {rows.length === 0 ? (
        <Caption tone="muted">Not in a class yet. Got a code from a teacher or a grown-up?</Caption>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.map((row) => (
            <View key={row.spaceId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{row.name}</Body>
                <Caption tone="muted">{KIND_LABEL[row.kind]}</Caption>
              </View>
              <Button label="Leave" tone="ghost" size="sm" accessibilityLabel={`Leave ${row.name}`} onPress={() => void leaveSpace(row)} />
            </View>
          ))}
        </View>
      )}
      <Spacer size="md" />
      <Button label="Join a class" tone="secondary" size="md" onPress={onJoin} />
    </Card>
  );
}
