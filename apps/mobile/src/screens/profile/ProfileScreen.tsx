import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { levelLabel } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { effectiveTier } from '../../store/tier-store';
import { isParentSessionValid } from '../../logic/profiles/session';
import type { RootStackParamList } from '../../navigation/types';
import { installGuideVariant } from '../../logic/pwa/install-guide';
import { installEnv } from '../../platform/pwa';
import { useAudioStore } from '../../store/audio-store';
import { useTierStore } from '../../store/tier-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { usePwaStore } from '../../store/pwa-store';
import { useAudience } from '../../store/audience';
import { useUiStore } from '../../store/ui-store';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { soundCardView, soundSwitchLabel } from '../../logic/audio/voice-help';
import { LanguageCard } from '../../components/LanguageCard';
import { useMessages } from '../../i18n/use-messages';
import { BackupCard } from '../../components/BackupCard';
import { SpacesCard } from '../../components/SpacesCard';

export function ProfileScreen(): React.ReactElement {
  const m = useMessages();
  const t = m.learner.profile;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profiles = useProfileStore((s) => s.profiles);
  const active = useProfileStore(activeProfileSelector);
  const setActive = useProfileStore((s) => s.setActive);
  const snap = useProgressStore((s) => (active ? s.byProfile[active.id] : undefined));
  const cachedTier = useTierStore((s) => (active ? s.byLearner[active.id] : undefined));
  const entitled = effectiveTier(active?.id ?? '', new Date());
  const tier = entitled.tier;
  void cachedTier; // subscribe so the card re-renders when the inbox updates the tier
  // Mute is a persisted device preference (F-AUDIO-004 AD7); the switch shows its inverse.
  const soundOn = useAudioStore((s) => !s.muted);
  const setMuted = useAudioStore((s) => s.setMuted);
  const voice = useAudioStore((s) => s.tts);
  const soundCard = soundCardView(voice, !soundOn);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const forceInstallGuide = usePwaStore((s) => s.force);
  const installed = usePwaStore((s) => s.installed);
  const { copy, pinSet, opensDirectly } = useAudience();
  const canOfferInstall = !installed && installGuideVariant(installEnv()) !== 'none';

  // A verified grown-up may add another child without re-entering the PIN
  // inside the 15-minute session window (F-PROF-001 §3.2). A self-only device
  // that never set a PIN has no gate to pass (F-LEARN-001 L7), so a learner
  // is not made to invent a PIN just to reach their own settings.
  const parentSessionOpen = isParentSessionValid(
    parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' },
    Date.now(),
  );
  const openGrownUps = (next: 'ParentDashboard' | 'AddProfile' | 'Restore' | 'SaveProgress' | 'Paywall'): void => {
    if (opensDirectly(parentSessionOpen)) {
      if (next === 'AddProfile') {
        navigation.navigate('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
      } else if (next === 'Restore') {
        navigation.navigate('Restore', { from: 'settings' });
      } else if (next === 'SaveProgress') {
        navigation.navigate('SaveProgress');
      } else if (next === 'Paywall') {
        navigation.navigate('Paywall', { from: 'settings' });
      } else {
        navigation.navigate('ParentDashboard');
      }
      return;
    }
    navigation.navigate('PinEntry', { next });
  };

  return (
    <Screen tone="canvas" scrollable>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={m.a11y.goBack}
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">{t.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{copy.profileSwitchHint}</Body>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {profiles.map((p) => {
          const isActive = p.id === active?.id;
          const level = levelLabel(p.ageGroup);
          return (
            <Pressable
              key={p.id}
              onPress={() => setActive(p.id)}
              accessibilityRole="button"
              accessibilityLabel={t.switchTo(p.displayName)}
              style={{
                flexBasis: '47%',
                padding: spacing.md,
                backgroundColor: isActive ? colors.brand.primaryLight : colors.surface.paper,
                borderColor: isActive ? colors.brand.primary : colors.border.subtle,
                borderWidth: 2,
                borderRadius: radii.lg,
                alignItems: 'center',
                minHeight: touchTarget.hero,
              }}
            >
              <ProfileAvatar avatar={p.avatar} size={72} pose={isActive ? 'cheering' : 'idle'} />
              <Spacer size="xs" />
              <Body weight="semibold">{p.displayName}</Body>
              {level ? <Caption tone="muted">{level}</Caption> : null}
              {isActive ? <Pill label={t.playingNow} tone="primary" size="sm" /> : null}
            </Pressable>
          );
        })}
      </View>

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Caption tone="muted">{t.stats.quests}</Caption>
            <Heading level="prompt">{snap?.quests.filter((q) => q.completedAt).length ?? 0}</Heading>
          </View>
          <View>
            <Caption tone="muted">{t.stats.cards}</Caption>
            <Heading level="prompt">{snap?.cards.length ?? 0}</Heading>
          </View>
          <View>
            <Caption tone="muted">{t.stats.threeStar}</Caption>
            <Heading level="prompt">{snap?.quests.filter((q) => q.stars === 3).length ?? 0}</Heading>
          </View>
        </View>
      </Card>

      <Spacer size="lg" />
      <Card padding="md">
        <Pressable
          onPress={() => {
            setMuted(soundOn, 'profile');
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: soundOn }}
          accessibilityLabel={soundSwitchLabel(voice, !soundOn)}
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

      {active ? (
        <>
          <Spacer size="lg" />
          <LanguageCard profileId={active.id} />
        </>
      ) : null}

      <Spacer size="lg" />
      <Card padding="md" tone={tier === 'premium' ? 'success' : 'sunken'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Body weight="semibold">{tier === 'premium' ? t.plan.premium : t.plan.free}</Body>
            <Caption tone="muted">
              {tier === 'premium'
                ? t.plan.unlocked(entitled.source?.name ?? null)
                : t.plan.freeNote}
            </Caption>
          </View>
          <Pill
            tone={tier === 'premium' ? 'success' : 'neutral'}
            label={tier === 'premium' ? t.plan.pillActive : t.plan.pillFree}
            size="sm"
          />
        </View>
        {tier !== 'premium' ? (
          <>
            <Spacer size="sm" />
            <Button label={t.plan.unlock} tone="secondary" size="md" accessibilityLabel={copy.gatedA11y(t.plan.unlock, pinSet)} onPress={() => openGrownUps('Paywall')} />
          </>
        ) : null}
      </Card>

      <Spacer size="lg" />
      {active ? <BackupCard profile={active} onRestore={() => openGrownUps('Restore')} onSaveProgress={() => openGrownUps('SaveProgress')} /> : null}

      {active ? (
        <>
          <Spacer size="lg" />
          <SpacesCard profile={active} onJoin={() => navigation.navigate('JoinSpace')} />
        </>
      ) : null}

      {canOfferInstall ? (
        <>
          <Spacer size="lg" />
          <Button
            label={t.install.label}
            tone="secondary"
            size="md"
            accessibilityLabel={t.install.a11yLabel}
            onPress={() => {
              forceInstallGuide();
              navigation.navigate('Main', { screen: 'Home' });
            }}
          />
        </>
      ) : null}

      <Spacer size="lg" />
      <Button
        label={copy.zoneLabel}
        tone="ghost"
        size="md"
        accessibilityLabel={copy.gatedA11y(copy.zoneLabel, pinSet)}
        onPress={() => openGrownUps('ParentDashboard')}
      />
      <Spacer size="xl" />
    </Screen>
  );
}
