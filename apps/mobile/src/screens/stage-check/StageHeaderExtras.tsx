import { requiredQuestIds } from '@hangul-route/content-schema';
import { Button, Caption, Icon, colors, spacing, useEffectiveFontScale } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { episodesAll } from '../../content';
import { useMessages } from '../../i18n/use-messages';
import { gridEpisodesOf } from '../../logic/my-route/order';
import { headerActionsBelow, testedOutHint } from '../../logic/reviews/stage-check-offer';
import type { RootStackParamList } from '../../navigation/types';
import { useProgressStore } from '../../store/progress-store';
import type { StageHeaderSlotProps } from './stage-check-entry';
import { useStageOffer } from './use-stage-offer';

/**
 * A Stage 2-7 Journey header's extras (F-CURR-002 row CM-22; design/wireframes/reviews/stage-check.md C, cell-check.md
 * States). `actions`: beside the Complete pill, See your prize (the ceremony again: never shown automatically a second
 * time) and Stage Check, which carries the best stars once one was finished ("Stage Check, best 2 stars"); small ghost
 * buttons of at least 48 dp, as Stage 1's. With large text (`headerActionsBelow`) the same buttons sit in `below`, under
 * the whole header and wrapping, so they never squeeze the title at 320 px. `caption`: under a stage not finished whose
 * every cell is done or tested out, one calm line. Nothing here gates the next stage (OD-1).
 */
export function StageHeaderExtras({ place, profileId, stage, complete }: StageHeaderSlotProps): ReactElement | null {
  const messages = useMessages();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const below = headerActionsBelow(useEffectiveFontScale());
  const { offer } = useStageOffer(profileId, stage);
  const snapshot = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  const hint = useMemo(() => {
    if (place !== 'caption' || !snapshot) return false;
    const done = new Set(snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
    const cells = gridEpisodesOf(episodesAll)
      .filter((e) => e.stage === stage)
      .map((e) => {
        const required = requiredQuestIds(e);
        return { done: required.length > 0 && required.every((q) => done.has(q)), testedOut: snapshot.testedOut?.[e.id] !== undefined };
      });
    return testedOutHint({ complete, cellCheckOn: true, cells });
  }, [place, snapshot, stage, complete]);

  if (place === 'caption') {
    return hint ? (
      <View testID={`journey-stage-hint-${stage}`}>
        <Caption tone="secondary">{messages.learner.testOut.stageHint}</Caption>
      </View>
    ) : null;
  }
  if (!offer.prize || below !== (place === 'below')) return null;
  const best = offer.check?.bestStars ?? 0;
  const buttons = (
    <>
      <Button
        label={messages.learner.journey.stagePrize.cta}
        tone="ghost"
        size="sm"
        onPress={() => navigation.navigate('StageComplete', { stageKey: stage })}
        testID={`journey-stage-prize-${stage}`}
      />
      {offer.check !== null ? (
        <Button
          label={messages.learner.stageCheck.title}
          tone="ghost"
          size="sm"
          onPress={() => navigation.navigate('StageCheck', { stageKey: stage })}
          accessibilityLabel={best > 0 ? messages.a11y.stageCheck.best(best) : messages.learner.stageCheck.title}
          trailing={
            best > 0 ? (
              <View style={{ flexDirection: 'row', gap: spacing.xxs }} aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {Array.from({ length: best }, (_, i) => (
                  <Icon key={i} name="star" size={spacing.md} color={colors.feedback.nudge} />
                ))}
              </View>
            ) : undefined
          }
          testID={`journey-stage-check-${stage}`}
        />
      ) : null}
    </>
  );
  return below ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }} testID={`journey-stage-actions-below-${stage}`}>
      {buttons}
    </View>
  ) : (
    buttons
  );
}
