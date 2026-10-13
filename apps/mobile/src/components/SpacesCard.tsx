import { Body, Button, Caption, Card, Heading, Icon, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { LearnerMembership, Profile } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { classesCardView } from '../logic/transfers/transfer-views';
import type { RootStackParamList } from '../navigation/types';
import { confirm } from '../platform/dialog';
import { useAudience } from '../store/audience';
import { useMembershipStore } from '../store/membership-store';
import { RoomBlock } from '../screens/transfer/RoomBlock';
import { useLearnerTransfers, useMoveDate, useOpenMove, useTransferDevice } from '../screens/transfer/use-transfer';
import { useOnline } from './use-online';

export interface SpacesCardProps {
  profile: Profile;
  onJoin: () => void;
}

/**
 * Settings card: the learner's classes and family, with Join / Leave (F-SPACE-001 §3.5), and class moves
 * (F-SPACE-002 section 4.12, T-7b; `design/screens/transfer/classes-card.md`). The move parts come from
 * `classesCardView`, decided from the inbox before any tap; nothing new renders while the inbox says
 * transfers are off. Leave keeps its confirm and now says when it did not go through.
 */
export function SpacesCard({ profile, onJoin }: SpacesCardProps): React.ReactElement {
  const { copy } = useAudience();
  const messages = useMessages();
  const m = messages.caregiver.spaces;
  const t = messages.caregiver.transfer;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const rows = useMembershipStore((s) => s.byLearner[profile.id]) ?? [];
  const hydrate = useMembershipStore((s) => s.hydrate);
  const refresh = useMembershipStore((s) => s.refresh);
  const leave = useMembershipStore((s) => s.leave);
  const moved = useMembershipStore((s) => s.movedByLearner[profile.id] ?? null);
  const rejoin = useMembershipStore((s) => s.rejoinByLearner[profile.id] === true);
  const clearMoved = useMembershipStore((s) => s.clearMoved);
  const clearRejoin = useMembershipStore((s) => s.clearRejoin);
  const transfers = useLearnerTransfers(profile.id);
  const device = useTransferDevice(profile.id);
  const online = useOnline();
  const date = useMoveDate();
  const openMove = useOpenMove();
  const [leaveFailed, setLeaveFailed] = useState(false);
  // One-off status lines: kept for this mount, cleared in the store so they show once.
  const [movedLine, setMovedLine] = useState<string | null>(null);
  const [rejoinLine, setRejoinLine] = useState(false);

  useEffect(() => {
    void hydrate(profile.id).then(() => refresh(profile.id));
  }, [profile.id, hydrate, refresh]);

  useEffect(() => {
    if (!moved) return;
    setMovedLine(t.lines.moved(profile.displayName, moved.to.name));
    clearMoved(profile.id);
  }, [moved, profile.id, profile.displayName, clearMoved, t]);

  useEffect(() => {
    if (!rejoin) return;
    setRejoinLine(true);
    clearRejoin(profile.id);
  }, [rejoin, profile.id, clearRejoin]);

  const view = device ? classesCardView({ transfers, memberships: rows, device, online }, t, date) : null;

  const leaveSpace = async (row: LearnerMembership): Promise<void> => {
    const yes = await confirm({
      title: m.leave.confirmTitle(row.name),
      message: m.leave.confirmMessage,
      confirmLabel: m.leave.cta,
      cancelLabel: m.leave.stay,
      destructive: true,
    });
    if (!yes) return;
    setLeaveFailed(false);
    const ok = await leave(profile.id, row.spaceId);
    if (!ok) setLeaveFailed(true);
  };

  const lock = (gated: boolean, onPrimary = false): React.ReactNode =>
    gated ? <Icon name="lock" size={16} color={onPrimary ? colors.text.onPrimary : colors.brand.primary} /> : undefined;
  const gatedName = (base: string, gated: boolean): string => messages.caregiver.audience.gated(base, gated);

  const pending = view?.pending ?? null;

  return (
    <Card padding="md" testID="spaces-card">
      <Heading level="prompt">{m.title}</Heading>
      <Spacer size="xs" />
      {rejoinLine ? (
        <View accessibilityRole={'status' as never} style={{ paddingBottom: spacing.sm }}>
          <Body>{t.lines.joinAgain}</Body>
        </View>
      ) : null}
      {movedLine ? (
        <View accessibilityRole={'status' as never} style={{ paddingBottom: spacing.sm }}>
          <Body>{movedLine}</Body>
        </View>
      ) : null}
      {rows.length === 0 ? (
        <Caption tone="muted">{copy.spacesNoClass}</Caption>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.map((row) => {
            const move = view?.move && row.kind === 'class' ? view.move : null;
            return (
              <View key={row.spaceId} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <Body weight="semibold">{row.name}</Body>
                  <Caption tone="muted">{m.kind[row.kind]}</Caption>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {move ? (
                    <Button
                      label={t.actions.move.cta}
                      tone="ghost"
                      size="sm"
                      leading={lock(move.gated)}
                      disabled={move.disabled}
                      accessibilityLabel={move.disabled ? t.a11y.move(row.name) : gatedName(t.a11y.move(row.name), move.gated)}
                      accessibilityHint={move.disabled ? messages.caregiver.retry.offline : undefined}
                      onPress={() => openMove({ screen: 'MoveClass', profileId: profile.id, fromSpaceId: row.spaceId })}
                      testID={`move-${row.spaceId}`}
                    />
                  ) : null}
                  <Button label={m.leave.cta} tone="ghost" size="sm" accessibilityLabel={messages.a11y.leaveSpace(row.name)} onPress={() => void leaveSpace(row)} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      {pending ? (
        <>
          <Spacer size="sm" />
          <View testID="transfer-pending" style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm }}>
            <Body>{pending.text}</Body>
            {pending.room ? <RoomBlock text={pending.room} /> : null}
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label={pending.button === 'cancel' ? t.actions.cancel.cta : t.actions.review.cta}
                tone={pending.primary ? 'primary' : 'ghost'}
                size="sm"
                leading={lock(pending.gated, pending.primary)}
                accessibilityLabel={gatedName(pending.button === 'cancel' ? t.actions.cancel.cta : t.a11y.review, pending.gated)}
                onPress={() => openMove({ screen: 'ApproveTransfer', profileId: profile.id, transferId: pending.transferId })}
                testID="transfer-review"
              />
            </View>
          </View>
        </>
      ) : null}
      {view?.line ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary" size="sm" testID="transfer-line">
            {view.line}
          </Body>
        </>
      ) : null}
      {view?.setUpPin ? (
        <>
          <Spacer size="xs" />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              label={t.actions.setUpPin.cta}
              tone="ghost"
              size="sm"
              onPress={() => navigation.navigate('PinEntry', { next: 'MoveClass', mode: 'setup', profileId: profile.id })}
              testID="transfer-setup-pin"
            />
          </View>
        </>
      ) : null}
      {leaveFailed ? (
        <>
          <Spacer size="sm" />
          <View accessibilityRole="alert">
            <Body tone="secondary" size="sm">
              {messages.caregiver.retry.offline}
            </Body>
          </View>
        </>
      ) : null}
      <Spacer size="md" />
      <Button label={m.join.cta} tone="secondary" size="md" onPress={onJoin} />
    </Card>
  );
}
