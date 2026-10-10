import { Button, Caption, Card, Heading, Hoya, HoyaBubble, Icon, Screen, Spacer, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeRescueCode } from '@hangul-route/content-schema';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { decodeBackup } from '../../logic/sync/backup';
import { RESCUE_INPUT_MAX, claimErrorMessage, cleanRescueInput } from '../../logic/sync/rescue-code';
import { planRestore, restoreNotice, type RestorePlan } from '../../logic/sync/restore';
import type { RootStackParamList } from '../../navigation/types';
import { pickTextFile } from '../../platform/file';
import { apiBaseUrl } from '../../platform/sync-api';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useSyncStore } from '../../store/sync-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Restore'>;

/**
 * sync/restore — three paths on one screen (wireframe): Rescue Code
 * (F-RESTORE-001 §3.4), grown-up sign-in (F-AUTH-002, not yet), a saved
 * file (F-SYNC-002 §3.3). Never overwrites; ends on the merge notice.
 */
export function RestoreScreen({ navigation, route }: Props): React.ReactElement {
  const from = route.params?.from ?? 'settings';
  const profiles = useProfileStore((s) => s.profiles);
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
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
      setMessage(claimErrorMessage('invalid'));
      return;
    }
    setBusy(true);
    const result = await useSyncStore.getState().claimRescueCode(code);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error === 'off' ? 'Cloud restore is not set up on this build. Use a saved file instead.' : claimErrorMessage(result.error));
      return;
    }
    finish(result.plan);
  };

  const restoreFile = async (): Promise<void> => {
    const picked = await pickTextFile();
    if (!picked.ok) {
      if (picked.reason === 'failed') setMessage("Couldn't open that file.");
      return;
    }
    const decoded = decodeBackup(picked.text);
    if (!decoded.ok) {
      setMessage(decoded.error === 'unsupported-version' ? 'This backup comes from a newer version. Update the app first.' : "This file can't be read. Choose a .hangulroute.json backup.");
      return;
    }
    const file = decoded.file;
    const existingProfile = profiles.find((p) => p.id === file.profile.id) ?? null;
    const progress = useProgressStore.getState();
    if (existingProfile) await progress.hydrate(existingProfile.id);
    const plan = planRestore(file, existingProfile ? { profile: existingProfile, snapshot: progress.ensure(existingProfile.id) } : null, new Date());
    if (plan.action === 'create') useProfileStore.getState().adoptProfile(plan.profile);
    progress.replaceSnapshot(plan.profile.id, plan.snapshot);
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
      <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel="Go back" style={{ alignSelf: 'flex-start', padding: spacing.xs }}>
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Bring back progress</Heading>
      <Spacer size="md" />
      <HoyaBubble tone="thinking" message="Got a rescue code, a grown-up account, or a saved file?" />
      <Spacer size="xl" />

      {done ? (
        <Card padding="lg" tone="success" testID="restore-notice">
          <View style={{ alignItems: 'center' }}>
            <Hoya pose="cheering" size={96} />
          </View>
          <Spacer size="md" />
          <HoyaBubble tone="cheering" message={restoreNotice(done)} />
          <Spacer size="lg" />
          <Button label="Great" tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
        </Card>
      ) : (
        <>
          <Button label="I have a rescue code" tone="primary" size="hero" fullWidth onPress={() => setShowCode((v) => !v)} />
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
                // Wraps instead of scrolling sideways; three rows hold the longest code (four 10-letter words + the number) at 320 px. Enter still submits.
                multiline
                numberOfLines={3}
                blurOnSubmit
                placeholder="Words, then the number"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                returnKeyType="go"
                maxLength={RESCUE_INPUT_MAX}
                accessibilityLabel="Rescue code"
                testID="rescue-code-input"
                style={{
                  minHeight: touchTarget.child,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  fontSize: typography.size.bodyLg,
                  fontWeight: '700',
                  color: colors.text.primary,
                  backgroundColor: colors.surface.paper,
                  borderWidth: 2,
                  borderColor: colors.border.subtle,
                  borderRadius: radii.lg,
                }}
              />
              <Spacer size="xs" />
              <Caption tone="muted" align="center">Like TIGER-MOON-RIVER-APPLE-482139. Older codes look like TIGER-MOON-4821.</Caption>
              <Spacer size="md" />
              <Button label={busy ? 'Looking…' : 'Find my cards'} tone="primary" size="lg" fullWidth disabled={busy || !cloudAvailable} onPress={() => void claim()} />
              {!cloudAvailable ? (
                <>
                  <Spacer size="xs" />
                  <Caption tone="muted" align="center">Cloud restore is not set up on this build.</Caption>
                </>
              ) : null}
            </>
          ) : null}
          <Spacer size="md" />
          <Button label="Sign in as a grown-up" tone="secondary" size="lg" fullWidth disabled onPress={() => {}} />
          <Caption tone="muted" align="center">Coming soon</Caption>
          <Spacer size="md" />
          <Button label="Open a saved file" tone="secondary" size="lg" fullWidth onPress={() => void restoreFile()} />
          {message ? (
            <>
              <Spacer size="md" />
              <Caption tone="secondary" align="center">{message}</Caption>
            </>
          ) : null}
          <Spacer size="xl" />
          <Button label="Start fresh instead" tone="ghost" size="md" fullWidth onPress={leave} />
        </>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
