import { Body, Button, Caption, Card, Heading, HoyaBubble, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { codeFieldFontSize, cleanJoinCode, isCodeError, isCompleteJoinCode, joinErrorMessage, joinPrefill, lookupRefusal } from '../../logic/spaces/join-code';
import { nameHint } from '../../logic/onboarding/create-profile-form';
import { validateDisplayName } from '../../logic/profiles/profile-model';
import { relinkNotice } from '../../logic/sync/restore';
import type { RootStackParamList } from '../../navigation/types';
import { takeJoinHandoff } from '../../platform/join-handoff';
import { apiBaseUrl } from '../../platform/sync-api';
import { useMembershipStore, type LookupOutcome } from '../../store/membership-store';
import type { RosterName } from '../../platform/sync-api';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useAudience } from '../../store/audience';
import { useUiStore } from '../../store/ui-store';
import { isParentSessionValid } from '../../logic/profiles/session';
import { flags } from '../../config/flags';
import { tileOrder } from '../../logic/profiles/who';
import { batchOffered, checklistRows, locksThatCount, type ChecklistRow } from '../../logic/spaces/join-batch';
import { useAccountStore } from '../../store/account-store';
import { holdJoin, learnerProfiles, readProfileLocks, takeBatchHandoff, takeBatchLaunchChooser } from '../../store/who-chooser';
import { JoinBatch } from './JoinBatch';
import { JoinNameField } from './JoinNameField';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinSpace'>;
type Found = Extract<LookupOutcome, { ok: true }>['space'];
type Relink = { requestId: string; expiresAt: string; name: string };

export const RELINK_POLL_MS = 4000;

/**
 * sync/join-space — F-SPACE-001 §3.5. Code → confirm the roster name →
 * done. Not PIN-gated: the teacher is in the room; nothing about progress
 * moves or resets.
 *
 * Join prefill (F-APP-001 A-7, sections 3.6 and 3.8, web): a family join code the family home's
 * "Open the app on this device" left in this tab fills the field the next time this screen is
 * shown within 30 minutes (read once); every step after it is unchanged. The class join link
 * (`/join#c=<code>`, owner decision 2026-10-17) passes its code as the `code` param, which wins.
 *
 * The name (F-LEARN-001 section 3.11): the field starts from the profile name and follows the profile rule
 * (`validateDisplayName`, the create form's hints). The Worker writes the join name over the learner's name for the
 * family and every class, so a changed name becomes the profile name after the join (`membership-store.join`).
 * The screen is not PIN-gated, but a rename is a grown-up action (Edit profile opens behind the gate): on a device
 * whose gate is closed the field keeps the profile name and says the name changes in Edit profile. A class tablet
 * keeps the profile name too, with Edit profile's class-device line. The store decides again when the join is sent
 * (`membership-store.join`), so a session that ends between this render and the tap renames nothing anywhere.
 *
 * [SA] Learner caps (AMENDMENTS-SEATS-ADMINS section 3.4): the lookup carries the active learner, and its `seat` picks
 * the line (a full family, class or school). At a full class with a roster the roster pick and relink stay, with the
 * line above "I'm new"; the atomic `/join` is still the only gate, and its refusal reads the cap the Worker sent.
 *
 * [OA] Who is joining? (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, OA-D20, sections 10.3 and 10.6; row OA-7b): with
 * `flags.multiJoinEnabled` on, a family the lookup found on a device with 2 or more learner profiles opens the
 * checklist (`JoinBatch`) in place of the one-learner name step; class codes keep the one-learner flow. A family
 * hand-off code the launch took for the checklist (`takeBatchHandoff`) fills the code and is looked up at once; should
 * it turn out to be a class code, it is held and the chooser asks who is joining (OA-D20), never joining as whoever
 * played last.
 */
export function JoinSpaceScreen({ navigation, route }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const locale = useLocale();
  const [codeFieldWidth, setCodeFieldWidth] = useState(0);
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
  // [SA] The at-cap line of a full class with a roster (section 3.4): shown above "I'm new", never in place of the roster.
  const [seatLine, setSeatLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; alreadyMember: boolean; notice?: string } | null>(null);
  // [OA] Who is joining? (row OA-7b): the checklist rows once the lookup found a family it applies to.
  const [batch, setBatch] = useState<readonly ChecklistRow[] | null>(null);
  // [OA] The launch's family hand-off code (OA-D20): looked up at once, once.
  const [launchCode, setLaunchCode] = useState<string | null>(null);
  const cloudAvailable = !!apiBaseUrl();
  // The grown-up gate (F-LEARN-001 L7), read like ProfileScreen reads it: closed means the name cannot change here.
  const { opensDirectly } = useAudience();
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const gateClosed = !opensDirectly(isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now()));
  // A class tablet cannot rename the learner (Edit profile's rule): the field keeps the profile name there too.
  const deviceScope = useMembershipStore((s) => s.deviceScope);
  const [classDevice, setClassDevice] = useState(false);
  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (profileId === null) return undefined;
    let live = true;
    void deviceScope(profileId).then(
      (scope) => {
        if (live) setClassDevice(scope === 'class');
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [profileId, deviceScope]);
  const nameLocked = gateClosed || classDevice;
  const joinName = nameLocked ? (profile?.displayName ?? '') : name;

  // The class join link's code (owner decision 2026-10-17) first, else the family home's hand-off; read once. The
  // hand-off is always taken, so a code left in the tab never fills a later Join screen.
  const linkCode = route.params?.code;
  useEffect(() => {
    const launched = takeBatchHandoff();
    const handed = launched ?? takeJoinHandoff();
    const prefill = joinPrefill(linkCode, handed);
    if (prefill !== null) setCode(prefill);
    if (launched !== null && prefill !== null && linkCode === undefined) setLaunchCode(prefill);
  }, [linkCode]);

  /**
   * [OA] The checklist rows when Who is joining? applies to this family (section 10.3), else null: the flag on, 2 or
   * more learner profiles, at least one not class-scoped on this device. Locks count only with a PIN (fail closed).
   */
  const batchRowsFor = async (kind: Found['kind']): Promise<ChecklistRow[] | null> => {
    const learners = tileOrder(learnerProfiles(useProfileStore.getState().profiles), locale);
    if (!flags.multiJoinEnabled || kind !== 'family' || learners.length < 2) return null;
    const ids = learners.map((l) => l.id);
    // A scope that cannot be read fails closed, as the locks do: the row is disabled (Linked for a class on this device.).
    const scopes = await Promise.all(ids.map((id) => deviceScope(id).catch(() => 'class' as const)));
    const classScoped = ids.filter((_, i) => scopes[i] === 'class');
    if (!batchOffered({ flag: true, kind, learners, classScoped })) return null;
    const locks = locksThatCount(await readProfileLocks(), useAccountStore.getState().parentPinHash !== null, ids);
    return checklistRows({ learners, activeId: profileId, locks, classScoped });
  };

  const find = async (typed: string = code): Promise<void> => {
    setMessage(null);
    setSeatLine(null);
    setBusy(true);
    // [SA] The active learner goes with the lookup, so a member who already holds the seat finds room (section 3.4).
    const result = await lookup(typed, profileId ?? undefined);
    if (!result.ok) {
      setBusy(false);
      setMessage(joinErrorMessage(result.error, messages.caregiver));
      return;
    }
    // [OA] OA-D20: the launch's hand-off code was a class code after all: the chooser asks who is joining.
    if (launchCode !== null && result.space.kind !== 'family' && flags.whoChooserEnabled) {
      setBusy(false);
      // The chooser shows now, so the one the launch deferred is spent.
      takeBatchLaunchChooser();
      holdJoin(typed);
      navigation.navigate('WhoIsUsing', { trigger: 'join' });
      return;
    }
    const rows = await batchRowsFor(result.space.kind);
    setBusy(false);
    // [SA] The line comes from `seat.reason` (else the old `full`). At a class with a roster, a returning student can
    // still pick their name (relink takes no seat), so the roster stays and the line sits above "I'm new".
    // [OA] Who is joining? reads each learner's seat from its own `/join` (a member keeps its place), so the lookup's
    // line for the active learner does not stop the checklist (section 10.2).
    const refusal = rows !== null ? null : lookupRefusal({ kind: result.space.kind, full: result.full, seat: result.seat });
    if (refusal !== null) {
      const line = joinErrorMessage(refusal.code, messages.caregiver, refusal.cap);
      if (result.space.kind !== 'class' || result.roster.length === 0) {
        setMessage(line);
        return;
      }
      setSeatLine(line);
      setPicking(true);
    }
    setFound(result.space);
    setRoster(result.roster);
    setBatch(rows);
  };

  // [OA] The launch's family hand-off code is looked up at once, so the checklist opens (OA-D20).
  useEffect(() => {
    if (launchCode === null) return;
    void find(launchCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per launch code
  }, [launchCode]);

  // [OA] OA-D20, CS-5: a launch that took the hand-off code deferred its chooser. Leaving Join (Done, Back to today, a
  // back gesture) opens "Who is using this?" as the launch would have, instead of Home as whoever played last.
  useEffect(() => {
    if (launchCode === null) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      const trigger = takeBatchLaunchChooser();
      if (trigger === null) return;
      e.preventDefault();
      navigation.reset({ index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger } }] });
    });
  }, [launchCode, navigation]);

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

  // The create form's calm hints (too long, a character the rule refuses); an empty field only keeps the button closed.
  // A stored name that predates the rule joins as it is (it stays the profile name), so only a changed name is checked.
  const unchanged = profile !== null && joinName.trim() === profile.displayName;
  const hint = unchanged ? null : nameHint(joinName, messages.learner.createProfile.nameHint);
  const nameOk = joinName.trim().length > 0 && (unchanged || validateDisplayName(joinName) === null);

  const confirmName = async (): Promise<void> => {
    if (!profile || !found || !nameOk) return;
    setMessage(null);
    setBusy(true);
    const result = await join(profile.id, found.id, code, joinName.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setMessage(joinErrorMessage(result.error, messages.caregiver, result.cap));
      if (isCodeError(result.error)) setFound(null);
      return;
    }
    setDone({ name: result.membership.name, alreadyMember: result.alreadyMember });
  };

  const seeYouAs = found?.kind === 'family' ? m.confirm.seeYouAs.family : m.confirm.seeYouAs.teacher;

  return (
    <Screen tone="canvas" scrollable>
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
          {seatLine !== null ? (
            <>
              <Caption tone="secondary" align="center" testID="join-seat-line">{seatLine}</Caption>
              <Spacer size="sm" />
            </>
          ) : null}
          <Button
            label={m.pick.newHere.cta}
            tone="ghost"
            size="sm"
            fullWidth
            onPress={() => {
              setPicking(false);
              // A new learner reads the line on the name step too; the join still decides.
              if (seatLine !== null) setMessage(seatLine);
            }}
          />
        </Card>
      ) : found && batch !== null ? (
        <JoinBatch
          space={found}
          code={code}
          rows={batch}
          gateClosed={gateClosed}
          askPin={() => navigation.navigate('PinEntry', { next: 'JoinSpace' })}
          onDone={() => navigation.navigate('Main', { screen: 'Home' })}
        />
      ) : found ? (
        <Card padding="lg" tone="brand" testID="join-confirm">
          <Caption tone="muted">{seeYouAs}</Caption>
          <Spacer size="xs" />
          <JoinNameField value={joinName} onChange={setName} locked={nameLocked} classDevice={classDevice} profileName={profile?.displayName ?? ''} hint={hint} />
          <Spacer size="md" />
          <Button label={busy ? m.confirm.joining.cta : m.confirm.me.cta} tone="primary" size="lg" fullWidth disabled={busy || !nameOk} onPress={() => void confirmName()} />
          <Spacer size="sm" />
          {roster.length > 0 ? (
            <Button
              label={m.confirm.alreadyIn.cta}
              tone="ghost"
              size="sm"
              fullWidth
              onPress={() => {
                // The pick card shows the at-cap line itself, so the slot below lets it go: the line is said once.
                if (seatLine !== null && message === seatLine) setMessage(null);
                setPicking(true);
              }}
            />
          ) : null}
          <Button label={m.confirm.notThis.cta} tone="ghost" size="sm" fullWidth onPress={() => { setFound(null); setRoster([]); if (message === seatLine) setMessage(null); setSeatLine(null); }} />
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
            // The code is drawn as large as the text size asks, but never so large that a whole code is cut (section 4).
            onLayout={(e) => setCodeFieldWidth(e.nativeEvent.layout.width - 2 * borderWidth.base)}
            style={{
              minHeight: touchTarget.hero,
              textAlign: 'center',
              fontSize: codeFieldFontSize(textScale.size.display, codeFieldWidth, spacing.sm),
              fontWeight: '700',
              letterSpacing: spacing.sm,
              color: colors.text.primary,
              backgroundColor: colors.surface.paper,
              borderWidth: borderWidth.base,
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
