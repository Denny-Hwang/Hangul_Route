import type { ThemeKey } from '@hangul-route/content-schema';
import { Body, Card, Hoya, borderWidth, colors, motion, spacing } from '@hangul-route/design-system';
import { formatNumber } from '@hangul-route/i18n';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Animated, View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { circleRing, segmentDash } from '../../logic/mastery-ring';

/**
 * The mastery moments on the Results of the activity that reached them (F-CURR-002 section 4.4, row CM-20; wireframe
 * `design/wireframes/journey/mastery-ring.md` G): a Words known milestone (Hoya cheering, one line), then one level up
 * (the cell's 48 dp ring fills its new segment once, in `motion.duration.slow`; with reduced motion it is drawn full at
 * once). Not targets; the telemetry is sent by the level derivation, never by a banner. Part of the mastery chunk.
 */

export interface MasteryLevelUp {
  /** The cell's title in the UI locale. */
  title: string;
  level: 1 | 2 | 3;
  theme: ThemeKey;
}

export interface MasteryBannersProps {
  milestone: number | null;
  levelUp: MasteryLevelUp | null;
  reducedMotion: boolean;
}

/** The level-up banner's ring. */
export const LEVEL_RING_SIZE = spacing.xxxl;

/** The 48 dp ring: the level-up banner's, and the cell page's mastery block (row CM-21, drawn full with `reducedMotion`). */
export function LevelRing({ level, theme, reducedMotion }: { level: 1 | 2 | 3; theme: ThemeKey; reducedMotion: boolean }): ReactElement {
  const ring = circleRing(LEVEL_RING_SIZE, { gap: spacing.xs, track: borderWidth.thick });
  const fill = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      fill.setValue(1);
      return undefined;
    }
    const run = Animated.timing(fill, { toValue: 1, duration: motion.duration.slow, useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [fill, reducedMotion]);
  const c = LEVEL_RING_SIZE / 2;
  const tone = colors.theme[theme];
  const arc = (count: number, color: string, width: number): ReactElement[] =>
    level === 3 && count === 3
      ? [<Circle key="all" cx={c} cy={c} r={ring.r} stroke={color} strokeWidth={width} fill="none" />]
      : ring.segments.slice(0, count).map((s, i) => (
          <Circle key={i} cx={c} cy={c} r={ring.r} stroke={color} strokeWidth={width} fill="none" transform={`rotate(-90 ${c} ${c})`} {...segmentDash(s, ring.length)} />
        ));
  const newOnly = level === 3 ? null : ring.segments[level - 1];
  return (
    <View testID="results-mastery-ring" style={{ width: LEVEL_RING_SIZE, height: LEVEL_RING_SIZE }}>
      <Svg width={LEVEL_RING_SIZE} height={LEVEL_RING_SIZE} style={{ position: 'absolute' }}>
        {arc(3, colors.border.shape, borderWidth.thin)}
        {arc(level - 1, tone, borderWidth.thick)}
      </Svg>
      {/* The new segment (at level 3, the closed ring) fades in once over what was there. */}
      <Animated.View testID="results-mastery-ring-new" style={{ position: 'absolute', opacity: fill }}>
        <Svg width={LEVEL_RING_SIZE} height={LEVEL_RING_SIZE}>
          {newOnly === null || newOnly === undefined ? (
            <Circle cx={c} cy={c} r={ring.r} stroke={tone} strokeWidth={borderWidth.thick} fill="none" />
          ) : (
            <Circle cx={c} cy={c} r={ring.r} stroke={tone} strokeWidth={borderWidth.thick} fill="none" transform={`rotate(-90 ${c} ${c})`} {...segmentDash(newOnly, ring.length)} />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

export function MasteryBanners({ milestone, levelUp, reducedMotion }: MasteryBannersProps): ReactElement | null {
  const messages = useMessages();
  const locale = useLocale();
  const m = messages.learner.mastery;
  if (milestone === null && levelUp === null) return null;
  const levelWord = levelUp === null ? '' : levelUp.level === 3 ? m.level.mastered : levelUp.level === 2 ? m.level.practiced : m.level.done;
  return (
    <View style={{ gap: spacing.lg }}>
      {milestone !== null ? (
        <Card padding="md" tone="success" testID="results-words-milestone">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Hoya pose="cheering" size={spacing.xxxl} accessibilityLabel={messages.a11y.hoya('cheering')} />
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{messages.learner.wordsKnown.milestone(formatNumber(locale, milestone))}</Body>
            </View>
          </View>
        </Card>
      ) : null}
      {levelUp !== null ? (
        <Card padding="md" tone="success" testID="results-level-up">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <LevelRing level={levelUp.level} theme={levelUp.theme} reducedMotion={reducedMotion} />
            </View>
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{m.levelUp(levelUp.title, levelWord)}</Body>
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );
}
