import { Body, Button, Caption, Card, Heading, HoyaBubble, Screen, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { rescueCodeHint, rescueCodeLines } from '../../logic/sync/rescue-code';
import { cloudStatusLine, saveNowNote } from '../../logic/sync/status-line';
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
  const messages = useMessages();
  const m = messages.caregiver.saveProgress;
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
    setNote(saveNowNote(after, messages.caregiver.sync));
  };

  const rotate = async (): Promise<void> => {
    const yes = await confirm({
      title: m.rotate.confirmTitle,
      message: m.rotate.confirmMessage,
      confirmLabel: m.rotate.cta,
      cancelLabel: m.rotate.keep.cta,
      destructive: true,
    });
    if (!yes || !learnerId) return;
    setBusy(true);
    const fresh = await issue(learnerId);
    setBusy(false);
    setNote(fresh ? m.rotate.ready : m.rotate.unavailable);
  };

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">{m.title}</Heading>
      <Spacer size="md" />
      <HoyaBubble tone="idle" message={code ? m.bubble.code(profile?.displayName ?? null) : m.bubble.noCode} />

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
              {rescueCodeHint(code, m) ?? ''}
            </Caption>
          </Card>
          <Spacer size="md" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label={m.copy.cta} tone="secondary" size="md" fullWidth onPress={() => void copyText(code).then((ok) => setNote(ok ? m.copy.done : m.copy.unavailable))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={m.share.cta} tone="secondary" size="md" fullWidth onPress={() => void shareText(m.share.text(profile?.displayName ?? null, code), m.share.title).then((ok) => { if (!ok) setNote(m.share.unavailable); })} />
            </View>
          </View>
        </>
      ) : null}

      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Caption tone="muted">{cloudStatusLine(state, new Date(), messages.caregiver.sync)}</Caption>
        <Spacer size="sm" />
        <Button label={busy ? m.saveNow.saving.cta : m.saveNow.cta} tone="primary" size="md" disabled={busy} onPress={() => void saveNow()} />
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
            <Button label={m.rotate.cta} tone="ghost" size="sm" disabled={busy} onPress={() => void rotate()} />
            <Caption tone="muted">{m.rotate.caption}</Caption>
          </View>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
