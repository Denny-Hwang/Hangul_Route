import { Screen, ScreenHeaderSlotContext, TextSizeProvider } from '@hangul-route/design-system';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AdultPersona, BrowsePass } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { flags, bundleOs, gatingActive } from './src/config/flags';
import { useDocumentLang, useMessages } from './src/i18n/use-messages';
import {
  entryStack,
  lessonAfter,
  linkStep,
  navigationCheck,
  readBootFragment,
  reentryResets,
  type BootFragment,
  type BrowseEntryRoute,
  type BrowseRouteName,
  type Reentry,
} from './src/logic/browse/boot';
import { defaultBrowseBundle } from './src/logic/browse/bundle';
import type { ResolvedPass } from './src/logic/browse/pass';
import { resolveEntry } from './src/logic/browse/target';
import { BROWSE_REGISTERED_ROUTES, BrowseNavigator, type BrowseStackParamList } from './src/navigation/browse';
import { PortraitGuard } from './src/components/PortraitGuard';
import { ConfirmHost } from './src/components/ConfirmHost';
import { LearnerScreenHeader } from './src/components/LearnerScreenHeader';
import { installHistoryBridge } from './src/platform/history-bridge';
import { OopsScreen } from './src/screens/system/OopsScreen';
import { BrowseSessionProvider, type BrowseSession } from './src/screens/browse/browse-session';
import { BrowseSettingsProvider } from './src/screens/browse/BrowseSettings';
import { canRenderPicture } from './src/screens/vocab/topic-data';
import { installGestureUnlock } from './src/platform/audio';
import { writeSessionPass } from './src/platform/browse';
import { readLastPersonaInTime, resolveBrowseBoot, type BrowseBoot } from './src/platform/browse-boot';
import { isOnline, markBootSettled, onFragmentChange, onPageRestored, onPageVisible } from './src/platform/browse-env';
import { announceBrowseOpened } from './src/platform/browse-opened';
import { startBrowse as runBrowseStart, type BrowseStart } from './src/platform/browse-start';
import { isOfflineReady, subscribePwa } from './src/platform/pwa';
import { flushQueue } from './src/platform/telemetry';
import { useAudioStore } from './src/store/audio-store';
import { followDeviceSettings, useLocaleStore } from './src/store/locale-store';

/**
 * All lessons, the third root of the learner web build at `/browse`
 * (F-BROWSE-001 BD1, sections 4.1, 4.3, 4.4 and 4.10). Grown-ups see every
 * lesson the way a learner does, and nothing they do is saved.
 *
 * Before anything can write or send, the boot applies the storage write fence,
 * the telemetry fence and the browse telemetry queue (BD3). It reads the link's
 * fragment and takes it out of the address, and resolves the pass: an active
 * session pass synchronously (nothing waits), else the kept pass and the last
 * grown-up persona (`platform/browse-start.ts` holds the first steps' order). It hydrates only the audio settings and the device locale
 * (`hydrate([])`, no profile id), applies the pass's UI locale in memory, and
 * sends `browse.opened` from its own queue.
 *
 * It never mounts `PwaBanners` (no update applies during a preview), never
 * calls `hydrateLearnerData`, sync, the inbox, the plan derivation, the
 * progress persist listener, the audio level binding or `requestPersistence`,
 * and keeps the grown-up unlock and the console session (BD1) only when the
 * tab can go back to the page that opened it; a tab with nothing to go back to
 * (a new tab, an address typed in) clears both at boot (BR-6 review).
 */

let started: BrowseStart | null = null;

/**
 * The pass's UI language (the console's, at the hand-off): a seed for a device that never chose,
 * like `?lang=` (owner items 6 and 7: one UI language per device, so there is no tab-only language).
 */
const applyLocale = (locale: UiLocale): void => useLocaleStore.getState().seedDeviceLocale(locale);

/** Runs once per page, during the first render (`platform/browse-start.ts`). */
function startBrowse(): BrowseStart {
  if (!started) started = runBrowseStart(Date.now());
  return started;
}

type Visit =
  | { status: 'pending' }
  | { status: 'ready'; session: BrowsePass | null; resolved: ResolvedPass; lastPersona: AdultPersona | null; initial: BrowseEntryRoute[] };

const navigation = createNavigationContainerRef<BrowseStackParamList>();

function routesOf(stack: readonly BrowseEntryRoute[]): { index: number; routes: { name: BrowseEntryRoute['name']; params: BrowseEntryRoute['params'] }[] } {
  return { index: stack.length - 1, routes: stack.map((r) => ({ name: r.name, params: r.params })) };
}

function currentRoute(): BrowseRouteName | null {
  return (navigation.getCurrentRoute()?.name as BrowseRouteName | undefined) ?? null;
}

export default function BrowseApp(): React.ReactElement {
  const start = useMemo(startBrowse, []);
  useDocumentLang();
  const messages = useMessages();
  // The device record's text size (owner items 6 and 7).
  const textSize = useLocaleStore((s) => s.textSize);
  const bundle = useMemo(() => defaultBrowseBundle(canRenderPicture), []);
  // The effective switch, read once (BD6): never the raw flag.
  const gatingEnabled = useMemo(() => gatingActive(flags, bundleOs()), []);
  const [online, setOnline] = useState(isOnline);

  const stackFor = useCallback(
    (fragment: BootFragment, boot: Pick<BrowseBoot, 'resolved' | 'lastPersona'>): BrowseEntryRoute[] =>
      entryStack(resolveEntry({ target: fragment.target, pass: boot.resolved, lastPersona: boot.lastPersona, bundle }), BROWSE_REGISTERED_ROUTES),
    [bundle],
  );

  const [visit, setVisit] = useState<Visit>(() =>
    start.fast
      ? { status: 'ready', ...start.fast, lastPersona: null, initial: stackFor(start.fragment, { resolved: start.fast.resolved, lastPersona: null }) }
      : { status: 'pending' },
  );
  // The pass as the navigation listeners must read it, without waiting for a render.
  const passRef = useRef<{ session: BrowsePass | null; resolved: ResolvedPass } | null>(start.fast);
  // The screen shown last (`null` until the first one: a page load or a reload is not activity), and whether a
  // lesson is under way (`lessonAfter`: by how the visit got there, not by the route name).
  const previousRoute = useRef<BrowseRouteName | null>(null);
  const inLesson = useRef(false);
  // The latest link: a `hashchange` while the boot still reads the kept pass replaces the first fragment.
  const fragmentRef = useRef<BootFragment>(start.fragment);
  // The device locale read, which the pass's session language waits for.
  const localeReady = useRef<Promise<unknown>>(Promise.resolve());
  const expiring = useRef(false);

  // Boot: audio, the device locale (no profile), the pass, then `browse.opened` from the browse queue.
  useEffect(() => {
    let live = true;
    const uninstallUnlock = installGestureUnlock();
    const audioReady = useAudioStore.getState().hydrate().catch(() => undefined);
    localeReady.current = useLocaleStore.getState().hydrate([]).catch(() => undefined);
    // The device record changed in another tab (the learner app, the grown-up pages): follow it live.
    const unfollow = followDeviceSettings();
    const opened = (resolved: ResolvedPass): Promise<void> =>
      announceBrowseOpened({ source: fragmentRef.current.source, resolved, offlineReady: isOfflineReady(), localeReady: localeReady.current, applyLocale });
    let booted: Promise<unknown>;
    if (start.fast) {
      booted = Promise.all([
        opened(start.fast.resolved),
        readLastPersonaInTime().then((lastPersona) => {
          if (live) setVisit((v) => (v.status === 'ready' ? { ...v, lastPersona } : v));
        }),
      ]);
    } else {
      booted = resolveBrowseBoot(Date.now()).then((boot) => {
        if (!live) return undefined;
        passRef.current = { session: boot.session, resolved: boot.resolved };
        setVisit({ status: 'ready', ...boot, initial: stackFor(fragmentRef.current, boot) });
        return opened(boot.resolved);
      });
    }
    // Every boot read, write and send has finished: the page says so (an e2e waits on it, never on a timer).
    void Promise.all([booted, audioReady, localeReady.current])
      .catch(() => undefined)
      .then(() => {
        if (live) markBootSettled();
      });
    const offPwa = subscribePwa((event) => {
      if (event === 'went-offline') setOnline(false);
      if (event === 'back-online') {
        setOnline(true);
        void flushQueue();
      }
    });
    return () => {
      live = false;
      uninstallUnlock();
      unfollow();
      offPwa();
    };
  }, [start, stackFor]);

  /**
   * Resolves the pass again and shows where it lands: a new link (`link`, which
   * also applies its pass's language and sends `browse.opened` for its source,
   * as the first boot does), a pass that ran out (`expired`) or a page restored
   * from the back/forward cache (`restored`); the last two are silent (not a
   * link) and keep the screen while a pass is still active (`reentryResets`).
   */
  const reenter = useCallback(
    async (fragment: BootFragment, why: Reentry): Promise<void> => {
      const boot = await resolveBrowseBoot(Date.now());
      passRef.current = { session: boot.session, resolved: boot.resolved };
      setVisit((v) => (v.status === 'ready' ? { ...v, session: boot.session, resolved: boot.resolved, lastPersona: boot.lastPersona } : v));
      if (reentryResets(why, boot.resolved) && navigation.isReady()) navigation.reset(routesOf(stackFor(fragment, boot)));
      if (why === 'link') {
        void announceBrowseOpened({ source: fragment.source, resolved: boot.resolved, offlineReady: isOfflineReady(), localeReady: localeReady.current, applyLocale });
      }
    },
    [stackFor],
  );

  // A later link while the tab is open (`hashchange`) is read the same way as the first. While the boot is still
  // resolving, the boot takes the latest link instead (nothing is mounted to reset yet).
  useEffect(
    () =>
      onFragmentChange((raw) => {
        const fragment = readBootFragment(raw);
        fragmentRef.current = fragment;
        if (linkStep(passRef.current !== null) === 'reenter') void reenter(fragment, 'link');
      }),
    [reenter],
  );

  // Every browse navigation refreshes a session pass's `seen`, or ends the visit when it ran out (section 4.3).
  // The first screen of a page load only checks the pass: a reload is not activity.
  const onNavigate = useCallback(() => {
    const to = currentRoute();
    const pass = passRef.current;
    if (to === null || pass === null) return;
    const activity = previousRoute.current !== null;
    const check = navigationCheck({ resolved: pass.resolved, session: pass.session, now: Date.now(), inLesson: inLesson.current, to, activity });
    previousRoute.current = to;
    inLesson.current = lessonAfter(inLesson.current, to);
    if (check.write && writeSessionPass(check.write)) passRef.current = { ...pass, session: check.write };
    if (check.expired) void reenter({ target: null, source: 'direct' }, 'expired');
  }, [reenter]);

  // A tab shown again after its pass ran out shows the Access screen without waiting for a tap, so a device
  // picked up later shows no catalogue (section 4.3). Being shown is not activity: `seen` is not refreshed, and
  // a lesson that already started still runs to its end screen.
  useEffect(
    () =>
      onPageVisible(() => {
        const at = currentRoute();
        const pass = passRef.current;
        if (at === null || pass === null) return;
        if (expiring.current) return;
        if (navigationCheck({ resolved: pass.resolved, session: pass.session, now: Date.now(), inLesson: inLesson.current, to: at, activity: false }).expired) {
          // Showing a tab fires both `visibilitychange` and `focus`: resolve once.
          expiring.current = true;
          void reenter({ target: null, source: 'direct' }, 'expired').finally(() => {
            expiring.current = false;
          });
        }
      }),
    [reenter],
  );

  // A page restored from the back/forward cache keeps its memory: read the pass again, since a learner page in this
  // tab (Close or Back to the app, then Forward) removed it at its boot (F-APP-001 section 3.9 clearing). Without an
  // active pass the Access screen replaces the screen, even inside a lesson (section 4.3, BR-6 review).
  useEffect(
    () =>
      onPageRestored(() => {
        if (passRef.current === null) return;
        void reenter({ target: null, source: 'direct' }, 'restored');
      }),
    [reenter],
  );

  // The web history bridge (AMENDMENTS-DISPLAY-NAV section 7.2): the browser back steps back one screen, and Close
  // still goes back past every entry this page added (`1 + hrBrowseDepth + hrNav`, platform/browse-env).
  const stopBridge = useRef<(() => void) | null>(null);
  const onReady = useCallback(() => {
    stopBridge.current?.();
    stopBridge.current = installHistoryBridge(navigation);
    onNavigate();
  }, [onNavigate]);
  useEffect(
    () => () => {
      stopBridge.current?.();
      stopBridge.current = null;
    },
    [],
  );

  const session: BrowseSession | null = useMemo(
    () =>
      visit.status === 'ready'
        ? { pass: visit.resolved.status === 'active' ? visit.resolved : null, bundle, gatingEnabled, lastPersona: visit.lastPersona, online }
        : null,
    [visit, bundle, gatingEnabled, online],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TextSizeProvider step={textSize}>
        <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
          {visit.status === 'ready' && session ? (
            <BrowseSessionProvider value={session}>
              <BrowseSettingsProvider>
                <ScreenHeaderSlotContext.Provider value={LearnerScreenHeader}>
                  <NavigationContainer
                    ref={navigation}
                    initialState={routesOf(visit.initial)}
                    documentTitle={{ formatter: () => messages.caregiver.browse.documentTitle }}
                    onReady={onReady}
                    onStateChange={onNavigate}
                  >
                    <BrowseNavigator />
                    <StatusBar style="dark" />
                  </NavigationContainer>
                </ScreenHeaderSlotContext.Provider>
                <ConfirmHost />
              </BrowseSettingsProvider>
            </BrowseSessionProvider>
          ) : (
            <Screen tone="canvas">{null}</Screen>
          )}
          {/* F-LAYOUT-001 §3.4: a touch phone held sideways is asked, once, to turn upright. */}
          <PortraitGuard />
        </ErrorBoundary>
        </TextSizeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
