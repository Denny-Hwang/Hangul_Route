import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
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
import type { RootStackParamList } from '../../navigation/types';
import { useAccountStore } from '../../store/account-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profiles = useProfileStore((s) => s.profiles);
  const active = useProfileStore(activeProfileSelector);
  const setActive = useProfileStore((s) => s.setActive);
  const snap = useProgressStore((s) => (active ? s.byProfile[active.id] : undefined));
  const subscription = useAccountStore((s) => s.subscription);
  const tier = entitlementTier(subscription, new Date());

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">Profiles</Heading>
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
        onPress={() => navigation.navigate('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } })}
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
            <Caption tone="muted">Streak</Caption>
            <Heading level="prompt">{snap?.streakDays ?? 0}</Heading>
          </View>
        </View>
      </Card>

      <Spacer size="lg" />
      <Card padding="md" tone={tier === 'premium' ? 'success' : 'sunken'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Body weight="semibold">{tier === 'premium' ? 'Premium' : 'Free plan'}</Body>
            <Caption tone="muted">
              {tier === 'premium'
                ? 'The full journey is unlocked.'
                : 'Stage 1 is free. Subscribe for the full journey.'}
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
      <Button
        label="Grown-up zone"
        tone="ghost"
        size="md"
        onPress={() => navigation.navigate('ParentGate', { next: 'ParentDashboard' })}
      />
      <Spacer size="xl" />
    </Screen>
  );
}
