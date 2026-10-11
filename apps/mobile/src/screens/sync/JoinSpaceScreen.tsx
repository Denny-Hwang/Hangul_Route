import { Body, Button, Caption, Card, Heading, HoyaBubble, Icon, Screen, Spacer, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { cleanJoinCode, isCodeError, isCompleteJoinCode, joinErrorMessage } from '../../logic/spaces/join-code';
import { relinkNotice } from '../../logic/sync/restore';
import type { RootStackParamList } from '../../navigation/types';
import { apiBaseUrl } from '../../platform/sync-api';
import { useMembershipStore, type LookupOutcome } from '../../store/membership-store';
import type { RosterName } from '../../platform/sync-api';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinSpace'>;
type Found = Extract<LookupOutcome, { ok: true }>['space'];
type Relink = { requestId: string; expiresAt: string; name: string };

export const RELINK_POLL_MS = 4000;

/**
 * sync/join-space — F-SPACE-001 §3.5. Code → confirm the roster name →
 * done. Not PIN-gated: the teacher is in the room; nothing about progress
 * moves or resets.
 */
export function JoinSpaceScreen({ navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.join;
  const profile = useProfileStore(activeProfileSelector);
  const lookup = useMembershipStore((s) => s.lookup);
  const join = useMembershipStore((s) => s.join);
  const requestRelink = useMembershipStore((s) => s.requestRelink);
  const pollRelink = useMembershipStore((s) => s.pollRelink);
  const setActive = useProfileStore((s) => s.setActive);
  const [roster, setRoster] = useState<RosterName[]>([]);
  const [picking, setPicking] = useState(false);
  const [relink, setRelink] = useState<Relink | null>(null);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; alreadyMember: boolean; notice?: string } | null>(null);
  const cloudAvailable = !!apiBaseUrl();

  const find = async (): Promise<void> => {
    setMessage(null);
    setBusy(true);
    const result = await lookup(code);
    setBusy(false);
    if (!result.ok) {
      setMessage(joinErrorMessage(result.error, messages.caregiver));
      return;
    }
    if (result.full) {
      setMessage(joinErrorMessage('cap_class', messages.caregiver));
      return;
    }
    setFound(result.space);
    setRoster(result.roster);
  };

  const askRelink = async (pick: RosterName): Promise<void> => {
    if (!found) return;
    setMessage(null);
    setBusy(true);
    const result = await requestRelink(found.id, code, pick.learnerId);
    setBusy(false);
    if (!result.ok) {
      setMessage(joinErrorMessage(result.error, messages.caregiver));
      return;
    }
    setRelink({ requestId: result.requestId, expiresAt: result.expiresAt, name: pick.name });
  };

  // Poll while the teacher decides (F-TCH-001 §10.1).
  useEffect(() => {
    if (!relink || !found) return undefined;
    let stopped = false;
    const tick = async (): Promise<void> => {
      const result = await pollRelink(found.id, relink.requestId);
      if (stopped) return;
      if (result.state === 'pending') return;
      setRelink(null);
      if (result.state === 'error') {
        setMessage(joinErrorMessage(result.error === 'off' ? 'off' : result.error === 'network' ? 'network' : 'unknown', messages.caregiver));
      } else if (result.state === 'approved') {
        setActive(result.plan.profile.id);
        setDone({ name: found.name, alreadyMember: true, notice: relinkNotice(result.plan, messages.caregiver) });
      } else if (result.state === 'denied') {
        setMessage(messages.caregiver.join.relink.denied);
      } else {
        setMessage(messages.caregiver.join.relink.expired);
      }
    };
    void tick();
    const handle = setInterval(() => void tick(), RELINK_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(handle);
    };
  }, [relink, found, pollRelink, setActive, messages]);

  const confirmName = async (): Promise<void> => {
    if (!profile || !found) return;
    setMessage(null);
    setBusy(true);
    const result = await join(profile.id, found.id, code, name.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setMessage(joinErrorMessage(result.error, messages.caregiver));
      if (isCodeError(result.error)) setFound(null);
      return;
    }
    setDone({ name: result.membership.name, alreadyMember: result.alreadyMember });
  };

  const seeYouAs = found?.kind === 'family' ? m.confirm.seeYouAs.family : m.confirm.seeYouAs.teacher;

  return (
    <Screen tone="canvas" scrollable>
      <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel={messages.a11y.goBack} style={{ alignSelf: 'flex-start', padding: spacing.xs }}>
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">{m.title}</Heading>
      <Spacer size="md" />
      <HoyaBubble tone={done ? 'cheering' : 'idle'} message={done ? m.bubble.done(done.name) : found ? m.bubble.found(found.name) : m.bubble.idle} />
      <Spacer size="xl" />

      {done ? (
        <Card padding="lg" tone="success" testID="join-done">
          <Body align="center">{done.notice ?? (done.alreadyMember ? m.done.already(done.name) : m.done.joined(done.name))}</Body>
          <Spacer size="lg" />
          <Button label={m.done.backToToday.cta} tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
        </Card>
      ) : relink ? (
        <Card padding="lg" tone="brand" testID="join-waiting">
          <Body align="center">{m.waiting.line(relink.name)}</Body>
          <Spacer size="xs" />
          <Caption tone="muted" align="center">{m.waiting.caption}</Caption>
          <Spacer size="md" />
          <Button label={m.waiting.neverMind.cta} tone="ghost" size="sm" fullWidth onPress={() => setRelink(null)} />
        </Card>
      ) : picking ? (
        <Card padding="lg" tone="brand" testID="join-pick">
          <Caption tone="muted">{m.pick.prompt}</Caption>
          <Spacer size="sm" />
          <View style={{ gap: spacing.sm }}>
            {roster.map((r) => (
              <Button key={r.learnerId} label={r.name} tone="secondary" size="md" fullWidth disabled={busy} onPress={() => void askRelink(r)} />
            ))}
          </View>
          <Spacer size="sm" />
          <Button label={m.pick.newHere.cta} tone="ghost" size="sm" fullWidth onPress={() => setPicking(false)} />
        </Card>
      ) : found ? (
        <Card padding="lg" tone="brand" testID="join-confirm">
          <Caption tone="muted">{seeYouAs}</Caption>
          <Spacer size="xs" />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoCorrect={false}
            accessibilityLabel={messages.a11y.joinName}
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
          <Button label={busy ? m.confirm.joining.cta : m.confirm.me.cta} tone="primary" size="lg" fullWidth disabled={busy || name.trim().length === 0} onPress={() => void confirmName()} />
          <Spacer size="sm" />
          {roster.length > 0 ? <Button label={m.confirm.alreadyIn.cta} tone="ghost" size="sm" fullWidth onPress={() => setPicking(true)} /> : null}
          <Button label={m.confirm.notThis.cta} tone="ghost" size="sm" fullWidth onPress={() => { setFound(null); setRoster([]); }} />
        </Card>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setMessage(null);
              setCode(cleanJoinCode(v));
            }}
            placeholder={m.code.placeholder}
            placeholderTextColor={colors.text.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            accessibilityLabel={messages.a11y.classCode}
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
          <Caption tone="muted" align="center">{m.code.rules}</Caption>
          <Spacer size="md" />
          <Button label={busy ? m.code.looking.cta : m.code.join.cta} tone="primary" size="hero" fullWidth disabled={busy || !cloudAvailable || !isCompleteJoinCode(code)} onPress={() => void find()} />
          {!cloudAvailable ? (
            <>
              <Spacer size="xs" />
              <Caption tone="muted" align="center">{joinErrorMessage('off', messages.caregiver)}</Caption>
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
