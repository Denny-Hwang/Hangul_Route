import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Modal, Platform, Pressable, View, type PressableStateCallbackType } from 'react-native';
import { episodesAll, stage1Cards } from '../../content';
import { RomanizationModeOverride, useRomanizationMode } from '../../i18n/use-romanization-mode';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { completeStages } from '../../logic/my-route/latch';
import { resumableHangulCheck, type ResumableHangulCheck } from '../../logic/reviews/saved-check';
import { buildHangulCheck } from '../../logic/stage1/hangul-check';
import {
  guardsBack,
  hangulCheckOpens,
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
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { clearSavedCheck, keepReviewRunSaved, readSavedCheck, type ReviewRunSaveContext } from '../../store/check-run-saved';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { reviewHost, useReviewRunStore } from '../../store/review-run-store';
import { ListenPickGame } from '../minigames/ListenPickGame';
import { CardArtThumb } from '../results/CardArtThumb';
import { DecodingSprintOffer } from '../minigames/syllable-build-entry';
import { SaveLaterLine } from './SaveLaterLine';

/**
 * F-QUEST-002 §3.9 — the Hangul Check (wireframe `design/wireframes/reviews/hangul-check.md`).
 * Intro with the per-attempt "hide the romanization" switch, 5 parts of 7 Listen & Pick items in
 * review mode with a Hoya pause between parts, then stars, Hoya, a certificate, the tip letters
 * and the Stage 1 cards. It never gates anything. The behaviour lives in `logic/stage1/review-flow.ts`; the run in
 * `store/review-run-store.ts`; the one write to the progress is `progress-store.recordReview` (the caregiver channel).
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (section 3.4): a stopped or interrupted check goes on. Its first answers
 * are kept on this device after each answer (`store/check-run-saved.ts`, `hr:check-run:<profileId>`, 24 hours, the
 * answers only); the screen reads them before the intro (the `reading` phase, at most 800 ms) and offers "Pick up where
 * you left off?". Stop keeps them (OD-LR1 (c)); the result and Let's go clear them.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'StageReview'>;

/** react-native-web also reports keyboard focus to the style callback. */
type PressState = PressableStateCallbackType & { focused?: boolean };

export function StageReviewScreen({ route, navigation }: Props): ReactElement {
  const messages = useMessages();
  const profile = useProfileStore(activeProfileSelector);
  const snapshot = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const opens = useMemo(
    () => (snapshot ? hangulCheckOpens(route.params.stageKey, completeStages(snapshot, episodesAll)) : false),
    [snapshot, route.params.stageKey],
  );
  // Only a learner who finished Stage 1 reaches the check; a stale link or a future caller gets one calm line.
  if (!opens) {
    return (
      <Screen tone="canvas" scrollable>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }} testID="hangul-check-not-ready">
          <Hoya pose="thinking" size={120} accessibilityLabel={messages.a11y.hoya('thinking')} />
          <Spacer size="lg" />
          <Body align="center">{messages.learner.stageReview.notReady}</Body>
          <Spacer size="xl" />
          <Button
            label={messages.learner.stageReview.result.backHome.cta}
            tone="primary"
            size="hero"
            fullWidth
            onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }))}
          />
        </View>
      </Screen>
    );
  }
  return <HangulCheck navigation={navigation} />;
}

function HangulCheck({ navigation }: { navigation: Props['navigation'] }): ReactElement {
  const messages = useMessages();
  const m = messages.learner.stageReview;
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const profileMode = useRomanizationMode();
  const recordReview = useProgressStore((s) => s.recordReview);
  const ownedIds = useProgressStore((s) => (profile ? s.byProfile[profile.id]?.cards : undefined));
  // The seed of this visit's check; a resumed check swaps in the stored seed (the check is deterministic by seed).
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const check = useMemo(() => buildHangulCheck({ seed }), [seed]);
  const [flow, setFlow] = useState(() => startReviewFlow({ chunks: check.chunks.length, romanizationMode: profileMode, reading: true }));
  const flowRef = useRef(flow);
  const [result, setResult] = useState<{ view: ReviewResultView; at: string } | null>(null);
  // [LR] The stored check this visit found (the resume page's Continue), and what the run is stored with while it is kept.
  const offer = useRef<ResumableHangulCheck | null>(null);
  const [kept, setKept] = useState<ReviewRunSaveContext | null>(null);

  // Set before the flow's own exits, so the back guard below lets them through.
  const allowLeave = useRef(false);

  const exit = useCallback((): void => {
    allowLeave.current = true;
    useReviewRunStore.getState().reset();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  }, [navigation]);

  const runEffect = useCallback(
    (effect: ReviewFlowEffect): void => {
      switch (effect.type) {
        case 'started':
          useReviewRunStore.getState().begin(check.items.map((i) => i.id));
          if (profile) {
            // A new check forgets the stored one, and from its first answer it is stored in its place (section 3.4).
            void clearSavedCheck(profile.id);
            setKept({ seed, hideRomanization: effect.hideRomanization, startedAt: new Date().toISOString() });
            void track(reviewStartEvent(profile.id, effect.hideRomanization));
          }
          return;
        case 'finished': {
          setKept(null);
          if (profile) void clearSavedCheck(profile.id);
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
    [check, seed, profile, recordReview, exit],
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

  // [LR] Reading: the stored check, for at most the read's limit; a read that lands later offers the resume page only
  // while the intro shows and nothing has started (the flow ignores it after Let's go).
  const profileId = profile?.id;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  useEffect(() => {
    const send = (found: boolean): void => dispatchRef.current({ type: 'read', found });
    if (!profileId) {
      send(false);
      return undefined;
    }
    let live = true;
    const offered = (value: unknown): boolean => {
      const found = resumableHangulCheck(value, Date.now(), (s) => buildHangulCheck({ seed: s }));
      if (found === null) return false;
      offer.current = found;
      return true;
    };
    void readSavedCheck(profileId, {
      onLate: (value) => {
        if (live) send(offered(value));
      },
    }).then((value) => {
      if (live) send(offered(value));
    });
    return () => {
      live = false;
    };
  }, [profileId]);

  // [LR] While a check runs, each answer is kept on the device (OD-LR9 (b)); Stop and a reload leave it stored.
  useEffect(() => (profileId && kept ? keepReviewRunSaved(profileId, kept) : undefined), [profileId, kept]);

  const onContinue = useCallback((): void => {
    const found = offer.current;
    if (!found) return;
    setSeed(found.seed);
    setKept({ seed: found.seed, hideRomanization: found.hideRomanization, startedAt: found.startedAt });
    useReviewRunStore.getState().restore(
      found.check.items.map((i) => i.id),
      found.answers,
    );
    dispatch({ type: 'continue', at: found.at, hideRomanization: found.hideRomanization });
  }, [dispatch]);

  // Leaving the screen any other way forgets the run in memory (the stored check stays: a Stop or a kill goes on later).
  useEffect(() => () => useReviewRunStore.getState().reset(), []);

  // Every back mid-check asks "Stop the check?" first (spec §3.9): the header's Close, the browser and the phone back
  // (the history bridge) and a swipe all reach this guard (AMENDMENTS-DISPLAY-NAV section 7.1); before the start and
  // after the result they leave at once.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (allowLeave.current || !guardsBack(flowRef.current)) return;
        e.preventDefault();
        dispatch({ type: 'leave' });
      }),
    [navigation, dispatch],
  );

  const host = useMemo(() => reviewHost(() => dispatch({ type: 'chunk-done' })), [dispatch]);
  // [LR] OD-LR1 (c): Stop keeps the stored check, so the sheet says so; before the first answer nothing is stored yet.
  const hasAnswers = useReviewRunStore((run) => Object.keys(run.answers).length > 0);
  const leaveSheet = (
    <LeaveSheet
      visible={flow.leaving}
      m={m.leave}
      kept={hasAnswers}
      onStay={() => dispatch({ type: 'stay' })}
      onStop={() => dispatch({ type: 'confirm-leave' })}
    />
  );

  if (flow.phase === 'playing') {
    // [LR] A resumed check opens in the middle of a part: the game plays only the items left in it.
    const rounds = (check.chunks[flow.chunk] ?? []).slice(flow.from).map((i) => i.round);
    return (
      <>
        <RomanizationModeOverride mode={flow.hideRomanization ? 'tap' : 'always'}>
          <ListenPickGame key={`${flow.chunk}:${flow.from}`} scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host} />
        </RomanizationModeOverride>
        {leaveSheet}
      </>
    );
  }

  if (flow.phase === 'pause') {
    return (
      <Screen tone="canvas" scrollable>
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
          {/* Row LR-4 (OD-LR8): one quiet line while the progress write is waiting, as Results shows it. */}
          <SaveLaterLine testID="hangul-check-save-later" />
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
                  accessibilityLabel={tip.final ? messages.a11y.practiceFinal(tip.romanization) : messages.a11y.practiceLetter(tip.romanization)}
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

        {/* F-CURR-002 row CM-32: the Block Sprint, the optional bonus after the Stage 1 review, while `decodingSprint` is on. */}
        <DecodingSprintOffer testID="hangul-check-sprint" onOpen={() => navigation.navigate('DecodingSprint')} />

        <Spacer size="xl" />
        <Button
          label={m.result.backHome.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }))}
        />
        <Spacer size="sm" />
        <Button label={m.result.seeCards.cta} tone="ghost" size="md" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Library', params: { section: 'cards' } })} />
        <Spacer size="lg" />
      </Screen>
    );
  }

  // [LR] Reading: the intro's Hoya and title with no buttons, for at most the read's limit (wireframe reviews/check-resume.md, panel R).
  if (flow.phase === 'reading') {
    return (
      <Screen tone="canvas" scrollable>
        <View style={{ alignItems: 'center', paddingTop: spacing.lg }} testID="hangul-check-reading" aria-busy>
          <Hoya pose="waving" size={120} accessibilityLabel={messages.a11y.hoya('waving')} />
          <Spacer size="lg" />
          <Heading level="display" align="center">
            {m.title}
          </Heading>
        </View>
      </Screen>
    );
  }

  // [LR] The resume page (panel A): Continue goes on, Start again shows the normal intro and clears nothing yet.
  if (flow.phase === 'resume') {
    return (
      <Screen tone="canvas" scrollable>
        <View style={{ alignItems: 'center', paddingTop: spacing.lg }} testID="hangul-check-resume">
          <Hoya pose="waving" size={120} accessibilityLabel={messages.a11y.hoya('waving')} />
          <Spacer size="lg" />
          <Heading level="display" align="center">
            {m.title}
          </Heading>
          <Spacer size="md" />
          <ResumeTitle>{m.resume.title}</ResumeTitle>
        </View>
        <Spacer size="xl" />
        <Button label={messages.common.buttons.continue} tone="primary" size="hero" fullWidth onPress={onContinue} testID="hangul-check-continue" />
        <Spacer size="md" />
        <Button label={m.resume.startAgain.cta} tone="secondary" size="lg" fullWidth onPress={() => dispatch({ type: 'start-again' })} testID="hangul-check-start-again" />
        <Spacer size="lg" />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable>
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

/** The resume page's question: the page's heading, and the first thing a screen reader lands on (once, when the page opens). */
function ResumeTitle({ children }: { children: string }): ReactElement {
  const ref = useRef<View>(null);
  const web = Platform.OS === 'web';
  useEffect(() => {
    // Native: on the next tick, once the view has settled (VoiceOver ignores a focus moved mid-mount).
    const focus = (): void => focusForScreenReader(ref.current);
    if (web) {
      focus();
      return undefined;
    }
    const timer = setTimeout(focus, 0);
    return () => clearTimeout(timer);
  }, [web]);
  return (
    <View ref={ref} {...(web ? { tabIndex: -1 as const, style: { outlineStyle: 'none' } as object } : { accessible: true, accessibilityRole: 'header' as const })}>
      <Heading level="title" align="center" testID="hangul-check-resume-title">
        {children}
      </Heading>
    </View>
  );
}

/** A labelled switch, one 64 dp target (the story reader's pattern). */
function AttemptSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }): ReactElement {
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

/**
 * "Stop the check?": stay is the primary; stop goes back. [LR] With answers given Stop keeps the stored check for a day
 * (OD-LR1 (c)) and the line says so; before the first answer there is nothing stored, and the old line stays true.
 */
function LeaveSheet({
  visible,
  m,
  kept,
  onStay,
  onStop,
}: {
  visible: boolean;
  m: ReturnType<typeof useMessages>['learner']['stageReview']['leave'];
  kept: boolean;
  onStay: () => void;
  onStop: () => void;
}): ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID="hangul-check-leave">
        {/* A tap on the dimmed area stays; hidden from assistive tech, which has the Keep going button below. */}
        <Pressable onPress={onStay} focusable={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1 }} />
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
          <Body tone="secondary">{kept ? m.bodyKept : m.body}</Body>
          <Spacer size="sm" />
          <Button label={m.stay.cta} tone="primary" size="md" fullWidth onPress={onStay} />
          <Button label={m.stop.cta} tone="ghost" size="md" fullWidth onPress={onStop} />
        </View>
      </View>
    </Modal>
  );
}
export { AttemptSwitch };
