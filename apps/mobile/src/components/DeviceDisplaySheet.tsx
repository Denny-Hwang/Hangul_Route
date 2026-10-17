import { DisplaySheet, textSizeOptions, type DisplayOption } from '@hangul-route/design-system';
import { LOCALE_META, availableLocales, type UiLocale } from '@hangul-route/i18n';
import type { TextSize } from '@hangul-route/content-schema';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocale, useMessages } from '../i18n/use-messages';
import { languageOptions } from '../logic/locale/language-picker';
import { useLocaleStore, type LocaleChangeSource } from '../store/locale-store';

/**
 * The Display (Aa) sheet of the learner app, All lessons and the presenter (owner items 6 and
 * 7): the design-system `DisplaySheet` wired to the device record (`useLocaleStore`), so a
 * language or text size chosen here applies to every screen and every open tab of the device.
 * A language change applies at once and the sheet, now in the new language, offers a one-tap
 * way back to the language it came from (the mis-tap rule of F-I18N-001 §3.3). Not behind the
 * grown-up gate: display only, reversible, no learner data.
 */
export interface DeviceDisplaySheetProps {
  visible: boolean;
  onClose: () => void;
  /** The sheet's title; defaults to "Display" (All lessons: "Lesson display"). */
  title?: string;
  /** Rows above Language (All lessons: Romanization). */
  children?: React.ReactNode;
  /** The line under the controls; defaults to the device-wide note. */
  note?: string;
  testID?: string;
}

export function DeviceDisplaySheet({ visible, onClose, title, children, note, testID }: DeviceDisplaySheetProps): React.ReactElement {
  const d = useMessages().common.display;
  const locale = useLocale();
  const textSize = useLocaleStore((s) => s.textSize);
  const setDeviceLocale = useLocaleStore((s) => s.setDeviceLocale);
  const setTextSize = useLocaleStore((s) => s.setTextSize);
  const [previous, setPrevious] = useState<UiLocale | null>(null);
  // The way back is offered for the change made while this sheet is open, and only then.
  useEffect(() => {
    if (!visible) setPrevious(null);
  }, [visible]);

  const options = useMemo<DisplayOption[]>(
    () => languageOptions(availableLocales()).map((o) => ({ value: o.locale, label: o.endonym, lang: o.htmlLang })),
    [],
  );
  const choose = (next: UiLocale, source: LocaleChangeSource): void => {
    if (next === locale) return;
    setPrevious(locale);
    setDeviceLocale(next, source);
  };

  return (
    <DisplaySheet
      visible={visible}
      title={title ?? d.title}
      testID={testID}
      language={{
        label: d.language,
        options,
        selected: locale,
        onSelect: (value) => choose(value as UiLocale, 'settings'),
        undo:
          previous !== null && previous !== locale
            ? {
                label: d.back(LOCALE_META[previous].endonym),
                onPress: () => {
                  setDeviceLocale(previous, 'settings');
                  setPrevious(null);
                },
              }
            : null,
      }}
      textSize={{
        label: d.textSize,
        options: textSizeOptions(d.sizes),
        selected: textSize,
        onSelect: (step: TextSize) => setTextSize(step),
        sample: d.sample,
        glyph: d.glyph,
      }}
      note={note ?? d.note}
      doneLabel={d.done.cta}
      closeLabel={d.close}
      onClose={onClose}
    >
      {children}
    </DisplaySheet>
  );
}
