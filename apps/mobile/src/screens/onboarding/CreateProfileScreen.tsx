import type { AvatarKind } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
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
import { isValidEmail } from '../../logic/email';
import type { OnboardingStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useProfileStore } from '../../store/profile-store';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CreateProfile'>;

const AVATARS: AvatarKind[] = ['hoya-orange', 'hoya-blue', 'hoya-green', 'hoya-purple', 'hoya-pink'];
type AgeGroup = '5-7' | '8-9' | '10-11';

const AGE_GROUPS: Array<{ value: AgeGroup; label: string; description: string }> = [
  { value: '5-7', label: '5–7', description: 'Big tiles, lots of pictures' },
  { value: '8-9', label: '8–9', description: 'Some reading and sentences' },
  { value: '10-11', label: '10–11', description: 'Stories and conversations' },
];

export function CreateProfileScreen({ navigation, route }: Props): React.ReactElement {
  const createProfile = useProfileStore((s) => s.createProfile);
  const consentAcceptedAt = useAccountStore((s) => s.consentAcceptedAt);
  const acceptConsent = useAccountStore((s) => s.acceptConsent);
  const saveParentEmail = useAccountStore((s) => s.setParentEmail);

  const firstRun = route.params?.firstRun ?? false;
  const needsConsent = firstRun && !consentAcceptedAt;

  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'5-7' | '8-9' | '10-11'>('5-7');
  const [avatar, setAvatar] = useState<AvatarKind>('hoya-orange');
  const [parentEmail, setParentEmail] = useState('');
  const [consent, setConsent] = useState(false);

  const nameValid = name.trim().length >= 1 && name.trim().length <= 20;
  const emailOk = parentEmail.trim() === '' || isValidEmail(parentEmail);
  const valid = nameValid && emailOk && (!needsConsent || consent);

  const onSubmit = (): void => {
    if (!valid) return;
    if (needsConsent) {
      acceptConsent();
      if (parentEmail.trim()) saveParentEmail(parentEmail);
    }
    const profile = createProfile({ displayName: name.trim(), ageGroup, avatar });
    void track({
      name: 'onboarding.started',
      profileId: profile.id,
      payload: { ageGroup, firstRun, hasParentEmail: parentEmail.trim().length > 0 },
    });
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

      {needsConsent ? (
        <>
          <Spacer size="xxl" />
          <Card padding="md" tone="sunken">
            <Body weight="semibold">For a grown-up</Body>
            <Spacer size="xs" />
            <Body tone="secondary" size="sm">
              A parent or guardian sets up the account. We collect as little as possible and never
              show ads.
            </Body>

            <Spacer size="md" />
            <Body weight="semibold" size="sm">
              Parent email (optional)
            </Body>
            <Caption tone="muted">For progress backup and receipts.</Caption>
            <Spacer size="xs" />
            <TextInput
              value={parentEmail}
              onChangeText={setParentEmail}
              placeholder="grown-up@email.com"
              placeholderTextColor={colors.text.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
              style={{
                backgroundColor: colors.surface.paper,
                borderRadius: radii.lg,
                borderWidth: 2,
                borderColor: emailOk ? colors.border.subtle : colors.feedback.nudge,
                paddingHorizontal: spacing.lg,
                minHeight: touchTarget.child,
                fontSize: typography.size.bodyLg,
                color: colors.text.primary,
              }}
            />
            {!emailOk ? (
              <>
                <Spacer size="xxs" />
                <Caption tone="muted">That email looks off — check the spelling.</Caption>
              </>
            ) : null}

            <Spacer size="md" />
            <Pressable
              onPress={() => setConsent((c) => !c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              accessibilityLabel="I am a parent or guardian and I agree to the Privacy Policy"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.sm,
                  borderWidth: 2,
                  borderColor: consent ? colors.brand.primary : colors.border.strong,
                  backgroundColor: consent ? colors.brand.primary : colors.surface.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {consent ? <Text style={{ color: colors.text.inverse, fontWeight: '700' }}>✓</Text> : null}
              </View>
              <Body size="sm" style={{ flex: 1 }}>
                I&apos;m a parent or guardian and I agree to the Privacy Policy.
              </Body>
            </Pressable>
          </Card>
        </>
      ) : null}

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
