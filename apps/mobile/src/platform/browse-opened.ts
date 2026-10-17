import type { BrowseSource } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { openedEvent } from '../logic/browse/boot';
import type { ResolvedPass } from '../logic/browse/pass';
import { flushQueue, track } from './telemetry';

/**
 * What the browse root does each time it resolves a link's pass (F-BROWSE-001
 * sections 4.4, 4.9 and 9): the first boot, and a later link in the same tab
 * (`hashchange`). The pass's UI language is applied once the device locale is
 * read (`applyLocale`: the root passes the locale store's `seedDeviceLocale`,
 * which only seeds a device that never chose, owner items 6 and 7; browse
 * platform code reaches no store, section 4.10); `browse.opened` goes out
 * for the link's source from the browse queue (the fence is already on), and
 * the queue is flushed. A pass that runs out sends nothing: that is not a link.
 */
export async function announceBrowseOpened(i: {
  source: BrowseSource;
  resolved: ResolvedPass;
  offlineReady: boolean;
  /** The device locale read (`useLocaleStore.hydrate([])`); the pass's language applies after it. */
  localeReady: Promise<unknown>;
  applyLocale: (locale: UiLocale) => void;
}): Promise<void> {
  const uiLocale = i.resolved.status === 'active' ? i.resolved.uiLocale : undefined;
  const sent = track(openedEvent({ source: i.source, pass: i.resolved, offlineReady: i.offlineReady })).then(() => flushQueue());
  if (uiLocale) {
    await i.localeReady.catch(() => undefined);
    i.applyLocale(uiLocale);
  }
  await sent;
}
