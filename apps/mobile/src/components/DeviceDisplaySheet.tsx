import { DisplaySheet, textSizeOptions, type DisplayOption } from '@hangul-route/design-system';
import { LOCALE_META, availableLocales, dictionaryLocale, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { TextSize } from '@hangul-route/content-schema';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocale, useMessages } from '../i18n/use-messages';
import { languageOptions } from '../logic/locale/language-picker';
import { useHistorySheet } from '../platform/history-bridge';
import { useLocaleStore } from '../store/locale-store';

/**
 * The Display (Aa) sheet of the learner app and the presenter (AMENDMENTS-DISPLAY-NAV section 3.6;
 * owner items 6 and 7): the design-system `DisplaySheet` wired to the device record
 * (`useLocaleStore`), so a language or text size chosen here applies to every screen and every
 * open tab of the device. A text size applies at once. Another language first shows the confirm
 * step written in that language ("Use Español on this device?", Use / Back; the F-I18N-001 §3.3
 * safety rule); Use writes the record and the sheet re-renders in the new language. Not behind the
 * grown-up gate: display only, reversible, no learner data.
 */
export interface DeviceDisplaySheetProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function DeviceDisplaySheet({ visible, onClose, testID }: DeviceDisplaySheetProps): React.ReactElement {
  const messages = useMessages();
  const d = messages.common.display;
  const locale = useLocale();
  const textSize = useLocaleStore((s) => s.textSize);
  const setDeviceLocale = useLocaleStore((s) => s.setDeviceLocale);
  const setTextSize = useLocaleStore((s) => s.setTextSize);
  const [pending, setPending] = useState<UiLocale | null>(null);
  // One history level while open: the browser or phone back closes the sheet (AMENDMENTS-DISPLAY-NAV section 7.2).
  useHistorySheet(visible, onClose);
  // A confirm step belongs to the sheet that asked it; closing the sheet drops it.
  useEffect(() => {
    if (!visible) setPending(null);
  }, [visible]);

  const options = useMemo<DisplayOption[]>(
    () => languageOptions(availableLocales()).map((o) => ({ value: o.locale, label: o.endonym, lang: o.htmlLang })),
    [],
  );
  // The step speaks the language being chosen, so the person sees at once whether they can read it.
  const confirm = pending === null ? null : getMessages(dictionaryLocale(pending)).common.display.confirm;

  return (
    <DisplaySheet
      visible={visible}
      title={d.title}
      testID={testID}
      language={{
        label: d.language,
        options,
        selected: locale,
        onSelect: (value) => {
          const next = value as UiLocale;
          setPending(next === locale ? null : next);
        },
        confirm:
          pending !== null && confirm !== null
            ? {
                question: confirm.question(LOCALE_META[pending].endonym),
                use: confirm.use(LOCALE_META[pending].endonym),
                back: confirm.back(LOCALE_META[locale].endonym),
                lang: LOCALE_META[pending].htmlLang,
                onUse: () => {
                  setDeviceLocale(pending, 'settings');
                  setPending(null);
                },
                onBack: () => setPending(null),
              }
            : null,
      }}
      textSize={{
        label: d.textSize,
        options: textSizeOptions(d.size),
        selected: textSize,
        onSelect: (step: TextSize) => setTextSize(step),
        sample: d.preview,
        glyph: d.button,
      }}
      note={d.note}
      doneLabel={messages.common.buttons.done}
      closeLabel={messages.common.buttons.close}
      onClose={onClose}
    />
  );
}
