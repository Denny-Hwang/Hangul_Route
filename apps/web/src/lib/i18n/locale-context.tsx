'use client';

import { DEFAULT_TEXT_SIZE, MIGRATED_AT, mergeAccountLocale, type AccountLocale, type DeviceSettings, type TextSize } from '@hangul-route/content-schema';
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
  clearStoredLocale,
  firstPaintLocale,
  queryLocale,
  readStoredLocale,
  readStoredTextSize,
  resolveConsoleDisplay,
  writeStoredLocale,
  writeStoredTextSize,
} from './console-locale';
import { HEAD_RATIO_CSS_VAR, ROOT_FONT_SIZE, headRatio } from '../console/rem';
import { followDeviceSettings, readDeviceSettings, writeDeviceSettings, type DeviceSettingsRead } from './device-settings';

/**
 * Console locale and text size provider — F-I18N-001 §3.2; owner items 6 and 7 (one UI language
 * per device and per account). The static HTML is always English (the locale of the route). After
 * mount the provider reads the device's one display record (`hr:device:settings`, shared with
 * the learner app on this origin) and resolves the language (`resolveConsoleDisplay`: the record >
 * on a device with no learner profiles, the console choice stored before the record existed > a
 * `?lang=` > the browser languages; the first two that the record lacks seed it, stamped
 * `MIGRATED_AT` so any account choice beats them) and the text size; until then `ready` is
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
  /**
   * True once the record read has finished (readable or not) and any seed it called for is
   * stored; never because the paint wait ran out. The account merge waits for it, so it never
   * merges against a record that is still being read.
   */
  recordSettled: boolean;
  /** The record as read (null until read, or where it cannot be read): the account merge reads it. */
  record: DeviceSettings | null;
  /** The last language chosen in this tab, with its time: the account sync writes it to the account. */
  lastChoice: { uiLocale: UiLocale; uiLocaleAt: string } | null;
  /**
   * The signed-in account's language won the merge: it is written into the record, but only if it
   * is still newer than what the record holds when the write runs (another tab may have chosen
   * meanwhile), then mirrored and applied. Where the record cannot be written it applies to this
   * tab only.
   */
  applyAccount: (account: AccountLocale) => void;
}

const ENGLISH_ONLY: readonly UiLocale[] = [DEFAULT_LOCALE];

/**
 * Keeps the mirrors in step with the record: the language mirror says the record's language, and
 * nothing when the record holds none (`clear`); `keep` (or null) leaves it. A mirror that already
 * says so is not written again.
 */
function syncMirrors(locale: UiLocale | 'clear' | 'keep' | null, size: TextSize | null): void {
  if (locale === 'clear') {
    if (readStoredLocale() !== null) clearStoredLocale();
  } else if (locale !== null && locale !== 'keep' && readStoredLocale() !== locale) writeStoredLocale(locale);
  if (size !== null && (readStoredTextSize() ?? DEFAULT_TEXT_SIZE) !== size) writeStoredTextSize(size);
}

const LocaleContext = createContext<ConsoleLocale>({
  locale: DEFAULT_LOCALE,
  messages: getMessages(DEFAULT_LOCALE),
  available: ENGLISH_ONLY,
  setLocale: () => undefined,
  textSize: DEFAULT_TEXT_SIZE,
  setTextSize: () => undefined,
  ready: true,
  recordSettled: false,
  record: null,
  lastChoice: null,
  applyAccount: () => undefined,
});

/** How long the gate waits for the record before it paints with the first-paint guess (a stuck IndexedDB). */
export const RECORD_WAIT_MS = 1500;

export interface LocaleProviderDeps {
  readDevice?: () => Promise<DeviceSettingsRead>;
  writeDevice?: typeof writeDeviceSettings;
  follow?: typeof followDeviceSettings;
  now?: () => string;
  /** Takes `lang` out of the address bar (`history.replaceState`); the rest of the query stays as written. */
  dropLang?: () => void;
}

/** The address without `lang`, the rest of the query and the hash kept as written. */
export function withoutLang(location: { pathname: string; search: string; hash: string }): string {
  const pairs = location.search.replace(/^\?/, '').split('&').filter((pair) => pair !== '' && pair.split('=')[0] !== 'lang');
  return `${location.pathname}${pairs.length > 0 ? `?${pairs.join('&')}` : ''}${location.hash}`;
}

function browserDropLang(): void {
  try {
    if (typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', withoutLang(window.location));
  } catch {
    // A history that refuses (a sandboxed frame) keeps the parameter; it never wins over the device anyway.
  }
}

export function LocaleProvider({ children, available, deps }: { children: ReactNode; available?: readonly UiLocale[]; deps?: LocaleProviderDeps }): JSX.Element {
  const offered = useMemo(() => available ?? availableLocales(), [available]);
  const io = useRef<Required<LocaleProviderDeps>>({
    readDevice: deps?.readDevice ?? (() => readDeviceSettings()),
    writeDevice: deps?.writeDevice ?? writeDeviceSettings,
    follow: deps?.follow ?? followDeviceSettings,
    now: deps?.now ?? (() => new Date().toISOString()),
    dropLang: deps?.dropLang ?? browserDropLang,
  });
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  const [textSize, setTextSizeState] = useState<TextSize>(DEFAULT_TEXT_SIZE);
  const [ready, setReady] = useState(false);
  const [recordSettled, setRecordSettled] = useState(false);
  const [record, setRecord] = useState<DeviceSettings | null>(null);
  const recordRef = useRef<DeviceSettings | null>(null);
  const keepRecord = useCallback((value: DeviceSettings | null) => {
    recordRef.current = value;
    setRecord(value);
  }, []);
  const [lastChoice, setLastChoice] = useState<{ uiLocale: UiLocale; uiLocaleAt: string } | null>(null);

  /** Shows a record (from a read, a write, another tab or the account merge) and mirrors it. */
  const show = useCallback(
    (value: DeviceSettings) => {
      keepRecord(value);
      const next = value.uiLocale !== undefined && offered.includes(value.uiLocale) ? value.uiLocale : null;
      if (next !== null) setLocaleState(next);
      const size = value.textSize ?? DEFAULT_TEXT_SIZE;
      setTextSizeState(size);
      syncMirrors(next ?? 'clear', size);
    },
    [offered, keepRecord],
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
    // The hand-off has been read: it leaves the address, so a reload or a bookmark never carries it.
    if (query !== null || (typeof window !== 'undefined' && /[?&]lang=/.test(window.location.search))) io.current.dropLang();
    void io.current
      .readDevice()
      .catch((): DeviceSettingsRead => ({ readable: false }))
      .then((device) => {
        if (!live) return;
        const picked = resolveConsoleDisplay({ device, mirror, query, languages, available: offered });
        setLocaleState(picked.locale);
        setTextSizeState(picked.textSize);
        syncMirrors(picked.mirror, picked.textSize);
        keepRecord(device.readable ? device.value : null);
        setReady(true);
        clearTimeout(wait);
        if (picked.seed === null) {
          setRecordSettled(true);
          return;
        }
        const seed = picked.seed;
        // A seed (a `?lang=`, or the console's own choice from before the record) is stamped
        // MIGRATED_AT: it was not chosen here just now, so any account choice beats it
        // (AMENDMENTS-DISPLAY-NAV sections 3.3 and 3.4). A choice another tab stored meanwhile wins.
        void io.current
          .writeDevice((stored) => (stored.uiLocale !== undefined ? null : { uiLocale: seed, uiLocaleAt: MIGRATED_AT }))
          .then((now) => {
            if (!live) return;
            if (now) show(now);
            else keepRecord({ ...(device.readable ? device.value : {}), uiLocale: seed, uiLocaleAt: MIGRATED_AT });
            setRecordSettled(true);
          });
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
  }, [offered, show, keepRecord]);

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
    const f = textSizeFactor(textSize);
    style.setProperty(TEXT_SCALE_CSS_VAR, String(f));
    // Headings grow half as much (AMENDMENTS-DISPLAY-NAV section 4): their rem is multiplied by this ratio.
    style.setProperty(HEAD_RATIO_CSS_VAR, String(headRatio(f)));
    style.setProperty('font-size', ROOT_FONT_SIZE);
    return () => {
      style.removeProperty(TEXT_SCALE_CSS_VAR);
      style.removeProperty(HEAD_RATIO_CSS_VAR);
      style.removeProperty('font-size');
    };
  }, [textSize]);

  const setLocale = useCallback(
    (next: UiLocale) => {
      if (!offered.includes(next)) return;
      const at = io.current.now();
      setLocaleState(next);
      syncMirrors(next, null);
      setLastChoice({ uiLocale: next, uiLocaleAt: at });
      void io.current.writeDevice(() => ({ uiLocale: next, uiLocaleAt: at })).then((written) => {
        if (written) keepRecord(written);
      });
    },
    [offered, keepRecord],
  );

  const setTextSize = useCallback(
    (size: TextSize) => {
      setTextSizeState(size);
      syncMirrors(null, size);
      void io.current.writeDevice(() => ({ textSize: size })).then((written) => {
        if (written) keepRecord(written);
      });
    },
    [keepRecord],
  );

  const applyAccount = useCallback(
    (account: AccountLocale) => {
      // Merged again against what is stored when the write runs: a newer choice another tab made
      // meanwhile is kept, never overwritten by the older account value.
      void io.current
        .writeDevice((stored) => mergeAccountLocale(stored, account).device)
        .then((now) => {
          if (now) {
            show(now);
            return;
          }
          // The record cannot be written: the account's language applies to this tab only.
          const inTab = mergeAccountLocale(recordRef.current ?? {}, account).device;
          if (inTab && offered.includes(inTab.uiLocale)) {
            setLocaleState(inTab.uiLocale);
            syncMirrors(inTab.uiLocale, null);
          }
        });
    },
    [show, offered],
  );

  const value = useMemo<ConsoleLocale>(
    () => ({ locale, messages: getMessages(locale), available: offered, setLocale, textSize, setTextSize, ready, recordSettled, record, lastChoice, applyAccount }),
    [locale, offered, setLocale, textSize, setTextSize, ready, recordSettled, record, lastChoice, applyAccount],
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
