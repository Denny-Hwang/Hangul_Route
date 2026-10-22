import { installContentOverlay } from '@hangul-route/content-schema/overlays';
import { registerMessageOverlay } from '@hangul-route/i18n';
import { isNewBuildError } from '../logic/lessons/lesson-store';
import { createLocalePackStore, LocalePackMismatch } from '../logic/locale/locale-pack-store';
import { abandonPendingChunk } from '../platform/lesson-chunk-abandon';
import { loadLocalePack } from '../platform/locale-packs';
import { isNewBuildAnswer, reloadForNewBuild } from '../platform/new-build-reload';

/**
 * The es / ko text of the app (F-CURR-002 §10, F-I18N-001 §3.6). On the web each locale is a precached chunk
 * of its own, loaded once (`platform/locale-packs.web.ts`); a loaded chunk's messages go to `getMessages`
 * (`registerMessageOverlay`) and its content overlays to `OVERLAYS` (`installContentOverlay`), so every
 * reader has them from then on. Native builds carry both locales from the start: nothing loads.
 *
 * A chunk that hangs past 15 s gives up its pending script, so the next try asks again; a chunk of a newer
 * build (the host's HTML page, another build's file) reloads the page once, online only, at most once a
 * minute, as a lesson chunk does (`platform/new-build-reload`); any other failure leaves the locale's text in
 * English until the next try (back online, or the language chosen again).
 */
export const localePacks = createLocalePackStore(loadLocalePack, {
  install: (locale, chunk) => {
    registerMessageOverlay(locale, chunk.LOCALE_MESSAGES);
    installContentOverlay(locale, chunk.LOCALE_CONTENT);
  },
  timeoutMs: 15_000,
  abandon: (bundleName) => {
    abandonPendingChunk(bundleName);
  },
  onFailure: (error) => {
    void (async () => {
      const newer = error instanceof LocalePackMismatch || isNewBuildError(error) || (await isNewBuildAnswer(error).catch(() => false));
      if (newer) reloadForNewBuild();
    })();
  },
});
