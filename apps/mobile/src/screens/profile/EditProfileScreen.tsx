import { LEARNER_LEVELS, type LearnerType } from '@hangul-route/content-schema';
import { levelWords } from '@hangul-route/i18n';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Icon,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useTypeScale,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { OptionCard } from '../../components/OptionCard';
import { PinSetupField } from '../../components/PinSetupField';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useMessages } from '../../i18n/use-messages';
import { privacyUrl } from '../../logic/links';
import { nameHint } from '../../logic/onboarding/create-profile-form';
import { PIN_SETUP_START, type PinSetupState } from '../../logic/onboarding/pin-setup';
import { canChooseWho } from '../../logic/onboarding/setup-steps';
import { AVATAR_PRESETS } from '../../logic/profiles/avatar-catalog';
import {
  editMissing,
  editPlan,
  initialEditDraft,
  keepWithGrownUp,
  levelEditable,
  submitEdit,
  type EditDraft,
  type EditState,
} from '../../logic/profiles/edit-profile';
import { createPinHash } from '../../logic/profiles/pin-hash';
import { NAME_MAX } from '../../logic/profiles/profile-model';
import type { RootStackParamList } from '../../navigation/types';
import { pinHasher } from '../../platform/crypto';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useMembershipStore } from '../../store/membership-store';
import { useProfileStore } from '../../store/profile-store';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const CHECKBOX_SIZE = spacing.xl + spacing.xs;

/**
 * Edit profile — F-LEARN-001 §3.11. Name, reading level, cub and who is
 * learning, entered from "Edit" on a switcher card (behind the PIN when the
 * gate is required; ProfileScreen decides). A change of who is learning asks
 * the consent the create form would, and a PIN for a child on a device with
 * none. Name, level and cub edits reach the server with the next sync, and the class roster with them; on a
 * class device (a class re-link, `logic/transfers/device-scope`) the server refuses them, so those rows stay as
 * they are and a line says the learner's own device changes them (§3.11).
 * Design reference: design/wireframes/onboarding/all-ages-onboarding.md, I, and
 * onboarding/setup-steps.md, G (the Privacy block and "I'm under 13", F-LEARN-001 §3.15.6).
 * Rules live in logic/profiles/edit-profile (tested); this file paints them.
 */
export function EditProfileScreen({ navigation, route }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const messages = useMessages();
  const m = messages.learner;
  const e = m.editProfile;
  const { profileId } = route.params;
  const original = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const guardianAcceptedAt = useAccountStore((s) => s.guardianConsentAcceptedAt);
  const selfAcceptedAt = useAccountStore((s) => s.selfConsentAcceptedAt);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const acceptGuardianConsent = useAccountStore((s) => s.acceptGuardianConsent);
  const acceptSelfConsent = useAccountStore((s) => s.acceptSelfConsent);
  const setParentPinHash = useAccountStore((s) => s.setParentPinHash);
  const inClass = useMembershipStore((s) => (s.byLearner[profileId] ?? []).some((r) => r.kind === 'class'));
  const hydrateMemberships = useMembershipStore((s) => s.hydrate);
  const deviceScope = useMembershipStore((s) => s.deviceScope);
  /**
   * Whether this is a class device, where the server refuses name, level and cub edits (§3.11). Until the answer is
   * read (a storage read) Save stays closed, so a quick tap cannot queue an edit a class device's server would refuse.
   */
  const [scope, setScope] = useState<'unknown' | 'full' | 'class'>('unknown');
  const classDevice = scope === 'class';

  const [draft, setDraft] = useState<EditDraft | null>(() => (original ? initialEditDraft(original) : null));
  const [agreed, setAgreed] = useState(false);
  const [pinSetup, setPinSetup] = useState<PinSetupState>(PIN_SETUP_START);
  const [pinError, setPinError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * "I'm under 13" put the who row back: say the profile stays with a grown-up,
   * and keep "Me" closed while this screen is open (the statement is latched, §3.15.6).
   */
  const [kept, setKept] = useState(false);
  // `busy` is React state, so two taps before the re-render would both read `false`;
  // this ref closes Save on the first tap (one hash, one consent, one goBack).
  const submitting = useRef(false);

  useEffect(() => {
    void hydrateMemberships(profileId);
  }, [profileId, hydrateMemberships]);

  useEffect(() => {
    let live = true;
    setScope('unknown');
    void deviceScope(profileId).then(
      (answer) => {
        if (!live) return;
        setScope(answer);
        if (answer !== 'class') return;
        // Anything typed before the answer came back goes back to the stored values: those rows cannot save here.
        const stored = useProfileStore.getState().profiles.find((p) => p.id === profileId);
        if (stored) {
          const start = initialEditDraft(stored);
          setDraft((d) => (d ? { ...d, name: start.name, level: start.level, avatar: start.avatar } : d));
        }
      },
      // A storage read that fails reads as a full device: the server still refuses a class device's edit, and nothing else changes.
      () => {
        if (live) setScope('full');
      },
    );
    return () => {
      live = false;
    };
  }, [profileId, deviceScope]);

  // The way back is the route's ScreenHeader (AMENDMENTS-DISPLAY-NAV section 7.1); the title stays in the screen.
  const back = (
    <>
      <Heading level="title">{e.title}</Heading>
    </>
  );

  if (original === null || draft === null) {
    return (
      <Screen tone="canvas" scrollable>
        {back}
        <Spacer size="md" />
        <Body tone="secondary">{e.notFound}</Body>
      </Screen>
    );
  }

  const state: EditState = {
    original,
    draft,
    agreed,
    pin: pinSetup.pin,
    guardianAcceptedAt,
    selfAcceptedAt,
    parentPinHash,
  };
  const plan = editPlan(state);
  const missing = editMissing(state);
  // A stored name that predates the rule stays as it is, so only a changed name gets a hint.
  const hint = plan.changed.includes('name') ? nameHint(draft.name, m.createProfile.nameHint) : null;
  const showCard = plan.consent !== null || plan.pinRequired;

  const change = (patch: Partial<EditDraft>): void => {
    setDraft({ ...draft, ...patch });
    setSaveError(null);
  };

  const chooseWho = (next: LearnerType): void => {
    if (next === draft.learnerType || !canChooseWho(next, kept)) return;
    change({ learnerType: next });
    // The consent wording and the PIN rule change with the answer: start those over.
    setAgreed(false);
    setPinSetup(PIN_SETUP_START);
    setPinError(null);
  };

  const underThirteen = (): void => {
    change(keepWithGrownUp(draft));
    setAgreed(false);
    setPinSetup(PIN_SETUP_START);
    setPinError(null);
    setKept(true);
  };

  const openPrivacy = async (): Promise<void> => {
    try {
      await Linking.openURL(privacyUrl());
      setLinkNote(null);
    } catch {
      setLinkNote(e.privacyFallback);
    }
  };

  const onSave = async (): Promise<void> => {
    if (missing !== null || scope === 'unknown' || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setPinError(null);
    setSaveError(null);
    let done = false;
    try {
      const result = await submitEdit(state, {
        hashPin: (pin) => createPinHash(pin, pinHasher),
        acceptGuardianConsent,
        acceptSelfConsent,
        setParentPinHash,
        updateProfile,
        track: (event) => void track(event),
      });
      if (result.ok) {
        done = true;
        navigation.goBack();
      } else if (result.reason === 'pin-failed') setPinError(e.pinFailed);
      else setSaveError(e.saveFailed);
    } catch {
      setSaveError(e.saveFailed);
    } finally {
      // After a save the screen is leaving: keep Save closed so a late tap cannot go back twice.
      if (!done) submitting.current = false;
      setBusy(false);
    }
  };

  const consentText = plan.consent === 'self' ? e.self.agree : e.guardian.agree;

  return (
    <Screen tone="canvas" scrollable>
      {back}

      {classDevice ? (
        <>
          <Spacer size="md" />
          <Caption tone="secondary" testID="edit-class-device">
            {e.classDevice}
          </Caption>
        </>
      ) : null}
      <Spacer size="lg" />
      <Body weight="semibold">{e.nameLabel}</Body>
      <Spacer size="xs" />
      <TextInput
        value={draft.name}
        onChangeText={(name) => change({ name })}
        placeholder={e.namePlaceholder}
        placeholderTextColor={colors.text.muted}
        accessibilityLabel={e.nameLabel}
        maxLength={Math.max(NAME_MAX, original.displayName.length)}
        autoCapitalize="words"
        editable={!classDevice}
        aria-disabled={classDevice}
        style={{
          backgroundColor: classDevice ? colors.surface.sunken : colors.surface.paper,
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: colors.border.subtle,
          paddingHorizontal: spacing.lg,
          minHeight: touchTarget.child,
          fontSize: textScale.size.bodyLg,
          color: classDevice ? colors.text.secondary : colors.text.primary,
        }}
      />
      {hint !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary">{hint}</Caption>
        </>
      ) : null}

      {levelEditable(original) ? (
        <>
          <Spacer size="xl" />
          <Body weight="semibold">{e.levelHeading}</Body>
          <Spacer size="sm" />
          <View accessibilityRole="radiogroup" accessibilityLabel={e.levelHeading} style={{ gap: spacing.sm }}>
            {/* Every LEARNER_LEVELS id has dictionary words; an id without them is skipped, never drawn in English. */}
            {LEARNER_LEVELS.flatMap((l) => {
              const levelText = levelWords(messages, l.id);
              return levelText === null
                ? []
                : [
                    <OptionCard
                      key={l.id}
                      label={levelText.label}
                      description={levelText.description}
                      selected={draft.level === l.id}
                      disabled={classDevice}
                      onPress={() => change({ level: l.id })}
                    />,
                  ];
            })}
          </View>
        </>
      ) : null}

      <Spacer size="xl" />
      <Body weight="semibold">{e.avatarHeading}</Body>
      <Spacer size="sm" />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={e.avatarHeading}
        style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}
      >
        {AVATAR_PRESETS.map((a) => {
          const active = draft.avatar === a.kind;
          return (
            <Pressable
              key={a.kind}
              onPress={() => change({ avatar: a.kind })}
              disabled={classDevice}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: classDevice }}
              aria-checked={active}
              accessibilityLabel={m.avatars[a.kind]}
              style={{
                flexGrow: 1,
                flexBasis: touchTarget.hero,
                minHeight: touchTarget.hero,
                alignItems: 'center',
                gap: spacing.xs,
                padding: spacing.sm,
                backgroundColor: active ? colors.brand.primaryLight : classDevice ? colors.surface.sunken : colors.surface.paper,
                borderWidth: borderWidth.base,
                borderColor: active ? colors.brand.primary : colors.border.subtle,
                borderRadius: radii.lg,
              }}
            >
              <ProfileAvatar avatar={a.kind} size={touchTarget.min} />
              <Caption align="center">{m.avatars[a.kind]}</Caption>
            </Pressable>
          );
        })}
      </View>

      {original.role === 'learner' ? (
        <>
          <Spacer size="xl" />
          <Body weight="semibold">{e.who.heading}</Body>
          <Spacer size="sm" />
          <View accessibilityRole="radiogroup" accessibilityLabel={e.who.heading} style={{ gap: spacing.sm }}>
            <OptionCard
              label={e.who.self.label}
              description={e.who.self.sub}
              disabled={!canChooseWho('self', kept)}
              selected={draft.learnerType === 'self'}
              onPress={() => chooseWho('self')}
            />
            <OptionCard
              label={e.who.child.label}
              description={e.who.child.sub}
              selected={draft.learnerType === 'child'}
              onPress={() => chooseWho('child')}
            />
          </View>
          <Spacer size="xs" />
          <Caption tone="secondary">{e.who.lessons}</Caption>
          {kept ? (
            <>
              <Spacer size="xs" />
              <View accessibilityLiveRegion="polite">
                <Caption tone="secondary">{e.privacy.kept}</Caption>
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {showCard ? (
        <>
          <Spacer size="xl" />
          <Body weight="semibold">{e.privacy.heading}</Body>
          <Spacer size="sm" />
          <Card padding="md" tone="sunken">
            {plan.whoChange === 'to-child' ? (
              <>
                <Body weight="semibold">{e.guardian.heading}</Body>
                <Spacer size="xs" />
                <Body tone="secondary" size="sm">
                  {e.guardian.body}
                </Body>
              </>
            ) : null}

            {plan.pinRequired ? (
              <>
                <Spacer size="md" />
                <PinSetupField
                  heading={e.guardian.pinHeading}
                  state={pinSetup}
                  onChange={(next) => {
                    setPinSetup(next);
                    setPinError(null);
                  }}
                  error={pinError}
                  disabled={busy}
                />
              </>
            ) : null}

            {plan.consent !== null ? (
              <>
                {plan.whoChange === 'to-child' ? <Spacer size="md" /> : null}
                <Pressable
                  onPress={() => setAgreed((c) => !c)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreed }}
                  aria-checked={agreed}
                  accessibilityLabel={consentText}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}
                >
                  <View
                    style={{
                      width: CHECKBOX_SIZE,
                      height: CHECKBOX_SIZE,
                      borderRadius: radii.sm,
                      borderWidth: borderWidth.base,
                      borderColor: agreed ? colors.brand.primary : colors.border.strong,
                      backgroundColor: agreed ? colors.brand.primary : colors.surface.paper,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {agreed ? <Icon name="check" size={spacing.lg} color={colors.text.inverse} /> : null}
                  </View>
                  <Body size="sm" style={{ flex: 1 }}>
                    {consentText}
                  </Body>
                </Pressable>
                <Pressable
                  onPress={() => void openPrivacy()}
                  accessibilityRole="link"
                  accessibilityLabel={e.privacyLink}
                  style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingLeft: CHECKBOX_SIZE + spacing.sm }}
                >
                  <Body size="sm" tone="brand">
                    {e.privacyLink}
                  </Body>
                </Pressable>
                {linkNote !== null ? <Caption tone="secondary">{linkNote}</Caption> : null}
              </>
            ) : null}
          </Card>
          {plan.whoChange === 'to-self' ? (
            <Pressable
              onPress={underThirteen}
              accessibilityRole="button"
              accessibilityLabel={e.privacy.under13}
              style={{ minHeight: touchTarget.min, justifyContent: 'center', alignSelf: 'flex-start' }}
            >
              <Body size="sm" tone="secondary">
                {e.privacy.under13}
              </Body>
            </Pressable>
          ) : null}
          <Spacer size="xs" />
          <Caption tone="secondary">{e.privacy.lessons}</Caption>
        </>
      ) : null}

      {inClass && !classDevice ? (
        <>
          <Spacer size="lg" />
          <Caption tone="secondary">{e.classNote}</Caption>
        </>
      ) : null}

      <Spacer size="xl" />
      <Button
        label={e.save.cta}
        tone="primary"
        size="hero"
        fullWidth
        disabled={missing !== null || busy || scope === 'unknown'}
        onPress={() => void onSave()}
      />
      {saveError !== null || missing !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" align="center">
            {saveError ?? (missing !== null ? e.missing[missing] : null)}
          </Caption>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
