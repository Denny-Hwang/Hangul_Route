import { Icon, borderWidth, colors, layout, radii, spacing, touchTarget, typography, z, type IconName, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { distinctParts, type SkipPart, type VoiceCheck } from '../../logic/lecture/shell';
import { START_BUTTON_HEIGHT, TEACHER_COLUMN } from './stage-metrics';
import { usePresenterView } from './presenter-context';
import { GhostButton, PrimaryButton } from './StatePage';

/**
 * The start screen (design/screens/presenter/start-screen.md, README D10, D15): a teacher page in
 * real pixels on paper, not stage-scaled. The deck title (teacher text), the facts, the device
 * checks (none blocks Start), the skipped parts with [ See which ], and one big Start, disabled
 * while the presenter font loads (at most 1.5 s) and focused when it is ready. Back to lessons,
 * above the title, returns to the home.
 *
 * In a phone window (F-TCH-004 section 3.5 amendment; start-screen.md "Phone") the page is short:
 * under the title and the facts, one "Ready to start" line, with "Some checks need a look: see
 * Details." under it when a device check is not ready, and a Details disclosure that opens the check
 * list and the skipped parts exactly as on the wide page; while the phone is upright, the hint to
 * turn it sideways (information, never a blocker); and a sticky footer with Back beside Start, clear
 * of the bottom safe-area inset.
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
  /** Back to lessons (the phone footer's Back): the presenter home, before anything starts (nothing is saved or sent). */
  onBack?: () => void;
  /** A phone window: the short page with the sticky footer. */
  phone?: boolean;
  /** Taller than wide (a phone held upright): the turn hint. */
  portrait?: boolean;
  /** A short window (under `layout.shortHeight`, a phone sideways): the title and Start step down. */
  short?: boolean;
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

function Line({ children, secondary, bold, large }: { children: React.ReactNode; secondary?: boolean; bold?: boolean; large?: boolean }): React.ReactElement {
  const size = large ? typography.size.bodyLg : typography.size.body;
  return (
    <Text {...KOREAN_LINE_BREAK}
      style={{
        fontSize: size,
        color: secondary ? colors.text.secondary : colors.text.primary,
        fontWeight: bold ? typography.weight.bold : typography.weight.regular,
        lineHeight: Math.round(size * typography.leading.normal),
      }}
    >
      {children}
    </Text>
  );
}

export function StartScreen(props: StartScreenProps): React.ReactElement {
  return props.phone ? <PhoneStart {...props} /> : <WideStart {...props} />;
}

/** The voice check's line; `ok` false is a line the teacher can act on. Null before the check. */
function useVoiceLine(voice: VoiceCheck): { ok: boolean; text: string } | null {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start;
  switch (voice.kind) {
    case 'local':
      return { ok: true, text: m.voiceLocal(voice.name) };
    case 'network':
      return { ok: true, text: m.voiceNetwork(voice.name) };
    case 'clips':
      return { ok: true, text: messages.learner.audio.voice.ready };
    case 'needs-internet':
      return { ok: false, text: messages.learner.audio.voice.needsInternet };
    case 'none':
      return { ok: false, text: m.voiceNone };
    default:
      return null;
  }
}

function DeckHead({ deckTitle, slides, minutes, compact }: { deckTitle: string; slides: number; minutes: number; compact?: boolean }): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start;
  const titleSize = compact ? typography.size.title : typography.size.hero;
  return (
    <>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.body, color: colors.text.secondary }}>{messages.learner.presenter.home.title}</Text>
      {/* The deck title is the teacher's own text (TD8): shown here, never in document.title. */}
      <Text {...KOREAN_LINE_BREAK} role="heading" aria-level={1} style={{ fontSize: titleSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(titleSize * typography.leading.tight) }}>
        {deckTitle}
      </Text>
      <Text {...KOREAN_LINE_BREAK} testID="presenter-start-facts" style={{ fontSize: typography.size.bodyLg, color: colors.text.secondary }}>
        {`${m.slides(slides)} · ${m.minutes(minutes)}`}
      </Text>
    </>
  );
}

function FontWait(): React.ReactElement {
  const { messages } = usePresenterView();
  return (
    <View role="status" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name="replay" size={spacing.xl} color={colors.text.secondary} />
      <Line secondary>{messages.learner.presenter.start.loading}</Line>
    </View>
  );
}

/** Before you start: the device checks and the skipped parts with [ See which ] (the same list on the wide page and in the phone's Details). */
function Checks(props: StartScreenProps): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start;
  const [listOpen, setListOpen] = useState(false);
  const voiceLine = useVoiceLine(props.voice);
  return (
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
      <Check ok={props.fullscreenSupported} testID="presenter-check-fullscreen">
        <Line>{props.fullscreenSupported ? m.fullscreen : m.fullscreenNone}</Line>
      </Check>
      <Check ok={props.wakeLockSupported} testID="presenter-check-awake">
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
  );
}

function PhoneStart(props: StartScreenProps): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start;
  const insets = useSafeAreaInsets();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const start = useRef<View>(null);
  useEffect(() => {
    if (props.fontReady) start.current?.focus?.();
  }, [props.fontReady]);
  const voiceLine = useVoiceLine(props.voice);
  // Every device check ready: the Ready line alone; otherwise it says that a check needs a look.
  const allReady = props.offlineReady && voiceLine?.ok !== false && props.fullscreenSupported && props.wakeLockSupported;
  return (
    <View testID="presenter-start" style={{ flex: 1, backgroundColor: colors.surface.paper }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: (props.short ? spacing.sm : spacing.lg) + insets.top,
          paddingBottom: spacing.lg,
          paddingLeft: layout.gutter.compact + insets.left,
          paddingRight: layout.gutter.compact + insets.right,
        }}
      >
        <View style={{ width: '100%', maxWidth: TEACHER_COLUMN, alignSelf: 'center', gap: props.short ? spacing.sm : spacing.md }}>
          <DeckHead deckTitle={props.deckTitle} slides={props.slides} minutes={props.minutes} compact={props.short === true} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
            <View testID="presenter-start-ready" style={{ flexShrink: 1, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name={allReady ? 'check-circle' : 'dash'} size={spacing.xxl} color={allReady ? colors.feedback.success : colors.text.secondary} />
                <Line bold large>
                  {m.ready}
                </Line>
              </View>
              {allReady ? null : (
                <View testID="presenter-start-some-checks">
                  <Line secondary>{m.someChecks}</Line>
                </View>
              )}
            </View>
            <GhostButton testID="presenter-start-details" label={m.details.cta} expanded={detailsOpen} onPress={() => setDetailsOpen((open) => !open)} />
          </View>
          {detailsOpen ? (
            <View testID="presenter-start-details-panel">
              <Checks {...props} />
            </View>
          ) : null}
          {props.portrait ? (
            <View testID="presenter-start-turn" style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
              <Line secondary>{m.turnHint}</Line>
            </View>
          ) : null}
          {!props.fontReady ? <FontWait /> : null}
        </View>
      </ScrollView>
      {/* The sticky footer: it stays at the bottom while the page scrolls, clear of the home indicator. */}
      <View
        testID="presenter-start-footer"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
          paddingLeft: layout.gutter.compact + insets.left,
          paddingRight: layout.gutter.compact + insets.right,
          borderTopWidth: borderWidth.thin,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.surface.paper,
          zIndex: z.sticky,
        }}
      >
        {props.onBack ? <GhostButton testID="presenter-start-back" label={messages.common.buttons.back} onPress={props.onBack} /> : null}
        <PrimaryButton
          ref={start}
          testID="presenter-start-button"
          label={m.cta}
          grow
          minHeight={props.short ? touchTarget.child : touchTarget.hero}
          disabled={!props.fontReady}
          onPress={props.onStart}
        />
      </View>
    </View>
  );
}

function WideStart(props: StartScreenProps): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.start;
  const start = useRef<View>(null);
  useEffect(() => {
    if (props.fontReady) start.current?.focus?.();
  }, [props.fontReady]);

  return (
    <ScrollView testID="presenter-start" style={{ flex: 1, backgroundColor: colors.surface.paper }} contentContainerStyle={{ paddingVertical: spacing.xxl, paddingHorizontal: layout.gutter.compact }}>
      <View style={{ width: '100%', maxWidth: TEACHER_COLUMN, alignSelf: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          {props.onBack ? (
            <View style={{ alignItems: 'flex-start' }}>
              <GhostButton testID="presenter-start-back" label={m.back.cta} onPress={props.onBack} />
            </View>
          ) : null}
          <DeckHead deckTitle={props.deckTitle} slides={props.slides} minutes={props.minutes} />
        </View>

        <Checks {...props} />

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
          {!props.fontReady ? <FontWait /> : null}
        </View>
      </View>
    </ScrollView>
  );
}
