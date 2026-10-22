import { Body, Button, Heading, Hoya, HoyaBubble, Screen, Spacer, StarRow, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { LinkButton } from '../../components/LinkButton';
import { cardById, questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { guestResultsActions, guestSaveGate } from '../../logic/guest/guest-model';
import { guestSaveCard } from '../../logic/guest/guest-save-cards';
import { guestSaveTarget } from '../../logic/guest/guest-save';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { resultsCheerMessage, resultsHeadline } from '../../logic/results-copy';
import type { GuestStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useActiveLearnerId } from '../../store/active-learner';
import { noteGuestQuestDone } from '../../store/guest-launch';
import { noteGuestSaveEntry } from '../../store/guest-save';
import { useGuestStore } from '../../store/guest-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { CardUnlockBanner } from '../results/CardUnlockBanner';
import { useBackGuard } from '../use-back-guard';
import { openGuestSave } from './guest-exits';

export type GuestResultsProps = NativeStackScreenProps<GuestStackParamList, 'Results'>;

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1 (row GU-3; mock `design/screens/onboarding/guest-save.md` D3): the
 * guest's Results. It keeps the stars, Hoya's line and the newly earned card with **See my card** (the card page,
 * whose Close returns here). It draws no next-quest teaser, Episode page, stage prize, practice, Back to Journey, name
 * row and no Paywall or PinEntry hand-off. Under the card, the save card of row GU-4 (below). Under Hoya's cheer, whenever
 * the cheer invites a replay (every tier but `perfect`, GU-0b D3), the shipped **Try this one again** (quiet, so the
 * save stays the one filled button) restarts quest 1 at step 1 in this stack. The score and the card are written under
 * the guest's id as for any learner (`applyQuestResult`; no profile record, so no welcome card), then `questDone` and
 * `guest.quest_done { stars }`, once per record (a run with every game skipped scores nothing and is not done). Its
 * Back, like every back, replaces it with the Not now card (`GuestLater`), so a back never leaves the stack.
 *
 * [GU] Row GU-4 (sections 8.1 and 8.2, mock D5): once quest 1 is done, the save card by `guestSaveGate` (which reads
 * no grown-up session, CS-G9): Hoya's line as the card's heading (the card kept, or not yet), **Keep my progress**
 * (the one filled button; the verify-only PIN `SaveGuest` when a PIN is stored, else the form), the PIN caption in the
 * `verify` case, and the quiet **Not now**; on a device someone else uses (`owner`) only the ask-the-owner line and
 * **Not now**, filled, with no PIN pad (CS-G10). Not now and every back send `guest.left { at: 'save' }` while the save
 * card is drawn. The first
 * focus stays on the tier word (section 14).
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

  const profiles = useProfileStore((s) => s.profiles);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const rewardCardId = questById(questId)?.rewardCardId;
  const holdsCard = useProgressStore((s) => (learnerId === null ? false : (s.byProfile[learnerId]?.cards.some((c) => c.cardId === rewardCardId) ?? false)));
  const questDone = useGuestStore((s) => s.record?.questDone === true);
  const played = total > 0;
  const saveGate = guestSaveGate({ profiles, parentPinHash });
  const { replay, notNow } = guestResultsActions({ questDone: questDone || played, saveGate, stars, played });
  // The save offer is left (Not now, or any back while the save card is drawn): `guest.left { at: 'save' }`, then the
  // Not now card. A back from a Results with no save card (every game skipped) opens it without the event.
  const toLater = (): void => {
    if (notNow) void track({ name: 'guest.left', payload: { at: 'save' } });
    navigation.replace('GuestLater');
  };
  const keep = (): void => {
    noteGuestSaveEntry('results');
    openGuestSave(navigation, guestSaveTarget({ profiles, parentPinHash }));
  };
  // Every back (the header's Back, the browser's and the phone's) opens the Not now card (section 7.1, GU-0b D4).
  useBackGuard(navigation, () => {
    toLater();
    return true;
  }, true);

  const card = guestSaveCard(saveGate, holdsCard);
  const g = messages.learner.guest.results;
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

      {notNow ? (
        <>
          <Spacer size="lg" />
          {/* Paper with the brand outline: the next thing to do, without a second filled block (mock D5). */}
          <View
            testID="guest-save-card"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface.paper, borderWidth: borderWidth.base, borderColor: colors.brand.primary, borderRadius: radii.lg }}
          >
            <Hoya pose="idle" size={56} accessibilityLabel={messages.a11y.hoya('idle')} />
            <View accessibilityRole="header" testID="guest-save-heading" style={{ flex: 1 }}>
              <Body size="lg" weight="bold">
                {g[card.heading]}
              </Body>
            </View>
          </View>
          <Spacer size="md" />
          {/* Under the card at full width, as Results' action column: one line at Largest in en, es and ko. */}
          {card.keep ? <Button label={g.keep} tone="primary" size="hero" fullWidth onPress={keep} testID="guest-save-keep" /> : null}
          {card.caption ? (
            <>
              <Spacer size="xs" />
              <Body size="sm" tone="secondary" align="center" testID="guest-save-caption">
                {g.askGrownUp}
              </Body>
            </>
          ) : null}
          {card.notNow === 'filled' ? (
            <Button label={g.notNow} tone="primary" size="hero" fullWidth onPress={toLater} testID="guest-save-not-now" />
          ) : (
            <>
              <Spacer size="xs" />
              <LinkButton label={g.notNow} onPress={toLater} testID="guest-save-not-now" />
            </>
          )}
        </>
      ) : null}
      <Spacer size="lg" />
    </Screen>
  );
}
