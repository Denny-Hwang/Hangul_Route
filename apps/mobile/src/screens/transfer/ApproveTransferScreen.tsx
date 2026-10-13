import { Body, Button, Icon, Screen, Spacer, spacing, touchTarget } from '@hangul-route/design-system';
import { TRANSFER_CONSENT_TEXT } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { isOpenRequest, requestAction } from '../../logic/transfers/consent-gate';
import { deviceConsentRecord, sheetDataFromRequest, sheetLocaleOf } from '../../logic/transfers/consent-sheet';
import { REQUEST_RELOAD, moveErrorLine, readOnlySheetView } from '../../logic/transfers/transfer-views';
import type { RootStackParamList } from '../../navigation/types';
import { useMembershipStore, type TransferRequestOutcome } from '../../store/membership-store';
import { useProfileStore } from '../../store/profile-store';
import { ConsentSheet } from './ConsentSheet';
import { FocusTitle } from './FocusTitle';
import { RoomBlock } from './RoomBlock';
import { useEndsGateOnLeave, useGateOpen, useLearnerTransfers, useMoveDate, useTransferDevice } from './use-transfer';

type Props = NativeStackScreenProps<RootStackParamList, 'ApproveTransfer'>;

/**
 * The sheet of one open move request — F-SPACE-002 section 4.12, T-7c (`design/screens/transfer/app-sheets.md`).
 * `ApproveTransfer` proper (a yes again) only for a learner-started request whose learner consent was reset on
 * route `device`, and only while this device can still make its claim; every other open request gets the
 * read-only sheet whose only actions are the veto and Back (guard 11), and a planned move the cooling-off sheet
 * with Cancel the move. Behind the grown-up gate; the decision is `requestAction`, never this screen.
 */
export function ApproveTransferScreen({ route, navigation }: Props): React.ReactElement {
  const { profileId, transferId } = route.params;
  const messages = useMessages();
  const t = messages.caregiver.transfer;
  const locale = useLocale();
  const online = useOnline();
  const gateOpen = useGateOpen();
  const date = useMoveDate();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const transfers = useLearnerTransfers(profileId);
  const device = useTransferDevice(profileId);
  const approveMove = useMembershipStore((s) => s.approveMove);
  const declineMove = useMembershipStore((s) => s.declineMove);
  const cancelMove = useMembershipStore((s) => s.cancelMove);
  const refresh = useMembershipStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped on every reload, so the sheet is drawn fresh (read to the end again) even when the digest is unchanged.
  const [reloads, setReloads] = useState(0);

  // On a managed device the PIN was entered for this sheet only: the grown-up session ends when it closes.
  const leaving = useEndsGateOnLeave(navigation);
  useEffect(() => {
    if (!gateOpen && !leaving.current) navigation.replace('PinEntry', { next: 'ApproveTransfer', profileId, transferId });
  }, [gateOpen, navigation, profileId, transferId, leaving]);

  const request = transfers?.requests.find((r) => r.id === transferId) ?? null;
  const open = request !== null && isOpenRequest(request) && transfers?.scope === 'full';
  const action = open && request && device ? requestAction(request, device) : null;
  const name = profile?.displayName ?? '';

  /** Sends one answer; offline nothing is sent or queued. */
  const answer = async (call: () => Promise<TransferRequestOutcome>): Promise<void> => {
    if (!online) {
      setError(messages.caregiver.retry.offline);
      return;
    }
    setError(null);
    setBusy(true);
    const result = await call();
    setBusy(false);
    if (result.ok) {
      navigation.goBack();
      return;
    }
    if (REQUEST_RELOAD.has(result.error)) {
      setNotice(messages.console.transfer.consent.updated);
      setReloads((n) => n + 1);
      await refresh(profileId);
      return;
    }
    setError(moveErrorLine(result, name, messages.caregiver));
  };

  const back = (
    <>
      <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel={messages.a11y.goBack} style={{ alignSelf: 'flex-start', minWidth: touchTarget.min, minHeight: touchTarget.min, justifyContent: 'center' }}>
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
    </>
  );

  const errorLine = error ? (
    <View accessibilityRole="alert" style={{ paddingTop: spacing.md }}>
      <Body tone="secondary" align="center">
        {error}
      </Body>
    </View>
  ) : null;

  const backButton = <Button label={messages.common.buttons.back} tone="ghost" size="lg" fullWidth disabled={busy} onPress={() => navigation.goBack()} />;

  if (!request || !action || !device) {
    return (
      <Screen tone="canvas" scrollable>
        {back}
        <FocusTitle text={t.readOnly.title} />
        <Spacer size="md" />
        <Body tone="secondary">{t.lines.ended}</Body>
        <Spacer size="lg" />
        {backButton}
      </Screen>
    );
  }

  if (action.sheet === 'approve' && action.attest) {
    const attest = action.attest;
    return (
      <Screen tone="canvas" scrollable={false}>
        <ConsentSheet
          key={`${request.termsDigest ?? request.id}:${reloads}`}
          data={sheetDataFromRequest(request, name)}
          initialLocale={sheetLocaleOf(locale)}
          self={attest === 'self'}
          notice={notice ?? t.lines.checkAgain}
          error={error}
          busy={busy}
          header={back}
          onYes={(l) => void answer(() => approveMove(profileId, transferId, deviceConsentRecord(l, attest, request.termsDigest)))}
          onNotNow={() => void answer(() => declineMove(profileId, transferId))}
          notNowNote={t.lines.notNowEnds}
        />
      </Screen>
    );
  }

  if (action.sheet === 'planned') {
    return (
      <Screen tone="canvas" scrollable>
        {back}
        <FocusTitle text={t.lines.planned(date(request.executeAfter ?? request.expiresAt))} />
        <Spacer size="md" />
        <Body>{TRANSFER_CONSENT_TEXT[sheetLocaleOf(locale)].lines.cooling_off}</Body>
        <Spacer size="xl" />
        <Button label={t.actions.cancelMove.cta} tone="ghost" size="lg" fullWidth disabled={busy} onPress={() => void answer(() => cancelMove(profileId, transferId))} testID="transfer-veto" />
        <Spacer size="sm" />
        {backButton}
        {errorLine}
      </Screen>
    );
  }

  const view = readOnlySheetView(request, device, name, t);
  return (
    <Screen tone="canvas" scrollable>
      {back}
      <FocusTitle text={t.readOnly.title} />
      <Spacer size="md" />
      <View style={{ gap: spacing.sm }}>
        {view.lines.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        {view.room ? <RoomBlock text={view.room} /> : null}
      </View>
      <Spacer size="xl" />
      <Button
        label={view.veto === 'decline' ? t.actions.notNow.cta : t.actions.cancelRequest.cta}
        tone="ghost"
        size="lg"
        fullWidth
        disabled={busy}
        accessibilityHint={view.vetoNote ?? undefined}
        onPress={() => void answer(() => (view.veto === 'decline' ? declineMove(profileId, transferId) : cancelMove(profileId, transferId)))}
        testID="transfer-veto"
      />
      {view.vetoNote ? (
        <Body tone="secondary" size="sm" align="center">
          {view.vetoNote}
        </Body>
      ) : null}
      <Spacer size="sm" />
      {backButton}
      {errorLine}
    </Screen>
  );
}
