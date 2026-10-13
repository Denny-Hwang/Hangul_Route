import {
  Body,
  Button,
  Card,
  Heading,
  Icon,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import { NOTES_MODES, type NotesMode } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { bundleOs, flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { attestFor, grownUpNotes, oneTimeCard, prefsChangedEvent, showModeSetting, type GrownUpNoteRow } from '../../logic/notes/grown-up';
import { isParentSessionValid } from '../../logic/profiles/session';
import { grownUpEntriesOn } from '../../logic/shell/entry-points';
import { grownUpPinParams } from '../../logic/shell/handoff-rules';
import type { RootStackParamList } from '../../navigation/types';
import { openGrownUpArea } from '../../platform/grown-up-handoff';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useNotesStore } from '../../store/notes-store';
import { useProfileStore } from '../../store/profile-store';
import { useUiStore } from '../../store/ui-store';
import { HideConfirmSheet } from '../notes/HideConfirmSheet';
import { hideNoteNow, putNotePrefsNow } from '../notes/note-actions';
import { BackButton, ROW_GLYPH, glyphColor } from '../notes/parts';
import { useProfileNotes } from '../notes/use-notes';

type Props = NativeStackScreenProps<RootStackParamList, 'NotesGrownUp'>;

const REACTION_GLYPH = { thanks: 'heart', will_try: 'pencil', did_it: 'check-circle', happy: 'sparkle' } as const;
/** The grown-up page the web's Send a note opens (F-FEEDBACK-001 section 6.13 entry 5; the hub is FB-11b). */
const SEND_NOTE_TARGET = '/parent/notes';
const SETTING_ID = 'notes-mode-setting';
/** The one-time card's two equal buttons wrap below this width (mock constants: 8rem). */
const CARD_BUTTON_BASIS = touchTarget.hero + spacing.xxl;

/**
 * Notes for <learner> in the grown-up zone (F-FEEDBACK-001 section 6.10 item 2, FB-9; mock
 * design/screens/notes/grown-up-notes.md B). Behind the gate: with the gate closed the PIN screen
 * replaces it. Every note the device holds for the learner, newest first, put-away ones marked; Hide
 * (online, every device, not a report) and Report (queued with a local hide); the class-notes
 * setting and its one-time card; the disclosure line; on the web, Send a note on app.hangulroute.com.
 */
export function NotesGrownUpScreen({ navigation, route }: Props): React.ReactElement {
  const m = useMessages();
  const t = m.caregiver.notes;
  const { profileId } = route.params;
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
  const gateOpen = opensDirectly(sessionOpen);
  const selfManaged = opensDirectly(false);
  const online = useOnline();
  const { data, ctx, memberships } = useProfileNotes(profileId);
  const [classScoped, setClassScoped] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hiding, setHiding] = useState<string | null>(null);
  const [mode, setMode] = useState<NotesMode | null>(null);
  const settingRef = useRef<View>(null);

  useEffect(() => {
    if (profile === undefined) navigation.replace('ParentDashboard');
    else if (!gateOpen) navigation.replace('PinEntry', { next: 'NotesGrownUp', profileId });
  }, [gateOpen, profile, profileId, navigation]);

  // Opening this learner's notes clears the dashboard row's "New" (a note that arrives while it is open is seen too).
  const noteIds = data?.notes.map((n) => n.id).join(',') ?? '';
  useEffect(() => {
    if (gateOpen && profile !== undefined) void useNotesStore.getState().markGrownUpSeen(profileId);
  }, [gateOpen, profile, profileId, noteIds]);

  const rows = useMemo(() => (data === undefined ? [] : grownUpNotes(data, ctx)), [data, ctx]);
  const prefs = data?.prefs ?? null;
  const card = useMemo(() => oneTimeCard({ memberships, data: data ?? null }), [memberships, data]);
  const setting = showModeSetting({ memberships, prefs });
  const hasClass = memberships.some((row) => row.kind === 'class');
  const shownMode = mode ?? prefs?.classes ?? null;

  if (!gateOpen || profile === undefined) return <Screen tone="canvas">{null}</Screen>;
  const name = profile.displayName;
  const attest = attestFor(selfManaged);

  const savePrefs = async (classes: NotesMode, acknowledge: boolean): Promise<boolean> => {
    setBusy(true);
    setFailed(false);
    const outcome = await putNotePrefsNow(profileId, { classes, ...(acknowledge ? { acknowledge: true as const } : {}), attest });
    setBusy(false);
    if (outcome === 'saved') return true;
    if (outcome === 'classScoped') setClassScoped(true);
    else setFailed(true);
    return false;
  };

  const pickMode = async (next: NotesMode): Promise<void> => {
    if (next === shownMode || busy) return;
    setMode(next);
    const ok = await savePrefs(next, false);
    // The choice snaps back when the Worker did not take it.
    setMode(null);
    if (ok) void track(prefsChangedEvent(next));
  };

  const answerCard = async (change: boolean): Promise<void> => {
    if (card === null || busy) return;
    const ok = await savePrefs(card.mode, true);
    if (ok) await useNotesStore.getState().markClassNotesCardSeen(profileId);
    if (ok && change) settingRef.current?.focus?.();
  };

  const hide = async (): Promise<void> => {
    if (hiding === null) return;
    setBusy(true);
    setFailed(false);
    const outcome = await hideNoteNow(profileId, hiding);
    setBusy(false);
    setHiding(null);
    if (outcome === 'classScoped') setClassScoped(true);
    else if (outcome === 'failed' || outcome === 'offline') setFailed(true);
  };

  const sendNote = async (): Promise<void> => {
    const request = { via: 'dashboard' as const, target: SEND_NOTE_TARGET };
    try {
      if ((await openGrownUpArea(request)) === 'pin') navigation.navigate('PinEntry', grownUpPinParams(request));
    } catch {
      // Nothing opened; the button stays usable.
    }
  };

  const offlineDescribed = online ? {} : { accessibilityHint: t.offline };

  return (
    <Screen tone="canvas" scrollable testID="notes-grown-up">
      <BackButton onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('ParentDashboard'))} />
      <Heading level="title">{t.title(name)}</Heading>
      <Spacer size="lg" />

      {!online ? (
        <View style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg }} testID="notes-grown-up-offline">
          <Body>{t.offline}</Body>
        </View>
      ) : null}
      {failed ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: colors.feedback.nudgeLight,
            borderLeftWidth: borderWidth.thick,
            borderLeftColor: colors.feedback.nudge,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
          testID="notes-grown-up-failed"
        >
          <Body>{t.saveFailed}</Body>
        </View>
      ) : null}

      {card !== null ? (
        <View style={{ backgroundColor: colors.brand.secondaryLight, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg }} testID="notes-one-time-card">
          <Body>{t.oneTimeCard.line(t.mode.options[card.mode])}</Body>
          {classScoped ? (
            // A class-scoped device cannot answer it (every save is refused): it says where, with no buttons.
            <Body tone="secondary" testID="notes-card-class-scoped">
              {t.mode.classScoped}
            </Body>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <View style={{ flexGrow: 1, flexBasis: CARD_BUTTON_BASIS }}>
                <Button label={t.oneTimeCard.keep.cta} tone="secondary" size="md" fullWidth disabled={!online || busy} {...offlineDescribed} onPress={() => void answerCard(false)} testID="notes-card-keep" />
              </View>
              <View style={{ flexGrow: 1, flexBasis: CARD_BUTTON_BASIS }}>
                <Button label={t.oneTimeCard.change.cta} tone="secondary" size="md" fullWidth disabled={!online || busy} {...offlineDescribed} onPress={() => void answerCard(true)} testID="notes-card-change" />
              </View>
            </View>
          )}
        </View>
      ) : null}

      {rows.length === 0 ? (
        <Body testID="notes-grown-up-empty">{t.empty(name)}</Body>
      ) : (
        <View style={{ gap: spacing.md }}>
          {rows.map((row) => (
            <GrownUpRow
              key={row.id}
              row={row}
              name={name}
              canHide={!classScoped}
              online={online}
              onHide={() => setHiding(row.id)}
              onReport={() => navigation.navigate('NoteReport', { noteId: row.id, profileId, via: 'grown_up_zone' })}
            />
          ))}
        </View>
      )}

      {setting && shownMode !== null ? (
        <>
          <Spacer size="xl" />
          <View
            ref={settingRef}
            accessibilityRole="radiogroup"
            accessibilityLabel={t.mode.title}
            {...(classScoped ? { accessibilityHint: t.mode.classScoped } : online ? {} : { accessibilityHint: t.offline })}
            nativeID={SETTING_ID}
            focusable
            style={{ gap: spacing.sm }}
            testID="notes-mode"
          >
            <Heading level="prompt">{t.mode.title}</Heading>
            {NOTES_MODES.map((id) => {
              const selected = shownMode === id;
              const disabled = classScoped || !online || busy;
              return (
                <Pressable
                  key={id}
                  onPress={disabled ? undefined : () => void pickMode(id)}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  aria-checked={selected}
                  accessibilityLabel={t.mode.options[id]}
                  testID={`notes-mode-${id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: touchTarget.min,
                    paddingHorizontal: spacing.lg,
                    borderRadius: radii.lg,
                    backgroundColor: disabled ? colors.surface.sunken : colors.surface.paper,
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
                  <Text style={{ flex: 1, fontSize: typography.size.body, color: disabled ? colors.text.muted : colors.text.primary, fontWeight: selected ? typography.weight.bold : typography.weight.regular }}>
                    {t.mode.options[id]}
                  </Text>
                </Pressable>
              );
            })}
            <Body tone="secondary">{classScoped ? t.mode.classScoped : t.mode.familyAlways}</Body>
          </View>
        </>
      ) : null}

      {/* Teachers get the reaction only while class notes are "All notes" (section 7.2), so the line shows only then (or while the mode is not known yet). */}
      {hasClass && shownMode !== 'presets' && shownMode !== 'off' ? (
        <>
          <Spacer size="lg" />
          <Body tone="secondary" testID="notes-disclosure">
            {t.disclosure(name)}
          </Body>
        </>
      ) : null}

      {Platform.OS === 'web' && grownUpEntriesOn(flags.grownUpHomeEnabled, bundleOs()) ? (
        <>
          <Spacer size="xl" />
          <Button label={t.sendNote.cta} tone="secondary" size="md" disabled={!online} {...offlineDescribed} onPress={() => void sendNote()} testID="notes-send-note" />
        </>
      ) : null}
      <Spacer size="xl" />

      <HideConfirmSheet visible={hiding !== null} learner={name} busy={busy} onHide={() => void hide()} onCancel={() => setHiding(null)} />
    </Screen>
  );
}

function GrownUpRow({
  row,
  name,
  canHide,
  online,
  onHide,
  onReport,
}: {
  row: GrownUpNoteRow;
  name: string;
  canHide: boolean;
  online: boolean;
  onHide: () => void;
  onReport: () => void;
}): React.ReactElement {
  const m = useMessages();
  const t = m.caregiver.notes;
  const lineId = `notes-row-line-${row.id}`;
  const describedBy = { accessibilityHint: row.line };
  const langProps = row.textLang === undefined ? {} : { lang: row.textLang, accessibilityLanguage: row.textLang };
  return (
    <Card padding="md" tone={row.putAway ? 'sunken' : 'paper'} testID={`notes-grown-up-row-${row.id}`}>
      <View style={{ gap: spacing.xs }}>
        <Text nativeID={lineId} style={{ fontSize: typography.size.bodySm, color: colors.text.secondary }}>
          {row.line}
        </Text>
        <Body weight="bold">{row.preset}</Body>
        {row.text !== null ? (
          <Text {...langProps} style={{ fontSize: typography.size.body, color: colors.text.primary }}>
            {row.text}
          </Text>
        ) : null}
        {row.opened || row.reaction !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }} testID="notes-grown-up-status">
            {row.opened ? <Body size="sm">{t.status.opened}</Body> : null}
            {row.reaction !== null && row.reactionText !== null ? (
              <>
                <Icon name={REACTION_GLYPH[row.reaction]} size={ROW_GLYPH} color={glyphColor} />
                <Body size="sm">{row.reactionText}</Body>
              </>
            ) : null}
          </View>
        ) : null}
        {row.putAway ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="note" size={ROW_GLYPH} color={glyphColor} />
            <Body size="sm" testID="notes-grown-up-put-away">
              {t.putAway}
            </Body>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          {canHide ? (
            <Button label={t.hide.cta(name)} tone="secondary" size="md" disabled={!online} {...describedBy} onPress={onHide} testID="notes-grown-up-hide" />
          ) : null}
          <Button label={t.report.cta} tone="secondary" size="md" {...describedBy} onPress={onReport} testID="notes-grown-up-report" />
        </View>
      </View>
    </Card>
  );
}

