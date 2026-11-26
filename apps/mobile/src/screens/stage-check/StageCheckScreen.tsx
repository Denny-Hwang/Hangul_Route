import type { ThemeKey } from '@hangul-route/content-schema';
import { Body, Button, ConfirmSheet, Heading, Hoya, Icon, Screen, Spacer, StarRow, colors, spacing } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { themeGlyph } from '../../logic/journey';
import { memoryChunk } from '../../logic/memory/boot';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import { keepRecording, recordAgain } from '../../logic/reviews/save-retry';
import type { ResumableStageCheck } from '../../logic/reviews/saved-stage-check';
import type { PlannedStageCheck } from '../../logic/reviews/stage-check';
import type { StageCheckApi, StageCheckFinished, StageCheckWorld } from '../../logic/reviews/stage-check-api';
import { PRIZE_STAGES } from '../../logic/stage1/stage-complete';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { clearSavedCheck, readSavedCheck, saveCheck } from '../../store/check-run-saved';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { dailyReviewChunk } from '../reviews/DailyReviewRoute';
import { ResumeTitle } from '../reviews/StageReviewScreen';
import { SaveLaterLine } from '../reviews/SaveLaterLine';
import { useStageOffer } from './use-stage-offer';

/**
 * The Stage Check of Stages 2-7 (F-CURR-002 sections 4.5, 7.3, 7.7 and OD-1, row CM-22; design/wireframes/reviews/
 * stage-check.md D to F and H, mock design/screens/stage-check/). Part of the Stage Check's chunk; the rounds, the top
 * row and the headline are the Daily Review chunk's (reached at run time through `dailyReviewChunk()`, so no module
 * sits in two chunks), the session logic the memory chunk's (`stageCheckApi()`).
 *
 * D the intro (about 7 minutes, no timer), E the rounds in parts of 5 (the dots show the
 * part only, with the theme line: the items mix all five themes), E2 a pause between parts, F the result (stars, then
 * "Your best result is kept"), H the stop sheet (the Hangul Check's). Never a percentage, an "n of m", a score, a
 * timer, "exam" or a certificate. A finish that could not be saved is the `failed` phase (AMENDMENTS-QUEST-LEAVE-RESUME
 * section 3.5, row LR-4), not "This check is not open yet": the Daily Review chunk's `SaveFailedPage` says so, and Try
 * again finishes the same plan on the same answers. A stopped check keeps its answers and writes no entry and no latch. It never gates
 * anything: the next stage does not read it (OD-1).
 *
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3b (section 3.4, OD-LR7, OD-LR9 (b)): a stopped or interrupted check goes on.
 * Each first answer is kept on this device (`store/check-run-saved.ts`, `hr:check-run:<profileId>`, 24 hours) once its
 * recording has settled, with the plan's rounds as played; the loading frame reads it beside the plan and offers "Pick up
 * where you left off?" (the `resume` phase) instead of the intro. Continue goes on at the round after the last one
 * answered, never asks a stored round again and does not send `review.start` again; Start again shows the intro and
 * clears nothing until Let's go (which plans the new check behind the loading frame). The run is stored with every answer
 * before the finish runs, so a kill or a failed save brings the learner back to Continue and straight to the finish; the
 * result clears it, and a stored run whose result is already in the progress is dropped. Stop keeps it (OD-LR1 (c)).
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
  // The plan is null after Start again on the resume page: Let's go plans the new check behind the loading frame.
  | { kind: 'intro'; plan: PlannedStageCheck | null }
  // [LR] A stored check of this stage and language: Continue goes on with it, Start again shows the intro (`plan` is the intro's, if it was made).
  | { kind: 'resume'; run: ResumableStageCheck; plan: PlannedStageCheck | null }
  | { kind: 'playing'; plan: PlannedStageCheck; index: number }
  | { kind: 'pause'; plan: PlannedStageCheck; next: number }
  // The last round has ended and the check could not be written: the plan and the answers are kept (in refs).
  | { kind: 'failed'; plan: PlannedStageCheck }
  | { kind: 'result'; stars: 1 | 2 | 3; missed: boolean };

const headlineKey = (stars: 1 | 2 | 3): 'one' | 'two' | 'three' => (stars === 3 ? 'three' : stars === 2 ? 'two' : 'one');

export function StageCheckScreen({ navigation, route }: Props): ReactElement {
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
  const [, setAnswered] = useState(0);
  // [LR] Something is stored for this check (an answer was kept): the stop sheet says Stop keeps it.
  const [kept, setKept] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const world = useRef<StageCheckWorld | null>(null);
  const api = useRef<StageCheckApi | null>(null);
  const answers = useRef(new Map<number, RoundAnswer>());
  // Each round's recording by round index, so Try again records again only the rounds whose recording rejected.
  const recorded = useRef(new Map<number, Promise<void>>());
  const allowLeave = useRef(false);
  // Stop was chosen: a Try again still running finishes nothing.
  const stopped = useRef(false);
  const finishing = useRef(false);
  // [LR] The answers whose recording settled (what is stored), the check's start time, and the double-tap guards of
  // Continue and Let's go.
  const settled = useRef(new Map<number, RoundAnswer>());
  const startedAtRef = useRef<string | null>(null);
  const continuing = useRef(false);
  const starting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
    const session = memoryChunk().then(async (chunk) => {
      const a = chunk.stageCheckApi();
      api.current = a;
      const read = await a.readWorld(profileId);
      if (read.kind !== 'ready') return null;
      world.current = read.world;
      return { a, w: read.world };
    });
    // [LR] The stored check, read beside the plan (bounded, section 3.3). A read that lands after its limit offers the
    // resume page only while the intro shows and nothing has started.
    let introUp = false;
    let lateValue: unknown = null;
    const offerLate = async (): Promise<void> => {
      const s2 = await session.catch(() => null);
      const value = lateValue;
      lateValue = null;
      // Only while the intro shows and nothing has started: after Let's go the late read is ignored, and it never clears
      // (the stored run is then the new check's own).
      const intro = (): boolean => alive && introUp && !starting.current && phaseRef.current.kind === 'intro';
      if (!intro() || s2 === null || value === null) return;
      const found = await s2.a.resumeSession(s2.w, value, locale, stageKey);
      if (!intro()) return;
      if (found.kind === 'recorded' && profileId !== null) void clearSavedCheck(profileId);
      if (found.kind === 'run') setPhase((p) => (p.kind === 'intro' ? { kind: 'resume', run: found.run, plan: p.plan } : p));
    };
    const stored =
      profileId === null
        ? Promise.resolve(null)
        : readSavedCheck(profileId, {
            onLate: (value) => {
              lateValue = value;
              if (introUp) void offerLate();
            },
          });
    session
      .then(async (s2): Promise<Phase> => {
        if (s2 === null) return { kind: 'nothing' };
        const value = await stored;
        const found = value === null ? null : await s2.a.resumeSession(s2.w, value, locale, stageKey);
        if (found?.kind === 'run') return { kind: 'resume', run: found.run, plan: null };
        // A stored run whose result is already recorded (a kill before the clear) is not offered again: it goes.
        if (found?.kind === 'recorded' && profileId !== null) void clearSavedCheck(profileId);
        const plan = await s2.a.startSession(s2.w, stageKey, locale);
        return plan ? { kind: 'intro', plan } : { kind: 'nothing' };
      })
      .then(
        (next) => {
          if (!alive) return;
          setPhase(next);
          if (next.kind === 'intro') {
            introUp = true;
            if (lateValue !== null) void offerLate();
          }
        },
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
        if (allowLeave.current || (kind !== 'playing' && kind !== 'pause' && kind !== 'failed')) return;
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

  // [LR] What is stored: the plan's rounds and the answers whose recording settled (OD-LR9 (b)). A failed write is dropped.
  const persist = (plan: PlannedStageCheck, finishedAt?: string): Promise<void> => {
    const a = api.current;
    const startedAt = startedAtRef.current;
    if (profileId === null || a === null || startedAt === null || settled.current.size === 0) return Promise.resolve();
    return saveCheck(profileId, a.savedRun(plan, { locale, answers: settled.current, startedAt, ...(finishedAt !== undefined ? { finishedAt } : {}) }));
  };
  // The result is in the progress: the stored run is marked finished (ordered before the complete event, and after the
  // entry and the latch), so a clear that does not happen never leaves a run that is offered or finished again.
  const markFinished = (plan: PlannedStageCheck): Promise<void> => persist(plan, new Date().toISOString());
  const markSettled = (plan: PlannedStageCheck, index: number, answer: RoundAnswer): void => {
    settled.current.set(index, answer);
    if (mounted.current) setKept(true);
    void persist(plan);
  };
  // Stored with every answer before the finish runs (section 3.4): an app kill or a failed save then comes back to
  // Continue, which goes straight to the finish. Only answers whose recording settled are stored.
  const storeBeforeFinish = async (plan: PlannedStageCheck): Promise<void> => {
    await Promise.all([...recorded.current.values()].map((r) => r.then(() => undefined, () => undefined)));
    await persist(plan);
  };
  // The result is in: the stored check is forgotten (a null finish wrote nothing, so the run stays).
  const finished = (done: StageCheckFinished | null): Phase => {
    if (done === null) return { kind: 'nothing' };
    if (profileId !== null) void clearSavedCheck(profileId);
    return { kind: 'result', stars: done.stars, missed: done.missed };
  };

  const onFirst = (index: number, answer: RoundAnswer): void => {
    const p = phaseRef.current;
    const w = world.current;
    const a = api.current;
    if (p.kind !== 'playing' || w === null || a === null || answers.current.has(index)) return;
    answers.current.set(index, answer);
    setAnswered(answers.current.size);
    const recording = keepRecording(recorded.current, index, a.recordRound(w, p.plan, index, answer));
    // Stored once the answer is recorded, so a stored answer is a recorded answer.
    void recording.then(() => markSettled(p.plan, index, answer), () => undefined);
  };

  // The round from `from` on that has no answer yet: a resumed check never asks a stored round again.
  const nextRound = (plan: PlannedStageCheck, from: number): number => {
    let next = from;
    while (next < plan.rounds.length && answers.current.has(next)) next += 1;
    return next;
  };

  // The finish of a plan: stored first, then written once; a rejection is the failed page, never the not-ready line.
  const finish = (plan: PlannedStageCheck): void => {
    const w = world.current;
    const a = api.current;
    if (w === null || a === null || finishing.current) return;
    finishing.current = true;
    setPhase({ kind: 'loading' });
    void storeBeforeFinish(plan)
      .then(() => a.finishSession(w, plan, answers.current, [...recorded.current.values()], undefined, () => markFinished(plan)))
      .then(
        // Null: the check was switched off or the stage closed while it played; nothing was written (the calm page).
        (done) => setPhase(finished(done)),
        // The check could not be written (a recording or the entry): the failed page, which says so and tries again on
        // the same answers (section 3.5). Never the not-ready line: it is untrue here.
        () => setPhase({ kind: 'failed', plan }),
      )
      .finally(() => {
        finishing.current = false;
      });
  };

  const onSolved = (): void => {
    const p = phaseRef.current;
    if (p.kind !== 'playing') return;
    const next = nextRound(p.plan, p.index + 1);
    if (next < p.plan.rounds.length) {
      setPhase(Math.floor(next / PART) > Math.floor(p.index / PART) ? { kind: 'pause', plan: p.plan, next } : { ...p, index: next });
      return;
    }
    finish(p.plan);
  };

  // [LR] Continue on the resume page: the stored answers are restored (they are in the memory store already, so nothing
  // is recorded for them and `review.start` is not sent again) and the check goes on at the round after the last one
  // answered; with every round answered it goes straight to the finish. A second tap does nothing.
  const onContinue = (): void => {
    const p = phaseRef.current;
    if (p.kind !== 'resume' || continuing.current) return;
    continuing.current = true;
    const { run } = p;
    answers.current = new Map(run.answers);
    recorded.current = new Map();
    settled.current = new Map(run.answers);
    startedAtRef.current = run.startedAt;
    setAnswered(run.answers.size);
    setKept(true);
    if (run.next >= run.plan.rounds.length) finish(run.plan);
    else setPhase({ kind: 'playing', plan: run.plan, index: run.next });
  };

  // [LR] Let's go: the check is planned now when the intro came after Start again, then the stored check is forgotten and
  // the new one begins (its first answer is stored in its place).
  const onStart = async (plan: PlannedStageCheck | null): Promise<void> => {
    const w = world.current;
    const a = api.current;
    if (phaseRef.current.kind !== 'intro' || starting.current || w === null || a === null) return;
    starting.current = true;
    let planned = plan;
    if (planned === null) {
      setPhase({ kind: 'loading' });
      planned = await a.startSession(w, stageKey, locale).catch(() => null);
      if (!mounted.current) return;
      if (planned === null) {
        starting.current = false;
        setPhase({ kind: 'nothing' });
        return;
      }
    }
    answers.current = new Map();
    recorded.current = new Map();
    settled.current = new Map();
    setKept(false);
    if (profileId !== null) void clearSavedCheck(profileId);
    startedAtRef.current = new Date().toISOString();
    a.begin(w, planned);
    setPhase({ kind: 'playing', plan: planned, index: 0 });
  };

  // Try again (section 3.5): records again the rounds whose recording rejected, then finishes the same plan with the
  // same answers (the finish is once per plan: a second try never writes a second entry, latch or event). Resolves
  // whether the result, or the calm page for a check that closed meanwhile, is now showing.
  const tryAgain = async (): Promise<boolean> => {
    const p = phaseRef.current;
    const w = world.current;
    const a = api.current;
    if (p.kind !== 'failed' || w === null || a === null) return false;
    try {
      await recordAgain(recorded.current, (index) =>
        a.recordRound(w, p.plan, index, answers.current.get(index) as RoundAnswer).then(() => {
          settled.current.set(index, answers.current.get(index) as RoundAnswer);
        }),
      );
      // Stop was chosen while the recordings were being written: nothing more is written.
      if (stopped.current) return true;
      // [LR] The rounds recorded now are stored with the rest before the finish runs again.
      await storeBeforeFinish(p.plan);
      if (stopped.current) return true;
      const done = await a.finishSession(w, p.plan, answers.current, [...recorded.current.values()], undefined, () => markFinished(p.plan));
      if (stopped.current) return true;
      setLeaving(false);
      setPhase(finished(done));
      return true;
    } catch {
      return false;
    }
  };

  const close = (): void => {
    const kind = phaseRef.current.kind;
    if (kind === 'playing' || kind === 'pause' || kind === 'failed') setLeaving(true);
    else back();
  };

  const leaveSheet = (
    <ConfirmSheet
      visible={leaving}
      title={m.learner.stageReview.leave.title}
      // [LR] OD-LR1 (c): Stop keeps the stored check, so the line says so once something is stored; before that, the old line is true.
      message={phase.kind === 'failed' ? m.learner.dailyReview.saveFailed.leaveBody : kept ? m.learner.stageReview.leave.bodyKept : m.learner.stageReview.leave.body}
      cancelLabel={m.learner.stageReview.leave.stay.cta}
      confirmLabel={m.learner.stageReview.leave.stop.cta}
      // [LR-6] Keep going is the filled button and Stop the plain one, as on the Hangul Check's sheet (owner decision 2026-11-24, O5).
      safeFilled
      onCancel={() => setLeaving(false)}
      onConfirm={() => {
        stopped.current = true;
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
              <ui.RoundView
                round={round}
                reducedMotion={reducedMotion}
                cantHear
                check="stage-check"
                holdSurface="stage-check"
                onFirst={(answer) => onFirst(index, answer)}
                onSolved={onSolved}
                grade={(target, typed) => api.current?.gradeTyped(target, typed) ?? 'miss'}
              />
            </View>
          ) : null}
        </Screen>
        {leaveSheet}
      </>
    );
  }

  if (phase.kind === 'failed' && ui !== null) {
    return (
      <>
        <ui.SaveFailedPage onTryAgain={tryAgain} testID="stage-check-save-failed" />
        {leaveSheet}
      </>
    );
  }

  if (phase.kind === 'pause' && ui !== null) {
    const pauses = Math.ceil(phase.plan.rounds.length / PART) - 1;
    const n = Math.floor(phase.next / PART) - 1;
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

  // [LR] The resume page (wireframe reviews/check-resume.md panel A): Continue goes on, Start again shows the intro and
  // clears nothing yet. No count of rounds.
  if (phase.kind === 'resume' && ui !== null) {
    return (
      <Screen tone="canvas" scrollable testID="stage-check-resume">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
          <ui.DisplayHeadline testID="stage-check-title">{copy.title}</ui.DisplayHeadline>
          <ResumeTitle testID="stage-check-resume-title">{m.learner.stageReview.resume.title}</ResumeTitle>
        </View>
        <Spacer size="xl" />
        <Button label={m.common.buttons.continue} tone="primary" size="hero" fullWidth onPress={onContinue} testID="stage-check-continue" />
        <Spacer size="sm" />
        <Button
          label={m.learner.stageReview.resume.startAgain.cta}
          tone="secondary"
          size="lg"
          fullWidth
          onPress={() => {
            if (phaseRef.current.kind !== 'resume') return;
            continuing.current = false;
            setPhase({ kind: 'intro', plan: phase.plan });
          }}
          testID="stage-check-start-again"
        />
      </Screen>
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
        <Spacer size="xl" />
        <Button label={m.learner.stageReview.intro.start.cta} tone="primary" size="hero" fullWidth onPress={() => void onStart(phase.plan)} testID="stage-check-go" />
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
          <SaveLaterLine testID="stage-check-save-later" />
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

  // Nothing to ask (the store cannot be read, too few playable rounds, the meanings not on this device offline, the
  // check switched off or the stage closed): one calm page with the Stage Check's own line.
  return (
    <Screen tone="canvas" scrollable testID="stage-check-nothing">
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
        <Heading level="prompt" align="center">
          {copy.title}
        </Heading>
        <Body align="center">{copy.notReady}</Body>
      </View>
      <Spacer size="xl" />
      <Button label={m.learner.stageComplete.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="stage-check-home" />
    </Screen>
  );
}
