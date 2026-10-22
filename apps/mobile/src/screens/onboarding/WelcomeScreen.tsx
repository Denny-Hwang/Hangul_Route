import { Body, Button, Card, Heading, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { availableLocales } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { LanguageChips } from '../../components/LanguageChips';
import { LinkButton } from '../../components/LinkButton';
import { bundleOs, flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { deviceChoice, languageOptions, showLanguagePickers } from '../../logic/locale/language-picker';
import { grownUpEntriesOn, startEvent } from '../../logic/shell/entry-points';
import type { OnboardingStackParamList, RootStackParamList } from '../../navigation/types';
import type { NavigationProp } from '@react-navigation/native';
import { isLiveGuest } from '../../logic/guest/guest-model';
import { track } from '../../platform/telemetry';
import { guestFirstQuest, resumeGuestFromWelcome } from '../../store/guest-launch';
import { useGuestStore } from '../../store/guest-store';
import { useLocaleStore } from '../../store/locale-store';
import { useProfileStore } from '../../store/profile-store';
import { preloadGuestStack } from '../../navigation/guest';
import { openGuestStack } from '../guest/guest-exits';
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
 *
 * [GU] Row GU-3 (AMENDMENTS-GUEST-FIRST-LESSON section 6.3): while a first quest waits on this device (a live guest,
 * `flags.guestLessonEnabled` on), one card above Let's start (**Your first quest is waiting.** with an outlined **Back
 * to my quest**, or once quest 1 is done **Add your name to keep your first quest.** with **Add my name**) and one line
 * under it (`welcome.keeps`). Let's start stays the only filled button, in its place; everything else is unchanged.
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
  // [GU] Welcome's waiting card (AMENDMENTS-GUEST-FIRST-LESSON section 6.3, row GU-3; mock guest-first-quest.md D2):
  // while a quest waits on this device (a live guest, the switch on). Back to my quest goes back into the run; once
  // quest 1 is done, Add my name leads to the save (row GU-4 builds it; until then the Not now card).
  const guest = useGuestStore((s) => s.record);
  const profiles = useProfileStore((s) => s.profiles);
  const waiting = flags.guestLessonEnabled && isLiveGuest(guest, profiles) ? guest : null;
  // The guest's screens are a chunk of their own: fetched while the card shows, so Back to my quest opens at once.
  const hasWaiting = waiting !== null;
  useEffect(() => {
    if (hasWaiting) preloadGuestStack();
  }, [hasWaiting]);
  const root = (): NavigationProp<RootStackParamList> | undefined => navigation.getParent() as NavigationProp<RootStackParamList> | undefined;
  const backToQuest = (): void => {
    void resumeGuestFromWelcome().then((route) => {
      if (route !== null) openGuestStack(root(), route);
    });
  };
  const addMyName = (): void => {
    if (guestFirstQuest() !== null) openGuestStack(root(), { screen: 'GuestLater' });
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
        {waiting !== null ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Card padding="md" tone="sunken" testID="welcome-guest">
              <Body weight="semibold" size="lg">
                {waiting.questDone ? m.learner.guest.welcome.saveTitle : m.learner.guest.welcome.waiting}
              </Body>
              <Spacer size="sm" />
              {waiting.questDone ? (
                <Button label={m.learner.guest.welcome.save} tone="ghost" size="md" fullWidth onPress={addMyName} testID="welcome-guest-save" />
              ) : (
                <Button label={m.learner.guest.welcome.resume} tone="ghost" size="md" fullWidth onPress={backToQuest} testID="welcome-guest-resume" />
              )}
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
        {waiting !== null ? (
          <Body tone="secondary" size="sm" align="center" style={{ maxWidth: 320 }} testID="welcome-guest-keeps">
            {m.learner.guest.welcome.keeps}
          </Body>
        ) : null}
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
