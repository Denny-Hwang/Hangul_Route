import { Caption, Spacer, colors, radii, spacing, touchTarget, useTypeScale } from '@hangul-route/design-system';
import React from 'react';
import { TextInput } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { NAME_MAX } from '../../logic/profiles/profile-model';

export interface JoinNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The gate is closed or the device is a class tablet: the field keeps the profile name. */
  locked: boolean;
  /** A class tablet: the locked line is Edit profile's class-device line. */
  classDevice: boolean;
  /** The profile name: a stored name longer than the rule still fits the field. */
  profileName: string;
  /** The create form's calm hint for a changed name, or null. */
  hint: string | null;
}

/**
 * The Join confirm step's name field (F-SPACE-001 section 3.5, F-LEARN-001 section 3.11): the name, the create form's
 * hint, "This name is the same everywhere", and, when the name cannot change here, where it changes. Shared by the
 * one-learner join and each name step of Who is joining? (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-7b), which shows
 * this step unchanged once per picked learner.
 */
export function JoinNameField({ value, onChange, locked, classDevice, profileName, hint }: JoinNameFieldProps): React.ReactElement {
  const textScale = useTypeScale();
  const messages = useMessages();
  const m = messages.caregiver.join;
  return (
    <>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!locked}
        aria-disabled={locked}
        testID="join-name"
        maxLength={Math.max(NAME_MAX, profileName.length)}
        autoCorrect={false}
        // Names start with a capital in every word, on purpose: "sungjoo" becomes "Sungjoo", never only the first word.
        autoCapitalize="words"
        accessibilityLabel={messages.a11y.joinName}
        style={{
          minHeight: touchTarget.child,
          paddingHorizontal: spacing.md,
          fontSize: textScale.size.title,
          fontWeight: '700',
          color: locked ? colors.text.secondary : colors.text.primary,
          backgroundColor: locked ? colors.surface.sunken : colors.surface.paper,
          borderWidth: 2,
          borderColor: colors.border.subtle,
          borderRadius: radii.lg,
        }}
      />
      {hint !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary">{hint}</Caption>
        </>
      ) : null}
      <Spacer size="xs" />
      <Caption tone="muted">{m.confirm.sameEverywhere}</Caption>
      {locked ? (
        <>
          <Spacer size="xs" />
          <Caption tone="muted" testID="join-name-locked">
            {classDevice ? messages.learner.editProfile.classDevice : m.confirm.nameLocked}
          </Caption>
        </>
      ) : null}
    </>
  );
}
