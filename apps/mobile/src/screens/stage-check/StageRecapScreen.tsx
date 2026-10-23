import type { HeritageCard, StageKey } from '@hangul-route/content-schema';
import { Body, Button, Heading, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { episodesAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { recapStages } from '../../logic/reviews/stage-ceremony';
import { shownStageCards, stageCardOpenedEvent } from '../../logic/reviews/stage-check-offer';
import { stageNumber, stagePrizeCards } from '../../logic/stage1/stage-complete';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { latchStageCeremony, markStageRecapShown, useStageCeremonyOn } from './stage-check-entry';
import { StageCards } from './StageCards';

/**
 * The one retroactive summary (F-CURR-002 section 4.8 step 7, row CM-22; design/wireframes/reviews/stage-check.md G):
 * one screen, never one modal per stage. Home opens it once when some finished Stage 2-7 has no `stageCeremonyAt` key
 * (finished before this build, or on a device still on an older one). It lists those stages and the stage cards that
 * exist then (row CM-23's; none before it ships, or with `upperCards` off), and latches every stage it lists as soon as
 * it shows, so no stage is summed up twice on this or any other device, or after a restore. No ceremony per stage.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'StageRecap'>;

export function StageRecapScreen({ navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner;
  const locale = useLocale();
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const on = useStageCeremonyOn(profileId);
  const upperCards = useCurrFlag('upperCards');
  const snapshot = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  // The stages are read once, when the summary opens: its own latch must not empty the list it shows.
  const [stages] = useState<StageKey[]>(() => (snapshot && on ? recapStages(snapshot, episodesAll) : []));
  const owned = snapshot?.cards;
  const cards = useMemo<HeritageCard[]>(
    () => stages.flatMap((stage) => shownStageCards(stagePrizeCards(stage), owned ?? [], upperCards)).map((c) => localizeCard(c, locale)),
    [stages, owned, upperCards, locale],
  );

  useEffect(() => {
    if (profileId === null) return;
    markStageRecapShown(profileId);
    if (stages.length > 0) latchStageCeremony(profileId, stages);
  }, [profileId, stages]);

  const goHome = (): void => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  const seeCards = (): void => navigation.navigate('Main', { screen: 'Library', params: { section: 'cards' } });

  if (stages.length === 0) {
    // Nothing to sum up (a stale route): straight home.
    return (
      <Screen tone="canvas" scrollable testID="stage-recap-empty">
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
          <Hoya pose="waving" size={120} accessibilityLabel={messages.a11y.hoya('waving')} />
        </View>
        <Spacer size="xl" />
        <Button label={m.stageComplete.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable testID="stage-recap">
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md }}>
        <Hoya pose="cheering" size={140} accessibilityLabel={messages.a11y.hoya('cheering')} />
        <Heading level="display" align="center" testID="stage-recap-title">
          {m.stageCheck.retro.title(stages.map(stageNumber))}
        </Heading>
        <Body align="center">{cards.length > 0 ? m.stageCheck.retro.body : m.stageCheck.retro.bodyNoCards}</Body>
      </View>
      {cards.length > 0 ? (
        <>
          <Spacer size="lg" />
          <StageCards
            cards={cards}
            testID="stage-recap-cards"
            onOpen={(card) => {
              const stage = stages.find((s) => card.unlockedBy === `${s}-complete`);
              const event = profileId !== null && stage !== undefined ? stageCardOpenedEvent(profileId, stage) : null;
              if (event) void track(event);
              navigation.navigate('CardDetail', { cardId: card.id });
            }}
          />
        </>
      ) : null}
      <Spacer size="xl" />
      <View style={{ gap: spacing.sm }}>
        <Button label={m.stageComplete.seeCards.cta} tone="primary" size="hero" fullWidth onPress={seeCards} testID="stage-recap-cards-cta" />
        <Button label={m.stageComplete.backHome.cta} tone="ghost" size="md" fullWidth onPress={goHome} testID="stage-recap-home" />
      </View>
      <Spacer size="lg" />
    </Screen>
  );
}
