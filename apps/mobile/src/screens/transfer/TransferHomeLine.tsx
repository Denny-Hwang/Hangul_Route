import { Body, Button, Icon, Spacer, colors, radii, shadows, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { homeLineView } from '../../logic/transfers/transfer-views';
import { useLearnerTransfers, useMoveDate, useOpenMove, useTransferDevice } from './use-transfer';

/**
 * The Home line for a class move — F-SPACE-002 section 4.12, T-7c (`design/screens/transfer/app-sheets.md`,
 * "Home line"): one calm paper row under the Hoya tip, only when the learner side must answer or a move is
 * planned. No number, no timer, no red. Review opens the sheet (a yes always follows the consent lines);
 * Cancel opens the planned sheet. Draws nothing while the inbox says transfers are off.
 */
export function TransferHomeLine({ profileId, learnerName }: { profileId: string; learnerName: string }): React.ReactElement | null {
  const messages = useMessages();
  const t = messages.caregiver.transfer;
  const transfers = useLearnerTransfers(profileId);
  const device = useTransferDevice(profileId);
  const date = useMoveDate();
  const openMove = useOpenMove();
  const view = device ? homeLineView({ transfers, device, learnerName }, t, date) : null;
  if (!view) return null;
  const label = view.button === 'cancel' ? t.actions.cancel.cta : t.actions.review.cta;
  const name = view.button === 'cancel' ? t.actions.cancel.cta : t.a11y.review;
  return (
    <>
      <Spacer size="md" />
      <View
        testID="transfer-home-line"
        style={{ backgroundColor: colors.surface.paper, borderRadius: radii.lg, ...shadows.card, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        <Body>{view.text}</Body>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label={label}
            tone="ghost"
            size="sm"
            leading={view.gated ? <Icon name="lock" size={16} color={colors.brand.primary} /> : undefined}
            accessibilityLabel={messages.caregiver.audience.gated(name, view.gated)}
            onPress={() => openMove({ screen: 'ApproveTransfer', profileId, transferId: view.transferId })}
            testID="transfer-home-review"
          />
        </View>
      </View>
    </>
  );
}
