import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Icon,
  KOREAN_LINE_BREAK,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useTypeScale,
} from '@hangul-route/design-system';
import { LOCALE_META, levelWords } from '@hangul-route/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LockBadge } from '../../components/LockBadge';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { bundleOs, flags, gatingActive, routeEnabledFor } from '../../config/flags';
import { placementEntriesOn } from '../../logic/placement/entry';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { profileRowOpens } from '../../logic/route/proposal-flow';
import { activeSelfRoute } from '../../logic/route/self-route';
import { planCardView } from '../../logic/paywall';
import { effectiveTier } from '../../store/tier-store';
import type { RootStackParamList } from '../../navigation/types';
import { installGuideVariant } from '../../logic/pwa/install-guide';
import { installEnv } from '../../platform/pwa';
import { useAudioStore } from '../../store/audio-store';
import { useTierStore } from '../../store/tier-store';
import { useLocks } from '../../store/profile-locks';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { learnerProfiles, switchOffered } from '../../store/who-chooser';
import { useProgressStore } from '../../store/progress-store';
import { useLocaleStore } from '../../store/locale-store';
import { usePwaStore } from '../../store/pwa-store';
import { useAudience } from '../../store/audience';
import { passGate, trackGateOpened, trackProfileSwitch } from '../../store/gate-telemetry';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { soundCardView, soundSwitchLabel } from '../../logic/audio/voice-help';
import { DeviceDisplaySheet } from '../../components/DeviceDisplaySheet';
import { ReadingPracticeCard } from '../../components/ReadingPracticeCard';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { BackupCard } from '../../components/BackupCard';
import { SpacesCard } from '../../components/SpacesCard';
import { grownUpEntriesOn, runGrownUpHandoff } from '../../logic/shell/entry-points';
import { grownUpPinParams } from '../../logic/shell/handoff-rules';
import { openGrownUpArea } from '../../platform/grown-up-handoff';
import { MyNotesRow } from '../notes/MyNotesRow';
import { GrownUpHomeRow } from './GrownUpHomeRow';
import { LicensesLink } from './LicensesLink';
import { ChallengeCard } from '../vocab/ChallengeCard';
import { wordsOffered } from '../vocab/topic-data';

export function ProfileScreen(): React.ReactElement {
  const m = useMessages();
  const locale = useLocale();
  const t = m.learner.profile;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profiles = useProfileStore((s) => s.profiles);
  const active = useProfileStore(activeProfileSelector);
  const setActive = useProfileStore((s) => s.setActive);
  // [OA] Row OA-5: locks are enforced on these tiles whatever the chooser flag says (fail safe, section 16).
  const locks = useLocks(profiles);
  const snap = useProgressStore((s) => (active ? s.byProfile[active.id] : undefined));
  const cachedTier = useTierStore((s) => (active ? s.byLearner[active.id] : undefined));
  const entitled = effectiveTier(active?.id ?? '', new Date());
  // The free line follows the real tier model: everything is open while content gating is off (owner request 2026-10-16, item 8).
  const card = planCardView(entitled.tier, entitled.source, t.plan, gatingActive(flags, bundleOs()));
  void cachedTier; // subscribe so the card re-renders when the inbox updates the tier
  // Mute is a persisted device preference (F-AUDIO-004 AD7); the switch shows its inverse.
  const soundOn = useAudioStore((s) => !s.muted);
  const setMuted = useAudioStore((s) => s.setMuted);
  const voice = useAudioStore((s) => s.tts);
  const soundCard = soundCardView(voice, !soundOn, m.learner.audio);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  // The Display (Aa) sheet: the device's language and text size (owner items 6 and 7); not behind the grown-up gate.
  const [displayOpen, setDisplayOpen] = useState(false);
  const textSize = useLocaleStore((s) => s.textSize);
  const displayLine = t.display.line(LOCALE_META[locale].endonym, m.common.display.size[textSize]);
  // For grown-ups starts collapsed (owner request 2026-10-16, item 8).
  const [grownUpsOpen, setGrownUpsOpen] = useState(false);
  const forceInstallGuide = usePwaStore((s) => s.force);
  const installed = usePwaStore((s) => s.installed);
  const { copy, pinSet, opensDirectly, audience } = useAudience();
  // A self-only device never says "grown-up" (F-LEARN-001 L7).
  const grownUpsTitle = audience === 'self' ? t.groups.account : t.groups.grownUps;
  const textScale = useTypeScale();
  const canOfferInstall = !installed && installGuideVariant(installEnv()) !== 'none';

  // [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS CS-1, OA-D5b: Profile is a learner screen, so an open grown-up session is
  // never honoured here (before OA-2 the 15-minute session let a grown-up add another learner without the PIN,
  // F-PROF-001 section 3.2). Only a self-only device that never set a PIN has no gate to pass (F-LEARN-001 L7), so a
  // learner is not made to invent a PIN just to reach their own settings.
  const opensHere = opensDirectly(false);
  const openGrownUps = (
    next: 'ParentDashboard' | 'AddProfile' | 'Restore' | 'SaveProgress' | 'EditProfile',
    profileId?: string,
  ): void => {
    if (opensHere) {
      // [OA] Section 15: a gate that a device without a gate opened directly.
      trackGateOpened(next, 'open');
      if (next === 'EditProfile') {
        if (profileId !== undefined) navigation.navigate('EditProfile', { profileId });
      } else if (next === 'AddProfile') {
        navigation.navigate('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
      } else if (next === 'Restore') {
        navigation.navigate('Restore', { from: 'settings' });
      } else if (next === 'SaveProgress') {
        navigation.navigate('SaveProgress');
      } else {
        navigation.navigate('ParentDashboard');
      }
      return;
    }
    navigation.navigate('PinEntry', next === 'EditProfile' ? { next, profileId } : { next });
  };

  // F-APP-001 A-7 (section 3.6, web, flag on): the grown-up area on the app host, after a fresh PIN
  // where the device has one (`openGrownUpArea`), with no stop at the local dashboard.
  const grownUpHome = grownUpEntriesOn(flags.grownUpHomeEnabled, bundleOs());
  const leaving = useRef(false);
  const openGrownUpHome = (): void => {
    void runGrownUpHandoff('profile', leaving, openGrownUpArea, (v) => navigation.navigate('PinEntry', grownUpPinParams({ via: v })));
  };

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">{t.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{copy.profileSwitchHint}</Body>
      {locks.unread ? (
        // [OA] Section 13.2: the locks could not be read, so every tile is locked; one line says it for all of them.
        <>
          <Spacer size="xs" />
          <Body tone="secondary" testID="profile-locks-unread">
            {m.learner.who.locksUnread}
          </Body>
        </>
      ) : null}

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {profiles.map((p) => {
          const isActive = p.id === active?.id;
          const locked = locks.locked.has(p.id);
          const level = levelWords(m, p.ageGroup)?.label ?? null;
          return (
            <View
              key={p.id}
              style={{
                flexBasis: '47%',
                backgroundColor: isActive ? colors.brand.primaryLight : colors.surface.paper,
                borderColor: isActive ? colors.brand.primary : colors.border.subtle,
                borderWidth: 2,
                borderRadius: radii.lg,
              }}
            >
              <Pressable
                testID={`profile-tile-${p.id}`}
                onPress={() => {
                  // [OA] Row OA-5, section 6.3: a locked learner opens only with the grown-up PIN, and the unlock opens
                  // that learner only, never a grown-up session (CS-3). The active learner's own tile switches nothing.
                  if (locked && !isActive) {
                    navigation.navigate('PinEntry', { next: 'LockedProfile', profileId: p.id, lockedFrom: { via: 'profile' } });
                    return;
                  }
                  // [OA] G1 baseline (section 15): a switch from the Profile tiles; the same tile again is no switch.
                  if (p.id !== active?.id) trackProfileSwitch('profile', false);
                  // setActive closes any grown-up session on a change of learner (OA-D5b, CS-15).
                  setActive(p.id);
                }}
                accessibilityRole="button"
                // The active learner's own tile asks nothing, so only another locked tile is named as one the PIN opens.
                accessibilityLabel={locked && !isActive ? m.a11y.who.lockedTile(p.displayName) : t.switchTo(p.displayName)}
                style={{ padding: spacing.md, alignItems: 'center', minHeight: touchTarget.hero, borderRadius: radii.lg }}
              >
                <ProfileAvatar avatar={p.avatar} size={72} pose={isActive ? 'cheering' : 'idle'} />
                {locked ? (
                  <View pointerEvents="none" style={{ position: 'absolute', top: spacing.xs, right: spacing.xs }}>
                    <LockBadge testID={`profile-tile-lock-${p.id}`} />
                  </View>
                ) : null}
                <Spacer size="xs" />
                <Body weight="semibold">{p.displayName}</Body>
                {locked && !locks.unread ? (
                  <Caption tone="secondary" align="center">
                    {m.learner.who.lockedCaption}
                  </Caption>
                ) : null}
                {level ? <Caption tone="muted">{level}</Caption> : null}
                {isActive ? <Pill label={t.playingNow} tone="primary" size="sm" /> : null}
              </Pressable>
              {/* Its own control, not nested in the switch button (F-LEARN-001 §3.11). */}
              <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
                <Button
                  label={m.learner.editProfile.cta}
                  tone="ghost"
                  size="sm"
                  fullWidth
                  accessibilityLabel={copy.gatedA11y(m.learner.editProfile.a11y(p.displayName), pinSet)}
                  onPress={() => openGrownUps('EditProfile', p.id)}
                />
              </View>
            </View>
          );
        })}
      </View>

      {switchOffered(learnerProfiles(profiles).length) ? (
        <>
          {/* [OA] "Who is using this?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a): the chooser; the tiles above stay a second way to switch. */}
          <Spacer size="lg" />
          <Card padding="md">
            <Pressable
              testID="profile-who-row"
              onPress={() => navigation.navigate('WhoIsUsing', { trigger: 'manual' })}
              accessibilityRole="button"
              accessibilityLabel={m.learner.who.profileRow}
              style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
            >
              <Body weight="semibold" style={{ flex: 1 }}>
                {m.learner.who.profileRow}
              </Body>
              <Icon name="arrow-right" size={24} color={colors.text.muted} />
            </Pressable>
          </Card>
        </>
      ) : null}

      <Spacer size="lg" />
      <Button
        label={t.addProfile}
        tone="secondary"
        size="md"
        accessibilityLabel={copy.gatedA11y(t.addProfileName, pinSet)}
        onPress={() => openGrownUps('AddProfile')}
      />

      <Spacer size="xxl" />
      <Heading level="prompt">{t.statsTitle(active?.displayName ?? null)}</Heading>
      <Spacer size="sm" />
      <Card padding="md">
        {/* The three figures wrap to a second line, and a long label wraps in its column, at a large text size. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.md, rowGap: spacing.sm }}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Caption tone="muted">{t.stats.quests}</Caption>
            <Heading level="prompt">{snap?.quests.filter((q) => q.completedAt).length ?? 0}</Heading>
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Caption tone="muted">{t.stats.cards}</Caption>
            <Heading level="prompt">{snap?.cards.length ?? 0}</Heading>
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Caption tone="muted">{t.stats.threeStar}</Caption>
            <Heading level="prompt">{snap?.quests.filter((q) => q.stars === 3).length ?? 0}</Heading>
          </View>
        </View>
      </Card>

      {active ? (
        <>
          {/* Classes and family, moved up out of the grown-ups group (owner decision 2026-10-17): the learner's classes
              and family, Join a class (not gated, F-SPACE-001) and Leave, right under the stats. */}
          <Spacer size="lg" />
          <SpacesCard profile={active} onJoin={() => navigation.navigate('JoinSpace')} />
        </>
      ) : null}

      {/* Owner request 2026-10-16 (item 8): two groups. My settings, open: what the learner changes alone. */}
      <Spacer size="xxl" />
      <View testID="profile-group-mine" role="group" aria-labelledby="profile-group-mine-title">
        <View id="profile-group-mine-title">
          <Heading level="prompt">{t.groups.mine}</Heading>
        </View>

        <Spacer size="sm" />
        <Card padding="md">
          <Pressable
            onPress={() => {
              setMuted(soundOn, 'profile');
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: soundOn }}
            accessibilityLabel={soundSwitchLabel(voice, !soundOn, m.learner.audio, m.a11y.soundSwitch)}
            style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                <Icon name={soundCard.glyph} size={24} color={soundOn ? colors.brand.primary : colors.text.muted} />
                <View style={{ flex: 1 }}>
                  <Body weight="semibold">{t.sound.label}</Body>
                  <Caption tone="muted" testID="sound-voice-status">{soundCard.statusLine}</Caption>
                </View>
              </View>
              <Pill tone={soundOn ? 'success' : 'neutral'} label={soundOn ? t.sound.on : t.sound.off} size="sm" />
            </View>
          </Pressable>
          {soundCard.showHowTo ? (
            <>
              <Spacer size="sm" />
              <Button label={soundCard.howToLabel} tone="ghost" size="md" onPress={() => setVoiceHelpOpen(true)} testID="sound-how-to-add" />
            </>
          ) : null}
        </Card>
        <VoiceHelpSheet visible={voiceHelpOpen} onClose={() => setVoiceHelpOpen(false)} />

        {/* Display: the one UI language and text size of this device (owner items 6 and 7), directly under Sound. */}
        <Spacer size="lg" />
        <Card padding="md">
          <Pressable
            testID="profile-display-row"
            onPress={() => setDisplayOpen(true)}
            accessibilityRole="button"
            aria-haspopup="dialog"
            // The current language and size are part of the name: react-native-web drops a hint, and the
            // label replaces the row's visible text, so on the web a hint would never be read.
            accessibilityLabel={`${m.common.display.a11y}. ${displayLine}`}
            style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
          >
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{t.display.row}</Body>
              <Caption tone="muted">{displayLine}</Caption>
            </View>
            <Icon name="arrow-right" size={24} color={colors.text.muted} />
          </Pressable>
        </Card>
        <DeviceDisplaySheet visible={displayOpen} onClose={() => setDisplayOpen(false)} />

        {active ? (
          <>
            <Spacer size="lg" />
            <ReadingPracticeCard profileId={active.id} />
          </>
        ) : null}

        {active && wordsOffered() ? (
          <>
            {/* F-VOC-004 S-6: the Speed Round's Challenge opt-in; only where Words (and so the Speed Round) is offered. */}
            <Spacer size="lg" />
            <ChallengeCard profileId={active.id} />
          </>
        ) : null}

        {active && placementEntriesOn(flags.placementEnabled) ? (
          <>
            {/* F-PLC-001 section 3.10: not behind the PIN (a learner may do this alone; the result is only a start). */}
            <Spacer size="lg" />
            <Card padding="md">
              <Pressable
                testID="profile-placement-row"
                onPress={() => navigation.navigate('Placement', { source: 'profile' })}
                accessibilityRole="button"
                accessibilityLabel={m.learner.placement.profileRow}
                style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
              >
                <Body weight="semibold" style={{ flex: 1 }}>
                  {m.learner.placement.profileRow}
                </Body>
                <Icon name="arrow-right" size={24} color={colors.text.muted} />
              </Pressable>
            </Card>
          </>
        ) : null}

        {active && routeEnabledFor(locale) ? (
          <>
            {/* F-PLAN-002 section 3.9: always here (a Not now on Home never hides it); a child's plan goes through the gate. */}
            <Spacer size="lg" />
            <Card padding="md">
              <Pressable
                testID="profile-plan-row"
                onPress={() => {
                  const learnerType = effectiveLearnerType(active);
                  if (profileRowOpens({ learnerType, opensDirectly: opensHere }) === 'proposal') {
                    // A self profile's own plan is no gate; a child's plan on a device without a gate is one.
                    if (learnerType !== 'self') passGate('RouteProposal', true);
                    navigation.navigate('RouteProposal', { source: 'profile', profileId: active.id });
                  } else {
                    navigation.navigate('PinEntry', { next: 'RouteProposal', profileId: active.id });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={activeSelfRoute(snap) ? m.learner.weeklyPlan.profileRow.open : m.learner.weeklyPlan.profileRow.make}
                style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
              >
                <Body weight="semibold" style={{ flex: 1 }}>
                  {activeSelfRoute(snap) ? m.learner.weeklyPlan.profileRow.open : m.learner.weeklyPlan.profileRow.make}
                </Body>
                <Icon name="arrow-right" size={24} color={colors.text.muted} />
              </Pressable>
            </Card>
          </>
        ) : null}

        {/* F-FEEDBACK-001 FB-8 (section 6.5 item 2): My notes; no gate (the learner's own notes). */}
        <MyNotesRow onOpen={() => navigation.navigate('Notes')} />
      </View>

      {/* For grown-ups, collapsed: the plan, backup, install, the account pages, the grown-up area and the notices. */}
      <Spacer size="xxl" />
      <View testID="profile-group-grown-ups" role="group" aria-labelledby="profile-group-grown-ups-title">
        {/* The heading holds the group's disclosure button (the accordion pattern): heading navigation still finds the
            group, and the button says whether it is open. A heading inside the button would lose its heading role. */}
        <View accessibilityRole="header" id="profile-group-grown-ups-title" testID="profile-group-grown-ups-heading">
          <Pressable
            testID="profile-group-grown-ups-toggle"
            onPress={() => setGrownUpsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={grownUpsTitle}
            accessibilityState={{ expanded: grownUpsOpen }}
            aria-expanded={grownUpsOpen}
            style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
          >
            <Text
              {...KOREAN_LINE_BREAK}
              style={{
                flex: 1,
                fontSize: textScale.size.prompt,
                lineHeight: textScale.size.prompt * typography.leading.tight,
                fontWeight: typography.weight.bold,
                color: colors.text.primary,
              }}
            >
              {grownUpsTitle}
            </Text>
            <View style={{ transform: [{ rotate: grownUpsOpen ? '90deg' : '0deg' }] }}>
              <Icon name="arrow-right" size={24} color={colors.text.secondary} />
            </View>
          </Pressable>
        </View>

        {grownUpsOpen ? (
          <>
            <Spacer size="sm" />
            {/* The plan card (F-BILL-002 §4.7, §6.3; mock design/screens/billing/plan-status.md): every tier opens the Plan screen, no PIN. */}
            <Card padding="md" tone={card.tone === 'success' ? 'success' : 'sunken'}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Body weight="semibold">{card.title}</Body>
                  <Caption tone="muted">{card.note}</Caption>
                </View>
                <Pill tone={card.tone} label={card.pill} size="sm" />
              </View>
              <Spacer size="sm" />
              <Button label={card.cta} tone="ghost" size="md" onPress={() => navigation.navigate('Paywall', { from: 'settings' })} />
            </Card>

            <Spacer size="lg" />
            {active ? <BackupCard profile={active} onRestore={() => openGrownUps('Restore')} onSaveProgress={() => openGrownUps('SaveProgress')} /> : null}

            {canOfferInstall ? (
              <>
                <Spacer size="lg" />
                <Button
                  label={t.install.label}
                  tone="ghost"
                  size="md"
                  accessibilityLabel={t.install.a11yLabel}
                  onPress={() => {
                    forceInstallGuide();
                    navigation.navigate('Main', { screen: 'Home' });
                  }}
                />
              </>
            ) : null}

            {grownUpHome ? (
              <>
                <Spacer size="lg" />
                <GrownUpHomeRow onOpen={openGrownUpHome} />
              </>
            ) : null}

            <Spacer size="lg" />
            <Button
              label={copy.zoneLabel}
              tone="ghost"
              size="md"
              accessibilityLabel={copy.gatedA11y(copy.zoneLabel, pinSet)}
              onPress={() => openGrownUps('ParentDashboard')}
              testID="profile-grown-up-area"
            />
            <Spacer size="lg" />
            {/* Leaving the app: through the grown-up gate where the device has one (F-STORY-002 §3.8). */}
            <LicensesLink onGate={(url) => navigation.navigate('PinEntry', { next: 'ExternalLink', url })} />
          </>
        ) : null}
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}
