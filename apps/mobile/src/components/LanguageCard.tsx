import { Body, Button, Card, Heading, Pill, Spacer, spacing, touchTarget } from '@hangul-route/design-system';
import { LOCALE_META, availableLocales, getMessages, type UiLocale } from '@hangul-route/i18n';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  deviceChoice,
  languageOptions,
  planLanguageChange,
  profileChoice,
  profileTarget,
  showLanguagePickers,
  type ProfileChoice,
} from '../logic/locale/language-picker';
import { useMessages } from '../i18n/use-messages';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { LanguageChips } from './LanguageChips';
import { OptionCard } from './OptionCard';

/**
 * "Language" card on profile/settings — F-I18N-001 §3.3, wireframe
 * profile/language-picker.md B. Two parts when more than one language is
 * offered: "This profile" (same as the device, or one language) and the device
 * default for new profiles. A change that switches the language first shows a
 * short sheet written in the NEW language with a one-tap way back; the card is
 * not behind the grown-up gate (reversible, display only; decision L7).
 * The reading-practice switch is always shown: it does not depend on a second
 * language (decision D2), and the card is then titled for reading alone.
 */
export interface LanguageCardProps {
  profileId: string;
}

/** A change waiting for "Use" on the sheet: what to apply, the language it shows, and the one to go back to. */
type Pending =
  | { scope: 'profile'; choice: ProfileChoice; target: UiLocale; previous: UiLocale }
  | { scope: 'device'; choice: UiLocale; target: UiLocale; previous: UiLocale };

const endonym = (locale: UiLocale): string => LOCALE_META[locale].endonym;

export function LanguageCard({ profileId }: LanguageCardProps): React.ReactElement {
  const lm = useMessages().learner;
  const m = lm.profile;
  const available = availableLocales();
  const pickers = showLanguagePickers(available);
  const options = languageOptions(available);

  const detected = useLocaleStore((s) => s.detected);
  const device = useLocaleStore((s) => s.device);
  const settings = useLocaleStore((s) => s.byProfile[profileId]);
  const current = useLocaleStore((s) => activeLocale(s, profileId));
  const setDeviceLocale = useLocaleStore((s) => s.setDeviceLocale);
  const setProfileLocale = useLocaleStore((s) => s.setProfileLocale);
  const setRomanizationMode = useLocaleStore((s) => s.setRomanizationMode);
  const [pending, setPending] = useState<Pending | null>(null);

  const deviceLocale = deviceChoice(device, detected, available);
  const selectedProfile = profileChoice(settings?.uiLocale, available);
  const tapMode = settings?.romanizationMode === 'tap';

  const apply = (p: Pending): void => {
    if (p.scope === 'profile') setProfileLocale(profileId, p.choice === 'device' ? null : p.choice, 'settings');
    else setDeviceLocale(p.choice, 'settings');
  };

  // A change that keeps the language applies at once; one that switches it asks first.
  const chooseProfile = (choice: ProfileChoice): void => {
    const target = profileTarget(choice, deviceLocale);
    const plan = planLanguageChange(current, target);
    const next: Pending = { scope: 'profile', choice, target, previous: current };
    if (plan.action === 'apply') apply(next);
    else setPending(next);
  };

  const chooseDevice = (locale: UiLocale): void => {
    const plan = planLanguageChange(deviceLocale, locale);
    const next: Pending = { scope: 'device', choice: locale, target: locale, previous: deviceLocale };
    if (plan.action === 'apply') apply(next);
    else setPending(next);
  };

  if (pending !== null) {
    // The sheet speaks the language being chosen, so the person sees at once whether they can read it.
    const t = getMessages(pending.target).learner.language;
    const htmlLang = LOCALE_META[pending.target].htmlLang;
    const title = pending.scope === 'profile' ? t.confirmProfile(endonym(pending.target)) : t.confirmDevice(endonym(pending.target));
    return (
      <Card padding="md" testID="language-confirm">
        <View
          accessibilityLiveRegion="polite"
          {...{ accessibilityLanguage: htmlLang, lang: htmlLang }}
        >
          <Heading level="prompt">{title}</Heading>
        </View>
        <Spacer size="md" />
        <Button
          label={t.confirmUse(endonym(pending.target))}
          tone="primary"
          size="md"
          fullWidth
          onPress={() => {
            apply(pending);
            setPending(null);
          }}
        />
        <Spacer size="sm" />
        <Button label={t.confirmBack(endonym(pending.previous))} tone="ghost" size="md" fullWidth onPress={() => setPending(null)} />
      </Card>
    );
  }

  return (
    <Card padding="md" testID="language-card">
      <Heading level="prompt">{pickers ? m.language.title : m.reading.title}</Heading>

      {pickers ? (
        <>
          <Spacer size="md" />
          <Body weight="semibold">{m.language.thisProfile}</Body>
          <Spacer size="xs" />
          <View accessibilityRole="radiogroup" accessibilityLabel={m.language.thisProfile} style={{ gap: spacing.sm }}>
            <OptionCard
              testID="language-profile-device"
              label={lm.language.sameAsDevice(endonym(deviceLocale))}
              selected={selectedProfile === 'device'}
              onPress={() => chooseProfile('device')}
            />
            {options.map((o) => (
              <OptionCard
                key={o.locale}
                testID={`language-profile-${o.locale}`}
                label={o.endonym}
                lang={o.htmlLang}
                selected={selectedProfile === o.locale}
                onPress={() => chooseProfile(o.locale)}
              />
            ))}
          </View>

          <Spacer size="lg" />
          <Body weight="semibold">{m.language.deviceDefault}</Body>
          <Spacer size="xs" />
          <LanguageChips
            testID="language-device"
            options={options}
            selected={deviceLocale}
            groupLabel={m.language.deviceDefault}
            onSelect={(locale) => chooseDevice(locale)}
          />

          <Spacer size="lg" />
          <Body weight="semibold">{m.reading.title}</Body>
          <Spacer size="xs" />
        </>
      ) : null}

      <Pressable
        testID="reading-practice-switch"
        onPress={() => setRomanizationMode(profileId, tapMode ? 'always' : 'tap')}
        accessibilityRole="switch"
        accessibilityState={{ checked: tapMode }}
        // RN-web drops `aria-checked` when it is false; a switch must always say its state.
        aria-checked={tapMode}
        accessibilityLabel={m.reading.hideUntilTap}
        style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Body style={{ flex: 1 }}>{m.reading.hideUntilTap}</Body>
          <Pill tone={tapMode ? 'success' : 'neutral'} label={tapMode ? m.reading.on : m.reading.off} size="sm" />
        </View>
      </Pressable>
    </Card>
  );
}
