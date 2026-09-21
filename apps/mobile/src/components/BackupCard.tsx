import type { Profile } from '@hangul-route/content-schema';
import { Body, Button, Caption, Card, Spacer, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { backupFileName, encodeBackup } from '../logic/sync/backup';
import { saveTextFile } from '../platform/file';
import { useProgressStore } from '../store/progress-store';
import { useSyncStore, type LearnerSyncState } from '../store/sync-store';

/**
 * "Progress backup" card on profile/settings — F-SYNC-002 §3.3.
 */
export interface BackupCardProps {
  profile: Profile;
  onRestore: () => void;
}

export function statusLine(state: LearnerSyncState | undefined, now: Date): string {
  if (!state || state.status === 'off') return 'Saved on this device only.';
  if (state.status === 'error') return "Couldn't reach the cloud — will retry.";
  if (state.status === 'syncing') return 'Saving to the cloud…';
  if (!state.lastSyncedAt) return 'Waiting for the first cloud save.';
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(state.lastSyncedAt).getTime()) / 60_000));
  return minutes < 1 ? 'Saved to the cloud · just now' : `Saved to the cloud · ${minutes} min ago`;
}

export function BackupCard({ profile, onRestore }: BackupCardProps): React.ReactElement {
  const snap = useProgressStore((s) => s.byProfile[profile.id]);
  const syncState = useSyncStore((s) => s.byLearner[profile.id]);
  const hydrateSync = useSyncStore((s) => s.hydrate);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void hydrateSync(profile.id);
  }, [profile.id, hydrateSync]);

  const exportFile = async (): Promise<void> => {
    if (!snap) return;
    const now = new Date();
    const result = await saveTextFile(backupFileName(profile.displayName, now), encodeBackup(profile, snap, now));
    setNote(result.ok ? 'Backup file ready.' : result.reason === 'unavailable' ? 'Saving files is not available here.' : "Couldn't make the file. Try again?");
  };

  return (
    <Card padding="md" testID="backup-card">
      <Body weight="semibold">Progress backup</Body>
      <Caption tone="muted">{statusLine(syncState, new Date())}</Caption>
      <Spacer size="md" />
      <View style={{ gap: spacing.sm }}>
        <Button label="Back up to a file" tone="secondary" size="md" onPress={() => void exportFile()} />
        <Button label="Restore from a file" tone="ghost" size="md" accessibilityLabel="Restore from a file (grown-ups only)" onPress={onRestore} />
      </View>
      {note ? (
        <>
          <Spacer size="sm" />
          <Caption tone="secondary">{note}</Caption>
        </>
      ) : null}
    </Card>
  );
}
