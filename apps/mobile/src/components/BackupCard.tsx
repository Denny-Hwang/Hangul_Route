import type { Profile } from '@hangul-route/content-schema';
import { Body, Button, Caption, Card, Spacer, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { backupFileName, encodeBackup } from '../logic/sync/backup';
import { memoryForBackup } from '../logic/sync/memory-hook';
import { cloudStatusLine } from '../logic/sync/status-line';
import { saveTextFile } from '../platform/file';
import { useAudience } from '../store/audience';
import { useProgressStore } from '../store/progress-store';
import { useSyncStore } from '../store/sync-store';

/**
 * "Progress backup" card on profile/settings — F-SYNC-002 §3.3.
 */
export interface BackupCardProps {
  profile: Profile;
  onRestore: () => void;
  onSaveProgress: () => void;
}

export function BackupCard({ profile, onRestore, onSaveProgress }: BackupCardProps): React.ReactElement {
  const { copy, pinSet } = useAudience();
  const messages = useMessages();
  const m = messages.caregiver.backup;
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
    const result = await saveTextFile(backupFileName(profile.displayName, now), encodeBackup(profile, snap, now, await memoryForBackup(profile.id)));
    setNote(result.ok ? m.note.ready : result.reason === 'unavailable' ? m.note.unavailable : m.note.failed);
  };

  return (
    <Card padding="md" testID="backup-card">
      <Body weight="semibold">{m.title}</Body>
      <Caption tone="muted">{cloudStatusLine(syncState, new Date(), messages.caregiver.sync)}</Caption>
      <Spacer size="md" />
      <View style={{ gap: spacing.sm }}>
        <Button label={m.save.cta} tone="ghost" size="md" accessibilityLabel={copy.gatedA11y(m.save.cta, pinSet, m.save.detail)} onPress={onSaveProgress} />
        <Button label={m.file.cta} tone="ghost" size="md" onPress={() => void exportFile()} />
        <Button label={m.restore.cta} tone="ghost" size="md" accessibilityLabel={copy.gatedA11y(m.restore.cta, pinSet)} onPress={onRestore} />
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
