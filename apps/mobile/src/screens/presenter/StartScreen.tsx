import { Icon, borderWidth, colors, layout, radii, spacing, touchTarget, typography, type IconName, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { distinctParts, type SkipPart, type VoiceCheck } from '../../logic/lecture/shell';
import { PICKER_COUNT_MAX, PICKER_COUNT_MIN } from '../../logic/lecture/stage-constants';
import { PICKER_LABEL_BASIS, START_BUTTON_HEIGHT, TEACHER_COLUMN } from './stage-metrics';
import { usePresenterView } from './presenter-context';
import { GhostButton, PrimaryButton } from './StatePage';

/**
 * The start screen (design/screens/presenter/start-screen.md, README D10, D15): a teacher page in
 * real pixels on paper, not stage-scaled. The deck title (teacher text), the facts, the device
 * checks (none blocks Start), the skipped parts with [ See which ], the helper picker row (a count
 * only, never a label), and one big Start, disabled while the presenter font loads (at most
 * 1.5 s) and focused when it is ready. Back to lessons, above the title, returns to the home.
 */

export type { VoiceCheck } from '../../logic/lecture/shell';

export type PickerRow =
  | null
  | { kind: 'received'; mode: 'names' | 'initials'; count: number }
  /** `line`: why numbers are used (no opener, or a resumed lesson); none for a numbers deck or while names may still arrive. */
  | { kind: 'numbers'; count: number; line: 'noOpener' | 'notKept' | null };

export interface StartScreenProps {
  deckTitle: string;
  slides: number;
  minutes: number;
  parts: readonly SkipPart[];
  /** The lesson a part belongs to, in the presenter language; null when the block has no title. */
  partTitle: (blockIndex: number | null) => string | null;
  offlineReady: boolean;
  voice: VoiceCheck;
  fullscreenSupported: boolean;
  wakeLockSupported: boolean;
  picker: PickerRow;
  onPickerCount: (count: number) => void;
  fontReady: boolean;
  onStart: () => void;
  /** Back to lessons: the presenter home, before anything starts (nothing is saved or sent). */
  onBack?: () => void;
}

function Check({ ok, children, testID }: { ok: boolean; children: React.ReactNode; testID?: string }): React.ReactElement {
  const icon: IconName = ok ? 'check-circle' : 'dash';
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={{ marginTop: spacing.xxs }}>
        <Icon name={icon} size={spacing.xxl} color={ok ? colors.feedback.success : colors.text.secondary} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>{children}</View>
    </View>
  );
}

function Line({ children, secondary, bold }: { children: React.ReactNode; secondary?: boolean; bold?: boolean }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK}
      style={{
        fontSize: typography.size.body,
        color: secondary ? colors.text.secondary : colors.text.primary,
        fontWeight: bold ? typography.weight.bold : typography.weight.regular,
        lineHeight: Math.round(typography.size.body * typography.leading.normal),
      }}
    >
      {children}
    </Text>
  );
}

type PressState = { pressed: boolean; focused?: boolean };


function StepButton({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          width: touchTarget.min,
          height: touchTarget.min,
          borderRadius: radii.circle,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface.paper,
          borderWidth: focused ? borderWidth.thick : borderWidth.base,
          borderColor: focused ? colors.border.focus : colors.border.strong,
        };
      }}
    >
      <Icon name={icon} size={spacing.xxl} color={disabled ? colors.text.muted : colors.text.primary} />
    </Pressable>
  );
}

export function StartScreen(props: StartScreenProps): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start;
  const [listOpen, setListOpen] = useState(false);
  const start = useRef<View>(null);
  useEffect(() => {
    if (props.fontReady) start.current?.focus?.();
  }, [props.fontReady]);

  const voiceLine = (() => {
    switch (props.voice.kind) {
      case 'local':
        return { ok: true, text: m.voiceLocal(props.voice.name) };
      case 'network':
        return { ok: true, text: m.voiceNetwork(props.voice.name) };
      case 'clips':
        return { ok: true, text: messages.learner.audio.voice.ready };
      case 'needs-internet':
        return { ok: false, text: messages.learner.audio.voice.needsInternet };
      case 'none':
        return { ok: false, text: m.voiceNone };
      default:
        return null;
    }
  })();

  return (
    <ScrollView testID="presenter-start" style={{ flex: 1, backgroundColor: colors.surface.paper }} contentContainerStyle={{ paddingVertical: spacing.xxl, paddingHorizontal: layout.gutter.compact }}>
      <View style={{ width: '100%', maxWidth: TEACHER_COLUMN, alignSelf: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          {props.onBack ? (
            <View style={{ alignItems: 'flex-start' }}>
              <GhostButton testID="presenter-start-back" label={m.back.cta} onPress={props.onBack} />
            </View>
          ) : null}
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.body, color: colors.text.secondary }}>{messages.learner.presenter.home.title}</Text>
          {/* The deck title is the teacher's own text (TD8): shown here, never in document.title. */}
          <Text {...KOREAN_LINE_BREAK} role="heading" aria-level={1} style={{ fontSize: typography.size.hero, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(typography.size.hero * typography.leading.tight) }}>
            {props.deckTitle}
          </Text>
          <Text {...KOREAN_LINE_BREAK} testID="presenter-start-facts" style={{ fontSize: typography.size.bodyLg, color: colors.text.secondary }}>
            {`${m.slides(props.slides)} · ${m.minutes(props.minutes)}`}
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text {...KOREAN_LINE_BREAK} role="heading" aria-level={2} style={{ fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {m.checks}
          </Text>
          <Check ok={props.offlineReady} testID="presenter-check-offline">
            <Line>{props.offlineReady ? m.offlineReady : m.offlineNotReady}</Line>
            {props.offlineReady ? null : <Line secondary>{m.installHint}</Line>}
          </Check>
          {voiceLine !== null ? (
            <Check ok={voiceLine.ok} testID="presenter-check-voice">
              <Line>{voiceLine.text}</Line>
            </Check>
          ) : null}
          <Check ok={props.fullscreenSupported}>
            <Line>{props.fullscreenSupported ? m.fullscreen : m.fullscreenNone}</Line>
          </Check>
          <Check ok={props.wakeLockSupported}>
            <Line>{props.wakeLockSupported ? m.awake : m.awakeNone}</Line>
          </Check>
          {props.parts.length > 0 ? (
            <Check ok={false} testID="presenter-check-skipped">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
                <Line>{m.skipped(props.parts.length)}</Line>
                <GhostButton
                  testID="presenter-see-which"
                  label={listOpen ? m.hideWhich.cta : m.seeWhich.cta}
                  expanded={listOpen}
                  onPress={() => setListOpen((open) => !open)}
                />
              </View>
              {listOpen ? (
                <View testID="presenter-skipped-list" role="list" style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
                  {distinctParts(props.parts).map((part) => {
                    const title = props.partTitle(part.blockIndex);
                    return (
                      <View key={`${part.blockIndex ?? 'none'}-${part.reason}`} role="listitem">
                        {title !== null ? <Line bold>{title}</Line> : null}
                        <Line>{m.reason[part.reason]}</Line>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Check>
          ) : null}
        </View>

        {props.picker !== null ? <PickerRowView row={props.picker} onCount={props.onPickerCount} /> : null}

        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <PrimaryButton
            ref={start}
            testID="presenter-start-button"
            label={m.cta}
            large
            minHeight={START_BUTTON_HEIGHT}
            disabled={!props.fontReady}
            onPress={props.onStart}
          />
          {!props.fontReady ? (
            <View role="status" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="replay" size={spacing.xl} color={colors.text.secondary} />
              <Line secondary>{m.loading}</Line>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function PickerRowView({ row, onCount }: { row: NonNullable<PickerRow>; onCount: (count: number) => void }): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start.picker;
  return (
    <View
      testID="presenter-picker-row"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        borderRadius: radii.lg,
      }}
    >
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: PICKER_LABEL_BASIS, gap: spacing.xxs }}>
        <Line bold>{m.title}</Line>
        {row.kind === 'received' ? (
          <Line secondary>{row.mode === 'names' ? m.names(row.count) : m.initials(row.count)}</Line>
        ) : (
          <>
            <Line secondary>{m.numbers(row.count)}</Line>
            {row.line !== null ? <Line secondary>{row.line === 'noOpener' ? m.noOpener : m.notKept}</Line> : null}
          </>
        )}
      </View>
      {row.kind === 'numbers' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <StepButton icon="dash" label={m.fewer} disabled={row.count <= PICKER_COUNT_MIN} onPress={() => onCount(Math.max(PICKER_COUNT_MIN, row.count - 1))} />
          <Text {...KOREAN_LINE_BREAK} role="status" style={{ fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary, minWidth: touchTarget.min, textAlign: 'center' }}>
            {String(row.count)}
          </Text>
          <StepButton icon="plus" label={m.more} disabled={row.count >= PICKER_COUNT_MAX} onPress={() => onCount(Math.min(PICKER_COUNT_MAX, row.count + 1))} />
        </View>
      ) : null}
    </View>
  );
}
