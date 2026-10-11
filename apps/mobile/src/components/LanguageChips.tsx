import { Body, Icon, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { LanguageOption } from '../logic/locale/language-picker';

/**
 * One row of language chips — F-I18N-001 §3.3, wireframe profile/language-picker.md
 * (A: Welcome row, B: device default in the Language card). The labels are the
 * endonyms, each tagged with its own language so a person who cannot read the
 * current UI can still find theirs. A single-choice set: each chip is a radio in
 * a radiogroup, at least `touchTarget.min` tall, the active one marked by a check
 * as well as its border (WCAG 1.4.1). Chips wrap on a narrow screen and never
 * reshuffle. No animation, so reduced motion needs no special case.
 */
export interface LanguageChipsProps {
  options: readonly LanguageOption[];
  selected: UiLocale;
  onSelect: (locale: UiLocale) => void;
  /** The group's accessible name, in the UI language ("Language"). */
  groupLabel: string;
  testID?: string;
}

export function LanguageChips({ options, selected, onSelect, groupLabel, testID }: LanguageChipsProps): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}
    >
      {options.map((o) => {
        const active = o.locale === selected;
        return (
          <Pressable
            key={o.locale}
            testID={`${testID ?? 'language-chips'}-${o.locale}`}
            onPress={() => {
              if (!active) onSelect(o.locale);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            // RN-web drops `aria-checked` for an unchecked radio; a radio must always say its state.
            aria-checked={active}
            accessibilityLabel={o.endonym}
            {...{ accessibilityLanguage: o.htmlLang, lang: o.htmlLang }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              minHeight: touchTarget.min,
              paddingHorizontal: spacing.lg,
              backgroundColor: active ? colors.brand.primaryLight : colors.surface.paper,
              borderColor: active ? colors.brand.primary : colors.border.subtle,
              borderWidth: borderWidth.base,
              borderRadius: radii.lg,
            }}
          >
            {active ? <Icon name="check" size={spacing.lg} color={colors.brand.primary} /> : null}
            <Body weight="semibold">{o.endonym}</Body>
          </Pressable>
        );
      })}
    </View>
  );
}
