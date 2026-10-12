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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { InstallGuideSheet } from '../../components/InstallGuideSheet';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import type { SceneArt } from '@hangul-route/content-schema';
import { welcomeCardIds } from '../../content/award-world';
import { flags } from '../../config/flags';
import { episodesAll, questsAll } from '../../content';
import { PLACEMENT_BANK } from '../../content/placement.generated';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { catchUpCard } from '../../logic/awards/catch-up';
import { localizeMissionCard } from '../../logic/content-locale';
import { cursorContext } from '../../logic/cursor-context';
import {
  buildTodaysMission,
  missionCardText,
  dayKey,
  planHomeStoryOpen,
  storyCardShownEvent,
  type MissionCard,
  type MissionPlan,
} from '../../logic/homework/mission-builder';
import { dueTodayCount, showsTodayCount } from '../../logic/homework/assignment-groups';
import { mergeAssignments } from '../../logic/homework/assignment-merger';
import { gridQuestProgress } from '../../logic/journey';
import { homeColumns } from '../../logic/layout/home-columns';
import { placementEntriesOn, questsDoneOf } from '../../logic/placement/entry';
import { skippedEvent } from '../../logic/placement/events';
import { homeQuietCard, levelCheckCard } from '../../logic/placement/home-card';
import { DEFAULT_AVATAR } from '../../logic/profiles/avatar-catalog';
import { computeStreak } from '../../logic/streak';
import { emptyBookmarks } from '../../logic/story/bookmarks';
import { storyCoverArt } from '../../logic/story/scene-view';
import { defaultStoryIndex, entryForQuest } from '../../logic/story/story-index';
import { storyLockFor } from '../../logic/story/story-pick';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { usePlacementRunStore } from '../../store/placement-run-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';
import { LinkButton } from '../placement/parts';

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
};
/** The story card's cover thumbnail (F-STORY-004 §3.7), drawn where the icon sits. */
const COVER_THUMB = 48;
const NO_BOOKMARKS = emptyBookmarks();
/**
 * `home.story_card.shown` goes once per profile, day and app session (`<profileId>|<date>`), when the plan is
 * first pinned — the plan itself is pinned per session too (F-STORY-004 §3.7, §3.11).
 */
const storyCardShownSent = new Set<string>();

/**
 * One of the three Today's mission cards (F-HW-001 §3.1).
 * A collected card keeps its slot and switches tone — it never disappears and
 * the cards below it never move up (§3.2).
 */
function MissionTile({
  card,
  cover,
  onPress,
}: {
  card: MissionCard;
  /** A story card's cover art; null or absent keeps the icon. */
  cover?: SceneArt | null;
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
  const { copy } = useAudience();
  const profile = useProfileStore(activeProfileSelector);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ensure = useProgressStore((s) => s.ensure);
  const markCardsSeen = useProgressStore((s) => s.markCardsSeen);
  // Session-only (F-STORY-006 §3.5): the cards a reconcile added this app session.
  const catchUpListed = useProgressStore((s) => (profile ? s.catchUp[profile.id] : undefined));
  const catchUp = useMemo(() => catchUpCard(catchUpListed, welcomeCardIds), [catchUpListed]);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // Re-renders Home when the inbox changes the tier, as Results does, so the
  // cursor follows OD-4 on both (F-ROUTE-001 R-4a).
  const cachedTier = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
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
    const dates = snap?.sessions.map((s) => s.startedAt) ?? [];
    return computeStreak(dates);
  }, [snap]);

  // Today's mission — the plan is pinned for the day so finishing one card
  // never reshuffles the other two under the learner (F-HW-001 §3.2).
  const pinnedPlan = useRef<MissionPlan | null>(null);
  const tier = profile ? effectiveTier(profile.id, new Date()).tier : 'free';
  const mission = useMemo(() => {
    if (!profile || !snap) return null;
    const today = dayKey(new Date().toISOString());
    const built = buildTodaysMission({
      profileId: profile.id,
      snapshot: snap,
      quests: questsAll,
      episodes: episodesAll,
      today,
      pinned: pinnedPlan.current,
      // The same stages and placed-out quests as Results and My route (F-ROUTE-001 R-4a).
      ...cursorContext({
        tier,
        placements: snap.placements,
        quests: questsAll,
        episodes: episodesAll,
      }),
      // The story card (F-STORY-004 §3.7): never a locked story; nothing is locked while gating is off.
      stories: {
        entries: storyIndex,
        bookmarks,
        isLocked: storyLockFor({
          tier,
          gatingEnabled: flags.contentGatingEnabled,
          episodes: episodesAll,
        }),
      },
    });
    // A caregiver or class assignment for today takes card ② (F-HW-001 §3.4, F-PLAN-001 §3.4).
    const merged = mergeAssignments({
      plan: built,
      assignments: snap.homework,
      today,
      enabled: true,
      titleOf: (questId) => questsAll.find((q) => q.id === questId)?.titleEn,
    }).plan;
    pinnedPlan.current = merged;
    return merged;
    // `cachedTier` re-renders this screen when the inbox changes the tier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, snap, tier, cachedTier, bookmarks, storyIndex]);

  useEffect(() => {
    if (!mission) return;
    const event = storyCardShownEvent(mission);
    const key = `${mission.profileId}|${mission.date}`;
    if (!event || storyCardShownSent.has(key)) return;
    storyCardShownSent.add(key);
    void track({ name: event.name, profileId: mission.profileId, payload: event.payload });
  }, [mission]);

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

  const openCard = (card: MissionCard): void => {
    if (card.kind === 'story' && openStory(card)) return;
    if (card.questId && card.episodeId) {
      navigation.navigate('QuestPlayer', { questId: card.questId, episodeId: card.episodeId });
    } else if (card.episodeId) {
      navigation.navigate('EpisodeDetail', { episodeId: card.episodeId });
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
  // F-PLAN-002's weekly-plan prompt joins this slot with P2-7a; until then only the level check.
  const quiet = homeQuietCard(levelCheck, false);
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
    ) : null;

  const layoutClass = useLayoutClass();
  const hoyaSize = useMediaSize(HOYA_SIZE);

  // See my cards: the Library, and those cards are seen, so the catch-up card goes for good.
  const seeCaughtUpCards = (): void => {
    if (profile && catchUp) markCardsSeen(profile.id, catchUp.cardIds);
    navigation.navigate('Main', { screen: 'Library' });
  };

  // Always mounted, so assistive tech is watching when the card arrives with the reconcile.
  const catchUpView = (
    <View accessibilityLiveRegion="polite" aria-live="polite">
      {catchUp ? (
        <>
          <CatchUpCard count={catchUp.count} hoyaSize={hoyaSize} onSeeCards={seeCaughtUpCards} />
          <Spacer size="lg" />
        </>
      ) : null}
    </View>
  );

  const missions =
    mission && mission.cards.length > 0 ? (
      <>
        <Heading level="prompt">{m.learner.home.mission.heading}</Heading>
        <Spacer size="sm" />
        <View testID="home-missions" style={{ gap: spacing.sm }}>
          {mission.cards.map((card) => {
            const entry = card.kind === 'story' && card.questId ? entryForQuest(storyIndex, card.questId) : undefined;
            return (
              <MissionTile
                key={card.slot}
                card={card}
                cover={entry ? storyCoverArt(entry.story) : null}
                onPress={() => openCard(card)}
              />
            );
          })}
        </View>
      </>
    ) : null;

  const side = (
    <>
      <Heading level="prompt">{m.learner.home.progress.heading}</Heading>
      <Spacer size="sm" />
      <Progress value={completed} max={totalStage1Quests} tone="primary" label={m.learner.home.progress.label(completed, totalStage1Quests)} />

      <Spacer size="xl" />
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

  // Regular and wide windows: two columns under the greeting; phones, short windows and a Home
  // with no mission cards: one column as always.
  const twoColumns = homeColumns(layoutClass, missions !== null) === 2;

  return (
    <View style={{ flex: 1 }}>
    <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width={twoColumns ? 'full' : 'reading'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {/* One Hoya on the screen: the catch-up card's cheering Hoya stands in while it shows. */}
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
              {missions}
              {quietCard ? (
                <>
                  <Spacer size="lg" />
                  {quietCard}
                </>
              ) : null}
            </View>
            <View testID="home-side-column" style={{ flex: SIDE_FLEX, minWidth: 0 }}>
              {side}
            </View>
          </View>
        </>
      ) : (
        <>
          {catchUp || missions ? <Spacer size="lg" /> : null}
          {catchUpView}
          {missions}
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
