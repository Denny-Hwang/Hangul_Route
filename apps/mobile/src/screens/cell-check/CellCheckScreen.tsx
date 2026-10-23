import type { ThemeKey } from '@hangul-route/content-schema';
import { Body, Button, ConfirmSheet, Heading, Hoya, Screen, Spacer, StarRow, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { episodeById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeEpisode } from '../../logic/content-locale';
import { memoryChunk } from '../../logic/memory/boot';
import type { CellCheckApi, CheckWorld } from '../../logic/reviews/cell-check-api';
import type { PlannedCheck } from '../../logic/reviews/cell-check';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { useMasteryMoment } from '../../store/mastery-entry';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { dailyReviewChunk } from '../reviews/DailyReviewRoute';
import { useActiveRouteNext } from '../use-route-next';

/**
 * The Cell Check and Test out (F-CURR-002 sections 4.4, 4.5 and 7.7, row CM-21; design/wireframes/reviews/
 * cell-check.md C to I, mock design/screens/cell-check/). Part of the Cell Check's chunk; the rounds, the top row and
 * the headline are the Daily Review chunk's (reached at run time through `dailyReviewChunk()`, so no module sits in two
 * chunks), the session logic the memory chunk's (`cellCheckApi()`).
 *
 * C the intro, D the rounds (the cell's items only, so no theme line), E and E2 the Cell Check result, F and G the
 * test-out result, I the stop sheet (the Hangul Check's). Stars only: never a percentage, an "n of m", a pass mark, a
 * timer or "failed". A stopped Cell Check keeps its answers and writes no entry; a stopped test-out writes nothing.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'CellCheck'>;
type Rounds = typeof import('../reviews/daily-review-chunk');

/** Hoya on the intro and the result: the Daily Review's size. */
const END_HOYA = 120;
/** The loading frame's dots: a Cell Check's 10 (not imported: no scheduler module in this chunk). */
const LOADING_DOTS = 10;

type Phase =
  | { kind: 'loading' }
  | { kind: 'nothing' }
  | { kind: 'intro'; plan: PlannedCheck }
  | { kind: 'playing'; plan: PlannedCheck; index: number }
  | { kind: 'result'; stars: 1 | 2 | 3; passed: boolean };

const headlineKey = (stars: 1 | 2 | 3): 'one' | 'two' | 'three' => (stars === 3 ? 'three' : stars === 2 ? 'two' : 'one');

export function CellCheckScreen({ navigation, route }: Props): React.ReactElement {
  const { cellId, mode } = route.params;
  const m = useMessages();
  const copy = m.learner.cellCheck;
  const out = m.learner.testOut;
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [ui, setUi] = useState<Rounds | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [, setAnswered] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const world = useRef<CheckWorld | null>(null);
  const api = useRef<CellCheckApi | null>(null);
  const answers = useRef(new Map<number, RoundAnswer>());
  const recorded = useRef<Promise<void>[]>([]);
  const allowLeave = useRef(false);
  const finishing = useRef(false);
  const next = useActiveRouteNext()?.next;
  const moment = useMasteryMoment(profileId, phase.kind === 'result');
  const episode = episodeById(cellId);

  useEffect(() => {
    let alive = true;
    dailyReviewChunk().then(
      (chunk) => alive && setUi(chunk),
      () => alive && setPhase({ kind: 'nothing' }),
    );
    memoryChunk()
      .then(async (chunk) => {
        const a = chunk.cellCheckApi();
        api.current = a;
        const read = await a.readWorld(profileId);
        if (read.kind !== 'ready') return null;
        world.current = read.world;
        return a.startSession(read.world, cellId, mode, locale);
      })
      .then(
        (plan) => alive && setPhase(plan ? { kind: 'intro', plan } : { kind: 'nothing' }),
        () => alive && setPhase({ kind: 'nothing' }),
      );
    return () => {
      alive = false;
    };
    // One plan per visit; a new profile or cell is a new visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, cellId, mode]);

  // Every way back mid-round asks first: the [x], the browser and phone back, a swipe.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (allowLeave.current || phaseRef.current.kind !== 'playing') return;
        e.preventDefault();
        setLeaving(true);
      }),
    [navigation],
  );

  const leaveTo = useCallback(
    (to: () => void): void => {
      allowLeave.current = true;
      to();
    },
    [],
  );
  const toPlace = (): void => leaveTo(() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Journey', params: { episodeId: cellId } })));
  const toMap = (): void => leaveTo(() => navigation.navigate('Main', { screen: 'Journey' }));

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
    if (p.index + 1 < p.plan.rounds.length) {
      setPhase({ ...p, index: p.index + 1 });
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
        (done) => setPhase({ kind: 'result', stars: done.stars, passed: done.passed }),
        () => setPhase({ kind: 'nothing' }),
      )
      .finally(() => {
        finishing.current = false;
      });
  };

  const close = (): void => {
    if (phaseRef.current.kind === 'playing') setLeaving(true);
    else toPlace();
  };

  if (phase.kind === 'loading' || phase.kind === 'playing' || (ui === null && phase.kind !== 'nothing')) {
    const total = phase.kind === 'playing' ? phase.plan.rounds.length : LOADING_DOTS;
    const index = phase.kind === 'playing' ? phase.index : 0;
    const round = phase.kind === 'playing' ? phase.plan.rounds[index] : undefined;
    const filled = phase.kind === 'playing' ? index + (answers.current.has(index) ? 1 : 0) : 0;
    return (
      <>
        <Screen tone="canvas" scrollable header={{ drawnByScreen: true }} testID="cell-check-screen">
          {ui !== null ? <ui.TopRow onClose={close} filled={filled} total={total} current={index + 1} /> : null}
          <Spacer size="md" />
          {ui !== null && round !== undefined ? (
            <View key={index}>
              <ui.RoundView
                round={round}
                reducedMotion={reducedMotion}
                onFirst={(answer) => onFirst(index, answer)}
                onSolved={onSolved}
                grade={(target, typed) => api.current?.gradeTyped(target, typed) ?? 'miss'}
              />
            </View>
          ) : null}
        </Screen>
        <ConfirmSheet
          visible={leaving}
          title={m.learner.stageReview.leave.title}
          message={m.learner.stageReview.leave.body}
          cancelLabel={m.learner.stageReview.leave.stay.cta}
          confirmLabel={m.learner.stageReview.leave.stop.cta}
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            toPlace();
          }}
          testID="cell-check-leave"
        />
      </>
    );
  }

  if (phase.kind === 'intro' && ui !== null) {
    return (
      <Screen tone="canvas" scrollable testID="cell-check-intro">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
          <ui.DisplayHeadline testID="cell-check-title">{mode === 'testout' ? out.title : copy.title}</ui.DisplayHeadline>
          <Body align="center">{copy.body}</Body>
          {mode === 'testout' ? <Body align="center">{out.intro}</Body> : null}
        </View>
        <Spacer size="xl" />
        <Button
          label={m.learner.stageReview.intro.start.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => {
            answers.current = new Map();
            recorded.current = [];
            setPhase({ kind: 'playing', plan: phase.plan, index: 0 });
          }}
          testID="cell-check-go"
        />
        <Spacer size="sm" />
        <Button label={m.learner.stageReview.intro.later.cta} tone="secondary" size="lg" fullWidth onPress={toPlace} testID="cell-check-later" />
      </Screen>
    );
  }

  if (phase.kind === 'result' && ui !== null) {
    const title = episode ? localizeEpisode(episode, locale).titleEn : '';
    const rise = moment?.read.rises.find((r) => r.cellId === cellId) ?? null;
    const banners =
      moment !== null && rise !== null && episode ? (
        <moment.ui.MasteryBanners milestone={moment.read.milestone} levelUp={{ title, level: rise.level, theme: episode.theme as ThemeKey }} reducedMotion={reducedMotion} />
      ) : null;
    const testOut = mode === 'testout';
    const headline = testOut ? (phase.passed ? out.passed : out.start) : m.learner.dailyReview.result.headline[headlineKey(phase.stars)];
    const pose = phase.passed ? 'cheering' : testOut ? 'waving' : 'thinking';
    const firstQuest = episode?.questIds[0];
    const nextQuest = next?.kind === 'quest' ? next : null;
    return (
      <Screen tone="canvas" scrollable testID="cell-check-result">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose={pose} size={END_HOYA} accessibilityLabel={m.a11y.hoya(pose)} />
          <ui.DisplayHeadline testID="cell-check-headline">{headline}</ui.DisplayHeadline>
          <StarRow stars={phase.stars} size={spacing.xxxl} accessibilityLabel={m.a11y.dailyReview.stars(phase.stars)} testID="cell-check-stars" />
          {!phase.passed && !testOut ? (
            <View style={{ alignItems: 'center' }} testID="cell-check-tricky">
              <Body align="center">{copy.tricky}</Body>
              <Body align="center">{copy.kept}</Body>
            </View>
          ) : null}
          {!phase.passed && testOut ? <Body align="center">{out.startBody}</Body> : null}
        </View>
        {banners ? (
          <>
            <Spacer size="lg" />
            {banners}
          </>
        ) : null}
        <Spacer size="xl" />
        <View style={{ gap: spacing.sm }}>
          {testOut && phase.passed && nextQuest !== null ? (
            <Button label={out.next} tone="primary" size="hero" fullWidth onPress={() => leaveTo(() => navigation.replace('EpisodeDetail', { episodeId: nextQuest.episodeId }))} testID="cell-check-next" />
          ) : null}
          {testOut && !phase.passed && firstQuest !== undefined ? (
            <Button label={out.first} tone="primary" size="hero" fullWidth onPress={() => leaveTo(() => navigation.replace('QuestPlayer', { questId: firstQuest, episodeId: cellId }))} testID="cell-check-first" />
          ) : null}
          {!testOut && !phase.passed ? <Button label={copy.toPlace} tone="primary" size="hero" fullWidth onPress={toPlace} testID="cell-check-to-place" /> : null}
          <Button
            label={copy.toMap}
            tone={!testOut && phase.passed ? 'primary' : 'secondary'}
            size={!testOut && phase.passed ? 'hero' : 'lg'}
            fullWidth
            onPress={toMap}
            testID="cell-check-to-map"
          />
          {!testOut && phase.passed ? <Button label={copy.toPlace} tone="secondary" size="lg" fullWidth onPress={toPlace} testID="cell-check-to-place" /> : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable testID="cell-check-nothing">
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
        <Heading level="prompt" align="center">
          {copy.title}
        </Heading>
        <Body align="center">{m.learner.dailyReview.allRefreshed.body}</Body>
      </View>
      <Spacer size="xl" />
      <Button label={copy.toPlace} tone="primary" size="hero" fullWidth onPress={toPlace} testID="cell-check-to-place" />
    </Screen>
  );
}
