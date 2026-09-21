import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, View } from 'react-native';
import { entitlementTier } from '../../logic/entitlement';
import { isParentSessionValid } from '../../logic/profiles/session';
import type { RootStackParamList } from '../../navigation/types';
import { installGuideVariant } from '../../logic/pwa/install-guide';
import { setMuted } from '../../platform/audio';
import { installEnv } from '../../platform/pwa';
import { useAccountStore } from '../../store/account-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { usePwaStore } from '../../store/pwa-store';
import { useUiStore } from '../../store/ui-store';
import { BackupCard } from '../../components/BackupCard';
import { SpacesCard } from '../../components/SpacesCard';

export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profiles = useProfileStore((s) => s.profiles);
  const active = useProfileStore(activeProfileSelector);
  const setActive = useProfileStore((s) => s.setActive);
  const snap = useProgressStore((s) => (active ? s.byProfile[active.id] : undefined));
  const subscription = useAccountStore((s) => s.subscription);
  const tier = entitlementTier(subscription, new Date());
  const soundOn = useUiStore((s) => s.soundOn);
  const toggleSound = useUiStore((s) => s.toggleSound);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const forceInstallGuide = usePwaStore((s) => s.force);
  const installed = usePwaStore((s) => s.installed);
  const canOfferInstall = !installed && installGuideVariant(installEnv()) !== 'none';

  // A verified grown-up may add another child without re-entering the PIN
  // inside the 15-minute session window (F-PROF-001 §3.2).
  const parentSessionOpen = isParentSessionValid(
    parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' },
    Date.now(),
  );
  const openGrownUps = (next: 'ParentDashboard' | 'AddProfile' | 'Restore' | 'SaveProgress'): void => {
    if (parentSessionOpen) {
      if (next === 'AddProfile') {
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
    navigation.navigate('PinEntry', { next });
  };

  return (
    <Screen tone="canvas" scrollable>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Profiles & settings</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Tap a Hoya to switch.</Body>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {profiles.map((p) => {
          const isActive = p.id === active?.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setActive(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${p.displayName}`}
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
              <Hoya pose={isActive ? 'cheering' : 'idle'} size={72} />
              <Spacer size="xs" />
              <Body weight="semibold">{p.displayName}</Body>
              <Caption tone="muted">Age {p.ageGroup}</Caption>
              {isActive ? <Pill label="Playing now" tone="primary" size="sm" /> : null}
            </Pressable>
          );
        })}
      </View>

      <Spacer size="lg" />
      <Button
        label="+ Add a profile"
        tone="secondary"
        size="md"
        accessibilityLabel="Add a profile (grown-ups only)"
        onPress={() => openGrownUps('AddProfile')}
      />

      <Spacer size="xxl" />
      <Heading level="prompt">{active?.displayName ?? 'Your'} stats</Heading>
      <Spacer size="sm" />
      <Card padding="md">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Caption tone="muted">Quests done</Caption>
            <Heading level="prompt">{snap?.quests.filter((q) => q.completedAt).length ?? 0}</Heading>
          </View>
          <View>
            <Caption tone="muted">Cards</Caption>
            <Heading level="prompt">{snap?.cards.length ?? 0}</Heading>
          </View>
          <View>
            <Caption tone="muted">3-star quests</Caption>
            <Heading level="prompt">{snap?.quests.filter((q) => q.stars === 3).length ?? 0}</Heading>
          </View>
        </View>
      </Card>

      <Spacer size="lg" />
      <Pressable
        onPress={() => {
          setMuted(soundOn);
          toggleSound();
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: soundOn }}
        accessibilityLabel="Sound"
        style={{ minHeight: touchTarget.min }}
      >
        <Card padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Icon name="speaker" size={24} color={soundOn ? colors.brand.primary : colors.text.muted} />
              <Body weight="semibold">Sound</Body>
            </View>
            <Pill tone={soundOn ? 'success' : 'neutral'} label={soundOn ? 'On' : 'Off'} size="sm" />
          </View>
        </Card>
      </Pressable>

      <Spacer size="lg" />
      <Card padding="md" tone={tier === 'premium' ? 'success' : 'sunken'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Body weight="semibold">{tier === 'premium' ? 'Premium' : 'Free plan'}</Body>
            <Caption tone="muted">
              {tier === 'premium'
                ? 'The full journey is unlocked.'
                : 'Stage 1 is free. More stages are on the way.'}
            </Caption>
          </View>
          <Pill
            tone={tier === 'premium' ? 'success' : 'neutral'}
            label={tier === 'premium' ? 'Active' : 'Free'}
            size="sm"
          />
        </View>
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
            label="Install on this device"
            tone="secondary"
            size="md"
            accessibilityLabel="Install Hangul Route on this device"
            onPress={() => {
              forceInstallGuide();
              navigation.navigate('Main', { screen: 'Home' });
            }}
          />
        </>
      ) : null}

      <Spacer size="lg" />
      <Button
        label="Grown-up zone"
        tone="ghost"
        size="md"
        accessibilityLabel="Grown-up zone (PIN required)"
        onPress={() => openGrownUps('ParentDashboard')}
      />
      <Spacer size="xl" />
    </Screen>
  );
}
