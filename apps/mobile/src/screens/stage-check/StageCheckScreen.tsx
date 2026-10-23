import type { ThemeKey } from '@hangul-route/content-schema';
import { Body, Button, ConfirmSheet, Heading, Hoya, Icon, Screen, Spacer, StarRow, colors, spacing } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { RomanizationModeOverride } from '../../i18n/use-romanization-mode';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { themeGlyph } from '../../logic/journey';
import { memoryChunk } from '../../logic/memory/boot';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import type { PlannedStageCheck } from '../../logic/reviews/stage-check';
import type { StageCheckApi, StageCheckWorld } from '../../logic/reviews/stage-check-api';
import { PRIZE_STAGES } from '../../logic/stage1/stage-complete';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { dailyReviewChunk } from '../reviews/DailyReviewRoute';
import { AttemptSwitch } from '../reviews/StageReviewScreen';
import { useStageOffer } from './use-stage-offer';

/**
 * The Stage Check of Stages 2-7 (F-CURR-002 sections 4.5, 7.3, 7.7 and OD-1, row CM-22; design/wireframes/reviews/
 * stage-check.md D to F and H, mock design/screens/stage-check/). Part of the Stage Check's chunk; the rounds, the top
 * row and the headline are the Daily Review chunk's (reached at run time through `dailyReviewChunk()`, so no module
 * sits in two chunks), the session logic the memory chunk's (`stageCheckApi()`).
 *
 * D the intro (about 7 minutes, no timer, the reading-practice switch), E the rounds in parts of 5 (the dots show the
 * part only, with the theme line: the items mix all five themes), E2 a pause between parts, F the result (stars, then
 * "Your best result is kept"), H the stop sheet (the Hangul Check's). Never a percentage, an "n of m", a score, a
 * timer, "exam" or a certificate. A stopped check keeps its answers and writes no entry and no latch. It never gates
 * anything: the next stage does not read it (OD-1).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'StageCheck'>;
type Rounds = typeof import('../reviews/daily-review-chunk');

/** Hoya on the intro, a pause and the result: the Daily Review's size. */
const END_HOYA = 120;
/** The loading frame's dots: one part's 5 (not imported: no scheduler module in this chunk). */
const LOADING_DOTS = 5;
/** Rounds of a part (`STAGE_CHECK_PART` of the memory chunk, repeated here so no scheduler module is imported). */
const PART = 5;

type Phase =
  | { kind: 'loading' }
  | { kind: 'nothing' }
  | { kind: 'notReady' }
  | { kind: 'intro'; plan: PlannedStageCheck }
  | { kind: 'playing'; plan: PlannedStageCheck; index: number }
  | { kind: 'pause'; plan: PlannedStageCheck; next: number }
  | { kind: 'result'; stars: 1 | 2 | 3; missed: boolean };

const headlineKey = (stars: 1 | 2 | 3): 'one' | 'two' | 'three' => (stars === 3 ? 'three' : stars === 2 ? 'two' : 'one');

export function StageCheckScreen({ navigation, route }: Props): React.ReactElement {
  const { stageKey } = route.params;
  const m = useMessages();
  const copy = m.learner.stageCheck;
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const { complete, open } = useStageOffer(profileId, stageKey);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [ui, setUi] = useState<Rounds | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [hideRomanization, setHideRomanization] = useState(false);
  const [, setAnswered] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const world = useRef<StageCheckWorld | null>(null);
  const api = useRef<StageCheckApi | null>(null);
  const answers = useRef(new Map<number, RoundAnswer>());
  const recorded = useRef<Promise<void>[]>([]);
  const allowLeave = useRef(false);
  const finishing = useRef(false);
  // A Stage 1 link, a stage not finished, or one the learner cannot open (F-ENT-003; a stale link): the not-ready
  // page. Nothing waits on the check.
  const opens = PRIZE_STAGES[stageKey]?.check === 'StageCheck' && complete && open;

  const hydrated = useProgressStore((s) => (profileId ? s.hydratedFor.has(profileId) : false));
  useEffect(() => {
    if (profileId !== null && !hydrated) {
      // The stage is judged on the learner's saved progress: read it first (the loading frame meanwhile).
      void useProgressStore.getState().hydrate(profileId);
      return undefined;
    }
    if (!opens) {
      setPhase({ kind: 'notReady' });
      return undefined;
    }
    let alive = true;
    dailyReviewChunk().then(
      (chunk) => alive && setUi(chunk),
      () => alive && setPhase({ kind: 'nothing' }),
    );
    memoryChunk()
      .then(async (chunk) => {
        const a = chunk.stageCheckApi();
        api.current = a;
        const read = await a.readWorld(profileId);
        if (read.kind !== 'ready') return null;
        world.current = read.world;
        return a.startSession(read.world, stageKey, locale);
      })
      .then(
        (plan) => alive && setPhase(plan ? { kind: 'intro', plan } : { kind: 'nothing' }),
        () => alive && setPhase({ kind: 'nothing' }),
      );
    return () => {
      alive = false;
    };
    // One plan per visit; a new profile or stage is a new visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, stageKey, opens, hydrated]);

  // Every way back mid-check asks first: the [x], the browser and phone back, a swipe.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        const kind = phaseRef.current.kind;
        if (allowLeave.current || (kind !== 'playing' && kind !== 'pause')) return;
        e.preventDefault();
        setLeaving(true);
      }),
    [navigation],
  );

  const leaveTo = useCallback((to: () => void): void => {
    allowLeave.current = true;
    to();
  }, []);
  const back = (): void => leaveTo(() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Journey' })));
  const goHome = (): void => leaveTo(() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })));
  const seeCards = (): void => leaveTo(() => navigation.navigate('Main', { screen: 'Library', params: { section: 'cards' } }));

  const onFirst = (index: number, answer: RoundAnswer): void => {
    const p = phaseRef.current;
    const w = world.current;
    const a = api.current;
    if (p.kind !== 'playing' || w === null || a === null || answers.current.has(index)) return;
    answers.current.set(index, answer);
    setAnswered(answers.current.size);
    recorded.current.push(a.recordRound(w, p.plan, index, answer));
  };

  const onSolved = (): void => {
    const p = phaseRef.current;
    if (p.kind !== 'playing') return;
    const next = p.index + 1;
    if (next < p.plan.rounds.length) {
      setPhase(next % PART === 0 ? { kind: 'pause', plan: p.plan, next } : { ...p, index: next });
      return;
    }
    const w = world.current;
    const a = api.current;
    if (w === null || a === null || finishing.current) return;
    finishing.current = true;
    setPhase({ kind: 'loading' });
    void a
      .finishSession(w, p.plan, answers.current, recorded.current)
      .then(
        (done) => setPhase({ kind: 'result', stars: done.stars, missed: done.missed }),
        () => setPhase({ kind: 'nothing' }),
      )
      .finally(() => {
        finishing.current = false;
      });
  };

  const close = (): void => {
    const kind = phaseRef.current.kind;
    if (kind === 'playing' || kind === 'pause') setLeaving(true);
    else back();
  };

  const leaveSheet = (
    <ConfirmSheet
      visible={leaving}
      title={m.learner.stageReview.leave.title}
      message={m.learner.stageReview.leave.body}
      cancelLabel={m.learner.stageReview.leave.stay.cta}
      confirmLabel={m.learner.stageReview.leave.stop.cta}
      onCancel={() => setLeaving(false)}
      onConfirm={() => {
        setLeaving(false);
        back();
      }}
      testID="stage-check-leave"
    />
  );

  if (phase.kind === 'notReady') {
    return (
      <Screen tone="canvas" scrollable testID="stage-check-not-ready">
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl }}>
          <Hoya pose="thinking" size={END_HOYA} accessibilityLabel={m.a11y.hoya('thinking')} />
          <Body align="center">{copy.notReady}</Body>
        </View>
        <Spacer size="xl" />
        <Button label={m.learner.stageComplete.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="stage-check-home" />
      </Screen>
    );
  }

  if (phase.kind === 'loading' || phase.kind === 'playing' || (ui === null && phase.kind !== 'nothing')) {
    const index = phase.kind === 'playing' ? phase.index : 0;
    const partStart = index - (index % PART);
    const total = phase.kind === 'playing' ? Math.min(PART, phase.plan.rounds.length - partStart) : LOADING_DOTS;
    const round = phase.kind === 'playing' ? phase.plan.rounds[index] : undefined;
    const filled = phase.kind === 'playing' ? index - partStart + (answers.current.has(index) ? 1 : 0) : 0;
    const theme = round?.question.theme;
    const themeKey = theme !== undefined && !theme.startsWith('pack:') ? (theme as ThemeKey) : undefined;
    return (
      <>
        <Screen tone="canvas" scrollable header={{ drawnByScreen: true }} testID="stage-check-screen">
          {ui !== null ? <ui.TopRow onClose={close} filled={filled} total={total} current={index - partStart + 1} /> : null}
          <Spacer size="md" />
          {ui !== null && round !== undefined ? (
            <View key={index} style={{ gap: spacing.md }}>
              {themeKey !== undefined ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="stage-check-theme">
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Icon name={themeGlyph(themeKey)} size={spacing.lg} color={colors.text.secondary} />
                  </View>
                  <Body size="sm" tone="secondary" weight="semibold">
                    {m.learner.journey.themeWord[themeKey]}
                  </Body>
                </View>
              ) : null}
              <RomanizationModeOverride mode={hideRomanization ? 'tap' : 'always'}>
                <ui.RoundView
                  round={round}
                  reducedMotion={reducedMotion}
                  onFirst={(answer) => onFirst(index, answer)}
                  onSolved={onSolved}
                  grade={(target, typed) => api.current?.gradeTyped(target, typed) ?? 'miss'}
                />
              </RomanizationModeOverride>
            </View>
          ) : null}
        </Screen>
        {leaveSheet}
      </>
    );
  }

  if (phase.kind === 'pause' && ui !== null) {
    const pauses = Math.ceil(phase.plan.rounds.length / PART) - 1;
    const n = phase.next / PART - 1;
    const line = n === pauses - 1 && n > 0 ? m.learner.stageReview.pause.fourth : n === 0 ? copy.pause : m.learner.stageReview.pause.second;
    return (
      <>
        <Screen tone="canvas" scrollable testID="stage-check-pause">
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl }}>
            <Hoya pose="cheering" size={END_HOYA} accessibilityLabel={m.a11y.hoya('cheering')} />
            <Heading level="prompt" align="center">
              {line}
            </Heading>
          </View>
          <Spacer size="xl" />
          <Button
            label={m.learner.stageReview.pause.keepGoing.cta}
            tone="primary"
            size="hero"
            fullWidth
            onPress={() => setPhase({ kind: 'playing', plan: phase.plan, index: phase.next })}
            testID="stage-check-keep-going"
          />
        </Screen>
        {leaveSheet}
      </>
    );
  }

  if (phase.kind === 'intro' && ui !== null) {
    return (
      <Screen tone="canvas" scrollable testID="stage-check-intro">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
          <ui.DisplayHeadline testID="stage-check-title">{copy.title}</ui.DisplayHeadline>
          <Body align="center">{copy.intro}</Body>
        </View>
        <Spacer size="lg" />
        <AttemptSwitch label={m.learner.stageReview.intro.hideRomanization} value={hideRomanization} onChange={() => setHideRomanization((v) => !v)} />
        <Spacer size="xl" />
        <Button
          label={m.learner.stageReview.intro.start.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => {
            answers.current = new Map();
            recorded.current = [];
            if (world.current !== null) api.current?.begin(world.current, phase.plan, hideRomanization);
            setPhase({ kind: 'playing', plan: phase.plan, index: 0 });
          }}
          testID="stage-check-go"
        />
        <Spacer size="sm" />
        <Button label={m.learner.stageReview.intro.later.cta} tone="secondary" size="lg" fullWidth onPress={back} testID="stage-check-later" />
      </Screen>
    );
  }

  if (phase.kind === 'result' && ui !== null) {
    const pose = phase.stars === 1 ? 'waving' : 'cheering';
    return (
      <Screen tone="canvas" scrollable testID="stage-check-result">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose={pose} size={END_HOYA} accessibilityLabel={m.a11y.hoya(pose)} />
          <ui.DisplayHeadline testID="stage-check-headline">{m.learner.dailyReview.result.headline[headlineKey(phase.stars)]}</ui.DisplayHeadline>
          <StarRow stars={phase.stars} size={spacing.xxxl} accessibilityLabel={m.a11y.dailyReview.stars(phase.stars)} testID="stage-check-stars" />
          <Body align="center" testID="stage-check-best">
            {copy.best}
          </Body>
          {phase.missed ? (
            <Body align="center" testID="stage-check-tricky">
              {m.learner.cellCheck.tricky}
            </Body>
          ) : null}
        </View>
        <Spacer size="xl" />
        <View style={{ gap: spacing.sm }}>
          <Button label={m.learner.stageComplete.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="stage-check-home" />
          <Button label={m.learner.stageComplete.seeCards.cta} tone="secondary" size="lg" fullWidth onPress={seeCards} testID="stage-check-cards" />
        </View>
      </Screen>
    );
  }

  // Nothing to ask (the store cannot be read, too few playable rounds, the check switched off): one calm page.
  return (
    <Screen tone="canvas" scrollable testID="stage-check-nothing">
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
        <Heading level="prompt" align="center">
          {copy.title}
        </Heading>
        <Body align="center">{m.learner.dailyReview.allRefreshed.body}</Body>
      </View>
      <Spacer size="xl" />
      <Button label={m.learner.stageComplete.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="stage-check-home" />
    </Screen>
  );
}
