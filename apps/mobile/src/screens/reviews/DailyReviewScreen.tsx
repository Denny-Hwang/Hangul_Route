import type { ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  ConfirmSheet,
  Heading,
  Hoya,
  Icon,
  Screen,
  Spacer,
  StarRow,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useCappedFont,
} from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { themeGlyph } from '../../logic/journey';
import { memoryChunk } from '../../logic/memory/boot';
import type { DailyReviewApi, ReviewWorld } from '../../logic/reviews/daily-review-api';
import type { AfterSession, DailySessionKind, PlannedSession, RoundAnswer } from '../../logic/reviews/daily-review';
import { YUT_REVIEW_FLAG, sessionSeed } from '../../logic/reviews/yut-board';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { RoundView } from './ReviewRounds';
import { YUT_CLOCK_IDLE, YutReviewSkin, yutClockAfter, yutResultHold, type YutClock } from './YutBoardSkin';
import { useClipPacks } from '../../platform/audio-assets-store';

/**
 * The Daily Review and Keep going (F-CURR-002 sections 4.3, 4.5, 7.4 and 7.7, row CM-14; design
 * design/wireframes/reviews/daily-review.md and keep-going.md, design/screens/daily-review/ and keep-going/).
 *
 * Panels: B (a round: [x] top left, fill-only dots, the theme glyph and word, one shipped round), B2 (a miss: amber,
 * Hoya shows the right answer), C (the result: one headline word, 1 to 3 stars, "N got stronger", Back home first,
 * then "Want a few more?" and Keep going while items remain and fewer than 3 Keep goings were played today), D (All
 * refreshed today: nothing to ask, the flags off, or a store that cannot be read), E (Stop for now?, over a round) and
 * Keep going's done-today page (the collected card tapped). Never a percentage, an "n of m", a running count of
 * misses or a timer. Behind `dailyReview` with `memoryRecord`; off, a deep link shows D.
 *
 * Yut Review (row CM-39, `game.yut-review`, built-in pct 0): with the switch on when a session starts, the rounds sit
 * under the yut board band (`YutBoardSkin.tsx`), and each round that ends throws the sticks, whatever its answer. The
 * board reads only the session's seed and how many rounds ended; the answers, stars and result are the same as here
 * with it off, and the result is this plain one, opened once the last item's throw has shown (`yutResultHold`).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'DailyReview'>;

/** The design's display headlines never break a word at 320 and 200 % text (daily-review.md, the 200 % state). */
export const DISPLAY_HEADLINE_MAX_SCALE = 1.5;
/** Hoya on the result and the end pages: the Hangul Check's size. */
const END_HOYA = 120;
/** The round dots (design/screens/daily-review/README.md constants): 8 dp dots with 4 dp gaps. */
const ROUND_DOT = spacing.sm;
const ROUND_DOT_GAP = spacing.xs;
/** The loading frame's dots: a Daily Review's 10 (the engine's `DAILY_REVIEW_SIZE`, not imported: no scheduler module here). */
const LOADING_DOTS = 10;

/** One headline word per star tier (F-RVW-001 section 3.1), never a number. */
const headlineKey = (stars: 1 | 2 | 3): 'one' | 'two' | 'three' => (stars === 3 ? 'three' : stars === 2 ? 'two' : 'one');

type Phase =
  // `finishing`: the last round has ended and the result is on its way (with the yut board on, after the last throw
  // has shown): the dots stay as the session left them, every one filled, not the loading frame's empty ten.
  | { kind: 'loading'; finishing?: number }
  | { kind: 'nothing' }
  | { kind: 'done-today'; offer: AfterSession }
  | { kind: 'playing'; plan: PlannedSession; index: number }
  | { kind: 'result'; session: DailySessionKind; stars: 1 | 2 | 3; stronger: number | null; after: AfterSession };

/** The dots row: fill-only, the same for right and wrong; it names the round's position and nothing else. */
function RoundDots({ filled, total, current }: { filled: number; total: number; current: number }): ReactElement {
  const m = useMessages();
  return (
    <View
      accessible
      accessibilityLabel={m.a11y.dailyReview.round(current)}
      testID="daily-review-dots"
      style={{ flexDirection: 'row', alignItems: 'center', gap: ROUND_DOT_GAP }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          testID={i < filled ? 'daily-review-dot-filled' : 'daily-review-dot'}
          style={{
            width: ROUND_DOT,
            height: ROUND_DOT,
            borderRadius: radii.circle,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.shape,
            backgroundColor: i < filled ? colors.brand.secondary : colors.surface.paper,
          }}
        />
      ))}
    </View>
  );
}

/** [x] and the dots, at the top of a round and of the loading frame (the Cell Check draws it too, row CM-21). */
export function TopRow({ onClose, filled, total, current }: { onClose: () => void; filled: number; total: number; current: number }): ReactElement {
  const m = useMessages();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={m.a11y.dailyReview.close}
        testID="daily-review-close"
        style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.md }}
      >
        <Icon name="close" size={spacing.xl} color={colors.text.primary} />
      </Pressable>
      <RoundDots filled={filled} total={total} current={current} />
    </View>
  );
}

export function DisplayHeadline({ children, testID }: { children: string; testID?: string }): ReactElement {
  const capped = useCappedFont('display', DISPLAY_HEADLINE_MAX_SCALE);
  return (
    <Heading level="display" align="center" style={{ fontSize: capped.fontSize }} testID={testID}>
      {children}
    </Heading>
  );
}

export function DailyReviewScreen({ navigation }: Props): ReactElement {
  // The review clip pack (AMENDMENTS-AUDIO-CLIPS AC-B6): a review asks words of every earlier pack.
  useClipPacks('review');
  const m = useMessages();
  const copy = m.learner.dailyReview;
  const keep = m.learner.keepGoing;
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // The Yut Review board of the session being played (row CM-39): its seed and how many rounds have ended; null when
  // the session plays on the plain screen. Decided when the session starts, so a switch that flips mid-session waits.
  const yutOn = useCurrFlag(YUT_REVIEW_FLAG);
  const yutOnRef = useRef(yutOn);
  yutOnRef.current = yutOn;
  const [yut, setYutState] = useState<{ seed: number; finished: number } | null>(null);
  const yutRef = useRef(yut);
  const setYut = useCallback((next: { seed: number; finished: number } | null): void => {
    yutRef.current = next;
    setYutState(next);
  }, []);
  // When the board's walk ends (a round can end mid-walk; the band finishes it first), and the result's wait timer.
  const yutClock = useRef<YutClock>(YUT_CLOCK_IDLE);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    },
    [],
  );
  const [leaving, setLeaving] = useState(false);
  // Bumped by each first answer, so the round's dot fills when it is answered.
  const [, setAnswered] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const world = useRef<ReviewWorld | null>(null);
  const api = useRef<DailyReviewApi | null>(null);
  const answers = useRef(new Map<number, RoundAnswer>());
  const recorded = useRef<Promise<void>[]>([]);
  const allowLeave = useRef(false);
  // A double tap never starts two sessions (two review.start events) or finishes one twice (two `daily` entries).
  const starting = useRef(false);
  const finishing = useRef(false);

  const goHome = useCallback((): void => {
    allowLeave.current = true;
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  }, [navigation]);

  const start = useCallback(
    async (kind: DailySessionKind): Promise<void> => {
      const w = world.current;
      const a = api.current;
      if (w === null || a === null || starting.current) return;
      starting.current = true;
      setYut(null);
      yutClock.current = YUT_CLOCK_IDLE;
      setPhase({ kind: 'loading' });
      try {
        const plan = await a.startSession(w, kind, locale);
        answers.current = new Map();
        recorded.current = [];
        if (plan !== null && yutOnRef.current) setYut({ seed: sessionSeed([plan.kind, ...plan.rounds.map((r) => r.question.itemId)]), finished: 0 });
        setPhase(plan === null ? { kind: 'nothing' } : { kind: 'playing', plan, index: 0 });
      } finally {
        starting.current = false;
      }
    },
    [locale, setYut],
  );

  // Opens on the Daily Review, or on the done-today page once it is finished (keep-going.md E).
  useEffect(() => {
    let alive = true;
    memoryChunk()
      .then(async (chunk) => {
        const a = chunk.dailyReviewApi();
        api.current = a;
        const read = await a.readWorld(profileId);
        if (!alive) return;
        if (read.kind !== 'ready') {
          setPhase({ kind: 'nothing' });
          return;
        }
        world.current = read.world;
        if (a.openingKind(read.world) === 'keep-going') setPhase({ kind: 'done-today', offer: a.doneTodayOffer(read.world) });
        else void start('daily');
      })
      // The memory chunk cannot load: as a store that cannot be read, "Nothing is waiting right now".
      .catch(() => alive && setPhase({ kind: 'nothing' }));
    return () => {
      alive = false;
    };
    // The world is read once per visit; a new profile is a new visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Every way back mid-round asks "Stop for now?" first: the [x], the browser and phone back, a swipe.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (allowLeave.current || phaseRef.current.kind !== 'playing') return;
        e.preventDefault();
        setLeaving(true);
      }),
    [navigation],
  );

  const stopNow = (): void => {
    const p = phaseRef.current;
    const w = world.current;
    // A stopped Daily Review keeps its answers (recorded as given) and writes no entry; its due items still count toward the day's 20.
    if (p.kind === 'playing' && w !== null) api.current?.noteStopped(w, p.plan, answers.current.keys());
    setLeaving(false);
    allowLeave.current = true;
    if (navigation.canGoBack()) navigation.goBack();
    else goHome();
  };

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
    // Every round that ends throws the sticks, whatever its answer: the board only counts ended rounds. The count is
    // that of the round that ended, so a second call for the same round throws nothing more.
    const y = yutRef.current;
    if (y !== null && y.finished < p.index + 1) {
      yutClock.current = yutClockAfter(yutClock.current, Date.now(), y.seed, p.index + 1, reducedMotion);
      setYut({ ...y, finished: p.index + 1 });
    }
    if (p.index + 1 < p.plan.rounds.length) {
      setPhase({ ...p, index: p.index + 1 });
      return;
    }
    const w = world.current;
    const a = api.current;
    if (w === null || a === null || finishing.current) return;
    finishing.current = true;
    setPhase(y === null ? { kind: 'loading' } : { kind: 'loading', finishing: p.plan.rounds.length });
    // With the yut board on, the plain result waits until the last item's throw has shown (row CM-39); off, at once.
    const hold = y === null ? 0 : yutResultHold(yutClock.current, Date.now(), y.seed, p.plan.rounds.length, reducedMotion);
    const finish = a.finishSession(w, p.plan, answers.current, recorded.current);
    const wait = (): Promise<void> =>
      new Promise<void>((resolve) => {
        holdTimer.current = setTimeout(resolve, hold);
      });
    void (hold === 0 ? finish : Promise.all([finish, wait()]).then(([done]) => done))
      .then(({ finished, world: next }) => {
        world.current = next;
        setPhase({ kind: 'result', session: p.plan.kind, stars: finished.stars, stronger: finished.stronger, after: finished.after });
      })
      .finally(() => {
        finishing.current = false;
      });
  };

  // The [x]: over a round it asks "Stop for now?"; on the loading frame it leaves, home when there is no screen behind.
  const close = (): void => {
    if (phaseRef.current.kind === 'playing') setLeaving(true);
    else if (navigation.canGoBack()) navigation.goBack();
    else goHome();
  };

  const leaveSheet = (
    <ConfirmSheet
      visible={leaving}
      title={copy.leave.title}
      message={copy.leave.body}
      cancelLabel={copy.leave.stay.cta}
      confirmLabel={copy.leave.stop.cta}
      onCancel={() => setLeaving(false)}
      onConfirm={stopNow}
      testID="daily-review-leave"
    />
  );

  if (phase.kind === 'loading' || phase.kind === 'playing') {
    const ended = phase.kind === 'loading' ? phase.finishing : undefined;
    const total = phase.kind === 'playing' ? phase.plan.rounds.length : (ended ?? LOADING_DOTS);
    const index = phase.kind === 'playing' ? phase.index : ended !== undefined ? ended - 1 : 0;
    const round = phase.kind === 'playing' ? phase.plan.rounds[phase.index] : undefined;
    const filled = phase.kind === 'playing' ? index + (answers.current.has(index) ? 1 : 0) : (ended ?? 0);
    const theme = round?.question.theme;
    const themeKey = theme !== undefined && !theme.startsWith('pack:') ? (theme as ThemeKey) : undefined;
    const item =
      round !== undefined ? (
        <View key={index} style={{ gap: spacing.md }}>
          {themeKey !== undefined ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="daily-review-theme">
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name={themeGlyph(themeKey)} size={spacing.lg} color={colors.text.secondary} />
              </View>
              <Body size="sm" tone="secondary" weight="semibold">
                {m.learner.journey.themeWord[themeKey]}
              </Body>
            </View>
          ) : null}
          <RoundView
            round={round}
            reducedMotion={reducedMotion}
            onFirst={(answer) => onFirst(index, answer)}
            onSolved={onSolved}
            grade={(target, typed) => api.current?.gradeTyped(target, typed) ?? 'miss'}
          />
        </View>
      ) : null;
    return (
      <>
        <Screen tone="canvas" scrollable header={{ drawnByScreen: true }} testID="daily-review-screen">
          <TopRow onClose={close} filled={filled} total={total} current={index + 1} />
          <Spacer size="md" />
          {yut === null ? (
            item
          ) : (
            <YutReviewSkin seed={yut.seed} finished={yut.finished} reducedMotion={reducedMotion}>
              {item}
            </YutReviewSkin>
          )}
        </Screen>
        {leaveSheet}
      </>
    );
  }

  if (phase.kind === 'result') {
    const stronger = phase.stronger;
    const offer = phase.after === 'offer';
    return (
      <Screen tone="canvas" scrollable testID="daily-review-result">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose={phase.stars === 1 ? 'thinking' : 'cheering'} size={END_HOYA} accessibilityLabel={m.a11y.hoya(phase.stars === 1 ? 'thinking' : 'cheering')} />
          <DisplayHeadline testID="daily-review-headline">{copy.result.headline[headlineKey(phase.stars)]}</DisplayHeadline>
          <StarRow stars={phase.stars} size={spacing.xxxl} accessibilityLabel={m.a11y.dailyReview.stars(phase.stars)} testID="daily-review-stars" />
          {stronger === null ? null : stronger > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="daily-review-stronger">
              <Icon name="check" size={spacing.lg} color={colors.feedback.success} />
              <Body weight="semibold">{copy.result.stronger(stronger)}</Body>
            </View>
          ) : (
            <Body align="center" testID="daily-review-stronger">
              {copy.result.noneStronger}
            </Body>
          )}
          {phase.session === 'keep-going' && phase.after === 'enough' ? (
            <View style={{ alignItems: 'center' }} testID="daily-review-enough">
              <Body align="center" weight="semibold">
                {keep.enough.title}
              </Body>
              <Body align="center">{keep.enough.body}</Body>
            </View>
          ) : null}
          {phase.session === 'keep-going' && phase.after === 'empty' ? (
            <Body align="center" weight="semibold" testID="daily-review-all-refreshed">
              {copy.allRefreshed.title}
            </Body>
          ) : null}
        </View>
        <Spacer size="xl" />
        <Button label={copy.result.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="daily-review-back-home" />
        {offer ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }} testID="daily-review-offer">
            <Body align="center">{keep.offer}</Body>
            <Button label={keep.cta} tone="secondary" size="lg" fullWidth accessibilityHint={keep.offer} onPress={() => void start('keep-going')} testID="daily-review-keep-going" />
          </View>
        ) : null}
      </Screen>
    );
  }

  if (phase.kind === 'done-today') {
    return (
      <Screen tone="canvas" scrollable testID="daily-review-done-today">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose="waving" size={END_HOYA} accessibilityLabel={m.a11y.hoya('waving')} />
          <DisplayHeadline>{keep.doneToday.title}</DisplayHeadline>
          {phase.offer === 'offer' ? <Body align="center">{keep.offer}</Body> : null}
          {phase.offer === 'empty' ? (
            <Body align="center" weight="semibold">
              {copy.allRefreshed.title}
            </Body>
          ) : null}
          {phase.offer === 'enough' ? (
            <View style={{ alignItems: 'center' }}>
              <Body align="center" weight="semibold">
                {keep.enough.title}
              </Body>
              <Body align="center">{keep.enough.body}</Body>
            </View>
          ) : null}
        </View>
        <Spacer size="xl" />
        {phase.offer === 'offer' ? (
          // The learner came back for more on their own: Keep going is the primary here, and only here.
          <View style={{ gap: spacing.sm }}>
            <Button label={keep.cta} tone="primary" size="hero" fullWidth accessibilityHint={keep.offer} onPress={() => void start('keep-going')} testID="daily-review-keep-going" />
            <Button label={copy.result.backHome.cta} tone="secondary" size="lg" fullWidth onPress={goHome} testID="daily-review-back-home" />
          </View>
        ) : (
          <Button label={copy.result.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="daily-review-back-home" />
        )}
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable testID="daily-review-nothing">
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Hoya pose="cheering" size={END_HOYA} accessibilityLabel={m.a11y.hoya('cheering')} />
        <DisplayHeadline>{copy.allRefreshed.title}</DisplayHeadline>
        <Body align="center">{copy.allRefreshed.body}</Body>
      </View>
      <Spacer size="xl" />
      <Button label={copy.result.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} testID="daily-review-back-home" />
    </Screen>
  );
}
