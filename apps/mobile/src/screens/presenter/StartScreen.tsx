import { Icon, colors, layout, radii, spacing, typography, type IconName, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { distinctParts, type SkipPart, type VoiceCheck } from '../../logic/lecture/shell';
import { START_BUTTON_HEIGHT, TEACHER_COLUMN } from './stage-metrics';
import { usePresenterView } from './presenter-context';
import { GhostButton, PrimaryButton } from './StatePage';

/**
 * The start screen (design/screens/presenter/start-screen.md, README D10, D15): a teacher page in
 * real pixels on paper, not stage-scaled. The deck title (teacher text), the facts, the device
 * checks (none blocks Start), the skipped parts with [ See which ], and one big Start, disabled while the presenter font loads (at most
 * 1.5 s) and focused when it is ready. Back to lessons, above the title, returns to the home.
 */

export type { VoiceCheck } from '../../logic/lecture/shell';

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
