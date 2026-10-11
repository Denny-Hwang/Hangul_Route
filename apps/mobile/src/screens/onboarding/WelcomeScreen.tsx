import { Body, Button, Heading, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { availableLocales } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { LanguageChips } from '../../components/LanguageChips';
import { useMessages } from '../../i18n/use-messages';
import { deviceChoice, languageOptions, showLanguagePickers } from '../../logic/locale/language-picker';
import type { OnboardingStackParamList, RootStackParamList } from '../../navigation/types';
import type { NavigationProp } from '@react-navigation/native';
import { useLocaleStore } from '../../store/locale-store';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

/**
 * First screen of the app. The language row sits below the CTAs so the primary
 * action never moves (F-I18N-001 §3.3, wireframe profile/language-picker.md A);
 * it is not drawn at all while English is the only language offered.
 */
export function WelcomeScreen({ navigation }: Props): React.ReactElement {
  const m = useMessages();
  const w = m.learner.welcome;
  const available = availableLocales();
  const detected = useLocaleStore((s) => s.detected);
  const device = useLocaleStore((s) => s.device);
  const setDeviceLocale = useLocaleStore((s) => s.setDeviceLocale);

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
        <Button
          label={w.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => navigation.navigate('CreateProfile', { firstRun: true })}
        />
        <Button
          label={w.restore}
          tone="ghost"
          size="md"
          onPress={() => (navigation.getParent() as NavigationProp<RootStackParamList> | undefined)?.navigate('Restore', { from: 'welcome' })}
        />
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
