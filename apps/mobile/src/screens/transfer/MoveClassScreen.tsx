import { Body, Button, Caption, Card, Icon, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, typography, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { deviceAttest } from '../../logic/transfers/consent-gate';
import { deviceConsentRecord, sheetDataFromPreview, sheetLocaleOf, type ConsentSheetData } from '../../logic/transfers/consent-sheet';
import { MOVE_RELOAD, moveErrorLine } from '../../logic/transfers/transfer-views';
import { cleanJoinCode, codeFieldFontSize, isCompleteJoinCode } from '../../logic/spaces/join-code';
import type { RootStackParamList } from '../../navigation/types';
import { useMembershipStore } from '../../store/membership-store';
import { useProfileStore } from '../../store/profile-store';
import { ConsentSheet } from './ConsentSheet';
import { FocusTitle } from './FocusTitle';
import { StatusLine } from './StatusLine';
import { useEndsGateOnLeave, useGateOpen, useLearnerTransfers, useTransferDevice } from './use-transfer';

type Props = NativeStackScreenProps<RootStackParamList, 'MoveClass'>;

/**
 * MoveClass — F-SPACE-002 section 4.12, T-7c (`design/screens/transfer/app-sheets.md`): enter the new
 * class code, Find class, the consent sheet, send. The device route only (learner-started), behind the
 * grown-up gate unless it opens directly. Online only: offline says "This needs internet." and nothing is
 * queued (consent is never sent later). Reachable only while the Classes card offers Move (variant c).
 */
export function MoveClassScreen({ route, navigation }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const { profileId, fromSpaceId } = route.params;
  const messages = useMessages();
  const t = messages.caregiver.transfer;
  const locale = useLocale();
  const online = useOnline();
  const gateOpen = useGateOpen();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const source = useMembershipStore((s) => (s.byLearner[profileId] ?? []).find((m) => m.spaceId === fromSpaceId));
  const previewMove = useMembershipStore((s) => s.previewMove);
  const startMove = useMembershipStore((s) => s.startMove);
  const transfers = useLearnerTransfers(profileId);
  const device = useTransferDevice(profileId);
  const [code, setCode] = useState('');
  const [codeFieldWidth, setCodeFieldWidth] = useState(0);
  const [sheet, setSheet] = useState<ConsentSheetData | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // Bumped on every reload, so the sheet is drawn fresh (read to the end again) even when the digest is unchanged.
  const [reloads, setReloads] = useState(0);

  // On a managed device the PIN was entered for this move only: the grown-up session ends when the screen closes.
  const leaving = useEndsGateOnLeave(navigation);
  // The gate guards this screen too: a closed gate sends it back through the PIN screen (not while it closes).
  useEffect(() => {
    if (!gateOpen && !sent && !leaving.current) navigation.replace('PinEntry', { next: 'MoveClass', profileId, fromSpaceId });
  }, [gateOpen, sent, navigation, profileId, fromSpaceId, leaving]);

  const name = profile?.displayName ?? '';
  const claim = device ? deviceAttest(device) : null;
  const allowed = transfers?.enabled === true && transfers.deviceConsent && transfers.scope === 'full' && claim?.kind === 'attest' && source !== undefined;

  const find = async (): Promise<void> => {
    if (!online) {
      setError(messages.caregiver.retry.offline);
      return;
    }
    setError(null);
    setBusy(true);
    const result = await previewMove(profileId, fromSpaceId, code);
    setBusy(false);
    // A failed find (also a reload's) leaves the code step with its line: no stale sheet stays up.
    if (!result.ok) {
      setSheet(null);
      setNotice(null);
      setError(moveErrorLine(result, name, messages.caregiver));
      return;
    }
    if (result.preview.blockReason) {
      setSheet(null);
      setNotice(null);
      setError(moveErrorLine({ ok: false, error: result.preview.blockReason }, name, messages.caregiver));
      return;
    }
    setDestinationId(result.preview.destination.id);
    setSheet(sheetDataFromPreview(result.preview, { learnerName: name, sourceName: source?.name ?? '' }));
  };

  const send = async (sheetLocale: Parameters<typeof deviceConsentRecord>[0], introduce: boolean): Promise<void> => {
    if (!sheet || destinationId === null || claim?.kind !== 'attest') return;
    // Consent is never queued: offline, nothing is sent and nothing waits to be sent.
    if (!online) {
      setError(messages.caregiver.retry.offline);
      return;
    }
    setError(null);
    setBusy(true);
    const result = await startMove(profileId, {
      fromSpaceId,
      destinationSpaceId: destinationId,
      code,
      introduce,
      consent: deviceConsentRecord(sheetLocale, claim.attest, sheet.termsDigest),
    });
    setBusy(false);
    if (result.ok) {
      setSent(true);
      return;
    }
    if (MOVE_RELOAD.has(result.error)) {
      setNotice(messages.console.transfer.consent.updated);
      setReloads((n) => n + 1);
      await find();
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

  if (sent) {
    return (
      <Screen tone="canvas" scrollable>
        {back}
        <FocusTitle text={t.move.title} />
        <Spacer size="lg" />
        <Card padding="lg" tone="success" testID="move-sent">
          <StatusLine>
            <Body align="center">{t.move.sent}</Body>
          </StatusLine>
          <Spacer size="lg" />
          <Button label={messages.common.buttons.done} tone="primary" size="lg" fullWidth onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  if (sheet) {
    return (
      <Screen tone="canvas" scrollable={false}>
        <ConsentSheet
          key={`${sheet.termsDigest ?? sheet.destination.name}:${reloads}`}
          data={sheet}
          initialLocale={sheetLocaleOf(locale)}
          self={claim?.kind === 'attest' && claim.attest === 'self'}
          notice={notice}
          error={error}
          busy={busy}
          header={back}
          onYes={(l, introduce) => void send(l, introduce)}
          onNotNow={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable>
      {back}
      <FocusTitle text={t.move.title} />
      <Spacer size="xs" />
      <Body tone="secondary">{t.move.step1}</Body>
      <Spacer size="lg" />
      <Caption tone="secondary" weight="semibold">
        {t.move.codeLabel}
      </Caption>
      <Spacer size="xs" />
      <TextInput
        value={code}
        onChangeText={(v) => {
          setError(null);
          setCode(cleanJoinCode(v));
        }}
        placeholder={messages.caregiver.join.code.placeholder}
        placeholderTextColor={colors.text.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        accessibilityLabel={t.move.codeLabel}
        aria-invalid={error !== null}
        {...{ 'aria-describedby': error || !online ? 'move-code-line' : undefined }}
        testID="move-code"
        // The code is drawn as large as the text size asks, but never so large that a whole code is cut (section 4).
        onLayout={(e) => setCodeFieldWidth(e.nativeEvent.layout.width - 2 * borderWidth.base)}
        style={{
          minHeight: touchTarget.hero,
          textAlign: 'center',
          fontSize: codeFieldFontSize(textScale.size.display, codeFieldWidth, spacing.sm),
          fontWeight: typography.weight.bold,
          letterSpacing: spacing.sm,
          color: colors.text.primary,
          backgroundColor: colors.surface.paper,
          borderWidth: borderWidth.base,
          borderColor: colors.border.subtle,
          borderRadius: radii.lg,
        }}
      />
      <Spacer size="xs" />
      <Caption tone="muted" align="center">
        {messages.caregiver.join.code.rules}
      </Caption>
      <Spacer size="md" />
      <Button
        label={busy ? messages.caregiver.join.code.looking.cta : t.actions.find.cta}
        tone="primary"
        size="hero"
        fullWidth
        disabled={busy || !online || !allowed || !isCompleteJoinCode(code)}
        accessibilityHint={online ? undefined : messages.caregiver.retry.offline}
        onPress={() => void find()}
        testID="move-find"
      />
      {error || !online || !allowed ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" {...{ id: 'move-code-line' }} style={{ paddingTop: spacing.md }}>
          <Body tone="secondary" align="center">
            {error ?? (online ? t.errors.deviceConsentLocked : messages.caregiver.retry.offline)}
          </Body>
        </View>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
