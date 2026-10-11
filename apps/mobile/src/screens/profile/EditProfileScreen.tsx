import { LEARNER_LEVELS, type LearnerType } from '@hangul-route/content-schema';
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
  typography,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { OptionCard } from '../../components/OptionCard';
import { PinSetupField } from '../../components/PinSetupField';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useMessages } from '../../i18n/use-messages';
import { privacyUrl } from '../../logic/links';
import { nameHint } from '../../logic/onboarding/create-profile-form';
import { PIN_SETUP_START, type PinSetupState } from '../../logic/onboarding/pin-setup';
import { AVATAR_PRESETS } from '../../logic/profiles/avatar-catalog';
import { editMissing, editPlan, initialEditDraft, submitEdit, type EditDraft, type EditState } from '../../logic/profiles/edit-profile';
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
 * none. Edits stay on the device until a server route exists (§3.11).
 * Design reference: design/wireframes/onboarding/all-ages-onboarding.md, I.
 * Rules live in logic/profiles/edit-profile (tested); this file paints them.
 */
export function EditProfileScreen({ navigation, route }: Props): React.ReactElement {
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

  const [draft, setDraft] = useState<EditDraft | null>(() => (original ? initialEditDraft(original) : null));
  const [agreed, setAgreed] = useState(false);
  const [pinSetup, setPinSetup] = useState<PinSetupState>(PIN_SETUP_START);
  const [pinError, setPinError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void hydrateMemberships(profileId);
  }, [profileId, hydrateMemberships]);

  const back = (
    <>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={messages.a11y.goBack}
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
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
  const hint = nameHint(draft.name, m.createProfile.nameHint);
  const showCard = plan.consent !== null || plan.pinRequired;

  const change = (patch: Partial<EditDraft>): void => setDraft({ ...draft, ...patch });

  const chooseWho = (next: LearnerType): void => {
    if (next === draft.learnerType) return;
    change({ learnerType: next });
    // The consent wording and the PIN rule change with the answer: start those over.
    setAgreed(false);
    setPinSetup(PIN_SETUP_START);
    setPinError(null);
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
    if (missing !== null || busy) return;
    setBusy(true);
    setPinError(null);
    try {
      const result = await submitEdit(state, {
        hashPin: (pin) => createPinHash(pin, pinHasher),
        acceptGuardianConsent,
        acceptSelfConsent,
        setParentPinHash,
        updateProfile,
        track: (event) => void track(event),
      });
      if (result.ok) navigation.goBack();
      else if (result.reason === 'pin-failed') setPinError(e.pinFailed);
    } finally {
      setBusy(false);
    }
  };

  const consentText = plan.consent === 'self' ? e.self.agree : e.guardian.agree;

  return (
    <Screen tone="canvas" scrollable>
      {back}

      <Spacer size="lg" />
      <Body weight="semibold">{e.nameLabel}</Body>
      <Spacer size="xs" />
      <TextInput
        value={draft.name}
        onChangeText={(name) => change({ name })}
        placeholder={e.namePlaceholder}
        placeholderTextColor={colors.text.muted}
        accessibilityLabel={e.nameLabel}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        style={{
          backgroundColor: colors.surface.paper,
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: colors.border.subtle,
          paddingHorizontal: spacing.lg,
          minHeight: touchTarget.child,
          fontSize: typography.size.bodyLg,
          color: colors.text.primary,
        }}
      />
      {hint !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary">{hint}</Caption>
        </>
      ) : null}

      <Spacer size="xl" />
      <Body weight="semibold">{e.levelHeading}</Body>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" accessibilityLabel={e.levelHeading} style={{ gap: spacing.sm }}>
        {LEARNER_LEVELS.map((l) => (
          <OptionCard
            key={l.id}
            label={l.label}
            description={l.description}
            selected={draft.level === l.id}
            onPress={() => change({ level: l.id })}
          />
        ))}
      </View>

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
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              aria-checked={active}
              accessibilityLabel={m.avatars[a.kind]}
              style={{
                flexGrow: 1,
                flexBasis: touchTarget.hero,
                minHeight: touchTarget.hero,
                alignItems: 'center',
                gap: spacing.xs,
                padding: spacing.sm,
                backgroundColor: active ? colors.brand.primaryLight : colors.surface.paper,
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
        </>
      ) : null}

      {showCard ? (
        <>
          <Spacer size="lg" />
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
        </>
      ) : null}

      {inClass ? (
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
        disabled={missing !== null || busy}
        onPress={() => void onSave()}
      />
      {missing !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" align="center">
            {e.missing[missing]}
          </Caption>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
