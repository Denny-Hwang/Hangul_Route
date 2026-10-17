'use client';

import { DEFAULT_TEXT_SIZE, type DeviceSettings, type TextSize } from '@hangul-route/content-schema';
import { TEXT_SCALE_CSS_VAR, textSizeFactor } from '@hangul-route/design-system/text-size';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  availableLocales,
  getMessages,
  type Messages,
  type UiLocale,
} from '@hangul-route/i18n';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  browserLanguages,
  firstPaintLocale,
  queryLocale,
  readStoredLocale,
  readStoredTextSize,
  resolveConsoleDisplay,
  writeStoredLocale,
  writeStoredTextSize,
} from './console-locale';
import { ROOT_FONT_SIZE } from '../console/rem';
import { followDeviceSettings, readDeviceSettings, writeDeviceSettings, type DeviceSettingsRead } from './device-settings';

/**
 * Console locale and text size provider — F-I18N-001 §3.2; owner items 6 and 7 (one UI language
 * per device and per account). The static HTML is always English (the locale of the route). After
 * mount the provider reads the device's one display record (`hr:device:settings`, shared with
 * the learner app on this origin) and resolves the language (the record > a `?lang=` that seeds a
 * device that never chose > the browser languages) and the text size; until then `ready` is
 * false, and the grown-up gate shows its empty canvas, so no frame paints in the wrong language
 * or size. `hr:console:uiLocale` / `hr:console:textSize` are read-through mirrors for that first
 * paint and for a browser whose IndexedDB cannot be read. A choice here writes the record, the
 * mirrors, and tells every open tab (`BroadcastChannel('hr-prefs')`); a record another tab wrote
 * applies live, and the page re-reads it when it comes back to the front. `<html lang>` and the
 * `--hr-text-scale` the grown-up pages size their type by follow the choice. No telemetry: the
 * web console has no telemetry client.
 */
export interface ConsoleLocale {
  locale: UiLocale;
  messages: Messages;
  /** Locales the Display sheet may offer (only shipped ones, unless the QA flag is set). */
  available: readonly UiLocale[];
  /** The person chose a language here: the record (with its time), the mirror, the other tabs. */
  setLocale: (locale: UiLocale) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  /** False until the record is read (or the wait ran out): the grown-up gate holds its empty canvas. */
  ready: boolean;
  /** The record as read (null until read, or where it cannot be read): the account merge reads it. */
  record: DeviceSettings | null;
  /** The last language chosen in this tab, with its time: the account sync writes it to the account. */
  lastChoice: { uiLocale: UiLocale; uiLocaleAt: string } | null;
  /** A record another source decided (the account merge after a sign-in): written, mirrored, applied. */
  applyRecord: (record: DeviceSettings) => void;
}

const ENGLISH_ONLY: readonly UiLocale[] = [DEFAULT_LOCALE];

const LocaleContext = createContext<ConsoleLocale>({
  locale: DEFAULT_LOCALE,
  messages: getMessages(DEFAULT_LOCALE),
  available: ENGLISH_ONLY,
  setLocale: () => undefined,
  textSize: DEFAULT_TEXT_SIZE,
  setTextSize: () => undefined,
  ready: true,
  record: null,
  lastChoice: null,
  applyRecord: () => undefined,
});

/** How long the gate waits for the record before it paints with the first-paint guess (a stuck IndexedDB). */
export const RECORD_WAIT_MS = 1500;

export interface LocaleProviderDeps {
  readDevice?: () => Promise<DeviceSettingsRead>;
  writeDevice?: typeof writeDeviceSettings;
  follow?: typeof followDeviceSettings;
  now?: () => string;
}

export function LocaleProvider({ children, available, deps }: { children: ReactNode; available?: readonly UiLocale[]; deps?: LocaleProviderDeps }): JSX.Element {
  const offered = useMemo(() => available ?? availableLocales(), [available]);
  const io = useRef<Required<LocaleProviderDeps>>({
    readDevice: deps?.readDevice ?? (() => readDeviceSettings()),
    writeDevice: deps?.writeDevice ?? writeDeviceSettings,
    follow: deps?.follow ?? followDeviceSettings,
    now: deps?.now ?? (() => new Date().toISOString()),
  });
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  const [textSize, setTextSizeState] = useState<TextSize>(DEFAULT_TEXT_SIZE);
  const [ready, setReady] = useState(false);
  const [record, setRecord] = useState<DeviceSettings | null>(null);
  const [lastChoice, setLastChoice] = useState<{ uiLocale: UiLocale; uiLocaleAt: string } | null>(null);

  /** Shows a record (from a read, another tab or the account merge) and mirrors it. */
  const show = useCallback(
    (value: DeviceSettings) => {
      setRecord(value);
      const next = value.uiLocale !== undefined && offered.includes(value.uiLocale) ? value.uiLocale : null;
      if (next !== null) {
        setLocaleState(next);
        writeStoredLocale(next);
      }
      const size = value.textSize ?? DEFAULT_TEXT_SIZE;
      setTextSizeState(size);
      writeStoredTextSize(size);
    },
    [offered],
  );

  useEffect(() => {
    let live = true;
    const mirror = { locale: readStoredLocale(), textSize: readStoredTextSize() };
    const languages = browserLanguages();
    // First paint: the mirror (the last record this page resolved), never the bare query.
    setLocaleState(firstPaintLocale({ mirror: mirror.locale, languages, available: offered }));
    if (mirror.textSize !== null) setTextSizeState(mirror.textSize);
    const wait = setTimeout(() => {
      if (live) setReady(true);
    }, RECORD_WAIT_MS);
    const query = queryLocale(typeof window === 'undefined' ? '' : window.location.search);
    void io.current
      .readDevice()
      .catch((): DeviceSettingsRead => ({ readable: false }))
      .then((device) => {
        if (!live) return;
        const picked = resolveConsoleDisplay({ device, mirror, query, languages, available: offered });
        setLocaleState(picked.locale);
        setTextSizeState(picked.textSize);
        writeStoredLocale(picked.locale);
        writeStoredTextSize(picked.textSize);
        setRecord(device.readable ? device.value : null);
        setReady(true);
        clearTimeout(wait);
        if (picked.seed !== null) {
          const seed = picked.seed;
          // A `?lang=` seed is not a person's choice here: stored without a time, so a signed-in account's choice can still win.
          void io.current
            .writeDevice((stored) => {
              if (stored.uiLocale !== undefined) return stored;
              const { uiLocaleAt: _seedHasNoTime, ...rest } = stored;
              return { ...rest, uiLocale: seed };
            })
            .then((written) => {
              if (live && written) setRecord(written);
            });
        }
      });
    const stop = io.current.follow(
      (value) => {
        if (live) show(value);
      },
      () => {
        void io.current
          .readDevice()
          .catch((): DeviceSettingsRead => ({ readable: false }))
          .then((device) => {
            if (live && device.readable && (device.value.uiLocale !== undefined || device.value.textSize !== undefined)) show(device.value);
          });
      },
    );
    return () => {
      live = false;
      clearTimeout(wait);
      stop();
    };
  }, [offered, show]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = LOCALE_META[locale].htmlLang;
    return () => {
      root.lang = previous;
    };
  }, [locale]);

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty(TEXT_SCALE_CSS_VAR, String(textSizeFactor(textSize)));
    style.setProperty('font-size', ROOT_FONT_SIZE);
    return () => {
      style.removeProperty(TEXT_SCALE_CSS_VAR);
      style.removeProperty('font-size');
    };
  }, [textSize]);

  const setLocale = useCallback(
    (next: UiLocale) => {
      if (!offered.includes(next)) return;
      const at = io.current.now();
      setLocaleState(next);
      writeStoredLocale(next);
      setLastChoice({ uiLocale: next, uiLocaleAt: at });
      void io.current.writeDevice((stored) => ({ ...stored, uiLocale: next, uiLocaleAt: at })).then((written) => {
        if (written) setRecord(written);
      });
    },
    [offered],
  );

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    writeStoredTextSize(size);
    void io.current.writeDevice((stored) => ({ ...stored, textSize: size })).then((written) => {
      if (written) setRecord(written);
    });
  }, []);

  const applyRecord = useCallback(
    (value: DeviceSettings) => {
      show(value);
      void io.current
        .writeDevice((stored) => {
          const { uiLocale: _u, uiLocaleAt: _t, ...rest } = stored;
          return { ...rest, ...(value.uiLocale !== undefined ? { uiLocale: value.uiLocale } : {}), ...(value.uiLocaleAt !== undefined ? { uiLocaleAt: value.uiLocaleAt } : {}) };
        })
        .then((written) => {
          if (written) setRecord(written);
        });
    },
    [show],
  );

  const value = useMemo<ConsoleLocale>(
    () => ({ locale, messages: getMessages(locale), available: offered, setLocale, textSize, setTextSize, ready, record, lastChoice, applyRecord }),
    [locale, offered, setLocale, textSize, setTextSize, ready, record, lastChoice, applyRecord],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useConsoleLocale(): ConsoleLocale {
  return useContext(LocaleContext);
}

/** The console's UI locale. */
export function useLocale(): UiLocale {
  return useContext(LocaleContext).locale;
}

/** The dictionary for the console's UI locale; re-renders when it changes. */
export function useMessages(): Messages {
  return useContext(LocaleContext).messages;
}

/** The setter behind the Display sheet's Language row. */
export function useSetLocale(): (locale: UiLocale) => void {
  return useContext(LocaleContext).setLocale;
}
