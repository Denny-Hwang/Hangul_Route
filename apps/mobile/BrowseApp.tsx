import { Screen } from '@hangul-route/design-system';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AdultPersona, BrowsePass } from '@hangul-route/content-schema';
import { flags, bundleOs, gatingActive } from './src/config/flags';
import { useDocumentLang, useMessages } from './src/i18n/use-messages';
import { entryStack, navigationCheck, openedEvent, readBootFragment, type BootFragment, type BrowseEntryRoute, type BrowseRouteName } from './src/logic/browse/boot';
import { defaultBrowseBundle } from './src/logic/browse/bundle';
import type { ResolvedPass } from './src/logic/browse/pass';
import { resolveEntry } from './src/logic/browse/target';
import { BROWSE_REGISTERED_ROUTES, BrowseNavigator, type BrowseStackParamList } from './src/navigation/browse';
import { PortraitGuard } from './src/components/PortraitGuard';
import { OopsScreen } from './src/screens/system/OopsScreen';
import { BrowseSessionProvider, type BrowseSession } from './src/screens/browse/browse-session';
import { BrowseSettingsProvider } from './src/screens/browse/BrowseSettings';
import { installGestureUnlock } from './src/platform/audio';
import { writeSessionPass } from './src/platform/browse';
import { resolveBrowseBoot, resolveSessionNow, type BrowseBoot } from './src/platform/browse-boot';
import { isOnline, onFragmentChange, takeFragment } from './src/platform/browse-env';
import { applyBrowseFences } from './src/platform/browse-fences';
import { isOfflineReady, subscribePwa } from './src/platform/pwa';
import { readLastPersona } from './src/platform/shell-store';
import { flushQueue, track } from './src/platform/telemetry';
import { useAudioStore } from './src/store/audio-store';
import { useLocaleStore } from './src/store/locale-store';

/**
 * All lessons, the third root of the learner web build at `/browse`
 * (F-BROWSE-001 BD1, sections 4.1, 4.3, 4.4 and 4.10). Grown-ups see every
 * lesson the way a learner does, and nothing they do is saved.
 *
 * Before anything can write or send, the boot applies the storage write fence,
 * the telemetry fence and the browse telemetry queue (BD3). It reads the link's
 * fragment and takes it out of the address, and resolves the pass: an active
 * session pass synchronously (nothing waits), else the kept pass and the last
 * grown-up persona. It hydrates only the audio settings and the device locale
 * (`hydrate([])`, no profile id), applies the pass's UI locale in memory, and
 * sends `browse.opened` from its own queue.
 *
 * It never mounts `PwaBanners` (no update applies during a preview), never
 * calls `hydrateLearnerData`, sync, the inbox, the plan derivation, the
 * progress persist listener, the audio level binding or `requestPersistence`,
 * and never touches the grown-up unlock or the console session (BD1).
 */

interface BrowseStart {
  fragment: BootFragment;
  /** The session pass resolved before first paint, when it is active. */
  fast: { session: BrowsePass; resolved: ResolvedPass } | null;
}

let started: BrowseStart | null = null;

/** Runs once per page, during the first render: fences first, then the address and the session pass. */
function startBrowse(): BrowseStart {
  if (started) return started;
  applyBrowseFences();
  const fragment = readBootFragment(takeFragment());
  started = { fragment, fast: resolveSessionNow(Date.now()) };
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
  const bundle = useMemo(() => defaultBrowseBundle(), []);
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
  const previousRoute = useRef<BrowseRouteName | null>(null);

  // Boot: audio, the device locale (no profile), the pass, then `browse.opened` from the browse queue.
  useEffect(() => {
    let live = true;
    const uninstallUnlock = installGestureUnlock();
    void useAudioStore.getState().hydrate().catch(() => undefined);
    const locale = useLocaleStore.getState().hydrate([]).catch(() => undefined);
    const opened = (resolved: ResolvedPass): void => {
      const uiLocale = resolved.status === 'active' ? resolved.uiLocale : undefined;
      if (uiLocale) void locale.then(() => useLocaleStore.getState().setSessionLocale(uiLocale));
      void track(openedEvent({ source: start.fragment.source, pass: resolved, offlineReady: isOfflineReady() })).then(() => flushQueue());
    };
    if (start.fast) {
      opened(start.fast.resolved);
      void readLastPersona().then((lastPersona) => {
        if (live) setVisit((v) => (v.status === 'ready' ? { ...v, lastPersona } : v));
      });
    } else {
      void resolveBrowseBoot(Date.now()).then((boot) => {
        if (!live) return;
        passRef.current = { session: boot.session, resolved: boot.resolved };
        setVisit({ status: 'ready', ...boot, initial: stackFor(start.fragment, boot) });
        opened(boot.resolved);
      });
    }
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
      offPwa();
    };
  }, [start, stackFor]);

  /** Resolves the pass again (a new link, or a pass that ran out) and shows where it lands. */
  const reenter = useCallback(
    async (fragment: BootFragment): Promise<void> => {
      const boot = await resolveBrowseBoot(Date.now());
      passRef.current = { session: boot.session, resolved: boot.resolved };
      setVisit((v) => (v.status === 'ready' ? { ...v, session: boot.session, resolved: boot.resolved, lastPersona: boot.lastPersona } : v));
      if (navigation.isReady()) navigation.reset(routesOf(stackFor(fragment, boot)));
    },
    [stackFor],
  );

  // A later link while the tab is open (`hashchange`) is read the same way as the first.
  useEffect(() => onFragmentChange((raw) => void reenter(readBootFragment(raw))), [reenter]);

  // Every browse navigation refreshes a session pass's `seen`, or ends the visit when it ran out (section 4.3).
  const onNavigate = useCallback(() => {
    const to = currentRoute();
    const pass = passRef.current;
    if (to === null || pass === null) return;
    const check = navigationCheck({ resolved: pass.resolved, session: pass.session, now: Date.now(), from: previousRoute.current, to });
    previousRoute.current = to;
    if (check.write && writeSessionPass(check.write)) passRef.current = { ...pass, session: check.write };
    if (check.expired) void reenter({ target: null, source: 'direct' });
  }, [reenter]);

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
        <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
          {visit.status === 'ready' && session ? (
            <BrowseSessionProvider value={session}>
              <BrowseSettingsProvider>
                <NavigationContainer
                  ref={navigation}
                  initialState={routesOf(visit.initial)}
                  documentTitle={{ formatter: () => messages.caregiver.browse.documentTitle }}
                  onReady={onNavigate}
                  onStateChange={onNavigate}
                >
                  <BrowseNavigator />
                  <StatusBar style="dark" />
                </NavigationContainer>
              </BrowseSettingsProvider>
            </BrowseSessionProvider>
          ) : (
            <Screen tone="canvas">{null}</Screen>
          )}
          {/* F-LAYOUT-001 §3.4: a touch phone held sideways is asked, once, to turn upright. */}
          <PortraitGuard />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
