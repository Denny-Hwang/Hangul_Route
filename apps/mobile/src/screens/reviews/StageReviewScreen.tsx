import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  KoreanText,
  Screen,
  Spacer,
  StarRow,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { formatDate } from '@hangul-route/i18n';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View, type PressableStateCallbackType } from 'react-native';
import { stage1Cards } from '../../content';
import { RomanizationModeOverride, useRomanizationMode } from '../../i18n/use-romanization-mode';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { buildHangulCheck } from '../../logic/stage1/hangul-check';
import {
  pauseLine,
  resultHeadline,
  reviewCompleteEvent,
  reviewResultView,
  reviewStartEvent,
  stageCertificateEntry,
  startReviewFlow,
  stepReviewFlow,
  tallyReview,
  type ReviewFlowEffect,
  type ReviewFlowEvent,
  type ReviewResultView,
} from '../../logic/stage1/review-flow';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { reviewHost, useReviewRunStore } from '../../store/review-run-store';
import { ListenPickGame } from '../minigames/ListenPickGame';
import { CardArtThumb } from '../results/CardArtThumb';

/**
 * F-QUEST-002 §3.9 — the Hangul Check (wireframe `design/wireframes/reviews/hangul-check.md`).
 * Intro with the per-attempt "hide the romanization" switch, 5 parts of 7 Listen & Pick items in
 * review mode with a Hoya pause between parts, then stars, Hoya, a certificate, the tip letters
 * and the Stage 1 cards. It never gates anything; stopping saves nothing. The behaviour lives in
 * `logic/stage1/review-flow.ts`; the run in `store/review-run-store.ts`; the one write is
 * `progress-store.recordReview` (the caregiver channel).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'StageReview'>;

/** react-native-web also reports keyboard focus to the style callback. */
type PressState = PressableStateCallbackType & { focused?: boolean };

export function StageReviewScreen({ navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.stageReview;
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const profileMode = useRomanizationMode();
  const recordReview = useProgressStore((s) => s.recordReview);
  const ownedIds = useProgressStore((s) => (profile ? s.byProfile[profile.id]?.cards : undefined));
  const [check] = useState(() => buildHangulCheck({ seed: Math.floor(Math.random() * 0x7fffffff) }));
  const [flow, setFlow] = useState(() => startReviewFlow({ chunks: check.chunks.length, romanizationMode: profileMode }));
  const flowRef = useRef(flow);
  const [result, setResult] = useState<{ view: ReviewResultView; at: string } | null>(null);

  const exit = useCallback((): void => {
    useReviewRunStore.getState().reset();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  }, [navigation]);

  const runEffect = useCallback(
    (effect: ReviewFlowEffect): void => {
      switch (effect.type) {
        case 'started':
          useReviewRunStore.getState().begin(check.items.map((i) => i.id));
          if (profile) void track(reviewStartEvent(profile.id, effect.hideRomanization));
          return;
        case 'finished': {
          const run = useReviewRunStore.getState();
          const tally = tallyReview(run.itemIds, run.answers);
          const now = new Date();
          if (profile) {
            recordReview(profile.id, stageCertificateEntry({ itemIds: run.itemIds, tally, now }));
            void track(reviewCompleteEvent(profile.id, tally));
          }
          setResult({ view: reviewResultView(tally), at: now.toISOString() });
          run.reset();
          return;
        }
        case 'exit':
          exit();
          return;
      }
    },
    [check, profile, recordReview, exit],
  );

  const dispatch = useCallback(
    (event: ReviewFlowEvent): void => {
      const out = stepReviewFlow(flowRef.current, event);
      flowRef.current = out.state;
      setFlow(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );

  // Leaving the screen any other way forgets the run too: nothing is saved, nothing is lost.
  useEffect(() => () => useReviewRunStore.getState().reset(), []);

  const host = useMemo(() => reviewHost(() => dispatch({ type: 'chunk-done' })), [dispatch]);
  const close = { label: m.leave.close, onPress: () => dispatch({ type: 'leave' }) };
  const leaveSheet = (
    <LeaveSheet
      visible={flow.leaving}
      m={m.leave}
      onStay={() => dispatch({ type: 'stay' })}
      onStop={() => dispatch({ type: 'confirm-leave' })}
    />
  );

  if (flow.phase === 'playing') {
    const rounds = (check.chunks[flow.chunk] ?? []).map((i) => i.round);
    return (
      <>
        <RomanizationModeOverride mode={flow.hideRomanization ? 'tap' : 'always'}>
          <ListenPickGame key={flow.chunk} scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host} onClose={close} />
        </RomanizationModeOverride>
        {leaveSheet}
      </>
    );
  }

  if (flow.phase === 'pause') {
    return (
      <Screen tone="canvas" scrollable>
        <CloseRow label={close.label} onPress={close.onPress} />
        <View style={{ alignItems: 'center', paddingTop: spacing.xl }} testID="hangul-check-pause">
          <Hoya pose="cheering" size={120} accessibilityLabel={messages.a11y.hoya('cheering')} />
          <Spacer size="lg" />
          <Heading level="title" align="center">
            {pauseLine(flow.chunk, m.pause)}
          </Heading>
          <Spacer size="xl" />
          <Button label={m.pause.keepGoing.cta} tone="primary" size="hero" fullWidth onPress={() => dispatch({ type: 'keep-going' })} />
        </View>
        {leaveSheet}
      </Screen>
    );
  }

  if (flow.phase === 'result' && result) {
    const owned = new Set((ownedIds ?? []).map((c) => c.cardId));
    const cards = stage1Cards.filter((c) => owned.has(c.id)).map((c) => localizeCard(c, locale));
    const { view } = result;
    return (
      <Screen tone="canvas" scrollable>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }} testID="hangul-check-result">
          <Hoya pose="cheering" size={140} accessibilityLabel={messages.a11y.hoya('cheering')} />
          <Spacer size="lg" />
          <Heading level="display" align="center">
            {resultHeadline(view.stars, m.result.headline)}
          </Heading>
          <Spacer size="sm" />
          <StarRow stars={view.stars} size={48} accessibilityLabel={messages.a11y.stars(view.stars)} />
        </View>
        <Spacer size="lg" />
        <HoyaBubble tone="cheering" message={m.result.cheer} />

        <Spacer size="lg" />
        <Card padding="lg" tone="brand" testID="hangul-check-certificate">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Caption tone="secondary">{m.result.certificate.title}</Caption>
              {profile ? (
                <Heading level="title">{profile.displayName}</Heading>
              ) : null}
              <Body weight="semibold">{m.result.certificate.stage}</Body>
              <Caption tone="secondary">{formatDate(locale, result.at, 'monthDayYear')}</Caption>
            </View>
            <Hoya pose="waving" size={72} accessibilityLabel={messages.a11y.hoya('waving')} />
          </View>
        </Card>

        <Spacer size="lg" />
        {view.everyLetter ? (
          <Heading level="title" testID="hangul-check-every-letter">
            {m.result.everyLetter}
          </Heading>
        ) : (
          <View testID="hangul-check-tips">
            <Heading level="title">{m.result.tipTitle}</Heading>
            <Spacer size="xs" />
            <Body tone="secondary">{m.result.tryAgain}</Body>
            <Spacer size="sm" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {view.tips.map((tip) => (
                <KoreanText
                  key={tip.jamoId}
                  ko={tip.char}
                  romanization={tip.romanization}
                  size="sm"
                  accessibilityLabel={messages.a11y.practiceLetter(tip.romanization)}
                  testID={`hangul-check-tip-${tip.jamoId}`}
                  onPress={() => {
                    useReviewRunStore.getState().reset();
                    navigation.navigate('QuestPlayer', { questId: tip.questId, episodeId: tip.episodeId });
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {cards.length > 0 ? (
          <>
            <Spacer size="lg" />
            <Heading level="title">{m.result.wallTitle}</Heading>
            <Spacer size="sm" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="hangul-check-cards">
              {cards.map((card) => (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={messages.learner.results.extraCards.seeA11y(card.titleEn)}
                  onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}
                  style={({ pressed, focused }: PressState) => ({
                    borderRadius: radii.lg,
                    borderWidth: borderWidth.base,
                    borderColor: pressed || focused ? colors.border.focus : colors.border.subtle,
                  })}
                >
                  <CardArtThumb card={card} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Spacer size="xl" />
        <Button
          label={m.result.backHome.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }))}
        />
        <Spacer size="sm" />
        <Button label={m.result.seeCards.cta} tone="ghost" size="md" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Library' })} />
        <Spacer size="lg" />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable>
      <CloseRow label={close.label} onPress={close.onPress} />
      <View style={{ alignItems: 'center', paddingTop: spacing.lg }} testID="hangul-check-intro">
        <Hoya pose="waving" size={120} accessibilityLabel={messages.a11y.hoya('waving')} />
        <Spacer size="lg" />
        <Heading level="display" align="center">
          {m.title}
        </Heading>
        <Spacer size="sm" />
        <Body align="center" tone="secondary">
          {m.intro.body}
        </Body>
      </View>
      <Spacer size="lg" />
      <AttemptSwitch label={m.intro.hideRomanization} value={flow.hideRomanization} onChange={() => dispatch({ type: 'toggle-romanization' })} />
      <Spacer size="xl" />
      <Button label={m.intro.start.cta} tone="primary" size="hero" fullWidth onPress={() => dispatch({ type: 'start' })} />
      <Spacer size="sm" />
      <Button label={m.intro.later.cta} tone="ghost" size="md" fullWidth onPress={() => dispatch({ type: 'leave' })} />
      <Spacer size="lg" />
    </Screen>
  );
}

function CloseRow({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="hangul-check-close"
        style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={spacing.xl} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
}

/** A labelled switch, one 64 dp target (the story reader's pattern). */
function AttemptSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }): React.ReactElement {
  const track = spacing.xxxl;
  const knob = spacing.xl;
  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      testID="hangul-check-hide-romanization"
      style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <View
        style={{
          width: track,
          height: knob + spacing.xs,
          borderRadius: radii.pill,
          padding: spacing.xxs,
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? colors.brand.secondary : colors.surface.sunken,
          borderWidth: borderWidth.base,
          borderColor: value ? colors.brand.secondaryDark : colors.border.strong,
        }}
      >
        <View
          style={{
            width: knob - spacing.xxs,
            height: knob - spacing.xxs,
            borderRadius: radii.pill,
            backgroundColor: colors.surface.paper,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.strong,
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Body weight="semibold">{label}</Body>
      </View>
    </Pressable>
  );
}

/** "Stop the check?": stay is the primary; stop goes back and saves nothing. */
function LeaveSheet({
  visible,
  m,
  onStay,
  onStop,
}: {
  visible: boolean;
  m: ReturnType<typeof useMessages>['learner']['stageReview']['leave'];
  onStay: () => void;
  onStop: () => void;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID="hangul-check-leave">
        <Pressable onPress={onStay} accessibilityRole="button" accessibilityLabel={m.stay.cta} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Heading level="prompt">{m.title}</Heading>
          <Body tone="secondary">{m.body}</Body>
          <Spacer size="sm" />
          <Button label={m.stay.cta} tone="primary" size="md" fullWidth onPress={onStay} />
          <Button label={m.stop.cta} tone="ghost" size="md" fullWidth onPress={onStop} />
        </View>
      </View>
    </Modal>
  );
}
