import { Body, Button, Caption, Card, Heading, Hoya, HoyaBubble, Icon, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { decodeBackup } from '../../logic/sync/backup';
import { planRestore, restoreNotice, type RestorePlan } from '../../logic/sync/restore';
import type { RootStackParamList } from '../../navigation/types';
import { pickTextFile } from '../../platform/file';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useSyncStore } from '../../store/sync-store';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupRestore'>;

/**
 * Restore from a backup file — the server-less branch of wireframe
 * sync/restore (F-SYNC-002 §3.3). Parent-gated by PinEntry.
 */
export function BackupRestoreScreen({ navigation }: Props): React.ReactElement {
  const profiles = useProfileStore((s) => s.profiles);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<RestorePlan | null>(null);

  const restore = async (): Promise<void> => {
    const picked = await pickTextFile();
    if (!picked.ok) {
      if (picked.reason === 'failed') setMessage("Couldn't open that file.");
      return;
    }
    const decoded = decodeBackup(picked.text);
    if (!decoded.ok) {
      setMessage(
        decoded.error === 'unsupported-version'
          ? 'This backup comes from a newer version. Update the app first.'
          : "This file can't be read. Choose a .hangulroute.json backup.",
      );
      return;
    }
    const file = decoded.file;
    const existingProfile = profiles.find((p) => p.id === file.profile.id) ?? null;
    const progress = useProgressStore.getState();
    if (existingProfile) await progress.hydrate(existingProfile.id);
    const existing = existingProfile ? { profile: existingProfile, snapshot: progress.ensure(existingProfile.id) } : null;
    const plan = planRestore(file, existing, new Date());

    if (plan.action === 'create') useProfileStore.getState().adoptProfile(plan.profile);
    progress.replaceSnapshot(plan.profile.id, plan.snapshot);
    useSyncStore.getState().requestSync(plan.profile.id);
    setMessage(null);
    setDone(plan);
  };

  return (
    <Screen tone="canvas" scrollable>
      <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel="Go back" style={{ alignSelf: 'flex-start', padding: spacing.xs }}>
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Restore from a file</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Choose a backup you saved earlier. Anything already on this device is kept and combined — never replaced.</Body>

      <Spacer size="xl" />
      {done ? (
        <Card padding="lg" tone="success" testID="restore-notice">
          <View style={{ alignItems: 'center' }}>
            <Hoya pose="cheering" size={96} />
          </View>
          <Spacer size="md" />
          <HoyaBubble tone="cheering" message={restoreNotice(done)} />
          <Spacer size="lg" />
          <Button label="Done" tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
        </Card>
      ) : (
        <>
          <Button label="Choose a backup file" tone="primary" size="hero" fullWidth onPress={() => void restore()} />
          {message ? (
            <>
              <Spacer size="md" />
              <Caption tone="secondary" align="center">
                {message}
              </Caption>
            </>
          ) : null}
        </>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
