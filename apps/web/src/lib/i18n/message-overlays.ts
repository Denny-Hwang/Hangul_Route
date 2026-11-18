import {
  hasMessageOverlay,
  registerMessageOverlay,
  type DeepPartial,
  type Messages,
  type MessageLocale,
  type OverlayMessageLocale,
} from '@hangul-route/i18n';

/**
 * The console's es / ko messages, loaded when they are needed (AMENDMENTS-FINISH-2026-11 FN-6, finding F5 of
 * `docs/launch/performance-review-2026-11.md`). The browser build of the console carries English only: Next's
 * client compilation resolves `@hangul-route/i18n`'s `bundled-messages` to its `.web` twin (`next.config.js`), as
 * Metro does for the learner PWA, so every grown-up page loads English plus the one language it shows. Each other
 * language is its own chunk, reached only through the literal `import()` below; once in, it is handed to
 * `registerMessageOverlay` and `getMessages(locale)` reads it. The server build (the static HTML, always English)
 * and the tests carry both overlays from the start, so there this never loads anything.
 */
export type OverlayImporters = Readonly<Record<OverlayMessageLocale, () => Promise<DeepPartial<Messages>>>>;

/** One chunk per language: the subpaths of `@hangul-route/i18n` that hold one overlay each. */
const IMPORTERS: OverlayImporters = {
  es: () => import('@hangul-route/i18n/messages-es').then((m) => m.es),
  ko: () => import('@hangul-route/i18n/messages-ko').then((m) => m.ko),
};

export interface OverlayLoadDeps {
  importers?: OverlayImporters;
  has?: (locale: MessageLocale) => boolean;
  register?: (locale: OverlayMessageLocale, overlay: DeepPartial<Messages>) => void;
}

const inFlight = new Map<OverlayMessageLocale, Promise<boolean>>();

/**
 * Loads `locale`'s messages if they are not in yet. Resolves true once `getMessages(locale)` has them, false when the
 * chunk could not be fetched (the locale then reads English, and the next call tries again). Never rejects; one fetch
 * at a time per language.
 */
export function loadMessageOverlay(locale: MessageLocale, deps: OverlayLoadDeps = {}): Promise<boolean> {
  const has = deps.has ?? hasMessageOverlay;
  if (has(locale)) return Promise.resolve(true);
  const overlayLocale = locale as OverlayMessageLocale;
  const running = inFlight.get(overlayLocale);
  if (running !== undefined) return running;
  const importers = deps.importers ?? IMPORTERS;
  const register = deps.register ?? registerMessageOverlay;
  const load = importers[overlayLocale]()
    .then((overlay) => {
      register(overlayLocale, overlay);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      inFlight.delete(overlayLocale);
    });
  inFlight.set(overlayLocale, load);
  return load;
}

/**
 * Runs `then` once `locale`'s messages are in: at once (synchronously) when they are, else after the load (also when
 * it failed, so the step still happens, in English). For a view that draws a language other than the page's own
 * (the Display sheet's confirm step, the transfer consent's language select).
 */
export function withMessages(locale: MessageLocale, then: () => void, deps: OverlayLoadDeps = {}): void {
  if ((deps.has ?? hasMessageOverlay)(locale)) {
    then();
    return;
  }
  void loadMessageOverlay(locale, deps).then(then);
}
