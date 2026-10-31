import type { WeekDropEntry } from '@hangul-route/content-schema/week-drops';
import { Body, Button, Caption, Heading, Hoya, Icon, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, KoreanText, Screen, Spacer, colors, radii, spacing, touchTarget, typography, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { WEEK_DROP_WEEKS } from '../../content/__generated__/week-drops-index';
import { weekDrops } from '../../logic/week-drop/drop-store';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { canPlayKorean } from '../../logic/audio/capability';
import { memoryChunk } from '../../logic/memory/boot';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import type { WeekPractice, WeekPracticeApi } from '../../logic/reviews/week-practice';
import { dropWeekFor } from '../../logic/week-drop/calendar';
import { markWeekDone } from '../../logic/week-drop/done-weeks';
import { weekDropView, type WeekDropView } from '../../logic/week-drop/view';
import { localDay } from '../../logic/vocab/progress';
import type { RootStackParamList } from '../../navigation/types';
import { playPrompt } from '../../platform/audio';
import { useReducedMotion } from '../../platform/motion';
import { useAudioStore } from '../../store/audio-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { dailyReviewChunk } from '../reviews/DailyReviewRoute';
import { OopsScreen } from '../system/OopsScreen';

/*
 * "This week in Korea", the drop's pages (F-CURR-002 §5.7, row CM-48; design/wireframes/home/this-week-in-korea.md B,
 * C and D). B, Meet: the title, the note (UI text with taught-Korean tokens) and its source line, then the 5 words with
 * their romanization and meaning, each a speaker button while the device can speak Korean, and Practice the words. C,
 * Practice: the review engine's quick rounds over the drop's words (`weekPracticeApi`, memory chunk), drawn by the Daily
 * Review's round view (reached at run time through `dailyReviewChunk()`, so no module sits in two chunks); each first
 * answer is recorded (the `week` shard). D, Done: one calm headline and Back home; the week is marked done on this
 * device. Never a score, a percentage, an "n of m", a timer, or a word about another week.
 *
 * Built screens: design/screens/this-week-in-korea/ (320 and wide).
 *
 * The drop is the one of the local week the page opened in (`useToday` is Home's; here the day is read once), so a page
 * left open past Sunday midnight keeps its drop. No drop this week, or `weeklyDrop` off (the route's door): back home.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'WeekDrop'>;
type Rounds = typeof import('../reviews/daily-review-chunk');

const END_HOYA = 120;
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'meet'; view: WeekDropView }
  | { kind: 'playing'; view: WeekDropView; practice: WeekPractice; index: number }
  | { kind: 'done'; view: WeekDropView };

/** The note: UI text, and each taught-Korean token on a sunken chip followed by its romanization. */
function Note({ view }: { view: WeekDropView }): ReactElement {
  const scale = useTypeScale().size;
  const m = useMessages();
  const line = { fontSize: scale.body, lineHeight: scale.body * typography.leading.relaxed, color: colors.text.primary };
  return (
    <View role="region" aria-label={m.learner.weekDrop.heading} testID="week-drop-note" style={{ backgroundColor: colors.surface.paper, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
      <Text {...KOREAN_LINE_BREAK} style={line} testID="week-drop-note-text">
        {view.note.map((part, i) =>
          'text' in part ? (
            <Text {...KOREAN_LINE_BREAK} key={i}>
              {part.text}
            </Text>
          ) : (
            <Text {...KOREAN_LINE_BREAK} key={i}>
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontWeight: typography.weight.semibold, backgroundColor: colors.surface.sunken }}>
                {` ${part.ko} `}
              </Text>
              <Text {...KOREAN_LINE_BREAK}>{` ${part.romanization}`}</Text>
            </Text>
          ),
        )}
      </Text>
      {view.citation ? (
        <Text {...KOREAN_LINE_BREAK} testID="week-drop-source" style={{ fontSize: scale.caption, lineHeight: scale.caption * typography.leading.normal, color: colors.text.muted }}>
          {view.citation.runs.map((run, i) => (
            <Text {...KOREAN_LINE_BREAK} key={i} {...(run.korean ? koreanSpeech : {})}>
              {run.text}
            </Text>
          ))}
          {view.citation.more ? ` ${view.citation.more}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

export function WeekDropScreen({ navigation }: Props): ReactElement {
  const m = useMessages();
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const voice = useAudioStore((s) => canPlayKorean({ tts: s.tts, clips: s.clips, unlocked: s.unlocked }) && !s.muted);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [ui, setUi] = useState<Rounds | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [, setAnswered] = useState(0);
  const on = useCurrFlag('weeklyDrop');
  const week = useRef(dropWeekFor(WEEK_DROP_WEEKS, localDay(new Date()))).current;
  const api = useRef<WeekPracticeApi | null>(null);
  const practice = useRef<Promise<WeekPractice | null> | null>(null);
  // The round views' load, kept so a quick tap on Practice waits for it (a tap before it settles never skips the practice).
  const rounds = useRef<Promise<Rounds | null> | null>(null);
  const answers = useRef(new Map<number, RoundAnswer>());

  const home = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  useEffect(() => {
    // `weeklyDrop` off (a remote turn, a stale visit): the surface hides, so back home; nothing is deleted.
    if (!on || week === null || profileId === null) {
      home();
      return undefined;
    }
    let alive = true;
    weekDrops.dropOf(week).then(
      (drop: WeekDropEntry | undefined) => {
        if (!alive) return;
        if (drop === undefined) {
          home();
          return;
        }
        const view = weekDropView(drop, locale, m.learner.cardDetail.citation);
        setPhase({ kind: 'meet', view });
        // The rounds and their plan load while the learner reads; a plan that cannot be made skips the practice.
        rounds.current = dailyReviewChunk().then(
          (chunk) => {
            if (alive) setUi(chunk);
            return chunk;
          },
          () => null,
        );
        practice.current = memoryChunk()
          .then((chunk) => {
            api.current = chunk.weekPracticeApi();
            return api.current.plan(profileId, drop.id, locale);
          })
          .catch(() => null);
      },
      () => alive && setPhase({ kind: 'failed' }),
    );
    return () => {
      alive = false;
    };
    // One drop per visit; Try again is a new attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, week, profileId, attempt]);

  const finish = (view: WeekDropView): void => {
    if (profileId !== null && week !== null) void markWeekDone(profileId, week);
    setPhase({ kind: 'done', view });
  };

  const startPractice = (view: WeekDropView): void => {
    setPhase({ kind: 'loading' });
    // Both the plan and the round views settle first: only a plan that cannot be made, or round views that fail to
    // load, go straight to Done. A tap while either is still loading waits on the loading page.
    void Promise.all([practice.current ?? Promise.resolve(null), rounds.current ?? Promise.resolve(null)]).then(([plan, chunk]) => {
      if (plan === null || chunk === null) finish(view);
      else {
        setUi(chunk);
        answers.current = new Map();
        setPhase({ kind: 'playing', view, practice: plan, index: 0 });
      }
    });
  };

  if (phase.kind === 'failed') {
    return (
      <OopsScreen
        onRetry={() => {
          setPhase({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  if (phase.kind === 'loading') {
    return <Screen tone="canvas" header={{ drawnByScreen: true }} testID="week-drop-loading">{null}</Screen>;
  }

  if (phase.kind === 'playing' && ui !== null) {
    const { practice: plan, index, view } = phase;
    const round = plan.rounds[index];
    const filled = index + (answers.current.has(index) ? 1 : 0);
    return (
      <Screen tone="canvas" scrollable header={{ drawnByScreen: true }} testID="week-drop-practice">
        <ui.TopRow onClose={home} filled={filled} total={plan.rounds.length} current={index + 1} />
        <Spacer size="md" />
        {round !== undefined ? (
          <View key={index}>
            <ui.RoundView
              round={round}
              reducedMotion={reducedMotion}
              onFirst={(answer) => {
                if (answers.current.has(index) || profileId === null) return;
                answers.current.set(index, answer);
                setAnswered(answers.current.size);
                void api.current?.record(profileId, plan, index, answer);
              }}
              onSolved={() => (index + 1 < plan.rounds.length ? setPhase({ ...phase, index: index + 1 }) : finish(view))}
              grade={() => 'miss'}
            />
          </View>
        ) : null}
      </Screen>
    );
  }

  if (phase.kind === 'done') {
    return (
      <Screen tone="canvas" scrollable header={{ drawnByScreen: true }} testID="week-drop-done">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Hoya pose="cheering" size={END_HOYA} accessibilityLabel={m.a11y.hoya('cheering')} />
          <Heading level="title" align="center" testID="week-drop-done-headline">
            {m.learner.weekDrop.done}
          </Heading>
          <Body align="center">{m.learner.weekDrop.next}</Body>
        </View>
        <Spacer size="xl" />
        <Button label={m.learner.results.backHome.cta} tone="primary" size="hero" fullWidth onPress={home} testID="week-drop-home" />
      </Screen>
    );
  }

  const view = phase.kind === 'meet' || phase.kind === 'playing' ? phase.view : null;
  if (view === null) return <Screen tone="canvas" header={{ drawnByScreen: true }}>{null}</Screen>;
  return (
    <Screen tone="canvas" scrollable header={{ drawnByScreen: true }} testID="week-drop-meet">
      <Pressable
        onPress={home}
        accessibilityRole="button"
        accessibilityLabel={m.common.buttons.close}
        testID="week-drop-close"
        style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.md }}
      >
        <Icon name="close" size={spacing.xl} color={colors.text.primary} />
      </Pressable>
      <Caption tone="secondary" weight="semibold">
        {m.learner.weekDrop.heading}
      </Caption>
      <Heading level="title" testID="week-drop-title">
        {view.title}
      </Heading>
      <Spacer size="md" />
      <Note view={view} />
      <Spacer size="lg" />
      <View role="list" style={{ gap: spacing.md }} testID="week-drop-words">
        {view.words.map((word) => (
          <View role="listitem" key={word.id} style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
            <KoreanText
              ko={word.ko}
              romanization={word.romanization}
              gloss={word.meaning}
              size="sm"
              onPress={voice ? () => void playPrompt({ text: word.ko, kind: 'word', source: 'discover' }) : undefined}
              accessibilityLabel={voice ? m.a11y.minigame.hear(word.romanization) : m.a11y.koreanItem({ ko: word.ko, romanization: word.romanization, gloss: word.meaning })}
              testID={`week-drop-word-${word.id}`}
            />
          </View>
        ))}
      </View>
      <Spacer size="xl" />
      <Button label={m.learner.weekDrop.practice.cta} tone="primary" size="hero" fullWidth onPress={() => startPractice(view)} testID="week-drop-practice-go" />
    </Screen>
  );
}
