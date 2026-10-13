import {
  Body,
  Button,
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
import { romanizationShown as showRomanization } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { localizedGloss, vocabItem } from '../../content/vocab';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { ACTIVITY_ROUTES, VOCAB_SCREENS } from '../../logic/vocab/caps';
import { resultsView } from '../../logic/vocab/speed-round';
import type { RootStackParamList } from '../../navigation/types';
import { PictureArt } from '../minigames/PictureArt';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabResults'>;

/** One "see again" tile: wide enough for a three-syllable word and its romanization (design/screens/vocab/topic.md). */
const TILE_WIDTH = 2 * touchTarget.hero - spacing.xxl;

/**
 * The Speed Round results (F-VOC-004 §3.6, wireframe H): Hoya, the stars
 * (1-3), the plain count of words caught, New best! (Challenge only, against
 * the learner's own earlier best), Hoya's line, the words to see again with
 * Practice these, Play again and Back to topic. No percentage, fraction, time
 * per word or comparison with anyone (S4, S11). It writes nothing: the round
 * wrote every answer and its session before it opened this screen.
 * Design: design/screens/vocab/results.md.
 */
export function VocabResultsScreen({ route, navigation }: Props): React.ReactElement {
  const { topicKey, summary, newBest = false } = route.params;
  const messages = useMessages();
  const copy = messages.learner.vocab.speed;
  const locale = useLocale();
  const romanizationShown = showRomanization(useRomanizationMode(), false);
  // `summary` is typed as required, but a restored or hand-built route may lack it: redirect, never throw.
  const view = summary ? resultsView(summary, newBest, copy) : null;
  const toTopic = (): void => navigation.navigate('VocabTopic', { topicKey });

  // A stale or broken route (nothing was played): back to the topic page, nothing written here.
  useEffect(() => {
    if (view === null) navigation.replace('VocabTopic', { topicKey });
  }, [view, navigation, topicKey]);

  const tiles = useMemo(
    () =>
      (view?.seeAgainIds ?? []).flatMap((id) => {
        const item = vocabItem(id);
        return item ? [{ item, gloss: localizedGloss(item, locale) }] : [];
      }),
    [view?.seeAgainIds, locale],
  );

  if (view === null) return <Screen tone="canvas" testID="vocab-results-redirect">{null}</Screen>;
  const practice = VOCAB_SCREENS.learn && tiles.length > 0;

  return (
    <Screen tone="canvas" scrollable testID="vocab-results">
      <Spacer size="lg" />
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Hoya pose={view.hoya.pose} size={touchTarget.hero} accessibilityLabel={messages.a11y.hoya(view.hoya.pose)} />
        <StarRow stars={view.stars} size={spacing.xxxl} accessibilityLabel={messages.a11y.stars(view.stars)} testID="vocab-results-stars" />
        {view.timeUp ? <Body tone="secondary">{view.timeUp}</Body> : null}
        <Heading level="title" align="center" testID="vocab-results-caught">
          {view.caughtLine}
        </Heading>
        {view.newBest ? (
          <Body weight="semibold" testID="vocab-results-new-best">
            {view.newBest}
          </Body>
        ) : null}
      </View>
      <Spacer size="lg" />
      <HoyaBubble tone={view.hoya.pose} message={view.hoya.line} testID="vocab-results-hoya" />

      {tiles.length > 0 ? (
        <View testID="vocab-results-see-again">
          <Spacer size="xl" />
          <Heading level="prompt">{copy.results.seeAgain}</Heading>
          <Spacer size="sm" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {tiles.map(({ item, gloss }) => (
              <View
                key={item.id}
                accessible
                accessibilityLabel={messages.a11y.koreanItem({ ko: item.ko, romanization: item.romanization, gloss })}
                testID={`vocab-results-tile-${item.id}`}
                style={{
                  width: TILE_WIDTH,
                  minHeight: touchTarget.min,
                  alignItems: 'center',
                  gap: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: radii.lg,
                  borderWidth: borderWidth.thin,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.surface.paper,
                }}
              >
                <PictureArt pictureRef={item.visual} gloss={gloss} size={touchTarget.min} decorative />
                <KoreanText ko={item.ko} romanization={item.romanization} romanizationShown={romanizationShown} gloss={gloss} size="sm" />
              </View>
            ))}
          </ScrollView>
          {practice ? (
            <>
              <Spacer size="md" />
              <Button
                label={copy.results.practice}
                tone="primary"
                size="lg"
                fullWidth
                onPress={() => navigation.navigate(ACTIVITY_ROUTES.learn, { topicKey, ids: tiles.map((t) => t.item.id) })}
                testID="vocab-results-practice"
              />
            </>
          ) : null}
        </View>
      ) : null}

      <Spacer size="xl" />
      <View style={{ gap: spacing.sm }}>
        <Button
          label={copy.results.playAgain}
          tone={view.playAgainPrimary || !practice ? 'primary' : 'secondary'}
          size="lg"
          fullWidth
          onPress={() => navigation.replace('VocabSpeedRound', { topicKey, mode: summary.mode })}
          testID="vocab-results-play-again"
        />
        <Button label={copy.results.backToTopic} tone="ghost" size="md" fullWidth onPress={toTopic} testID="vocab-results-back" />
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}
