import { Body, Button, Card, Heading, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { availableLocales } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { LanguageChips } from '../../components/LanguageChips';
import { LinkButton } from '../../components/LinkButton';
import { bundleOs, flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { deviceChoice, languageOptions, showLanguagePickers } from '../../logic/locale/language-picker';
import { grownUpEntriesOn, startEvent } from '../../logic/shell/entry-points';
import type { OnboardingStackParamList, RootStackParamList } from '../../navigation/types';
import type { NavigationProp } from '@react-navigation/native';
import { track } from '../../platform/telemetry';
import { useLocaleStore } from '../../store/locale-store';
import { WelcomeGrownUps } from './WelcomeGrownUps';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

/**
 * First screen of the app. The language row sits below the CTAs so the primary
 * action never moves (F-I18N-001 §3.3, wireframe profile/language-picker.md A);
 * it is not drawn at all while English is the only language offered.
 *
 * F-APP-001 A-7 (web, `flags.grownUpHomeEnabled`; wireframe onboarding/welcome-personas.md): the
 * grown-ups' row sits under the restore link, so "Let's start" stays the only filled button, in
 * its place; Let's start then also sends `shell.persona_chosen { persona: 'learner' }`. Native
 * builds and the flag off: today's screen (OD-6).
 *
 * The class join link on a device with no profile (owner decision 2026-10-17; review of #734) opens this screen with
 * `classLink` and the link's code: a card shows the code and what Start does, and tells a learner who already plays in
 * the installed app (whose storage the browser does not share on iOS) to type the code there. Start then runs the
 * class-code first run with the code; "I already have progress" stays next to it.
 */
export function WelcomeScreen({ navigation, route }: Props): React.ReactElement {
  const m = useMessages();
  const w = m.learner.welcome;
  const available = availableLocales();
  const detected = useLocaleStore((s) => s.detected);
  const device = useLocaleStore((s) => s.device);
  const setDeviceLocale = useLocaleStore((s) => s.setDeviceLocale);
  const grownUps = grownUpEntriesOn(flags.grownUpHomeEnabled, bundleOs());
  const classLink = route.params?.classLink === true;
  const linkCode = route.params?.code;
  // Start (and "Got a class code?") is the learner's way in: `shell.persona_chosen { learner }` on the grown-up entries'
  // build, then the first run (with Join a class after it for a class code).
  const startFirstRun = (params: OnboardingStackParamList['CreateProfile']): void => {
    const event = startEvent(grownUps);
    if (event) void track(event);
    navigation.navigate('CreateProfile', params);
  };

  return (
    <Screen tone="canvas">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Hoya pose="waving" size={180} />
        <Spacer size="xl" />
        <Heading level="display" align="center">
          {w.title}
        </Heading>
        <Spacer size="md" />
        <Body align="center" tone="secondary" size="lg" style={{ maxWidth: 320 }}>
          {w.invitation}
        </Body>
      </View>

      <View style={{ paddingBottom: spacing.xl, alignItems: 'center', gap: spacing.md }}>
        {classLink ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Card padding="md" tone="sunken" testID="welcome-class-link">
              {linkCode !== undefined ? (
                <Body weight="semibold" size="lg" testID="welcome-class-link-code">
                  {w.classLink.code(linkCode)}
                </Body>
              ) : null}
              <Body tone="secondary">{w.classLink.next}</Body>
              <Spacer size="xs" />
              <Body tone="secondary" size="sm">
                {w.classLink.inApp}
              </Body>
            </Card>
          </View>
        ) : null}
        <Button
          label={w.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => startFirstRun(classLink ? { firstRun: true, then: 'join', ...(linkCode === undefined ? {} : { code: linkCode }) } : { firstRun: true })}
          testID="welcome-start"
        />
        <Button
          label={w.restore}
          tone="ghost"
          size="md"
          onPress={() => (navigation.getParent() as NavigationProp<RootStackParamList> | undefined)?.navigate('Restore', { from: 'welcome' })}
        />
        {/* A quiet way in for a learner with a class code (owner request 2026-10-16, item 8): the profile and consent steps
            run unchanged, then Join a class opens. The join link's card already says it, so the link then stays away. */}
        {classLink ? null : (
          <LinkButton label={m.learner.home.classCode.cta} onPress={() => startFirstRun({ firstRun: true, then: 'join' })} testID="welcome-class-code" />
        )}
        {grownUps ? <WelcomeGrownUps /> : null}
        {showLanguagePickers(available) ? (
          <LanguageChips
            testID="welcome-language"
            options={languageOptions(available)}
            selected={deviceChoice(device, detected, available)}
            groupLabel={m.learner.language.groupLabel}
            onSelect={(locale) => setDeviceLocale(locale, 'welcome')}
          />
        ) : null}
        <Body tone="muted" size="sm" align="center" style={{ maxWidth: 280 }}>
          {w.trust}
        </Body>
      </View>
    </Screen>
  );
}
