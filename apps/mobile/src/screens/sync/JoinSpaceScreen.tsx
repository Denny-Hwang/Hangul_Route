import { Body, Button, Caption, Card, Heading, Hoya, HoyaBubble, Icon, Screen, Spacer, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { cleanJoinCode, isCodeError, isCompleteJoinCode, joinErrorMessage } from '../../logic/spaces/join-code';
import type { RootStackParamList } from '../../navigation/types';
import { apiBaseUrl } from '../../platform/sync-api';
import { useMembershipStore, type LookupOutcome } from '../../store/membership-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinSpace'>;
type Found = Extract<LookupOutcome, { ok: true }>['space'];

/**
 * sync/join-space — F-SPACE-001 §3.5. Code → confirm the roster name →
 * done. Not PIN-gated: the teacher is in the room; nothing about progress
 * moves or resets.
 */
export function JoinSpaceScreen({ navigation }: Props): React.ReactElement {
  const profile = useProfileStore(activeProfileSelector);
  const lookup = useMembershipStore((s) => s.lookup);
  const join = useMembershipStore((s) => s.join);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; alreadyMember: boolean } | null>(null);
  const cloudAvailable = !!apiBaseUrl();

  const find = async (): Promise<void> => {
    setMessage(null);
    setBusy(true);
    const result = await lookup(code);
    setBusy(false);
    if (!result.ok) {
      setMessage(joinErrorMessage(result.error));
      return;
    }
    if (result.full) {
      setMessage(joinErrorMessage('cap_class'));
      return;
    }
    setFound(result.space);
  };

  const confirmName = async (): Promise<void> => {
    if (!profile || !found) return;
    setMessage(null);
    setBusy(true);
    const result = await join(profile.id, found.id, code, name.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setMessage(joinErrorMessage(result.error));
      if (isCodeError(result.error)) setFound(null);
      return;
    }
    setDone({ name: result.membership.name, alreadyMember: result.alreadyMember });
  };

  const who = found?.kind === 'family' ? 'Your family' : 'Your teacher';

  return (
    <Screen tone="canvas" scrollable>
      <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel="Go back" style={{ alignSelf: 'flex-start', padding: spacing.xs }}>
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Join a class</Heading>
      <Spacer size="md" />
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Hoya pose={done ? 'cheering' : 'idle'} size={64} />
        <View style={{ flex: 1 }}>
          <HoyaBubble tone={done ? 'cheering' : 'idle'} message={done ? `You're in ${done.name}!` : found ? `${found.name} found!` : 'Type the code your teacher gave you.'} />
        </View>
      </View>
      <Spacer size="xl" />

      {done ? (
        <Card padding="lg" tone="success" testID="join-done">
          <Body align="center">{done.alreadyMember ? `You're already in ${done.name}.` : `You're in ${done.name}. New missions may show up on Today.`}</Body>
          <Spacer size="lg" />
          <Button label="Back to today" tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
        </Card>
      ) : found ? (
        <Card padding="lg" tone="brand" testID="join-confirm">
          <Caption tone="muted">{who} will see you as:</Caption>
          <Spacer size="xs" />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoCorrect={false}
            accessibilityLabel="Name your teacher will see"
            style={{
              minHeight: touchTarget.child,
              paddingHorizontal: spacing.md,
              fontSize: typography.size.title,
              fontWeight: '700',
              color: colors.text.primary,
              backgroundColor: colors.surface.paper,
              borderWidth: 2,
              borderColor: colors.border.subtle,
              borderRadius: radii.lg,
            }}
          />
          <Spacer size="md" />
          <Button label={busy ? 'Joining…' : "That's me"} tone="primary" size="lg" fullWidth disabled={busy || name.trim().length === 0} onPress={() => void confirmName()} />
          <Spacer size="sm" />
          <Button label="Not this one" tone="ghost" size="sm" fullWidth onPress={() => setFound(null)} />
        </Card>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setMessage(null);
              setCode(cleanJoinCode(v));
            }}
            placeholder="ABC123"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            accessibilityLabel="Class code"
            testID="join-code"
            style={{
              minHeight: touchTarget.hero,
              textAlign: 'center',
              fontSize: typography.size.display,
              fontWeight: '700',
              letterSpacing: spacing.sm,
              color: colors.text.primary,
              backgroundColor: colors.surface.paper,
              borderWidth: 2,
              borderColor: colors.border.subtle,
              borderRadius: radii.lg,
            }}
          />
          <Spacer size="xs" />
          <Caption tone="muted" align="center">6 letters or numbers — no O, I, 0 or 1</Caption>
          <Spacer size="md" />
          <Button label={busy ? 'Looking…' : 'Join'} tone="primary" size="hero" fullWidth disabled={busy || !cloudAvailable || !isCompleteJoinCode(code)} onPress={() => void find()} />
          {!cloudAvailable ? (
            <>
              <Spacer size="xs" />
              <Caption tone="muted" align="center">{joinErrorMessage('off')}</Caption>
            </>
          ) : null}
        </>
      )}

      {message ? (
        <>
          <Spacer size="md" />
          <Caption tone="secondary" align="center">{message}</Caption>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
