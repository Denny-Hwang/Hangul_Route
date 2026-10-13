import { Body, Button, Card, Heading, Icon, Screen, Spacer, borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import { NOTE_REPORT_REASONS, type NoteReportReason } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useMessages } from '../../i18n/use-messages';
import { attestFor, endsGateOnLeave, grownUpNotes, noteReportDoneTarget, reportSentEvent, type ReportAnswer } from '../../logic/notes/grown-up';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useProfileStore } from '../../store/profile-store';
import { useUiStore } from '../../store/ui-store';
import { backToNotes } from '../notes/back-to-notes';
import { HideConfirmSheet } from '../notes/HideConfirmSheet';
import { hideNoteNow, reportNoteNow } from '../notes/note-actions';
import { useProfileNotes } from '../notes/use-notes';
import { useGateLapse } from './use-gate-lapse';

type Props = NativeStackScreenProps<RootStackParamList, 'NoteReport'>;

/** The line under Report and hide describes it (web `aria-describedby`). */
const LINE_ID = 'note-report-line';

type Done = Exclude<ReportAnswer, 'refused'> | 'hidden';

/**
 * The report sheet of one note (F-FEEDBACK-001 section 6.10 item 4, FB-9; mock
 * design/screens/notes/note-report.md). Reached through the gate from "Tell a grown-up", directly
 * from "Report this note" on a self-managed profile, and from Report in Notes for <learner>.
 * Four reasons and no free text (nothing typed about a learner is collected). **Report and hide**
 * queues the report with a local hide at once and sends it when it can; **Just hide it** (a
 * full-scope device, online) hides without a report (decision D8), after the Hide confirm. The
 * person reporting is never told what happens to the sender.
 */
export function NoteReportScreen({ navigation, route }: Props): React.ReactElement {
  const m = useMessages();
  const t = m.caregiver.notes;
  const r = t.report;
  const { noteId, profileId } = route.params;
  const via = route.params.via ?? 'note_page';
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const { opensDirectly } = useAudience();
  // Re-checked when the session lapses or the sheet is back in focus: a sheet left open goes to the PIN.
  const { sessionOpen, stillOpen } = useGateLapse(navigation);
  const gateOpen = opensDirectly(sessionOpen);
  const selfManaged = opensDirectly(false);
  const online = useOnline();
  const { data, status, retry, ctx } = useProfileNotes(profileId);
  const [reason, setReason] = useState<NoteReportReason | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [classScoped, setClassScoped] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (profile === undefined) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('ParentDashboard');
    }
    else if (!gateOpen) navigation.replace('PinEntry', { next: 'NoteReport', noteId, profileId, noteVia: via });
  }, [gateOpen, profile, noteId, profileId, via, navigation]);

  // The learner path (a note page on a gated device): the PIN was entered for this report only, so
  // the grown-up session ends however the sheet is left (Done, the close button, a hardware or
  // browser back), and the device goes back to the learner with the grown-up zone closed.
  const endsGate = endsGateOnLeave(via, selfManaged);
  useEffect(() => {
    if (!endsGate) return undefined;
    return navigation.addListener('beforeRemove', () => useUiStore.getState().resetParentGate());
  }, [endsGate, navigation]);
  useEffect(() => (endsGate ? () => useUiStore.getState().resetParentGate() : undefined), [endsGate]);

  const quoted = useMemo(() => (data === undefined ? null : (grownUpNotes(data, ctx).find((row) => row.id === noteId) ?? null)), [data, ctx, noteId]);
  // The report hides the note here at once: keep quoting it while the answer is on its way.
  const lastQuoted = useRef(quoted);
  if (quoted !== null) lastQuoted.current = quoted;

  if (!gateOpen || profile === undefined || (status === 'loading' && data === undefined)) return <Screen tone="canvas">{null}</Screen>;
  const name = profile.displayName;
  const attest = attestFor(selfManaged);
  // Already gone before anything was sent here: the note left this device (hidden, withdrawn, reported elsewhere).
  // Only a record that was read can say so: a read error offers Try again instead.
  const shown: Done | null = done ?? (quoted === null && !busy && status === 'ready' ? 'alreadyGone' : null);

  const close = (): void => {
    if (endsGate) useUiStore.getState().resetParentGate();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ParentDashboard');
  };
  const finish = (): void => {
    if (noteReportDoneTarget(via) === 'back') return close();
    // The learner path: the grown-up is done, so the gate session ends, and the one My notes shows what is left.
    if (endsGate) useUiStore.getState().resetParentGate();
    backToNotes(navigation);
  };

  // The report carries the grown-up attestation: it goes out only while the session is still open.
  const mayAct = (): boolean => opensDirectly(stillOpen());

  const submit = async (): Promise<void> => {
    if (reason === null || busy || !mayAct()) return;
    setBusy(true);
    setFailed(false);
    const answer = await reportNoteNow(profileId, noteId, reason, attest);
    // Counted once the report is sent or waiting to be sent, never for a note that was already gone or a limit.
    if (answer === 'reported' || answer === 'queued') void track(reportSentEvent(reason, via));
    setBusy(false);
    // Refused (not a gone note): nothing was recorded, so the sheet stays with the note and says it did not send.
    if (answer === 'refused') setFailed(true);
    else setDone(answer);
  };

  const justHide = async (): Promise<void> => {
    if (!mayAct()) {
      setConfirming(false);
      return;
    }
    setBusy(true);
    setFailed(false);
    const outcome = await hideNoteNow(profileId, noteId);
    setBusy(false);
    setConfirming(false);
    if (outcome === 'hidden') setDone('hidden');
    else if (outcome === 'alreadyGone') setDone('alreadyGone');
    else if (outcome === 'classScoped') setClassScoped(true);
    else setFailed(true);
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Heading level="title">{r.title}</Heading>
      </View>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={r.close}
        testID="note-report-close"
        style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={24} color={colors.text.secondary} />
      </Pressable>
    </View>
  );

  if (shown !== null) {
    const lines: string[] =
      shown === 'reported'
        ? [r.reported, ...(reason === 'unsafe' ? [r.emergency] : [])]
        : shown === 'hidden'
          ? [r.hidden]
          : shown === 'alreadyGone'
            ? [r.alreadyGone]
            : shown === 'tooMany'
              ? [r.tooMany]
              : [r.queued, ...(reason === 'unsafe' ? [r.emergency] : [])];
    return (
      <Screen tone="canvas" scrollable testID="note-report">
        <View style={{ width: '100%', maxWidth: layout.maxWidth.reading, alignSelf: 'center' }}>
          {header}
          <Spacer size="lg" />
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ gap: spacing.sm }} testID={`note-report-${shown}`}>
            {lines.map((line) => (
              <Body key={line} size="lg">
                {line}
              </Body>
            ))}
          </View>
          <Spacer size="xl" />
          <Button label={r.done.cta} tone="primary" size="lg" fullWidth onPress={finish} testID="note-report-done" />
        </View>
      </Screen>
    );
  }

  if (status === 'error' && data === undefined) {
    return (
      <Screen tone="canvas" scrollable testID="note-report">
        <View style={{ width: '100%', maxWidth: layout.maxWidth.reading, alignSelf: 'center', gap: spacing.md }}>
          {header}
          <View accessibilityRole="alert" testID="note-report-load-error">
            <Body>{t.error}</Body>
          </View>
          <Button label={t.retry.cta} tone="secondary" size="md" onPress={retry} testID="note-report-retry" />
        </View>
      </Screen>
    );
  }

  const row = quoted ?? lastQuoted.current;
  if (row === null) return <Screen tone="canvas">{null}</Screen>;
  const langProps = row.textLang === undefined ? {} : { lang: row.textLang, accessibilityLanguage: row.textLang };
  const canJustHide = !classScoped;

  return (
    <Screen tone="canvas" scrollable testID="note-report">
      <View style={{ width: '100%', maxWidth: layout.maxWidth.reading, alignSelf: 'center' }}>
        {header}
        <Spacer size="md" />
        <Card padding="md" tone="sunken" elevation="flat" testID="note-report-quote">
          <Body tone="secondary" size="sm">
            {row.line}
          </Body>
          <Body weight="bold">{row.preset}</Body>
          {row.text !== null ? (
            <Text {...langProps} style={{ fontSize: typography.size.body, color: colors.text.primary }}>
              {row.text}
            </Text>
          ) : null}
        </Card>

        {failed ? (
          <View
            accessibilityRole="alert"
            style={{ marginTop: spacing.md, backgroundColor: colors.feedback.nudgeLight, borderLeftWidth: borderWidth.thick, borderLeftColor: colors.feedback.nudge, borderRadius: radii.md, padding: spacing.md }}
          >
            <Body>{t.saveFailed}</Body>
          </View>
        ) : null}

        <Spacer size="lg" />
        <View accessibilityRole="radiogroup" accessibilityLabel={r.why} style={{ gap: spacing.sm }} testID="note-report-reasons">
          <Heading level="prompt">{r.why}</Heading>
          {NOTE_REPORT_REASONS.map((id) => {
            const label = id === 'not_for_me' ? r.reasons.not_for_me(name) : r.reasons[id];
            const selected = reason === id;
            return (
              <Pressable
                key={id}
                onPress={() => setReason(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                accessibilityLabel={label}
                testID={`note-report-reason-${id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: touchTarget.min,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface.paper,
                  borderWidth: selected ? borderWidth.thick : borderWidth.base,
                  borderColor: selected ? colors.brand.primary : colors.border.strong,
                }}
              >
                <View
                  style={{
                    width: spacing.xl,
                    height: spacing.xl,
                    borderRadius: radii.circle,
                    borderWidth: borderWidth.base,
                    borderColor: selected ? colors.brand.primary : colors.border.shape,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? <View style={{ width: spacing.md, height: spacing.md, borderRadius: radii.circle, backgroundColor: colors.brand.primary }} /> : null}
                </View>
                <Text style={{ flex: 1, fontSize: typography.size.body, color: colors.text.primary, fontWeight: selected ? typography.weight.bold : typography.weight.regular }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Spacer size="xl" />
        <Button
          label={r.submit.cta}
          tone="primary"
          size="lg"
          fullWidth
          disabled={reason === null || busy}
          accessibilityHint={r.line(name)}
          onPress={() => void submit()}
          testID="note-report-submit"
        />
        <Spacer size="xs" />
        <Text nativeID={LINE_ID} testID="note-report-line" style={{ fontSize: typography.size.body, color: colors.text.secondary }}>
          {r.line(name)}
        </Text>
        {canJustHide ? (
          <>
            <Spacer size="md" />
            <Button
              label={r.justHide.cta}
              tone="secondary"
              size="lg"
              fullWidth
              disabled={!online || busy}
              {...(online ? {} : { accessibilityHint: t.offline })}
              onPress={() => setConfirming(true)}
              testID="note-report-just-hide"
            />
            {!online ? (
              <Body tone="secondary" size="sm">
                {t.offline}
              </Body>
            ) : null}
          </>
        ) : null}
        <Spacer size="xl" />
      </View>
      <HideConfirmSheet visible={confirming} learner={name} busy={busy} onHide={() => void justHide()} onCancel={() => setConfirming(false)} />
    </Screen>
  );
}
