import type { AvatarKind } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CreateProfile'>;

const AVATARS: AvatarKind[] = ['hoya-orange', 'hoya-blue', 'hoya-green', 'hoya-purple', 'hoya-pink'];
type AgeGroup = '5-7' | '8-9' | '10-11';

const AGE_GROUPS: Array<{ value: AgeGroup; label: string; description: string }> = [
  { value: '5-7', label: '5–7', description: 'Big tiles, lots of pictures' },
  { value: '8-9', label: '8–9', description: 'Some reading and sentences' },
  { value: '10-11', label: '10–11', description: 'Stories and conversations' },
];

export function CreateProfileScreen({ navigation }: Props): React.ReactElement {
  const createProfile = useProfileStore((s) => s.createProfile);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'5-7' | '8-9' | '10-11'>('5-7');
  const [avatar, setAvatar] = useState<AvatarKind>('hoya-orange');

  const valid = name.trim().length >= 1 && name.trim().length <= 20;

  const onSubmit = (): void => {
    if (!valid) return;
    const profile = createProfile({ displayName: name.trim(), ageGroup, avatar });
    navigation.replace('FirstQuestPreview', { profileId: profile.id });
  };

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">Who&apos;s playing?</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">A grown-up can help with this.</Body>

      <Spacer size="xl" />
      <Body weight="semibold">Your name</Body>
      <Spacer size="xs" />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Type your name"
        placeholderTextColor={colors.text.muted}
        maxLength={20}
        autoCapitalize="words"
        style={{
          backgroundColor: colors.surface.paper,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: colors.border.subtle,
          paddingHorizontal: spacing.lg,
          minHeight: touchTarget.child,
          fontSize: typography.size.bodyLg,
          color: colors.text.primary,
        }}
      />

      <Spacer size="xl" />
      <Body weight="semibold">How old are you?</Body>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {AGE_GROUPS.map((g) => {
          const active = ageGroup === g.value;
          return (
            <Pressable
              key={g.value}
              onPress={() => setAgeGroup(g.value)}
              accessibilityRole="button"
              accessibilityLabel={`Age group ${g.label}`}
              style={{
                flexBasis: '31%',
                minHeight: touchTarget.child,
                backgroundColor: active ? colors.brand.primaryLight : colors.surface.paper,
                borderColor: active ? colors.brand.primary : colors.border.subtle,
                borderWidth: 2,
                borderRadius: radii.lg,
                padding: spacing.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: colors.text.primary }}>
                {g.label}
              </Text>
              <Text
                style={{
                  marginTop: spacing.xxs,
                  fontSize: typography.size.caption,
                  color: colors.text.muted,
                  textAlign: 'center',
                }}
              >
                {g.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Spacer size="xl" />
      <Body weight="semibold">Pick a Hoya</Body>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {AVATARS.map((a) => {
          const active = avatar === a;
          return (
            <Pressable
              key={a}
              onPress={() => setAvatar(a)}
              accessibilityLabel={`Avatar ${a}`}
              style={{
                minWidth: touchTarget.child,
                minHeight: touchTarget.child,
                backgroundColor: active ? colors.brand.primaryLight : colors.surface.paper,
                borderWidth: 2,
                borderColor: active ? colors.brand.primary : colors.border.subtle,
                borderRadius: radii.lg,
                padding: spacing.xs,
              }}
            >
              <Hoya pose="idle" size={64} />
            </Pressable>
          );
        })}
      </View>

      <Spacer size="xxl" />
      <Card padding="md" tone="brand">
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Hoya pose="cheering" size={56} />
          <View style={{ flex: 1 }}>
            <Body weight="semibold">Ready to go!</Body>
            <Body tone="secondary" size="sm">
              Your name and choices stay on this device.
            </Body>
          </View>
        </View>
      </Card>
      <Spacer size="lg" />
      <Button
        label="Continue"
        tone="primary"
        size="hero"
        fullWidth
        disabled={!valid}
        onPress={onSubmit}
      />
      <Spacer size="xl" />
    </Screen>
  );
}
