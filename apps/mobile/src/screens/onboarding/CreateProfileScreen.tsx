import {
  DEFAULT_LEARNER_LEVEL,
  LEARNER_LEVELS,
  type AvatarKind,
  type LearnerLevelId,
  type LearnerType,
} from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
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
import React, { useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { OptionCard } from '../../components/OptionCard';
import { PinSetupField } from '../../components/PinSetupField';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { isValidEmail } from '../../logic/email';
import { PRIVACY_FALLBACK_NOTE, privacyUrl } from '../../logic/links';
import { CREATE_PROFILE_COPY, whoCopy } from '../../logic/onboarding/create-profile-copy';
import {
  MISSING_STEP_CAPTION,
  formPlan,
  missingStep,
  nameHint,
  type FormState,
} from '../../logic/onboarding/create-profile-form';
import { levelSelected, whoSelected } from '../../logic/onboarding/onboarding-events';
import { PIN_SETUP_START, type PinSetupState } from '../../logic/onboarding/pin-setup';
import { submitProfile } from '../../logic/onboarding/submit-profile';
import { AVATAR_PRESETS, DEFAULT_AVATAR } from '../../logic/profiles/avatar-catalog';
import { createPinHash } from '../../logic/profiles/pin-hash';
import { NAME_MAX } from '../../logic/profiles/profile-model';
import type { OnboardingStackParamList } from '../../navigation/types';
import { pinHasher } from '../../platform/crypto';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useProfileStore } from '../../store/profile-store';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CreateProfile'>;

const COPY = CREATE_PROFILE_COPY;
const CHECKBOX_SIZE = spacing.xl + spacing.xs;

const fieldStyle = (borderColor: string) =>
  ({
    backgroundColor: colors.surface.paper,
    borderRadius: radii.lg,
    borderWidth: borderWidth.base,
    borderColor,
    paddingHorizontal: spacing.lg,
    minHeight: touchTarget.child,
    fontSize: typography.size.bodyLg,
    color: colors.text.primary,
  }) as const;

/**
 * Create a profile — F-LEARN-001 §3.2 to §3.4. Says who is learning first (no
 * preselected answer), then name, reading level and cub; the card at the
 * bottom matches the answer: a grown-up card with the consent, an email and
 * the PIN for a child or student, or a short agreement for a learner who is
 * 13 or older. First-run route params: `{ firstRun }`.
 * Design reference: design/wireframes/onboarding/all-ages-onboarding.md, A to E.
 * Rules and copy live in logic/onboarding (tested); this file paints them.
 */
export function CreateProfileScreen({ navigation, route }: Props): React.ReactElement {
  const createProfile = useProfileStore((s) => s.createProfile);
  const guardianAcceptedAt = useAccountStore((s) => s.guardianConsentAcceptedAt);
  const selfAcceptedAt = useAccountStore((s) => s.selfConsentAcceptedAt);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const acceptGuardianConsent = useAccountStore((s) => s.acceptGuardianConsent);
  const acceptSelfConsent = useAccountStore((s) => s.acceptSelfConsent);
  const setParentPinHash = useAccountStore((s) => s.setParentPinHash);
  const saveParentEmail = useAccountStore((s) => s.setParentEmail);

  const firstRun = route.params?.firstRun ?? false;

  const [learnerType, setLearnerType] = useState<LearnerType | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<LearnerLevelId>(DEFAULT_LEARNER_LEVEL);
  const [avatar, setAvatar] = useState<AvatarKind>(DEFAULT_AVATAR);
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [pinSetup, setPinSetup] = useState<PinSetupState>(PIN_SETUP_START);
  const [pinRowOpen, setPinRowOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Events that fire once per form: the first answer, and the first level change.
  const whoReported = useRef(false);
  const levelReported = useRef(false);

  const state: FormState = {
    learnerType,
    name,
    email,
    agreed,
    pin: pinSetup.pin,
    guardianAcceptedAt,
    selfAcceptedAt,
    parentPinHash,
  };
  const plan = formPlan(state);
  const missing = missingStep(state);
  const emailOk = email.trim() === '' || isValidEmail(email);
  const hint = nameHint(name);
  const words = learnerType === null ? null : whoCopy(learnerType);

  const chooseWho = (next: LearnerType): void => {
    if (next === learnerType) return;
    if (!whoReported.current) {
      whoReported.current = true;
      void track(whoSelected(firstRun));
    }
    setLearnerType(next);
    // The consent wording and the PIN rule change with the answer: start those over.
    setAgreed(false);
    setPinSetup(PIN_SETUP_START);
    setPinRowOpen(false);
    setPinError(null);
  };

  const chooseLevel = (next: LearnerLevelId): void => {
    if (next !== level && !levelReported.current) {
      levelReported.current = true;
      void track(levelSelected(next));
    }
    setLevel(next);
  };

  const togglePinRow = (): void => {
    // A closed row means "no PIN": drop anything half-entered or confirmed.
    if (pinRowOpen) setPinSetup(PIN_SETUP_START);
    setPinRowOpen(!pinRowOpen);
    setPinError(null);
  };

  const openPrivacy = async (): Promise<void> => {
    try {
      await Linking.openURL(privacyUrl());
      setLinkNote(null);
    } catch {
      setLinkNote(PRIVACY_FALLBACK_NOTE);
    }
  };

  const onSubmit = async (): Promise<void> => {
    if (missing !== null || busy) return;
    setBusy(true);
    setPinError(null);
    try {
      const result = await submitProfile(
        { state, level, avatar, firstRun },
        {
          hashPin: (pin) => createPinHash(pin, pinHasher),
          acceptGuardianConsent,
          acceptSelfConsent,
          setParentPinHash,
          setParentEmail: saveParentEmail,
          createProfile,
          track: (event) => void track(event),
        },
      );
      if (result.ok) {
        navigation.replace('FirstQuestPreview', { profileId: result.profile.id });
      } else if (result.reason === 'pin-failed') {
        setPinError(COPY.pin.failed);
      }
    } finally {
      setBusy(false);
    }
  };

  const consentText = plan?.card === 'self' ? COPY.self.agree : COPY.guardian.agree;

  return (
    <Screen tone="canvas" scrollable>
      {!firstRun ? (
        <>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel={COPY.back}
            style={{ alignSelf: 'flex-start', padding: spacing.xs }}
          >
            <Icon name="arrow-left" size={28} />
          </Pressable>
          <Spacer size="sm" />
        </>
      ) : null}
      <Heading level="title">{COPY.title}</Heading>

      <Spacer size="lg" />
      <View accessibilityRole="radiogroup" accessibilityLabel={COPY.title} style={{ gap: spacing.sm }}>
        <OptionCard
          label={COPY.who.self.label}
          description={COPY.who.self.sub}
          selected={learnerType === 'self'}
          onPress={() => chooseWho('self')}
        />
        <OptionCard
          label={COPY.who.child.label}
          description={COPY.who.child.sub}
          selected={learnerType === 'child'}
          onPress={() => chooseWho('child')}
        />
      </View>

      {words !== null && plan !== null ? (
        <>
          <Spacer size="xl" />
          <Body weight="semibold">{words.nameLabel}</Body>
          <Spacer size="xs" />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={COPY.namePlaceholder}
            placeholderTextColor={colors.text.muted}
            accessibilityLabel={words.nameLabel}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            style={fieldStyle(colors.border.subtle)}
          />
          {hint !== null && (
            <>
              <Spacer size="xs" />
              <Caption tone="secondary">{hint}</Caption>
            </>
          )}

          <Spacer size="xl" />
          <Body weight="semibold">{words.levelHeading}</Body>
          <Spacer size="sm" />
          <View accessibilityRole="radiogroup" accessibilityLabel={words.levelHeading} style={{ gap: spacing.sm }}>
            {LEARNER_LEVELS.map((l) => (
              <OptionCard
                key={l.id}
                label={l.label}
                description={l.description}
                selected={level === l.id}
                onPress={() => chooseLevel(l.id)}
              />
            ))}
          </View>
          <Spacer size="xs" />
          <Caption tone="secondary">{COPY.levelHelper}</Caption>

          <Spacer size="xl" />
          <Body weight="semibold">{COPY.avatarHeading}</Body>
          <Spacer size="sm" />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={COPY.avatarHeading}
            style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}
          >
            {AVATAR_PRESETS.map((a) => {
              const active = avatar === a.kind;
              return (
                <Pressable
                  key={a.kind}
                  onPress={() => setAvatar(a.kind)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  aria-checked={active}
                  accessibilityLabel={a.label}
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
                  <Caption align="center">{a.label}</Caption>
                </Pressable>
              );
            })}
          </View>

          {plan.card !== null ? (
            <>
              <Spacer size="xxl" />
              <Card padding="md" tone="sunken">
                <Body weight="semibold">{plan.card === 'self' ? COPY.self.heading : COPY.guardian.heading}</Body>
                <Spacer size="xs" />
                <Body tone="secondary" size="sm">
                  {plan.card === 'self' ? COPY.self.body : COPY.guardian.body}
                </Body>

                {plan.showEmail ? (
                  <>
                    <Spacer size="md" />
                    <Body weight="semibold" size="sm">
                      {COPY.email.label}
                    </Body>
                    <Caption tone="muted">{COPY.email.caption}</Caption>
                    <Spacer size="xs" />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder={COPY.email.placeholder}
                      placeholderTextColor={colors.text.muted}
                      accessibilityLabel={COPY.email.label}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={254}
                      style={fieldStyle(emailOk ? colors.border.subtle : colors.feedback.nudge)}
                    />
                    {!emailOk ? (
                      <>
                        <Spacer size="xxs" />
                        <Caption tone="muted">{COPY.email.invalid}</Caption>
                      </>
                    ) : null}
                  </>
                ) : null}

                {plan.pinRequired ? (
                  <>
                    <Spacer size="md" />
                    <PinSetupField
                      heading={COPY.guardian.pinHeading}
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

                {plan.pinOptional ? (
                  <>
                    <Spacer size="md" />
                    <Pressable
                      onPress={togglePinRow}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: pinRowOpen }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}
                    >
                      <Icon name={pinRowOpen ? 'close' : 'plus'} size={spacing.xl} color={colors.text.secondary} />
                      <Body size="sm" style={{ flex: 1 }}>
                        {COPY.self.pinRow}
                      </Body>
                    </Pressable>
                    {pinRowOpen ? (
                      <PinSetupField
                        heading={COPY.self.pinHeading}
                        state={pinSetup}
                        onChange={(next) => {
                          setPinSetup(next);
                          setPinError(null);
                        }}
                        error={pinError}
                        disabled={busy}
                      />
                    ) : null}
                  </>
                ) : null}

                {plan.consent !== null ? (
                  <>
                    <Spacer size="md" />
                    <Pressable
                      onPress={() => setAgreed((c) => !c)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: agreed }}
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
                      accessibilityLabel="Privacy Policy"
                      style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingLeft: CHECKBOX_SIZE + spacing.sm }}
                    >
                      <Body size="sm" tone="brand">
                        {COPY.privacyLink}
                      </Body>
                    </Pressable>
                    {linkNote !== null ? <Caption tone="secondary">{linkNote}</Caption> : null}
                  </>
                ) : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      <Spacer size="xxl" />
      <Card padding="md" tone="brand">
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Hoya pose="cheering" size={56} />
          <View style={{ flex: 1 }}>
            <Body weight="semibold">{COPY.ready.heading}</Body>
            <Body tone="secondary" size="sm">
              {COPY.ready.line}
            </Body>
          </View>
        </View>
      </Card>
      <Spacer size="lg" />
      <Button
        label={COPY.continue}
        tone="primary"
        size="hero"
        fullWidth
        disabled={missing !== null || busy}
        onPress={() => void onSubmit()}
      />
      {missing !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" align="center">
            {MISSING_STEP_CAPTION[missing]}
          </Caption>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
