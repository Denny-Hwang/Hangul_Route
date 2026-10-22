import type { OverlayLocale, Overlays } from '@hangul-route/content-schema';
import type { DeepPartial, Messages, UiLocale } from '@hangul-route/i18n';

/**
 * The es / ko text of the learner PWA at runtime (F-CURR-002 §10, F-I18N-001 §3.6). The web build's start
 * bundle carries English only: each other UI locale is one precached chunk (`content/locale-chunks/
 * locale-<locale>.ts`) holding that locale's UI messages and its content overlays, loaded once, through an
 * injected loader (`platform/locale-packs.web.ts`'s literal `import()`s). A UI locale applies once its chunk
 * is in (`i18n/use-messages.ts`), so a screen never mixes Spanish menus with English ones.
 *
 * The native build and the tests carry both locales from the start (the packages' eager tables), so they
 * have no loader: every locale counts as loaded and nothing is fetched.
 *
 * Pure over the loader and the install step, so the lazy path is testable without Metro
 * (`content/locale-packs.ts` binds the real ones).
 */

/** The module of a locale's chunk (`content/locale-chunks/locale-<locale>.ts`). */
export interface LocalePackChunk {
  /** `locale-pack:<locale>`: the marker the post-build check looks for (never in the start bundle). */
  LOCALE_PACK: string;
  /** The locale's UI message overlay (`@hangul-route/i18n/messages-<locale>`). */
  LOCALE_MESSAGES: DeepPartial<Messages>;
  /** The locale's content overlays (`@hangul-route/content-schema/overlays-<locale>`). */
  LOCALE_CONTENT: Overlays[OverlayLocale];
}

/** Loads a locale's chunk; null when the build carries every locale from the start (native, tests). */
export type LocalePackLoader = ((locale: OverlayLocale) => Promise<LocalePackChunk>) | null;

/** The overlay locales, in the order `ensureAll` loads them. */
export const PACK_LOCALES: readonly OverlayLocale[] = ['es', 'ko'];

/** The web bundle name of a locale's chunk (`locale-es`): what the post-build check and the give-up step match. */
export const localePackBundleName = (locale: OverlayLocale): string => `locale-${locale}`;

/** The marker a locale's chunk exports, so a build can tell the chunk from the start bundle. */
export const localePackMarker = (locale: OverlayLocale): string => `locale-pack:${locale}`;

/** A chunk that did not arrive in time (a hung request); a later ensure tries again. */
export class LocalePackTimeout extends Error {
  constructor(
    readonly locale: OverlayLocale,
    readonly ms: number,
  ) {
    super(`the ${locale} locale chunk did not load within ${ms} ms`);
    this.name = 'LocalePackTimeout';
  }
}

/** A chunk that is not the one asked for (another build's file, or the wrong locale). */
export class LocalePackMismatch extends Error {
  constructor(
    readonly locale: OverlayLocale,
    readonly marker: unknown,
  ) {
    super(`the ${locale} locale chunk carries ${String(marker)}`);
    this.name = 'LocalePackMismatch';
  }
}

export interface LocalePackOptions {
  /** Lays a loaded chunk into the app's tables (the message overlay and the content overlays); once per locale. */
  install: (locale: OverlayLocale, chunk: LocalePackChunk) => void;
  /** A load that has not settled after this many ms fails with `LocalePackTimeout`; none when omitted. */
  timeoutMs?: number;
  /** Called with the chunk's bundle name when its load times out, so the next ensure asks again (`platform/lesson-chunk-abandon`). */
  abandon?: (bundleName: string) => void;
  /** Called with each failed load's error (the binding reloads the page for a newer build). */
  onFailure?: (error: unknown) => void;
}

export interface LocalePackStore {
  /** True when the build carries every locale from the start (no loader): nothing ever loads. */
  readonly bundled: boolean;
  /** True when the locale's text is in: always for English and on a bundled build. */
  isLoaded: (locale: UiLocale) => boolean;
  /** True when the locale's chunk is in or its last load failed (its text then stays English until a retry). */
  settled: (locale: UiLocale) => boolean;
  /** Loads the locale's chunk once (a failed one again); rejects on a failed load. */
  ensure: (locale: UiLocale) => Promise<void>;
  /** Every overlay locale's chunk; rejects when one fails, after both have settled. */
  ensureAll: () => Promise<void>;
  /** Loads the locale's chunk and resolves once it is settled (`settled`). Never rejects. */
  untilSettled: (locale: UiLocale) => Promise<void>;
  /** Called with each loaded locale's content overlays so far, then with each as it arrives. */
  onContent: (listener: (locale: OverlayLocale, table: Overlays[OverlayLocale]) => void) => () => void;
  /** Change notifications for React (`useSyncExternalStore`): a chunk loaded or failed. */
  subscribe: (listener: () => void) => () => void;
  /** Bumps on every change: what a memo of another locale's text keys on. */
  version: () => number;
}

export function createLocalePackStore(load: LocalePackLoader, options: LocalePackOptions): LocalePackStore {
  const { install, timeoutMs, abandon, onFailure } = options;
  const loaded = new Map<OverlayLocale, LocalePackChunk>();
  const loads = new Map<OverlayLocale, Promise<void>>();
  const failed = new Set<OverlayLocale>();
  const contentListeners = new Set<(locale: OverlayLocale, table: Overlays[OverlayLocale]) => void>();
  const listeners = new Set<() => void>();
  let changes = 0;

  const changed = (): void => {
    changes += 1;
    for (const l of [...listeners]) l();
  };

  const withinTime = (locale: OverlayLocale, started: Promise<LocalePackChunk>): Promise<LocalePackChunk> => {
    if (timeoutMs === undefined) return started;
    return new Promise<LocalePackChunk>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new LocalePackTimeout(locale, timeoutMs));
        abandon?.(localePackBundleName(locale));
      }, timeoutMs);
      started.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  };

  const isLoaded = (locale: UiLocale): boolean => load === null || locale === 'en' || loaded.has(locale);

  const ensure = (locale: UiLocale): Promise<void> => {
    if (load === null || locale === 'en' || loaded.has(locale)) return Promise.resolve();
    const pending = loads.get(locale);
    if (pending !== undefined) return pending;
    let started: Promise<LocalePackChunk>;
    try {
      started = load(locale);
    } catch (error) {
      started = Promise.reject(error);
    }
    const promise = withinTime(locale, started)
      .then((chunk) => {
        if (chunk.LOCALE_PACK !== localePackMarker(locale)) throw new LocalePackMismatch(locale, chunk.LOCALE_PACK);
        return chunk;
      })
      .then(
        (chunk) => {
          install(locale, chunk);
          loaded.set(locale, chunk);
          failed.delete(locale);
          loads.delete(locale);
          for (const l of [...contentListeners]) l(locale, chunk.LOCALE_CONTENT);
          changed();
        },
        (error: unknown) => {
          failed.add(locale);
          loads.delete(locale);
          changed();
          onFailure?.(error);
          throw error;
        },
      );
    loads.set(locale, promise);
    return promise;
  };

  const settled = (locale: UiLocale): boolean => isLoaded(locale) || (locale !== 'en' && failed.has(locale));

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const untilSettled = (locale: UiLocale): Promise<void> => {
    const pending = ensure(locale).catch(() => undefined);
    // A retry of a failed locale counts as settled at once (the boot never waits on it twice); a first load waits.
    return settled(locale) ? Promise.resolve() : pending;
  };

  return {
    bundled: load === null,
    isLoaded,
    settled,
    ensure,
    ensureAll: async () => {
      const results = await Promise.allSettled(PACK_LOCALES.map(ensure));
      const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failure !== undefined) throw failure.reason;
    },
    untilSettled,
    onContent: (listener) => {
      for (const [locale, chunk] of loaded) listener(locale, chunk.LOCALE_CONTENT);
      contentListeners.add(listener);
      return () => {
        contentListeners.delete(listener);
      };
    },
    subscribe,
    version: () => changes,
  };
}
