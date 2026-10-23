import {
  Body,
  Button,
  Heading,
  Hoya,
  HoyaBubble,
  Pill,
  Screen,
  Spacer,
  spacing,
  touchTarget,
} from "@hangul-route/design-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { View } from "react-native";
import { useMessages } from "../../i18n/use-messages";
import { fnv1a32 } from "../../logic/remote-config/remote-config";
import {
  CLOCK_START,
  finishSprint,
  holdClock,
  parseRecord,
  planSprint,
  remainingMs,
  runClock,
  SPRINT_MS,
  timeUp,
  type DecodeSprintRecord,
  type SprintClock,
  type SprintOutcome,
  type SprintPlan,
} from "../../logic/syllable-build/sprint";
import { clockView } from "../../logic/vocab/challenge";
import { subscribeAppActive } from "../../platform/app-state";
import { track } from "../../platform/telemetry";
import { readDecodeSprint, writeDecodeSprint } from "./sprint-record";
import { LessonWaiting } from "../lesson-content";
import { SyllableBuildBoard } from "../minigames/SyllableBuildBoard";
import { ClockBar, ClockDigits, PausedPanel } from "../vocab/ChallengeControls";
import { SprintPick } from "./SprintPick";

/**
 * The Block Sprint (F-CURR-002 section 7.1 F9 "Decoding Sprint", OD-8, section 3.2 G9, row CM-32; the frame of
 * design/wireframes/vocab/speed-round.md G and H, drawn for this row in design/wireframes/minigame/decoding-sprint.md):
 * an optional one-minute bonus after Stage 1.
 *
 * Intro -> the drill (one clock for the minute: it stops while an answer shows and while paused, and the app going to
 * the background pauses it; Pause hides the round) -> "That's the time!" -> the probe (a few held-out blocks, no clock on
 * screen) -> the result: the blocks read and, from the second sprint, the learner's own best, with New best! only above
 * it. Stopping saves nothing. The record is this device's (`store/decode-sprint-store.ts`), and the one event,
 * `decode.sprint.finished`, carries buckets only.
 */

type Phase =
  | "loading"
  | "intro"
  | "drill"
  | "time-up"
  | "probe-intro"
  | "probe"
  | "result";

/** How long "That's the time! Nice work." shows before the probe. */
export const TIME_UP_MS = 1200;
const TICK_MS = 250;

const monotonic = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export interface DecodingSprintScreenProps {
  profileId: string;
  /** `game.syllable-build` for the learner: every other drill round builds the block; off, every round is a pick. */
  buildOn: boolean;
  onClose: () => void;
}

export function DecodingSprintScreen({
  profileId,
  buildOn,
  onClose,
}: DecodingSprintScreenProps): ReactElement {
  const m = useMessages();
  const copy = m.learner.decodingSprint;
  const speed = m.learner.vocab.speed;
  const [record, setRecord] = useState<DecodeSprintRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState(0);
  const [clock, setClock] = useState<SprintClock>(CLOCK_START);
  const [now, setNow] = useState(monotonic);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<SprintOutcome | null>(null);
  const [pauseFocus, setPauseFocus] = useState(0);
  const revealing = useRef(false);
  const tally = useRef({
    drillRight: 0,
    probeRight: 0,
    probeMs: 0,
    shownAt: 0,
  });
  /** Drill rounds already answered: a round drawn again after a pause is never scored twice. */
  const scored = useRef(new Set<number>());

  const load = useCallback((): void => {
    setPhase("loading");
    void readDecodeSprint(profileId).then((raw) => {
      setRecord(parseRecord(raw));
      setRound(0);
      setClock(CLOCK_START);
      setOutcome(null);
      setPaused(false);
      revealing.current = false;
      tally.current = { drillRight: 0, probeRight: 0, probeMs: 0, shownAt: 0 };
      scored.current = new Set();
      setPhase("intro");
    });
  }, [profileId]);
  useEffect(load, [load]);

  const plan: SprintPlan | null = useMemo(
    () =>
      record === null
        ? null
        : planSprint(
            fnv1a32(`${profileId}|decode-sprint|${record.sprints + 1}`),
            buildOn,
          ),
    [record, profileId, buildOn],
  );

  // The clock ticks only in the drill; the screen redraws in quarter seconds so the bar moves in whole seconds on time.
  useEffect(() => {
    if (phase !== "drill") return undefined;
    const id = setInterval(() => setNow(monotonic()), TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "drill" && timeUp(clock, now)) {
      setClock((c) => holdClock(c, now));
      setPhase("time-up");
    }
  }, [phase, clock, now]);

  useEffect(() => {
    if (phase !== "time-up") return undefined;
    const id = setTimeout(() => setPhase("probe-intro"), TIME_UP_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const pause = useCallback((): void => {
    const t = monotonic();
    setClock((c) => holdClock(c, t));
    setPaused(true);
    setPauseFocus((k) => k + 1);
  }, []);

  // The app going to the background pauses the drill, so the minute never runs out while the learner is away.
  useEffect(() => {
    if (phase !== "drill") return undefined;
    return subscribeAppActive((active) => {
      if (!active && !paused) pause();
    });
  }, [phase, paused, pause]);

  const resume = (): void => {
    setPaused(false);
    // Paused while an answer showed: the round is over, so the next one comes up (and the clock runs again).
    if (revealing.current) {
      nextDrill();
      return;
    }
    const t = monotonic();
    setNow(t);
    setClock((c) => runClock(c, t));
  };

  const start = (): void => {
    const t = monotonic();
    setNow(t);
    setClock(runClock(CLOCK_START, t));
    revealing.current = false;
    setRound(0);
    setPhase("drill");
  };

  const holdForAnswer = (): void => {
    revealing.current = true;
    const t = monotonic();
    setClock((c) => holdClock(c, t));
  };

  function nextDrill(): void {
    revealing.current = false;
    const t = monotonic();
    setNow(t);
    setRound((r) => r + 1);
    setClock((c) => (timeUp(c, t) ? c : runClock(c, t)));
  }

  const scoreDrill = (correct: boolean): void => {
    if (scored.current.has(round)) return;
    scored.current.add(round);
    if (correct) tally.current.drillRight += 1;
  };

  const startProbe = (): void => {
    tally.current.shownAt = monotonic();
    setRound(0);
    setPhase("probe");
  };

  const finish = (): void => {
    if (record === null) return;
    const { drillRight, probeRight, probeMs } = tally.current;
    const out = finishSprint(
      {
        drillRight,
        drillMs: SPRINT_MS,
        probeRight,
        probeMs,
        probeRounds: plan?.probe.length ?? 0,
      },
      record,
      profileId,
    );
    setOutcome(out);
    void writeDecodeSprint(profileId, out.record);
    if (out.event !== null) void track(out.event);
    setPhase("result");
  };

  if (phase === "loading" || plan === null) return <LessonWaiting />;

  if (phase === "intro") {
    return (
      <Screen tone="canvas" testID="decoding-sprint-intro">
        <Hoya pose="waving" size={touchTarget.hero} />
        <Spacer size="md" />
        <Heading level="title">{copy.title}</Heading>
        <Spacer size="sm" />
        <Body>{copy.intro}</Body>
        <Body>{copy.introProbe}</Body>
        <Spacer size="xl" />
        <Button
          label={speed.start}
          tone="primary"
          size="lg"
          fullWidth
          onPress={start}
          testID="decoding-sprint-start"
        />
      </Screen>
    );
  }

  if (phase === "result" && outcome !== null) {
    return (
      <Screen tone="canvas" testID="decoding-sprint-result">
        <Hoya pose="cheering" size={touchTarget.hero} />
        <Spacer size="md" />
        <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm }}>
          <Heading level="title">{copy.read(outcome.read)}</Heading>
          {outcome.newBest ? (
            <Pill
              label={speed.results.newBest}
              tone="primary"
              size="sm"
              testID="decoding-sprint-new-best"
            />
          ) : null}
          {outcome.best !== null ? (
            <Body testID="decoding-sprint-best">{copy.best(outcome.best)}</Body>
          ) : null}
        </View>
        <Spacer size="xl" />
        <Button
          label={speed.results.playAgain}
          tone="primary"
          size="lg"
          fullWidth
          onPress={load}
          testID="decoding-sprint-again"
        />
        <Spacer size="sm" />
        <Button
          label={copy.done}
          tone="secondary"
          size="md"
          fullWidth
          onPress={onClose}
          testID="decoding-sprint-done"
        />
      </Screen>
    );
  }

  if (phase === "time-up" || phase === "probe-intro") {
    return (
      <Screen tone="canvas" testID={`decoding-sprint-${phase}`}>
        <View accessibilityLiveRegion="polite">
          <HoyaBubble
            tone="cheering"
            message={phase === "time-up" ? speed.challenge.timeUp : copy.probe}
          />
        </View>
        {phase === "probe-intro" ? (
          <>
            <Spacer size="xl" />
            <Button
              label={speed.start}
              tone="primary"
              size="lg"
              fullWidth
              onPress={startProbe}
              testID="decoding-sprint-probe-start"
            />
          </>
        ) : null}
      </Screen>
    );
  }

  if (phase === "probe") {
    const r = plan.probe[round];
    if (r === undefined) return <LessonWaiting />;
    return (
      <Screen tone="canvas" testID="decoding-sprint-probe">
        <SprintPick
          key={`probe-${round}`}
          round={r}
          testID="decoding-sprint-probe-pick"
          onAnswer={(correct) => {
            tally.current.probeMs += Math.max(
              0,
              monotonic() - tally.current.shownAt,
            );
            if (correct) tally.current.probeRight += 1;
          }}
          onDone={() => {
            if (round + 1 >= plan.probe.length) finish();
            else {
              tally.current.shownAt = monotonic();
              setRound(round + 1);
            }
          }}
        />
      </Screen>
    );
  }

  // The drill.
  const view = clockView(
    remainingMs(clock, now),
    SPRINT_MS,
    speed.challenge,
    m.a11y.vocab.speed,
  );
  const r = plan.drill[round % plan.drill.length];
  return (
    <Screen tone="canvas" testID="decoding-sprint-drill">
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        <View style={{ flex: 1 }}>
          {view ? <ClockBar view={view} /> : null}
        </View>
        {view ? <ClockDigits view={view} /> : null}
        {!paused ? (
          <Button
            label={speed.challenge.pause}
            tone="ghost"
            size="md"
            onPress={pause}
            testID="decoding-sprint-pause"
          />
        ) : null}
      </View>
      <Spacer size="sm" />
      {paused ? (
        <PausedPanel
          copy={speed.challenge}
          focusResume
          focusKey={pauseFocus}
          onResume={resume}
          onStop={onClose}
        />
      ) : r === undefined ? null : r.kind === "pick" ? (
        <SprintPick
          key={`drill-${round}`}
          round={r}
          testID="decoding-sprint-pick"
          onAnswer={(correct) => {
            scoreDrill(correct);
            holdForAnswer();
          }}
          onDone={() => {
            if (!paused) nextDrill();
          }}
        />
      ) : (
        <View key={`drill-${round}`} style={{ gap: spacing.sm }}>
          <Heading level="prompt">
            {m.learner.minigame.syllableBuild.heading}
          </Heading>
          <SyllableBuildBoard
            target={{ ko: r.target, romanization: r.romanization }}
            tiles={r.tiles}
            autoplay
            source="decoding-sprint"
            testID="decoding-sprint-build"
            onFirst={(correct, hinted) => scoreDrill(correct && !hinted)}
            onRight={holdForAnswer}
            onSolved={() => {
              if (!paused) nextDrill();
            }}
          />
        </View>
      )}
    </Screen>
  );
}
