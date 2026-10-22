import { Button, Caption, Card, Heading, Hoya, HoyaBubble, Screen, Spacer, colors, radii, spacing, touchTarget, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeRescueCode } from '@hangul-route/content-schema';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { decodeBackup } from '../../logic/sync/backup';
import { restoreMemory } from '../../logic/sync/memory-hook';
import { RESCUE_INPUT_MAX, claimErrorMessage, cleanRescueInput, rescueInputRows } from '../../logic/sync/rescue-code';
import { planRestore, restoreNotice, type RestorePlan } from '../../logic/sync/restore';
import type { RootStackParamList } from '../../navigation/types';
import { pickTextFile } from '../../platform/file';
import { apiBaseUrl } from '../../platform/sync-api';
import { useAudience } from '../../store/audience';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { rederiveLocal } from '../../store/membership-store';
import { useSyncStore } from '../../store/sync-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Restore'>;

/**
 * sync/restore — three paths on one screen (wireframe): Rescue Code
 * (F-RESTORE-001 §3.4), grown-up sign-in (F-AUTH-002, not yet), a saved
 * file (F-SYNC-002 §3.3). Never overwrites; ends on the merge notice.
 */
/** The code field's line height at the chosen text size (bodyLg x 1.3), so its height can be planned for the worst case. */
const codeLineHeight = (fontSize: number): number => Math.round(fontSize * 1.3);
const CODE_BORDER = 2;

export function RestoreScreen({ navigation, route }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const fieldLineHeight = codeLineHeight(textScale.size.bodyLg);
  const { copy } = useAudience();
  const messages = useMessages();
  const m = messages.caregiver.restore;
  const from = route.params?.from ?? 'settings';
  const profiles = useProfileStore((s) => s.profiles);
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const codeRows = rescueInputRows(codeInput);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RestorePlan | null>(null);
  const cloudAvailable = !!apiBaseUrl();

  const finish = (plan: RestorePlan): void => {
    setMessage(null);
    setDone(plan);
  };

  const claim = async (): Promise<void> => {
    if (busy || !cloudAvailable) return;
    const code = normalizeRescueCode(codeInput);
    if (!code) {
      setMessage(claimErrorMessage('invalid', messages.caregiver));
      return;
    }
    setBusy(true);
    const result = await useSyncStore.getState().claimRescueCode(code);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error === 'off' ? m.cloudOffUseFile : claimErrorMessage(result.error, messages.caregiver));
      return;
    }
    finish(result.plan);
  };

  const restoreFile = async (): Promise<void> => {
    const picked = await pickTextFile();
    if (!picked.ok) {
      if (picked.reason === 'failed') setMessage(m.file.openFailed);
      return;
    }
    const decoded = decodeBackup(picked.text);
    if (!decoded.ok) {
      setMessage(decoded.error === 'unsupported-version' ? m.file.newerVersion : m.file.unreadable);
      return;
    }
    const file = decoded.file;
    const existingProfile = profiles.find((p) => p.id === file.profile.id) ?? null;
    const progress = useProgressStore.getState();
    if (existingProfile) await progress.hydrate(existingProfile.id);
    const plan = planRestore(file, existingProfile ? { profile: existingProfile, snapshot: progress.ensure(existingProfile.id) } : null, new Date());
    if (plan.action === 'create') useProfileStore.getState().adoptProfile(plan.profile);
    progress.replaceSnapshot(plan.profile.id, plan.snapshot);
    // F-CURR-002 section 4.8: the file's memory states, merged into the store (none before row CM-12).
    await restoreMemory(plan.profile.id, file.memory);
    // The merge is a union: put the cached plans' answer back on derived homework (F-PLAN-002 section 3.6).
    await rederiveLocal(plan.profile.id);
    useSyncStore.getState().requestSync(plan.profile.id);
    finish(plan);
  };

  const leave = (): void => {
    if (from === 'welcome' && useProfileStore.getState().profiles.length === 0) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'Home' });
  };

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">{m.title}</Heading>
      <Spacer size="md" />
      <HoyaBubble tone="thinking" message={copy.restorePrompt} />
      <Spacer size="xl" />

      {done ? (
        <Card padding="lg" tone="success" testID="restore-notice">
          <View style={{ alignItems: 'center' }}>
            <Hoya pose="cheering" size={96} />
          </View>
          <Spacer size="md" />
          <HoyaBubble tone="cheering" message={restoreNotice(done, messages.caregiver)} />
          <Spacer size="lg" />
          <Button label={m.great.cta} tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
        </Card>
      ) : (
        <>
          <Button label={m.code.cta} tone="primary" size="hero" fullWidth onPress={() => setShowCode((v) => !v)} />
          {showCode ? (
            <>
              <Spacer size="md" />
              <TextInput
                value={codeInput}
                onChangeText={(v) => {
                  setMessage(null);
                  setCodeInput(cleanRescueInput(v));
                }}
                onSubmitEditing={() => void claim()}
                // Wraps instead of scrolling sideways. The box has a row for every word typed (worst case: one per row), so no font can clip the last one at 320 px. Enter still submits.
                multiline
                numberOfLines={codeRows}
                blurOnSubmit
                placeholder={m.code.placeholder}
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                returnKeyType="go"
                maxLength={RESCUE_INPUT_MAX}
                accessibilityLabel={messages.a11y.rescueCode}
                testID="rescue-code-input"
                style={{
                  minHeight: Math.max(touchTarget.child, codeRows * fieldLineHeight + 2 * spacing.sm + 2 * CODE_BORDER),
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  fontSize: textScale.size.bodyLg,
                  lineHeight: fieldLineHeight,
                  fontWeight: '700',
                  color: colors.text.primary,
                  backgroundColor: colors.surface.paper,
                  borderWidth: CODE_BORDER,
                  borderColor: colors.border.subtle,
                  borderRadius: radii.lg,
                }}
              />
              <Spacer size="xs" />
              <Caption tone="muted" align="center">{m.code.example}</Caption>
              <Spacer size="md" />
              <Button label={busy ? m.code.looking.cta : m.code.find.cta} tone="primary" size="lg" fullWidth disabled={busy || !cloudAvailable} onPress={() => void claim()} />
              {!cloudAvailable ? (
                <>
                  <Spacer size="xs" />
                  <Caption tone="muted" align="center">{m.cloudOff}</Caption>
                </>
              ) : null}
            </>
          ) : null}
          <Spacer size="md" />
          <Button label={copy.restoreSignInLabel} tone="secondary" size="lg" fullWidth disabled onPress={() => {}} />
          <Caption tone="muted" align="center">{m.signIn.comingSoon}</Caption>
          <Spacer size="md" />
          <Button label={m.file.cta} tone="secondary" size="lg" fullWidth onPress={() => void restoreFile()} />
          {message ? (
            <>
              <Spacer size="md" />
              <Caption tone="secondary" align="center">{message}</Caption>
            </>
          ) : null}
          <Spacer size="xl" />
          <Button label={m.startFresh.cta} tone="ghost" size="md" fullWidth onPress={leave} />
        </>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
