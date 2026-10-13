import type { HeritageCard } from '@hangul-route/content-schema';
import { Body, Button, Caption, Card, Heading, Hoya, Spacer, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { useMessages } from '../../i18n/use-messages';
import { earnedFaces } from '../../logic/free-end';

/** One earned face in the row (RouteMarkers D9): an image size, `spacing.jumbo`. */
const FACE = spacing.jumbo;
const FACE_GAP = spacing.xs;
/** Hoya beside the title (RouteMarkers "The cards", Results B). */
const HOYA = spacing.jumbo;

/** How many faces fit in one line of `width` dp. */
const facesThatFit = (width: number): number => Math.max(0, Math.floor((width + FACE_GAP) / (FACE + FACE_GAP)));

/**
 * Results at the end of the free lessons, once per profile and device (F-ENT-003 section 3.8;
 * wireframe design/wireframes/results/back-to-plan-and-free-end.md B; mock
 * design/components/RouteMarkers/spec.md "The cards", D8, D9): a paper card with Hoya cheering
 * beside "You finished your first lessons!" and one line of the cards earned in the free lessons
 * (as many as fit, at most six, then "and N more in your Library"); then Back home, Practice words
 * and the ask. Replaces the teaser card and its buttons. The run that finishes Stage 1 is also the
 * run that reaches the free end (all of Stage 1 is free): See your Stage 1 prize (F-QUEST-002
 * section 3.8) then stays, as the one primary, and Back home steps down to secondary.
 */
export function ResultsFreeEndCelebration({
  cards,
  practiceLabel,
  onPractice,
  onHome,
  askLabel,
  onAsk,
  stagePrize = null,
}: {
  /** The cards earned from the free lessons, newest first. */
  cards: readonly HeritageCard[];
  /** "Practice words" or "Read a story"; null when this build offers neither. */
  practiceLabel: string | null;
  onPractice: () => void;
  onHome: () => void;
  askLabel: string;
  onAsk: () => void;
  /** See your Stage 1 prize, when this run completed Stage 1; null otherwise. */
  stagePrize?: StagePrizeAction | null;
}): React.ReactElement {
  const m = useMessages();
  const access = m.learner.access;
  const [fit, setFit] = useState<number | null>(null);
  const onRowLayout = (e: LayoutChangeEvent): void => {
    const next = facesThatFit(e.nativeEvent.layout.width);
    setFit((prev) => (prev === next ? prev : next));
  };
  const row = earnedFaces(
    cards.map((c) => c.id),
    fit ?? 0,
  );
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <>
      <View testID="results-free-end-card">
        <Card padding="md" tone="paper">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Hoya pose="cheering" size={HOYA} accessibilityLabel={m.a11y.hoya('cheering')} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading level="prompt">{access.freeEnd.title}</Heading>
            </View>
          </View>
          {cards.length > 0 ? (
            <>
              <Spacer size="md" />
              {/* One image group read as the count of cards; the faces are decoration. */}
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={m.learner.library.collected.line(cards.length)}
                onLayout={onRowLayout}
                style={{ flexDirection: 'row', gap: FACE_GAP, minHeight: FACE }}
                testID="results-free-end-row"
              >
                {row.shown.map((id) => {
                  const card = byId.get(id);
                  return card ? (
                    <View
                      key={id}
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                      style={{
                        width: FACE,
                        height: FACE,
                        borderRadius: radii.md,
                        borderWidth: borderWidth.base,
                        borderColor: colors.rarity[card.rarity],
                        overflow: 'hidden',
                      }}
                    >
                      <CardArt card={card} size={FACE - 2 * borderWidth.base} />
                    </View>
                  ) : null;
                })}
              </View>
              {fit !== null && row.more > 0 ? (
                <>
                  <Spacer size="xs" />
                  <Caption tone="secondary">{m.learner.results.extraCards.more(row.more)}</Caption>
                </>
              ) : null}
            </>
          ) : null}
        </Card>
      </View>
      <Spacer size="xl" />
      <StagePrizeButton stagePrize={stagePrize} />
      <Button
        label={access.home.cta}
        tone={stagePrize ? 'secondary' : 'primary'}
        size={stagePrize ? 'md' : 'hero'}
        fullWidth
        onPress={onHome}
        testID="results-free-end-home"
      />
      {practiceLabel ? (
        <>
          <Spacer size="sm" />
          <Button label={practiceLabel} tone="secondary" size="md" fullWidth onPress={onPractice} testID="results-free-end-practice" />
        </>
      ) : null}
      <Spacer size="sm" />
      <Button label={askLabel} tone="ghost" size="md" fullWidth onPress={onAsk} testID="results-free-end-ask" />
    </>
  );
}

/**
 * Results at the end of the free lessons once the celebration was seen (section 3.8, wireframe C):
 * no teaser card, the line "You played every quest that is open for you.", then Practice words,
 * Back home and the episode page. No ask.
 */
export function ResultsOpenForYou({
  practiceLabel,
  onPractice,
  onHome,
  episodeLabel,
  onEpisode,
  stagePrize = null,
}: {
  practiceLabel: string | null;
  onPractice: () => void;
  onHome: () => void;
  /** The episode page button's label; null when the quest has no episode page. */
  episodeLabel: string | null;
  onEpisode: () => void;
  /** See your Stage 1 prize, when this run completed Stage 1; null otherwise (then it is the one primary). */
  stagePrize?: StagePrizeAction | null;
}): React.ReactElement {
  const m = useMessages();
  // One primary: the Stage 1 prize when this run earned it, else Practice words, else Back home.
  const homePrimary = !practiceLabel && !stagePrize;
  return (
    <View testID="results-open-for-you">
      <Body weight="semibold">{m.learner.access.openForYou}</Body>
      <Spacer size="xl" />
      <StagePrizeButton stagePrize={stagePrize} />
      {practiceLabel ? (
        <>
          <Button
            label={practiceLabel}
            tone={stagePrize ? 'secondary' : 'primary'}
            size={stagePrize ? 'md' : 'hero'}
            fullWidth
            onPress={onPractice}
            testID="results-open-for-you-practice"
          />
          <Spacer size="sm" />
        </>
      ) : null}
      <Button
        label={m.learner.access.home.cta}
        tone={homePrimary ? 'primary' : 'ghost'}
        size={homePrimary ? 'hero' : 'md'}
        fullWidth
        onPress={onHome}
      />
      {episodeLabel ? (
        <>
          <Spacer size="sm" />
          <Button label={episodeLabel} tone="ghost" size="md" fullWidth onPress={onEpisode} />
        </>
      ) : null}
    </View>
  );
}

/** See your Stage 1 prize on a free-end Results (F-QUEST-002 section 3.8): the Results stage-prize button. */
export interface StagePrizeAction {
  label: string;
  onPress: () => void;
}

function StagePrizeButton({ stagePrize }: { stagePrize: StagePrizeAction | null }): React.ReactElement | null {
  if (!stagePrize) return null;
  return (
    <>
      <Button label={stagePrize.label} tone="primary" size="hero" fullWidth onPress={stagePrize.onPress} testID="results-stage-prize" />
      <Spacer size="sm" />
    </>
  );
}
