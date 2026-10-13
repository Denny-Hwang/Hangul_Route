import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  StarRow,
  StoryScene,
  TAB_SCREEN_EDGES,
  colors,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { InstallGuideSheet } from '../../components/InstallGuideSheet';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import type { SceneArt } from '@hangul-route/content-schema';
import { welcomeCardIds } from '../../content/award-world';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { episodesAll, questsAll } from '../../content';
import { PLACEMENT_BANK } from '../../content/placement.generated';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { catchUpCard, takeCatchUpAnnouncement } from '../../logic/awards/catch-up';
import { localizeMissionCard } from '../../logic/content-locale';
import { cursorContext } from '../../logic/cursor-context';
import {
  buildTodaysMission,
  missionCardText,
  dayKey,
  planHomeStoryOpen,
  storyCardShownEvent,
  type MissionCard,
} from '../../logic/homework/mission-builder';
import { dueTodayCount, showsTodayCount } from '../../logic/homework/assignment-groups';
import { homeCardLock } from '../../logic/homework/home-card-access';
import { mergeAssignments } from '../../logic/homework/assignment-merger';
import { gridQuestProgress } from '../../logic/journey';
import { homeColumns } from '../../logic/layout/home-columns';
import { homeStripView, type HomeStripView } from '../../logic/my-route/home-strip';
import { buildMyRoute } from '../../logic/my-route/model';
import { localizedRouteContent, routeModelInput, routeWeekOf } from '../../logic/my-route/route-input';
import { emptySnapshot } from '../../logic/my-route/view';
import { placementEntriesOn, questsDoneOf } from '../../logic/placement/entry';
import { skippedEvent } from '../../logic/placement/events';
import { homeQuietCard, levelCheckCard } from '../../logic/placement/home-card';
import { DEFAULT_AVATAR } from '../../logic/profiles/avatar-catalog';
import { askFor, askGate, helpAskedEvent, isClassOnly } from '../../logic/access-copy';
import { favoriteReplay, freeEndPrimary, practiceTarget } from '../../logic/free-end';
import { nextStartedEvent, qualifiesForNext, routeNext, routeNextInputOf } from '../../logic/route-next';
import { streakSessionDates } from '../../logic/sessions/session-log';
import { computeStreak } from '../../logic/streak';
import { emptyBookmarks } from '../../logic/story/bookmarks';
import { storyCoverArt } from '../../logic/story/scene-view';
import { defaultStoryIndex, entryForQuest } from '../../logic/story/story-index';
import { storyFitsForSnapshot } from '../../logic/story/story-fit';
import { storyLockFor } from '../../logic/story/story-pick';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { markFreeEndSeen, readFreeEndSeen } from '../../store/free-end-seen';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { useMembershipStore } from '../../store/membership-store';
import { usePlacementRunStore } from '../../store/placement-run-store';
import { usePlanStore } from '../../store/plan-store';
import { pinMission, pinnedMission } from '../../store/mission-pin-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { useAccessTier, useQuestAccess } from '../../store/tier-store';
import { PictureArt } from '../minigames/PictureArt';
import { LinkButton } from '../placement/parts';
import { NotesHomeCard } from '../notes/NotesHomeCard';
import { PlanSlotCard, usePlanSlot } from '../route/PlanPromptCard';
import { firstFreeTopicKey } from '../vocab/topic-data';
import { FreeEndCard } from './FreeEndCard';
import { freeTopicsInBuild, samplerStoryOf } from './free-end-inputs';
import { RouteStrip } from './RouteStrip';

/** Avatar circle in the Profile entry; with its label the button clears the 64pt floor. */
const AVATAR_SIZE = 52;
/** Hoya beside the greeting at scale 1 (phones); x1.2 on regular, x1.4 on wide (F-LAYOUT-001 §3.6). */
const HOYA_SIZE = 72;
/** Two columns: missions left (flex 3), progress / homework / tip right (flex 2), wireframe layout/wide B. */
const MISSIONS_FLEX = 3;
const SIDE_FLEX = 2;

const ICON_FOR: Record<MissionCard['kind'], 'replay' | 'play' | 'library' | 'star' | 'journey'> = {
  replay: 'replay',
  new: 'play',
  story: 'library',
  'daily-test': 'star',
  explore: 'journey',
  // F-ENT-003 E3-7: the free-end card draws its own card; a practice card leads with its replay icon (or the topic or story cover).
  'free-end': 'star',
  practice: 'replay',
};
/** The story card's cover thumbnail (F-STORY-004 §3.7), drawn where the icon sits. */
const COVER_THUMB = 48;
const NO_BOOKMARKS = emptyBookmarks();
/**
 * `home.story_card.shown` goes once per profile, day and app session (`<profileId>|<date>`), when the plan is
 * first pinned — the plan itself is pinned per session too (F-STORY-004 §3.7, §3.11).
 */
const storyCardShownSent = new Set<string>();
/** Catch-up lines already announced this app session (`<profileId>|<line>`), so a tab switch never repeats one (F-STORY-006 §3.10). */
const catchUpAnnounced = new Set<string>();

/**
 * One of the three Today's mission cards (F-HW-001 §3.1).
 * A collected card keeps its slot and switches tone — it never disappears and
 * the cards below it never move up (§3.2).
 */
function MissionTile({
  card,
  cover,
  picture,
  onPress,
}: {
  card: MissionCard;
  /** A story card's cover art; null or absent keeps the icon. */
  cover?: SceneArt | null;
  /** A practice card's word topic cover (F-ENT-003 E3-7); absent keeps the icon. */
  picture?: { pictureRef: string | undefined } | null;
  onPress: () => void;
}): React.ReactElement {
  const m = useMessages();
  const locale = useLocale();
  const { title, subtitle } = missionCardText(localizeMissionCard(card, locale), m.learner);
  return (
    <Card
      padding="md"
      tone={card.collected ? 'success' : 'paper'}
      onPress={onPress}
      accessibilityLabel={m.a11y.missionCard(title, subtitle, card.collected)}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget.hero,
        }}
      >
        {/* One leading slot for the icon or the cover, so every card's title starts at the same x. */}
        <View style={{ width: COVER_THUMB, alignItems: 'center' }}>
          {cover ? (
            <StoryScene art={cover} variant="thumb" width={COVER_THUMB} decorative testID={`home-mission-cover-${card.slot}`} />
          ) : picture ? (
            <PictureArt pictureRef={picture.pictureRef} gloss={title} size={COVER_THUMB} decorative />
          ) : (
            <Icon name={ICON_FOR[card.kind]} size={32} color={colors.text.secondary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Body weight="semibold" size="lg">
            {title}
          </Body>
          <Caption tone="muted">{subtitle}</Caption>
        </View>
        {card.collected ? <Icon name="sparkle" size={28} color={colors.brand.primary} /> : null}
      </View>
    </Card>
  );
}

/**
 * The one-time catch-up card (F-STORY-006 §3.5, wireframe `home/cards-catch-up.md` E): cards the
 * learner had already earned, found by the reconcile at start. Hoya cheers (static: the pose never
 * changes while it shows), one line says how many cards, and one button opens the Library. No
 * timer and no counter of what is left; it lives for this app session only.
 */
function CatchUpCard({
  count,
  hoyaSize,
  onSeeCards,
}: {
  count: number;
  hoyaSize: number;
  onSeeCards: () => void;
}): React.ReactElement {
  const m = useMessages();
  return (
    <View testID="home-catch-up">
      <Card padding="md" tone="brand">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Hoya pose="cheering" size={hoyaSize} accessibilityLabel={m.a11y.hoya('cheering')} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body weight="semibold" size="lg">
              {m.learner.home.catchUp.line(count)}
            </Body>
          </View>
        </View>
        <Spacer size="md" />
        <Button label={m.learner.home.catchUp.cta} tone="primary" size="lg" fullWidth onPress={onSeeCards} />
      </Card>
    </View>
  );
}

export function HomeScreen(): React.ReactElement {
  const m = useMessages();
  const locale = useLocale();
  const { copy, audience } = useAudience();
  const profile = useProfileStore(activeProfileSelector);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ensure = useProgressStore((s) => s.ensure);
  const markCardsSeen = useProgressStore((s) => s.markCardsSeen);
  // Session-only (F-STORY-006 §3.5): the cards a reconcile added this app session.
  const catchUpListed = useProgressStore((s) => (profile ? s.catchUp[profile.id] : undefined));
  const catchUpFound = useProgressStore((s) => (profile ? s.catchUpFound[profile.id] : undefined));
  // The number is the cards found this session; cards opened in the Library never count it down (D3).
  const catchUp = useMemo(() => catchUpCard(catchUpListed, welcomeCardIds, catchUpFound), [catchUpListed, catchUpFound]);
  const catchUpLine = catchUp ? m.learner.home.catchUp.line(catchUp.count) : null;
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // The access tier (F-ENT-003 section 3.4): re-renders Home when the inbox, the spaces or the
  // subscription change it, as Results does, so the cursor follows OD-4 on both (F-ROUTE-001 R-4a).
  const tier = useAccessTier(profile?.id ?? '');
  // May the active learner start a quest (F-ENT-003 section 3.6): every card is chosen among open quests.
  const questOpen = useQuestAccess();
  // The learner's cached inbox plans: card (2) follows the one next (F-ENT-003 section 3.5).
  const plans = usePlanStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const bookmarks = useStoryStore((s) => (profile ? s.byProfile[profile.id] : undefined)) ?? NO_BOOKMARKS;
  // Reviewed stories only (D14): empty in production while every bundled story is still a draft.
  const storyIndex = defaultStoryIndex();

  useEffect(() => {
    if (profile) ensure(profile.id);
  }, [profile, ensure]);

  const stars3 = (snap?.quests.filter((q) => q.stars === 3).length ?? 0);
  // Both sides count grid quests only: a shelf story is not a Journey quest (F-STORY-004 §3.10).
  const { completed, total: totalStage1Quests } = gridQuestProgress(episodesAll, questsAll, snap?.quests ?? []);
  const cardsUnlocked = snap?.cards.length ?? 0;
  // Today's count only, the same number as the Homework list's Today group (F-PLAN-002 section 3.6).
  const homeworkDue = dueTodayCount(snap?.homework, dayKey(new Date().toISOString()));

  const recentStars = (snap?.quests.slice(-1)[0]?.stars ?? 0) as 0 | 1 | 2 | 3;

  const streak = useMemo(() => {
    // Quest sessions only: story, game and level-check time never moves the streak (F-REPORT-001 OD-19).
    return computeStreak(streakSessionDates(snap?.sessions ?? []));
  }, [snap]);

  // The end of the free lessons (F-ENT-003 section 3.7): whether this device already celebrated it for
  // the learner, read each time Home comes into focus (Results may have just shown it). Null while read.
  const [freeEndSeen, setFreeEndSeen] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!profile) return undefined;
      let alive = true;
      void readFreeEndSeen(profile.id).then((seen) => {
        if (alive) setFreeEndSeen(seen);
      });
      return () => {
        alive = false;
      };
    }, [profile]),
  );
  const freeTopics = useMemo(() => freeTopicsInBuild(), []);
  const samplerStory = useMemo(() => samplerStoryOf(storyIndex), [storyIndex]);
  // Story locks (F-STORY-004 §3.7): the story card is never picked locked, and a tap checks again (PR 4.8e).
  const isStoryLocked = useMemo(
    () => storyLockFor({ tier, gatingEnabled: gatingActive(flags, bundleOs()), episodes: episodesAll, isQuestOpen: questOpen }),
    [tier, questOpen],
  );

  // Today's mission: the plan is pinned for the day so finishing one card never reshuffles the other
  // two under the learner (F-HW-001 §3.2). The pin lives in a session store keyed by profile and day,
  // not in this screen, so Results' Back home (which mounts Home again) keeps it (F-STORY-004 PR 4.8c).
  // The one next (F-ENT-003 section 3.5): due today, then the leading plan source, then the default route.
  const routeInput = useMemo(
    () =>
      profile && snap
        ? routeNextInputOf({
            snapshot: snap,
            profileId: profile.id,
            today: dayKey(new Date().toISOString()),
            plans,
            quests: questsAll,
            episodes: episodesAll,
            tier,
            gatingActive: gatingActive(flags, bundleOs()),
            isQuestOpen: questOpen,
          })
        : null,
    [profile, snap, plans, tier, questOpen],
  );
  const next = useMemo(() => (routeInput ? routeNext(routeInput) : null), [routeInput]);
  const mission = useMemo(() => {
    if (!profile || !snap || !routeInput) return null;
    const today = routeInput.today;
    const built = buildTodaysMission({
      profileId: profile.id,
      snapshot: snap,
      quests: questsAll,
      episodes: episodesAll,
      today,
      pinned: pinnedMission(profile.id, today),
      // The same stages and placed-out quests as Results and My route (F-ROUTE-001 R-4a).
      ...cursorContext({
        tier,
        placements: snap.placements,
        quests: questsAll,
        episodes: episodesAll,
        isQuestOpen: questOpen,
      }),
      // Card (2) is the one next; "Next in your plan" when it comes from a plan.
      route: routeInput,
      // At the end of the free lessons: the celebration once, then the practice card (an unread key reads as seen).
      freeEnd: {
        seen: freeEndSeen !== false,
        practice: practiceTarget({ snapshot: snap, today, quests: questsAll, episodes: episodesAll, freeTopics, samplerStory }),
      },
      // The story card (F-STORY-004 §3.7): never a locked story; nothing is locked while gating is off.
      stories: {
        entries: storyIndex,
        bookmarks,
        isLocked: isStoryLocked,
        // F-STORY-005 §3.4: stories near the learner's stage come first; it only orders, never hides.
        fits: storyFitsForSnapshot(snap),
      },
    });
    // A caregiver or class assignment for today takes card ② (F-HW-001 §3.4, F-PLAN-001 §3.4).
    const merged = mergeAssignments({
      plan: built,
      assignments: snap.homework,
      today,
      enabled: true,
      titleOf: (questId) => questsAll.find((q) => q.id === questId)?.titleEn,
      // Only an assignment `routeNext` step 1 would pick takes the card: known, playable, open, not done (section 3.5).
      isQuestOpen: qualifiesForNext(routeInput),
    }).plan;
    pinMission(merged);
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, snap, tier, questOpen, routeInput, bookmarks, storyIndex, freeEndSeen, freeTopics, samplerStory, isStoryLocked]);

  // The route strip (F-ROUTE-001 R-4b, OD-3): built from `routeModelInput`, the same input as the
  // Learning Route page, so the strip and the page always name the same stage and pips.
  // Localized only when the flag is on, so Home does no extra work with the flag off.
  const routeContent = useMemo(() => (flags.myRouteEnabled ? localizedRouteContent(locale) : null), [locale]);
  const routeStrip = useMemo((): HomeStripView | null => {
    if (!routeContent || !profile) return null;
    try {
      const snapshot = snap ?? emptySnapshot(profile.id);
      // The same F-ENT-003 input as card (2), so the strip's goal is the Learning Route's (LR-5a).
      const model = buildMyRoute(routeModelInput({ snapshot, tier, localized: routeContent, now: new Date(), ...(routeInput ? { next: routeInput } : {}) }));
      // The same week as the Learning Route's plan line (R-7b): the goal's plan, the class's or the learner's own.
      return homeStripView({ model, messages: m, goalStage: model.goal?.stage ?? null, week: routeWeekOf(model, routeInput ?? undefined) });
    } catch {
      // Content that cannot be read leaves the slot empty; the page itself shows the retry.
      return null;
    }
  }, [profile, snap, tier, routeContent, routeInput, m]);

  // Native screen readers hear the catch-up line once (F-STORY-006 §3.10): the card is usually on
  // the first render, where a live region says nothing, and iOS has no live regions. The web reads
  // it in order under the greeting, and from the polite region below when a sync adds it later.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const line = takeCatchUpAnnouncement(catchUpAnnounced, profile?.id, catchUpLine);
    if (line !== null) AccessibilityInfo.announceForAccessibility(line);
  }, [profile?.id, catchUpLine]);

  useEffect(() => {
    if (!mission) return;
    const event = storyCardShownEvent(mission);
    const key = `${mission.profileId}|${mission.date}`;
    if (!event || storyCardShownSent.has(key)) return;
    storyCardShownSent.add(key);
    void track({ name: event.name, profileId: mission.profileId, payload: event.payload });
  }, [mission]);

  // Showing the celebration marks it for this profile and device and sends access.free_end_reached once (section 3.12).
  const freeEndShown = mission?.cards.find((c) => c.kind === 'free-end');
  useEffect(() => {
    if (freeEndShown && profile) void markFreeEndSeen(profile.id, freeEndShown.placedOut === true);
  }, [freeEndShown, profile]);
  const memberships = useMembershipStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const ask = askFor(audience, isClassOnly(memberships ?? []), m.learner.access);
  const onAsk = (): void => {
    void track(helpAskedEvent(profile?.id, 'home', ask.audience));
    const gate = askGate(gateOpensDirectlyNow(), 'home');
    if (gate.route === 'Paywall') navigation.navigate('Paywall', gate.params);
    else navigation.navigate('PinEntry', gate.params);
  };
  const primary = freeEndPrimary(firstFreeTopicKey(), samplerStory);
  const onFreeEndPrimary = (): void => {
    if (primary?.kind === 'topic') navigation.navigate('VocabTopic', { topicKey: primary.topicKey });
    else if (primary?.kind === 'story') navigation.navigate('QuestPlayer', { questId: primary.questId, episodeId: primary.episodeId });
  };
  const onFavoriteReplay = (): void => {
    const quest = snap ? favoriteReplay(snap, questsAll, episodesAll) : null;
    const episode = quest ? episodesAll.find((e) => e.questIds.includes(quest.id)) : undefined;
    if (quest && episode) navigation.navigate('QuestPlayer', { questId: quest.id, episodeId: episode.id });
  };

  // A story card opens through the one story-open plan (F-STORY-004 §3.2): the quest player, or the
  // unscored reader for "Read it again"; "Keep reading" resumes at the bookmark (PR 4.4b).
  const openStory = (card: MissionCard): boolean => {
    const plan = planHomeStoryOpen({ card, entries: storyIndex, snapshot: snap, bookmarks });
    if (!plan) return false;
    void track({ name: plan.event.name, profileId: profile?.id, payload: plan.event.payload });
    if (plan.route === 'StoryReader') navigation.navigate('StoryReader', plan.params);
    else navigation.navigate('QuestPlayer', plan.params);
    return true;
  };

  // A pinned card whose quest closed, or whose story locked, after the pin takes the locked path, as a
  // locked Library tile does (F-STORY-004 PR 4.8e); nothing is closed while gating is off.
  const openLocked = (card: MissionCard): boolean => {
    const lock = homeCardLock({ card, entries: storyIndex, isQuestOpen: questOpen, isStoryLocked, opensDirectly: gateOpensDirectlyNow() });
    if (!lock) return false;
    if (lock.storyId) void track({ name: 'story.locked.tapped', profileId: profile?.id, payload: { storyId: lock.storyId } });
    if (lock.gate.route === 'Paywall') navigation.navigate('Paywall', lock.gate.params);
    else navigation.navigate('PinEntry', lock.gate.params);
    return true;
  };

  const openCard = (card: MissionCard): void => {
    if (openLocked(card)) return;
    if (card.kind === 'story' && openStory(card)) return;
    // A practice card of a word topic opens the topic page (F-ENT-003 section 3.7).
    if (card.kind === 'practice' && card.topicKey) {
      navigation.navigate('VocabTopic', { topicKey: card.topicKey });
      return;
    }
    // Card (2) naming the one next starts it from Home (F-ENT-003 section 3.12); a day-pinned older pick does not.
    if (profile && card.slot === 2 && next?.kind === 'quest' && card.questId === next.questId) {
      void track(nextStartedEvent(profile.id, next.source, 'home'));
    }
    if (card.questId && card.episodeId) {
      navigation.navigate('QuestPlayer', { questId: card.questId, episodeId: card.episodeId });
    } else if (card.episodeId) {
      navigation.navigate('EpisodeDetail', { episodeId: card.episodeId, from: 'home' });
    }
  };

  // The level check card (F-PLC-001 section 3.10): at most one quiet card below the mission cards.
  const profileId = profile?.id ?? null;
  const entriesOn = placementEntriesOn(flags.placementEnabled);
  const placementUi = usePlacementRunStore((s) => (profileId === null ? undefined : s.ui[profileId]));
  const [resumable, setResumable] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!entriesOn || profileId === null) return undefined;
      let alive = true;
      const store = usePlacementRunStore.getState();
      void store.loadUi(profileId);
      void store.peekResumable(profileId, Date.now(), PLACEMENT_BANK.version).then((kind) => {
        if (alive) setResumable(kind !== null);
      });
      return () => {
        alive = false;
      };
    }, [entriesOn, profileId]),
  );
  const levelCheck =
    placementUi === undefined
      ? null
      : levelCheckCard({
          enabled: flags.placementEnabled,
          bankReady: entriesOn,
          hasResult: (snap?.placements?.length ?? 0) > 0,
          questsDone: questsDoneOf(snap?.quests),
          dismissedAt: placementUi.dismissedAt,
          resumable,
        });
  // F-PLAN-002's weekly plan card (prompt, check-in or moved line) shares the slot; the level check wins while it is eligible (AM-6).
  const { slot: planSlot, closeCheckIn } = usePlanSlot(profile, snap, plans);
  const quiet = homeQuietCard(levelCheck, planSlot !== null);
  const levelCheckCopy = m.learner.placement.homeCard;
  const quietCard =
    quiet === 'level-check' && profileId !== null ? (
      <Card padding="md" tone="sunken" testID="home-level-check">
        <Body weight="semibold">{levelCheckCopy.line}</Body>
        <Spacer size="sm" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Button
            label={levelCheck === 'continue' ? levelCheckCopy.continue : levelCheckCopy.take}
            tone="ghost"
            size="md"
            onPress={() => navigation.navigate('Placement', { source: 'home' })}
            testID="home-level-check-open"
          />
          <LinkButton
            label={levelCheckCopy.notNow}
            onPress={() => {
              void usePlacementRunStore.getState().markDismissed(profileId, new Date().toISOString());
              void track(skippedEvent(profileId, 'home'));
            }}
            testID="home-level-check-not-now"
          />
        </View>
      </Card>
    ) : quiet === 'plan-prompt' && profileId !== null && planSlot !== null ? (
      <PlanSlotCard
        slot={planSlot}
        profileId={profileId}
        onOpen={() => navigation.navigate('RouteProposal', { source: 'home', profileId })}
        onOverview={() => navigation.navigate('RouteOverview', { profileId })}
        onCloseCheckIn={closeCheckIn}
      />
    ) : null;

  const layoutClass = useLayoutClass();
  const hoyaSize = useMediaSize(HOYA_SIZE);

  // See my cards: the Library, and those cards are seen, so the catch-up card goes for good.
  const seeCaughtUpCards = (): void => {
    if (profile && catchUp) markCardsSeen(profile.id, catchUp.cardIds);
    navigation.navigate('Main', { screen: 'Library' });
  };

  // Always mounted, so the web's assistive tech is watching when a later sync adds the card. A live
  // region on the web only: native announces the line itself (one announcement, no overlap).
  const catchUpView = (
    <View
      accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : 'none'}
      aria-live={Platform.OS === 'web' ? 'polite' : undefined}
    >
      {catchUp ? <CatchUpCard count={catchUp.count} hoyaSize={hoyaSize} onSeeCards={seeCaughtUpCards} /> : null}
    </View>
  );

  const missions =
    mission && mission.cards.length > 0 ? (
      <>
        <Heading level="prompt">{m.learner.home.mission.heading}</Heading>
        <Spacer size="sm" />
        <View testID="home-missions" style={{ gap: spacing.sm }}>
          {mission.cards.map((card) => {
            if (card.kind === 'free-end') {
              return (
                <FreeEndCard
                  key={card.slot}
                  primary={primary === null ? null : primary.kind === 'story' ? 'story' : 'practice'}
                  onPrimary={onFreeEndPrimary}
                  onReplay={onFavoriteReplay}
                  askLabel={ask.label}
                  onAsk={onAsk}
                />
              );
            }
            const storyQuest = card.kind === 'story' || card.practiceKind === 'story' ? card.questId : undefined;
            const entry = storyQuest ? entryForQuest(storyIndex, storyQuest) : undefined;
            const topicCover = card.topicKey ? freeTopics.find((t) => t.key === card.topicKey)?.cover : undefined;
            return (
              <MissionTile
                key={card.slot}
                card={card}
                cover={entry ? storyCoverArt(entry.story) : null}
                picture={topicCover ?? null}
                onPress={() => openCard(card)}
              />
            );
          })}
        </View>
      </>
    ) : null;

  // The gap under the card only when mission cards follow it; the side block brings its own.
  const catchUpGap = catchUp && missions ? <Spacer size="lg" /> : null;

  // Block 5 of the Home stack (F-ROUTE-001 section 6.4): the route strip replaces the
  // "Stage 1 progress" bar when the flag is on (OD-3); with the flag off Home is unchanged.
  const progressBlock = flags.myRouteEnabled ? (
    routeStrip ? <RouteStrip view={routeStrip} onPress={() => navigation.navigate('Main', { screen: 'Route' })} /> : null
  ) : (
    <>
      <Heading level="prompt">{m.learner.home.progress.heading}</Heading>
      <Spacer size="sm" />
      <Progress value={completed} max={totalStage1Quests} tone="primary" label={m.learner.home.progress.label(completed, totalStage1Quests)} />
    </>
  );

  const side = (
    <>
      {progressBlock ? (
        <>
          {progressBlock}
          <Spacer size="xl" />
        </>
      ) : null}
      <Pressable
        onPress={() => navigation.navigate('Homework')}
        accessibilityRole="button"
        accessibilityLabel={m.a11y.openHomework}
      >
        <Card padding="md" tone="sunken">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{m.learner.home.homework.title}</Body>
              <Caption tone="muted">
                {homeworkDue === 0 ? copy.homeReviewsIdle : showsTodayCount(homeworkDue) ? m.learner.home.homework.due(homeworkDue) : m.learner.home.homework.dueMany}
              </Caption>
            </View>
            <Icon name="card" size={24} color={colors.text.muted} />
          </View>
        </Card>
      </Pressable>

      <Spacer size="xl" />
      <HoyaBubble tone="idle" message={m.learner.home.tip} />
      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.learner.home.recentStars}</Heading>
        <Spacer size="sm" />
        <StarRow
          stars={recentStars}
          size={28}
          accessibilityLabel={m.a11y.stars(recentStars)}
        />
      </Card>
    </>
  );

  // Row 2a (F-FEEDBACK-001 FB-8, F-ROUTE-001 section 6.4): a new note from a teacher or the family,
  // after the mission cards; in two columns it heads the right column. Nothing with the flag off.
  const notesCard = (place: 'after' | 'top'): React.ReactElement | null => (flags.notesEnabled ? <NotesHomeCard gap={place} /> : null);

  // Regular and wide windows: two columns under the greeting; phones, short windows and a Home
  // with no mission cards: one column as always.
  const twoColumns = homeColumns(layoutClass, missions !== null) === 2;

  return (
    <View style={{ flex: 1 }}>
    <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width={twoColumns ? 'full' : 'reading'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {/* The catch-up card's cheering Hoya stands in for the greeting's while it shows. */}
        {catchUp ? null : <Hoya pose="waving" size={hoyaSize} accessibilityLabel={m.a11y.hoya('waving')} />}
        <View style={{ flex: 1 }}>
          <Heading level="title">{m.learner.home.greeting(profile?.displayName ?? null)}</Heading>
          <Body tone="secondary">{m.learner.home.subtitle}</Body>
        </View>
        {/* Profile entry (UX-05): the learner's own cub, tinted and ringed in the
            colour its avatar name says (not the Pillar theme), with a visible
            label — the only way to profiles, backup, classes and the grown-up zone. */}
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel={m.a11y.profileEntry}
          hitSlop={spacing.xs}
          style={{ alignItems: 'center', minWidth: touchTarget.min, gap: spacing.xxs }}
        >
          <ProfileAvatar avatar={profile?.avatar ?? DEFAULT_AVATAR} size={AVATAR_SIZE} ring />
          <Caption tone="secondary" weight="semibold">
            {m.learner.home.profileLabel}
          </Caption>
        </Pressable>
      </View>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Pill tone="primary" label={m.learner.home.streak.pill(streak)} />
        <Pill tone="secondary" label={m.learner.home.cards.pill(cardsUnlocked)} />
        <Pill tone="success" label={m.learner.home.stars.pill(stars3)} />
      </View>

      {twoColumns ? (
        <>
          <Spacer size="lg" />
          {/* The mission cards keep their slot order in every class (F-HW-001 §3.2). */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
            <View testID="home-missions-column" style={{ flex: MISSIONS_FLEX, minWidth: 0 }}>
              {/* Under the greeting, spanning the mission column; never between the mission cards. */}
              {catchUpView}
              {catchUpGap}
              {missions}
              {quietCard ? (
                <>
                  <Spacer size="lg" />
                  {quietCard}
                </>
              ) : null}
            </View>
            <View testID="home-side-column" style={{ flex: SIDE_FLEX, minWidth: 0 }}>
              {notesCard('top')}
              {side}
            </View>
          </View>
        </>
      ) : (
        <>
          {catchUp || missions ? <Spacer size="lg" /> : null}
          {catchUpView}
          {catchUpGap}
          {missions}
          {notesCard('after')}
          {quietCard ? (
            <>
              <Spacer size="lg" />
              {quietCard}
            </>
          ) : null}

          <Spacer size="xl" />
          {side}
        </>
      )}
    </Screen>
      {/* Web only (F-PWA-001): asks a grown-up to install once the app is cached. */}
      <InstallGuideSheet />
    </View>
  );
}
