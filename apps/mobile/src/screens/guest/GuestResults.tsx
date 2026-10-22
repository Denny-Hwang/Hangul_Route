import { Heading, Hoya, HoyaBubble, Screen, Spacer, StarRow, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { LinkButton } from '../../components/LinkButton';
import { cardById, questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { guestResultsActions } from '../../logic/guest/guest-model';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { resultsCheerMessage, resultsHeadline } from '../../logic/results-copy';
import type { GuestStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import { useActiveLearnerId } from '../../store/active-learner';
import { noteGuestQuestDone } from '../../store/guest-launch';
import { useGuestStore } from '../../store/guest-store';
import { useProgressStore } from '../../store/progress-store';
import { CardUnlockBanner } from '../results/CardUnlockBanner';
import { useBackGuard } from '../use-back-guard';

export type GuestResultsProps = NativeStackScreenProps<GuestStackParamList, 'Results'>;

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1 (row GU-3; mock `design/screens/onboarding/guest-save.md` D3): the
 * guest's Results. It keeps the stars, Hoya's line and the newly earned card with **See my card** (the card page,
 * whose Close returns here). It draws no next-quest teaser, Episode page, stage prize, practice, Back to Journey, name
 * row and no Paywall or PinEntry hand-off; row GU-4 adds the save card under the card. Under Hoya's cheer, whenever
 * the cheer invites a replay (every tier but `perfect`, GU-0b D3), the shipped **Try this one again** (quiet, so the
 * save stays the one filled button) restarts quest 1 at step 1 in this stack. The score and the card are written under
 * the guest's id as for any learner (`applyQuestResult`; no profile record, so no welcome card), then `questDone` and
 * `guest.quest_done { stars }`, once per record (a run with every game skipped scores nothing and is not done). Its
 * Back, like every back, replaces it with the Not now card (`GuestLater`), so a back never leaves the stack.
 */
export function GuestResults({ route, navigation }: GuestResultsProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.results;
  const locale = useLocale();
  const { questId, episodeId, stars, correct, total, retries = 0 } = route.params;
  const learnerId = useActiveLearnerId();
  const startedAt = useGuestStore((s) => s.record?.startedAt);
  const reducedMotion = useReducedMotion();
  const recordQuestComplete = useProgressStore((s) => s.recordQuestComplete);
  const unlockCards = useProgressStore((s) => s.unlockCards);
  const recordCatchUp = useProgressStore((s) => s.recordCatchUp);
  const [outcome, setOutcome] = useState<QuestResultOutcome | null>(null);
  const recorded = useRef(false);

  useEffect(() => {
    const quest = questById(questId);
    if (learnerId === null || quest === undefined || recorded.current) return;
    recorded.current = true;
    const earned = applyQuestResult(
      {
        profileId: learnerId,
        profileCreatedAt: startedAt ?? new Date().toISOString(),
        questId,
        episodeId,
        rewardCardId: quest.rewardCardId,
        stars,
        correct,
        total,
        retries,
      },
      {
        isHydrated: (id) => useProgressStore.getState().hydratedFor.has(id),
        snapshot: (id) => useProgressStore.getState().byProfile[id],
        recordQuestComplete,
        unlockCards,
        recordCatchUp,
        track,
      },
    );
    setOutcome(earned);
    if (total > 0) noteGuestQuestDone(stars);
  }, [learnerId, startedAt, questId, episodeId, stars, correct, total, retries, recordQuestComplete, unlockCards, recordCatchUp]);

  const toLater = (): void => navigation.replace('GuestLater');
  // Every back (the header's Back, the browser's and the phone's) opens the Not now card (section 7.1, GU-0b D4).
  useBackGuard(navigation, () => {
    toLater();
    return true;
  }, true);

  const played = total > 0;
  const { replay } = guestResultsActions({ questDone: played, saveGate: 'open', stars, played });
  const award = outcome?.award ?? null;
  const source = award?.isNew ? cardById(award.cardId) : undefined;
  const newCard = source && localizeCard(source, locale);
  useEffect(() => {
    if (!newCard || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(m.newCard.announce(newCard.titleEn));
  }, [newCard, m]);

  return (
    <Screen tone="canvas" scrollable header={{ leading: { kind: 'back', onPress: toLater } }}>
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
        <Hoya pose={stars >= 2 ? 'cheering' : 'thinking'} size={140} accessibilityLabel={messages.a11y.hoya(stars >= 2 ? 'cheering' : 'thinking')} />
        <Spacer size="lg" />
        <Heading level="display">{resultsHeadline(stars, played, m.headline)}</Heading>
        <Spacer size="sm" />
        <StarRow stars={stars} size={48} accessibilityLabel={messages.a11y.stars(stars)} />
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone={stars >= 2 ? 'cheering' : 'thinking'} message={resultsCheerMessage(stars, played, m.cheer)} />
      {replay ? (
        <>
          <Spacer size="sm" />
          <LinkButton label={m.nextUp.again.cta} onPress={() => navigation.replace('QuestPlayer', { questId, episodeId })} testID="guest-results-again" />
        </>
      ) : null}

      {/* Always mounted so assistive tech is watching it when the card appears. */}
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="guest-results-card">
        {newCard ? (
          <>
            <Spacer size="lg" />
            <CardUnlockBanner
              m={m}
              card={newCard}
              showSparkles={stars >= 3}
              reducedMotion={reducedMotion}
              onSeeCard={() => navigation.navigate('CardDetail', { cardId: newCard.id })}
            />
          </>
        ) : null}
      </View>
      <Spacer size="lg" />
    </Screen>
  );
}
