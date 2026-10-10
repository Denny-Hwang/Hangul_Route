import { Body, Button, Caption, Card, Heading, HoyaBubble, Icon, Screen, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { statusLine } from '../../components/BackupCard';
import { rescueCodeHint, rescueCodeLines } from '../../logic/sync/rescue-code';
import { saveNowNote } from '../../logic/sync/status-line';
import type { RootStackParamList } from '../../navigation/types';
import { confirm } from '../../platform/dialog';
import { copyText } from '../../platform/pwa';
import { shareText } from '../../platform/share-text';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useSyncStore } from '../../store/sync-store';

type Props = NativeStackScreenProps<RootStackParamList, 'SaveProgress'>;

/**
 * sync/save-progress — F-RESTORE-001 §3.3. PIN-gated; the code is shown as
 * a block a parent writes down. Rotation is last and small on purpose.
 */
export function SaveProgressScreen({ navigation }: Props): React.ReactElement {
  const profile = useProfileStore(activeProfileSelector);
  const learnerId = profile?.id ?? '';
  const state = useSyncStore((s) => s.byLearner[learnerId]);
  const hydrate = useSyncStore((s) => s.hydrate);
  const syncNow = useSyncStore((s) => s.syncNow);
  const issue = useSyncStore((s) => s.issueRescueCode);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (learnerId) void hydrate(learnerId);
  }, [learnerId, hydrate]);

  const code = state?.rescueCode ?? null;

  const saveNow = async (): Promise<void> => {
    if (!learnerId) return;
    setBusy(true);
    const after = await syncNow(learnerId);
    setBusy(false);
    setNote(saveNowNote(after));
  };

  const rotate = async (): Promise<void> => {
    const yes = await confirm({
      title: 'Get a new code?',
      message: 'The old code will stop working. Write the new one down.',
      confirmLabel: 'Get a new code',
      cancelLabel: 'Keep my code',
      destructive: true,
    });
    if (!yes || !learnerId) return;
    setBusy(true);
    const fresh = await issue(learnerId);
    setBusy(false);
    setNote(fresh ? 'New code ready. The old one no longer works.' : "Couldn't get a new code right now.");
  };

  return (
    <Screen tone="canvas" scrollable>
      <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel="Go back" style={{ alignSelf: 'flex-start', padding: spacing.xs }}>
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Save my progress</Heading>
      <Spacer size="md" />
      <HoyaBubble tone="idle" message={code ? `Write this down. It brings ${profile?.displayName ?? 'your'}'s cards back on any device.` : 'Once progress is saved to the cloud, a rescue code appears here.'} />

      <Spacer size="xl" />
      {code ? (
        <>
          <Card padding="lg" tone="brand" testID="rescue-code">
            {/* One word per row (title size): the longest code still fits a 320 px line without breaking a word. */}
            <Heading level="title" align="center" style={{ letterSpacing: spacing.xxs }}>
              {rescueCodeLines(code).join('\n')}
            </Heading>
            <Spacer size="xs" />
            <Caption tone="muted" align="center">
              {rescueCodeHint(code) ?? ''}
            </Caption>
          </Card>
          <Spacer size="md" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Copy" tone="secondary" size="md" fullWidth onPress={() => void copyText(code).then((ok) => setNote(ok ? 'Copied.' : 'Copy is not available here — write it down.'))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Share" tone="secondary" size="md" fullWidth onPress={() => void shareText(`Hangul Route rescue code for ${profile?.displayName ?? 'my learner'}: ${code}`, 'Rescue code').then((ok) => { if (!ok) setNote('Sharing is not available here — copy it instead.'); })} />
            </View>
          </View>
        </>
      ) : null}

      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Caption tone="muted">{statusLine(state, new Date())}</Caption>
        <Spacer size="sm" />
        <Button label={busy ? 'Saving…' : 'Save now'} tone="primary" size="md" disabled={busy} onPress={() => void saveNow()} />
      </Card>

      {note ? (
        <>
          <Spacer size="md" />
          <Caption tone="secondary" align="center">{note}</Caption>
        </>
      ) : null}

      {code ? (
        <>
          <Spacer size="xxl" />
          <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border.subtle, borderRadius: radii.sm, paddingTop: spacing.md }}>
            <Button label="Get a new code" tone="ghost" size="sm" disabled={busy} onPress={() => void rotate()} />
            <Caption tone="muted">The old code stops working.</Caption>
          </View>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
