import {
  DEFAULT_LEARNER_LEVEL,
  LEARNER_LEVELS,
  type AvatarKind,
  type LearnerLevelId,
  type LearnerType,
} from '@hangul-route/content-schema';
import { levelWords } from '@hangul-route/i18n';
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
  useTypeScale,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { OptionCard } from '../../components/OptionCard';
import { PinSetupField } from '../../components/PinSetupField';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { flags } from '../../config/flags';
import { isValidEmail } from '../../logic/email';
import { privacyUrl } from '../../logic/links';
import { lessonsLine, readyLine, whoCopy } from '../../logic/onboarding/create-profile-copy';
import { formPlan, nameHint, type FormState } from '../../logic/onboarding/create-profile-form';
import { levelSelected, whoSelected } from '../../logic/onboarding/onboarding-events';
import { PIN_SETUP_START, type PinSetupState } from '../../logic/onboarding/pin-setup';
import {
  canChooseWho,
  nextStep,
  previousStep,
  profileVoice,
  stepMissing,
  stepPosition,
  switchToGrownUp,
  systemBack,
  type SetupStep,
} from '../../logic/onboarding/setup-steps';
import { submitProfile } from '../../logic/onboarding/submit-profile';
import { afterProfileCreated, placementEntriesOn } from '../../logic/placement/entry';
import { AVATAR_PRESETS, DEFAULT_AVATAR } from '../../logic/profiles/avatar-catalog';
import { createPinHash } from '../../logic/profiles/pin-hash';
import { NAME_MAX } from '../../logic/profiles/profile-model';
import type { OnboardingStackParamList } from '../../navigation/types';
import { pinHasher } from '../../platform/crypto';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useProfileStore } from '../../store/profile-store';
import { syncApi } from '../../store/sync-store';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CreateProfile'>;

const CHECKBOX_SIZE = spacing.xl + spacing.xs;

/** A text field: `fontSize` is the chosen text size's bodyLg (`useTypeScale`). */
const fieldStyle = (borderColor: string, fontSize: number) =>
  ({
    backgroundColor: colors.surface.paper,
    borderRadius: radii.lg,
    borderWidth: borderWidth.base,
    borderColor,
    paddingHorizontal: spacing.lg,
    minHeight: touchTarget.child,
    fontSize,
    color: colors.text.primary,
  }) as const;

/**
 * Create a profile — F-LEARN-001 §3.2 to §3.4 and §3.15. Three steps in one
 * screen: who is learning (no age wording, no preselected answer), the
 * profile (name, reading level, cub) and Privacy, the agreement that fits
 * the answer: a grown-up card with the consent, an email and the PIN for
 * someone looked after, or the "13 or older" box for "Me", with "I'm under
 * 13" handing the step to a grown-up. Privacy is skipped when the device
 * already holds what the answer needs (adding a profile later). First-run
 * route params: `{ firstRun }`. Next: the level check's fork (F-PLC-001 P-7)
 * when the check is on, else the first-quest preview.
 * Design reference: design/wireframes/onboarding/setup-steps.md, A to H.
 * Rules live in logic/onboarding (tested); this file paints them.
 */
export function CreateProfileScreen({ navigation, route }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const messages = useMessages();
  const m = messages.learner;
  const c = m.createProfile;
  const createProfile = useProfileStore((s) => s.createProfile);
  const guardianAcceptedAt = useAccountStore((s) => s.guardianConsentAcceptedAt);
  const selfAcceptedAt = useAccountStore((s) => s.selfConsentAcceptedAt);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const acceptGuardianConsent = useAccountStore((s) => s.acceptGuardianConsent);
  const acceptSelfConsent = useAccountStore((s) => s.acceptSelfConsent);
  const setParentPinHash = useAccountStore((s) => s.setParentPinHash);
  const saveParentEmail = useAccountStore((s) => s.setParentEmail);

  const firstRun = route.params?.firstRun ?? false;
  const levelCheckOn = useMemo(() => placementEntriesOn(flags.placementEnabled), []);

  const [step, setStep] = useState<SetupStep>('who');
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
  /**
   * "I'm under 13" was pressed: the grown-up card shows with its note, and the
   * statement is latched for the life of the form ("Me" stays closed, §3.15.3).
   */
  const [switched, setSwitched] = useState(false);
  const [busy, setBusy] = useState(false);
  // Events that fire once per form: the first answer, and the first level change.
  const whoReported = useRef(false);
  const levelReported = useRef(false);
  // The system back reads the step through a ref (the listener is added once).
  const stepRef = useRef<SetupStep>('who');
  stepRef.current = step;
  // Focus target after a step change: the step's heading, or the under-13 note.
  const headingRef = useRef<object | null>(null);
  const noteRef = useRef<object | null>(null);
  const moved = useRef(false);

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
  const missing = stepMissing(step, state);
  const position = stepPosition(step, state);
  const isLast = nextStep(step, state) === 'submit';
  const emailOk = email.trim() === '' || isValidEmail(email);
  const hint = nameHint(name, c.nameHint);
  const words = learnerType === null ? null : whoCopy(c, profileVoice(learnerType, switched));

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        const back = systemBack(stepRef.current, e.data.action.type);
        if (back === 'leave' || back === 'ignore') return;
        e.preventDefault();
        moved.current = true;
        setStep(back);
      }),
    [navigation],
  );

  // The native iOS swipe cannot be cancelled by `beforeRemove` (native-stack): it is
  // on only on the question, where leaving the route is what back does (§3.15.4).
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step === 'who' });
  }, [navigation, step]);

  useEffect(() => {
    // Not on the first paint: the screen reader starts at the top by itself.
    if (!moved.current) return;
    focusForScreenReader(switched && step === 'privacy' ? noteRef.current : headingRef.current);
  }, [step, switched]);

  const goTo = (next: SetupStep): void => {
    moved.current = true;
    setStep(next);
  };

  const chooseWho = (next: LearnerType): void => {
    if (next === learnerType || !canChooseWho(next, switched)) return;
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

  const underThirteen = (): void => {
    const next = switchToGrownUp(state);
    setLearnerType(next.learnerType);
    setAgreed(next.agreed);
    setEmail(next.email);
    setPinSetup(PIN_SETUP_START);
    setPinRowOpen(false);
    setPinError(null);
    moved.current = true;
    setSwitched(true);
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
      setLinkNote(c.privacyFallback);
    }
  };

  const goBack = (): void => {
    const back = previousStep(step);
    if (back === 'leave') navigation.goBack();
    else goTo(back);
  };

  const onSubmit = async (): Promise<void> => {
    if (busy) return;
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
        // The level check's fork when it is on (F-PLC-001 section 3.1 step 1, first and later profiles alike).
        navigation.replace(afterProfileCreated(levelCheckOn), { profileId: result.profile.id });
      } else if (result.reason === 'pin-failed') {
        setPinError(c.pinFailed);
      }
    } finally {
      setBusy(false);
    }
  };

  const onContinue = (): void => {
    if (missing !== null) return;
    const next = nextStep(step, state);
    if (next === 'submit') void onSubmit();
    else goTo(next);
  };

  const title = step === 'who' ? c.title : step === 'profile' ? (words?.title ?? c.title) : c.privacy.title;
  const consentText = plan?.card === 'self' ? c.self.agree : c.guardian.agree;

  const header = (
    <>
      {step !== 'who' || !firstRun ? (
        <>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={messages.a11y.goBack}
            // A full touch target (the layout matrix checks every control on this screen, F-I18N-001 §3.11).
            style={{
              alignSelf: 'flex-start',
              minWidth: touchTarget.min,
              minHeight: touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="arrow-left" size={28} />
          </Pressable>
          <Spacer size="xs" />
        </>
      ) : null}
      <View
        ref={(node) => {
          headingRef.current = node;
        }}
        accessible
        focusable
        // One stop for the caption and the heading. Native merges the children, so the stop itself is the
        // header the heading rotor finds (§3.15.2); the web keeps the inner heading's role, so no second one there.
        {...(Platform.OS === 'web' ? {} : { accessibilityRole: 'header' as const })}
        accessibilityLabel={`${c.step(position.n, position.total)}. ${title}`}
        testID="create-profile-heading"
      >
        <Caption tone="secondary">{c.step(position.n, position.total)}</Caption>
        <Spacer size="xxs" />
        <Heading level="title">{title}</Heading>
      </View>
    </>
  );

  const whoStep = (
    <>
      <Spacer size="lg" />
      <View accessibilityRole="radiogroup" accessibilityLabel={c.title} style={{ gap: spacing.sm }}>
        <OptionCard
          label={c.who.self.label}
          description={c.who.self.sub}
          selected={learnerType === 'self'}
          disabled={!canChooseWho('self', switched)}
          onPress={() => chooseWho('self')}
        />
        <OptionCard
          label={c.who.child.label}
          description={c.who.child.sub}
          selected={learnerType === 'child'}
          onPress={() => chooseWho('child')}
        />
      </View>
      {switched ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary">{c.who.latched}</Caption>
        </>
      ) : null}
      <Spacer size="md" />
      <Caption tone="secondary">{lessonsLine(c, levelCheckOn)}</Caption>
    </>
  );

  const profileStep =
    words === null ? null : (
      <>
        <Spacer size="xl" />
        <Body weight="semibold">{words.nameLabel}</Body>
        <Spacer size="xs" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={c.namePlaceholder}
          placeholderTextColor={colors.text.muted}
          accessibilityLabel={words.nameLabel}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          style={fieldStyle(colors.border.subtle, textScale.size.bodyLg)}
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
                    selected={level === l.id}
                    onPress={() => chooseLevel(l.id)}
                  />,
                ];
          })}
        </View>
        <Spacer size="xs" />
        <Caption tone="secondary">{c.levelHelper}</Caption>

        <Spacer size="xl" />
        <Body weight="semibold">{c.avatarHeading}</Body>
        <Spacer size="sm" />
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={c.avatarHeading}
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
      </>
    );

  const privacyStep =
    plan === null || plan.card === null ? null : (
      <>
        {switched && plan.card === 'guardian' ? (
          <>
            <Spacer size="md" />
            <View
              ref={(node) => {
                noteRef.current = node;
              }}
              accessible
              focusable
              accessibilityLiveRegion="polite"
              testID="create-profile-switched-note"
            >
              <Body size="sm">{c.privacy.switchedNote}</Body>
            </View>
          </>
        ) : null}
        <Spacer size="lg" />
        <Card padding="md" tone="sunken">
          <Body weight="semibold">{plan.card === 'self' ? c.self.heading : c.guardian.heading}</Body>
          <Spacer size="xs" />
          <Body tone="secondary" size="sm">
            {plan.card === 'self' ? c.self.body : c.guardian.body}
          </Body>

          {plan.showEmail ? (
            <>
              <Spacer size="md" />
              <Body weight="semibold" size="sm">
                {c.email.label}
              </Body>
              <Caption tone="muted">{c.email.caption}</Caption>
              <Spacer size="xs" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={c.email.placeholder}
                placeholderTextColor={colors.text.muted}
                accessibilityLabel={c.email.label}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
                style={fieldStyle(emailOk ? colors.border.subtle : colors.feedback.nudge, textScale.size.bodyLg)}
              />
              {!emailOk ? (
                <>
                  <Spacer size="xxs" />
                  <Caption tone="muted">{c.email.invalid}</Caption>
                </>
              ) : null}
            </>
          ) : null}

          {plan.pinRequired ? (
            <>
              <Spacer size="md" />
              <PinSetupField
                heading={c.guardian.pinHeading}
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
                  {c.self.pinRow}
                </Body>
              </Pressable>
              {pinRowOpen ? (
                <PinSetupField
                  heading={c.self.pinHeading}
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
                onPress={() => setAgreed((v) => !v)}
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
                accessibilityLabel={c.privacyLinkName}
                style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingLeft: CHECKBOX_SIZE + spacing.sm }}
              >
                <Body size="sm" tone="brand">
                  {c.privacyLink}
                </Body>
              </Pressable>
              {linkNote !== null ? <Caption tone="secondary">{linkNote}</Caption> : null}
            </>
          ) : null}
        </Card>

        {plan.card === 'self' ? (
          <Pressable
            onPress={underThirteen}
            accessibilityRole="button"
            accessibilityLabel={c.privacy.under13}
            style={{ minHeight: touchTarget.min, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Body size="sm" tone="secondary">
              {c.privacy.under13}
            </Body>
          </Pressable>
        ) : null}

        {plan.consent !== null ? (
          <>
            <Spacer size="md" />
            <Caption tone="secondary">{c.privacy.lessons}</Caption>
          </>
        ) : null}
      </>
    );

  return (
    // Keyed by step: each step opens scrolled to the top (§3.15.4).
    <Screen key={step} tone="canvas" scrollable>
      {header}
      {step === 'who' ? whoStep : step === 'profile' ? profileStep : privacyStep}

      {isLast ? (
        <>
          <Spacer size="xxl" />
          <Card padding="md" tone="brand">
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Hoya pose="cheering" size={56} />
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{c.ready.heading}</Body>
                <Body tone="secondary" size="sm">
                  {readyLine(c, syncApi() !== null)}
                </Body>
              </View>
            </View>
          </Card>
        </>
      ) : null}
      <Spacer size="xl" />
      <Button
        label={c.cta}
        tone="primary"
        size="hero"
        fullWidth
        disabled={missing !== null || busy}
        onPress={onContinue}
      />
      {missing !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" align="center">
            {c.missing[missing]}
          </Caption>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
