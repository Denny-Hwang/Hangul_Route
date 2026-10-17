import {
  Body,
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
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { inviteOutcome, type InviteChoice } from '../../logic/placement/entry';
import { speechLangOf } from '../../logic/placement/options-view';
import type { OnboardingStackParamList, RootStackParamList } from '../../navigation/types';
import { playPrompt, stop } from '../../platform/audio';
import { isScreenReaderEnabled } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { usePlacementRunStore } from '../../store/placement-run-store';
import { SpeakerButton } from '../placement/parts';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PlacementInvite'>;

const HOYA_SIZE = touchTarget.hero + spacing.xxl;

/**
 * The fork after CreateProfile (F-PLC-001 section 3.1 step 1; wireframe
 * design/wireframes/placement/invite.md, as built in
 * design/screens/placement/flow.md): "I am new to Korean" opens the
 * first-quest preview as today
 * and only records the decline; "I already know some Korean" opens the level
 * check. Two choices of equal size and weight, neither a default; no back (the
 * profile exists). It works for a learner alone: big targets, and the
 * question is spoken on open (not with a screen reader on) and on the speaker.
 * Shown only while `flags.placementEnabled` is on and the bank parsed
 * (`logic/placement/entry`).
 */
export function PlacementInviteScreen({ navigation, route }: Props): React.ReactElement {
  const { profileId } = route.params;
  const messages = useMessages();
  const copy = messages.learner.placement.invite;
  const locale = useLocale();
  const root = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const busy = useRef(false);

  const sayTitle = useCallback(
    () => void playPrompt({ text: copy.title, language: speechLangOf(locale), kind: 'narration', source: 'placement' }),
    [copy.title, locale],
  );

  useEffect(() => {
    let alive = true;
    void isScreenReaderEnabled().then((on) => {
      if (alive && !on) sayTitle();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [sayTitle]);

  const choose = (choice: InviteChoice): void => {
    if (busy.current) return;
    busy.current = true;
    stop();
    const outcome = inviteOutcome(choice, profileId, new Date().toISOString());
    if (outcome.kind === 'declined') {
      void usePlacementRunStore.getState().markDeclined(profileId, outcome.declinedAt);
      void track(outcome.event);
      // The fork is left behind for good: the stack is the preview alone, so a back leaves setup as at any root.
      navigation.reset({ index: 0, routes: [{ name: 'FirstQuestPreview', params: { profileId } }] });
      return;
    }
    // The fork stays underneath: a system back before the check starts returns here.
    busy.current = false;
    root.navigate('Placement', outcome.params);
  };

  return (
    <Screen tone="canvas" scrollable testID="placement-invite">
      <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
        <Hoya pose="waving" size={HOYA_SIZE} accessibilityLabel={messages.a11y.hoya('waving')} />
        <Spacer size="md" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flexShrink: 1 }}>
            <Heading level="title" align="center">
              {copy.title}
            </Heading>
          </View>
          <SpeakerButton
            onPress={sayTitle}
            label={messages.learner.placement.item.hearAgain}
            size={touchTarget.min}
            testID="placement-invite-hear"
          />
        </View>
      </View>
      <Spacer size="xl" />
      <View style={{ gap: spacing.md }}>
        <ForkChoice icon="play" label={copy.newToKorean} onPress={() => choose('new')} testID="placement-invite-new" />
        <ForkChoice icon="ear" label={copy.knowSome} onPress={() => choose('knowSome')} testID="placement-invite-know" />
      </View>
      <Spacer size="lg" />
      <Body tone="secondary" align="center">
        {copy.duration}
      </Body>
      <Spacer size="xl" />
    </Screen>
  );
}

/** One of the two equal choices: an icon and one line, at least `touchTarget.hero` tall. */
function ForkChoice({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: 'play' | 'ear';
  label: string;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        minHeight: touchTarget.hero,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.brand.primaryLight : colors.surface.paper,
        borderColor: colors.border.subtle,
        borderWidth: borderWidth.base,
        borderRadius: radii.lg,
      })}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          width: touchTarget.min,
          height: touchTarget.min,
          borderRadius: radii.circle,
          backgroundColor: colors.brand.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={spacing.xl} color={colors.brand.primaryDark} />
      </View>
      <Body weight="semibold" size="lg" style={{ flex: 1 }}>
        {label}
      </Body>
    </Pressable>
  );
}
