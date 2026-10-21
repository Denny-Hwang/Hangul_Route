import {
  Body,
  Button,
  Screen,
  Spacer,
  colors,
  layout,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PIN_PAD_GAP, PinPad } from '../../components/PinPad';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { afterGateHandoff } from '../../logic/browse/gate-entry';
import { pinCreated, pinResetCompleted, pinResetRequested } from '../../logic/onboarding/onboarding-events';
import {
  forCancelReset,
  forFreshPin,
  forGrownUpArea as opensGrownUpArea,
  forLockedProfile,
  grownUpAreaNoPin,
  initialPinMode,
  pinCreatedWhere,
  showForgotPin,
  verifiedGoesToSetup,
  voidWithoutPin,
  type PinMode,
} from '../../logic/profiles/pin-flow';
import {
  PIN_LENGTH,
  attemptsRemaining,
  cooldownRemainingMs,
  createPinHash,
} from '../../logic/profiles/pin-hash';
import { pauseAnnounceKey, pauseText, showsPauseHelp } from '../../logic/profiles/pin-pause';
import { pinKeyMax, pinPadBudget, pinPadFirstWidth, pinPadLayout } from '../../logic/profiles/pin-pad-layout';
import { routeGateStep } from '../../logic/route/proposal-flow';
import type { RootStackParamList } from '../../navigation/types';
import { flags } from '../../config/flags';
import { subscribeAppVisibility } from '../../platform/app-visibility';
import { onPinAttemptsChanged } from '../../platform/pin-attempts-channel';
import { openBrowseFromGate } from '../../platform/browse-handoff';
import { pinHasher } from '../../platform/crypto';
import { continueToGrownUpPage, openGrownUpArea } from '../../platform/grown-up-handoff';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { trackGateOpened, trackPinPaused, trackProfileSwitch } from '../../store/gate-telemetry';
import { verifyForLockedProfile } from '../../store/profile-locks';
import { useProfileStore } from '../../store/profile-store';
import { useUiStore } from '../../store/ui-store';
import { pickLanding } from '../../logic/profiles/who';
import { routeZone } from '../../logic/profiles/session';
import { heldJoin, persistLeaving, takeHeldJoin } from '../../store/who-chooser';

type Props = NativeStackScreenProps<RootStackParamList, 'PinEntry'>;

/**
 * Grown-up gate — F-PROF-001 §3.1 (PIN, 5 attempts / 60 s, 30 s cooldown)
 * and §10 (interim: the first entry creates the family PIN because
 * parent-first onboarding has not shipped yet). Replaces the v1.0 math gate
 * (10-app-map §7 #1). Digits are never echoed as text — dots only (§3.5).
 *
 * Destination `GrownUpArea` (F-APP-001 section 3.9, web only; wireframe
 * `parent/grown-up-home-card.md` Panel D and `shell/grown-up-lock.md`): verify only, no Forgot
 * PIN, never a new PIN. A correct PIN hands off to the grown-up page in this tab
 * (`openGrownUpArea`); with no PIN stored the screen shows one line and Continue to the page
 * without an unlock. Cancel and Close write nothing (the learner boot already cleared the tab).
 *
 * Destination `Billing` (F-BILL-002 B-9, section 4.7, web only): the learner Plan screen's Open
 * billing. A correct PIN opens the grown-up session and returns to the Plan screen, which asks for
 * one more tap of Open billing (a tab opened outside a tap may be blocked); Cancel opens nothing.
 *
 * Destination `ExternalLink` (F-STORY-002): a source link on Sources; a correct PIN returns there,
 * which likewise asks for one more tap on the web.
 *
 * [OA] PIN v2 (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2, section 8.3; wireframe `profiles/pin-entry-v2.md`, mock
 * `design/screens/profiles/pin-entry-v2.md` boards 2 and 3): longer pauses (30 s, 1 min, 5 min, 15 min, 60 min),
 * minutes from a minute on, the Forgot PIN? help line from the 3rd pause on the Grown-up area only, a polite live
 * region updated once a minute, one attempt count shared by every tab, `pin.paused` and `parent.gate.opened`.
 *
 * [OA] Destination `CancelReset` (row OA-4a, OA-D21; mock `design/screens/profiles/pin-entry-v2.md` D8): the chooser's
 * **Cancel the wait**, titled with those words. Verify only, no Forgot PIN?: a correct PIN clears the pending 24-hour
 * wait, sends `pin.reset_requested { method: 'wait_cancelled' }` and returns to the chooser. It opens no grown-up
 * session and counts as no fresh PIN (CS-4).
 *
 * [OA] Destination `LockedProfile` (row OA-5, section 6.3; mock `design/screens/profiles/pin-entry-v2.md` board 4): a
 * locked learner tile, titled with the learner's name. Verify only, through `verifyForLockedProfile` (strikes reset and
 * a pending wait cleared, but no gate session and no fresh PIN, CS-3); a correct PIN opens that learner's Home. Cancel
 * goes back to the chooser (or the Profile tiles). With no PIN stored the lock is void and the learner opens (CS-4).
 *
 * [OA] Destination `FreshPin` (row OA-5, OA-D5b (3)): the PIN again for the Edit profile lock switch. Verify only, no
 * Forgot PIN?: a correct PIN marks a fresh PIN (`markPinVerified`) and goes back, where the switch applies the change.
 */

const DOT_SIZE = 20;
/** First-frame guess for the block under the header (the subtitle or the hint, about two lines) until it is measured. */
const HEADER_ESTIMATE = touchTarget.min + spacing.sm;
/** First-frame guess for the route's ScreenHeader (Close and Aa: one touch target) until it is measured. */
const SCREEN_HEADER_ESTIMATE = touchTarget.min + spacing.sm;
/**
 * Everything but the header and the keys that must stay on screen: screen
 * padding (top + bottom), the gaps around the dots and above the CTA, the dots
 * and the CTA itself. Cancel may scroll — Close stays in the header.
 */
const PAD_CHROME = 2 * spacing.lg + 3 * spacing.md + DOT_SIZE + touchTarget.child;
/** Read by a screen reader, drawn nowhere (the presenter's and the games' live regions use the same box). */
const SR_ONLY = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

export function PinEntryScreen({ route, navigation }: Props): React.ReactElement {
  const storedHash = useAccountStore((s) => s.parentPinHash);
  // [OA] Row OA-5: a hash that could not be read is not "no PIN": a lock stays (fail closed, 13.2).
  const hashReadFailed = useAccountStore((s) => s.pinHashReadFailed);
  const retryPinHashRead = useAccountStore((s) => s.retryPinHashRead);
  const attempts = useAccountStore((s) => s.pinAttempts);
  const setParentPinHash = useAccountStore((s) => s.setParentPinHash);
  const verifyPinAttempt = useAccountStore((s) => s.verifyPinAttempt);
  const refreshAttempts = useAccountStore((s) => s.refreshAttempts);
  const markPinResetByWait = useAccountStore((s) => s.markPinResetByWait);
  const clearPinResetRequest = useAccountStore((s) => s.clearPinResetRequest);
  const pinResetRequestedAt = useAccountStore((s) => s.pinResetRequestedAt);
  const { copy } = useAudience();
  const messages = useMessages();
  const m = messages.caregiver.pin;
  const openParentGate = useUiStore((s) => s.openParentGate);
  const markPinVerified = useUiStore((s) => s.markPinVerified);
  const markGateReturn = useUiStore((s) => s.markGateReturn);
  const locale = useLocale();
  const forGrownUpArea = opensGrownUpArea(route.params);
  const cancelReset = forCancelReset(route.params);
  const lockedProfile = forLockedProfile(route.params);
  const freshPin = forFreshPin(route.params);
  const noPin = grownUpAreaNoPin(route.params, storedHash);
  const lockedName = useProfileStore((s) => (lockedProfile ? (s.profiles.find((p) => p.id === route.params.profileId)?.displayName ?? null) : null));

  const [mode, setMode] = useState<PinMode>(() => initialPinMode(route.params, storedHash));
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // [OA] `parent.gate.opened` once per gate: Change PIN checks the PIN first, then sets a new one.
  const gateSent = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(HEADER_ESTIMATE);
  // The route's ScreenHeader (Close, AMENDMENTS-DISPLAY-NAV section 7.1) sits above the title block: the pad leaves room for both.
  const [screenHeaderHeight, setScreenHeaderHeight] = useState<number>(SCREEN_HEADER_ESTIMATE);
  const { windowWidth, windowHeight, gutter, mediaScale } = useLayoutClass();
  const insets = useSafeAreaInsets();
  // First-frame guess until the pad's box is measured: the `Screen` reading column less its gutter.
  const [padWidth, setPadWidth] = useState(() =>
    pinPadFirstWidth({ windowWidth, maxWidth: layout.maxWidth.reading, sidePadding: 2 * gutter }),
  );
  const pad = pinPadLayout({
    width: padWidth,
    height: pinPadBudget({
      windowHeight,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      header: headerHeight + screenHeaderHeight + spacing.sm,
      chrome: PAD_CHROME,
    }),
    minKey: touchTarget.min,
    // F-LAYOUT-001 §3.6: keys scale with the window up to touchTarget.hero (80 on a phone, as before).
    maxKey: pinKeyMax({ base: touchTarget.child, mediaScale, ceiling: touchTarget.hero }),
    gap: PIN_PAD_GAP,
  });

  // The ticking `now` may be a moment old when the attempt state changes (a pause that just started): never older
  // than the clock, so a fresh pause never reads a second longer than it is.
  const clock = Math.max(now, Date.now());
  const schedule = flags.pinPauseStepsEnabled ? 'steps' : 'flat';
  // [OA] CS-8: a pause holds the check of the PIN only. Choosing a new PIN (after a Rescue Code accepted during a pause,
  // or the finished wait) is not a guess, so the creation pad is never paused.
  const cooldownMs = mode === 'verify' ? cooldownRemainingMs(attempts, clock) : 0;
  const locked = cooldownMs > 0;

  // [OA] OA-D19: a pause another tab started shows here too (on arrival and whenever the app comes back in front).
  useEffect(() => {
    const refresh = (): void => {
      void refreshAttempts()
        .then(() => setNow(Date.now()))
        .catch(() => undefined);
    };
    refresh();
    const offVisibility = subscribeAppVisibility((visible) => {
      if (visible) refresh();
    });
    // CS-16: another tab's miss, pause or correct PIN shows here at once, even while both tabs are in front.
    const offOtherTab = onPinAttemptsChanged(refresh);
    return () => {
      offVisibility();
      offOtherTab();
    };
  }, [refreshAttempts]);

  // Tick once a second only while a cooldown is showing.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const leave = (): void => navigation.goBack();

  /**
   * [OA] Section 6.3: a locked tile's learner opens after the PIN (or at once when the lock is void), landing as a pick
   * on the chooser does (section 6.2, `pickLanding`): the learner who was already active, over a learner screen (the
   * CS-19 relock over a quest or a story), closes this screen and the chooser, and that screen continues where it was.
   * Otherwise what ran under is saved, the learner becomes active (which closes any grown-up session on a change,
   * OA-D5b), and Home opens, or Join prefilled when a join code is held (OA-D20). Nothing here opens the gate or marks a
   * fresh PIN (CS-3).
   */
  const openLocked = (): void => {
    const { profileId, lockedFrom } = route.params;
    const store = useProfileStore.getState();
    if (profileId === undefined || !store.profiles.some((p) => p.id === profileId)) {
      leave();
      return;
    }
    const same = profileId === store.activeId;
    const state = navigation.getState();
    // This screen sits on the chooser; the route under the chooser is the one the learner may come back to.
    const chooserBelow = state.index >= 1 && state.routes[state.index - 1]!.name === 'WhoIsUsing';
    const underRoute = chooserBelow && state.index >= 2 ? state.routes[state.index - 2]! : null;
    const under = underRoute === null ? null : routeZone(underRoute.name, underRoute.params);
    const join = lockedFrom?.via === 'chooser' ? heldJoin() : null;
    const landing = pickLanding({ same, under, join });
    if (!same) {
      persistLeaving();
      if (lockedFrom !== undefined) {
        if (lockedFrom.via === 'chooser') trackProfileSwitch('chooser', true, Date.now(), lockedFrom.trigger);
        else trackProfileSwitch('profile', true);
      }
    }
    store.setActive(profileId);
    if (landing.kind === 'back') {
      // A reset (the screen's own way on, never a back the chooser swallows) to the routes under the chooser: the
      // screen under it keeps its key, so it stays mounted and continues.
      navigation.reset({ ...state, index: state.index - 2, routes: state.routes.slice(0, state.index - 1) });
    } else if (landing.kind === 'join') {
      takeHeldJoin();
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'JoinSpace', params: landing.code === null ? undefined : { code: landing.code } }] });
    } else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  // [OA] CS-4: with no PIN stored a lock is void (the learner opens) and a fresh PIN has nothing to confirm (back).
  const voided = voidWithoutPin(route.params, storedHash, hashReadFailed);
  // [OA] A hash that could not be read at hydrate is read again on arrival, so the lock can be checked (or found void).
  useEffect(() => {
    if ((lockedProfile || freshPin) && hashReadFailed) void retryPinHashRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  useEffect(() => {
    if (!voided) return;
    if (lockedProfile) openLocked();
    else leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [voided]);

  // [OA] CS-1: back to the screen whose action asked for the PIN, gate open; that landing keeps the session for the
  // waiting action only (the Grown-up area exit watcher closes it on the next learner screen).
  const back = (): void => {
    markGateReturn();
    navigation.goBack();
  };

  const handOff = async (): Promise<void> => {
    const { url, grownUpVia } = route.params;
    // The PIN screen already sent `parent.gate.opened` for this gate.
    const result = await openGrownUpArea({ via: grownUpVia ?? 'lock', ...(url === undefined ? {} : { target: url }) }, undefined, { gateSent: true });
    // The tab is leaving; a return through the back/forward cache lands on the start screen.
    if (result === 'opened') back();
  };

  const proceed = (): void => {
    openParentGate();
    if (route.params.next === 'PlacementFinish') {
      // The level check is underneath: it sees the gate open and ends the run for the grown-up.
      back();
    } else if (route.params.next === 'AddProfile') {
      navigation.replace('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
    } else if (route.params.next === 'Restore') {
      navigation.replace('Restore', { from: 'settings' });
    } else if (route.params.next === 'SaveProgress') {
      navigation.replace('SaveProgress');
    } else if (route.params.next === 'Paywall') {
      navigation.replace('Paywall', { from: route.params.from ?? 'journey' });
    } else if (route.params.next === 'Billing') {
      // Back to the Plan screen with the gate open: native opens Billing for the press that waited, the web asks for one more tap (F-BILL-002 §4.7).
      back();
    } else if (route.params.next === 'EditProfile') {
      const { profileId } = route.params;
      if (profileId === undefined) back();
      else navigation.replace('EditProfile', { profileId });
    } else if (route.params.next === 'MyRoute') {
      // A profile's Learning Route, read-only now that the gate is open (F-ROUTE-001 section 3.1); a grown-up
      // passed the gate, so it stays read-only even for the active profile (amendment section 5.1).
      const { profileId } = route.params;
      if (profileId === undefined) back();
      else navigation.replace('MyRoute', { profileId, viewer: 'grownup' });
    } else if (route.params.next === 'PlacementReport') {
      const { profileId } = route.params;
      if (profileId === undefined) navigation.replace('ParentDashboard');
      else navigation.replace('PlacementReport', { profileId });
    } else if (route.params.next === 'LearnerReport') {
      // The in-app progress report (F-REPORT-001 section 3.9): See report, or the report itself after the session lapsed.
      const { profileId } = route.params;
      if (profileId === undefined) navigation.replace('ParentDashboard');
      else navigation.replace('LearnerReport', { profileId });
    } else if (route.params.next === 'RouteProposal' || route.params.next === 'RouteSetup' || route.params.next === 'RouteOverview') {
      // A child's weekly plan, through the gate (F-PLAN-002 section 3.9): made, changed, or stopped on the overview underneath.
      const step = routeGateStep(route.params.next, route.params.profileId);
      if (step.kind === 'back') back();
      else if (step.kind === 'proposal') navigation.replace('RouteProposal', { source: 'profile', profileId: step.profileId });
      else navigation.replace('RouteSetup', { profileId: step.profileId });
    } else if (route.params.next === 'NoteReport') {
      // "Tell a grown-up" on a note page (F-FEEDBACK-001 section 6.10 item 4): the report sheet of that note.
      const { noteId, profileId, noteVia } = route.params;
      if (noteId === undefined || profileId === undefined) back();
      else navigation.replace('NoteReport', { noteId, profileId, via: noteVia ?? 'note_page' });
    } else if (route.params.next === 'NotesGrownUp') {
      // Notes for <learner> after the session lapsed (F-FEEDBACK-001 section 6.10 item 2).
      const { profileId } = route.params;
      if (profileId === undefined) navigation.replace('ParentDashboard');
      else navigation.replace('NotesGrownUp', { profileId });
    } else if (route.params.next === 'MoveClass') {
      // A class move (F-SPACE-002 section 4.12). Without a class this was Set up PIN on the Classes card:
      // back to the card, which now says when moves open.
      const { profileId, fromSpaceId } = route.params;
      if (profileId === undefined || fromSpaceId === undefined) back();
      else navigation.replace('MoveClass', { profileId, fromSpaceId });
    } else if (route.params.next === 'ApproveTransfer') {
      // The request's sheet; on a device whose PIN was made just now it is the read-only veto (D24).
      const { profileId, transferId } = route.params;
      if (profileId === undefined || transferId === undefined) back();
      else navigation.replace('ApproveTransfer', { profileId, transferId });
    } else if (route.params.next === 'ClassScope') {
      // [TV] The class update of one learner (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4).
      const { profileId } = route.params;
      if (profileId === undefined) back();
      else navigation.replace('ClassScope', { profileId });
    } else if (route.params.next === 'BrowseLessons') {
      // All lessons (F-BROWSE-001 section 4.3, BR-12a): the gate hand-off writes a fresh gate pass and leaves in this
      // tab. A browser that refuses the pass opens the dashboard, which says why under Open all lessons.
      if (afterGateHandoff(openBrowseFromGate(route.params.browseTarget)) === 'leave') back();
      else navigation.replace('ParentDashboard', { browseBlocked: true });
    } else if (route.params.next === 'LectureMode') {
      // The Lecture mode card (AMENDMENTS-LECTURE-V2 E5): back to the dashboard with the gate open. A browser opens a new
      // tab only inside a tap, so the grown-up taps the row again there (as Open billing and Sources do on the web).
      back();
    } else if (route.params.next === 'ExternalLink') {
      // Back to Sources with the gate open: native opens the waiting link, the web asks for one more tap (F-STORY-002 §3.8).
      back();
    } else {
      navigation.replace('ParentDashboard');
    }
  };

  /** The calm "tries left" line after a miss, or none once no try is left (the pause line takes over). */
  const triesHint = (state: Parameters<typeof attemptsRemaining>[0]): string | null => {
    const left = attemptsRemaining(state, Date.now(), schedule);
    return left > 0 ? m.entry.triesLeft(left) : null;
  };

  const submit = async (): Promise<void> => {
    if (entry.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    try {
      if (mode === 'setup-1') {
        setFirstPin(entry);
        setEntry('');
        setHint(null);
        setMode('setup-2');
        return;
      }
      if (mode === 'setup-2') {
        if (entry !== firstPin) {
          setEntry('');
          setFirstPin('');
          setMode('setup-1');
          setHint(m.mismatch);
          return;
        }
        setParentPinHash(await createPinHash(entry, pinHasher));
        // [OA] OA-D21: a PIN the finished 24-hour wait set is announced once at the next Grown-up area entry.
        if (route.params.via === 'wait') markPinResetByWait(Date.now());
        void track(pinCreated(pinCreatedWhere(route.params)));
        if (route.params.via) void track(pinResetCompleted(route.params.via));
        if (!gateSent.current) trackGateOpened(route.params.next, 'pin');
        gateSent.current = true;
        // [OA] A new PIN reached from a locked tile's Forgot PIN? opens that learner only, never a grown-up session.
        if (lockedProfile) {
          openLocked();
          return;
        }
        if (route.params.returnAfterSet === true) {
          // [OA] OA-D21: Change PIN on the notice goes back to the Grown-up area that asked, with the gate open.
          openParentGate();
          navigation.goBack();
          return;
        }
        proceed();
        return;
      }
      if ((lockedProfile || freshPin) && useAccountStore.getState().pinHashReadFailed) {
        // [OA] Fail closed (13.2): the PIN hash is unknown, so it is read again before any check; while it stays
        // unknown nothing opens, no attempt is counted and the pad stays usable.
        await retryPinHashRead();
        if (useAccountStore.getState().pinHashReadFailed) {
          setEntry('');
          setHint(messages.common.errors.generic);
          return;
        }
        // A read that now says "no PIN" makes the lock void (the effect above opens the learner).
        if (useAccountStore.getState().parentPinHash === null) {
          setEntry('');
          return;
        }
      }
      if (lockedProfile) {
        // [OA] Section 6.3, CS-3: the locked-profile verify path: no gate session, no fresh PIN.
        const result = await verifyForLockedProfile(entry, { hasher: pinHasher, schedule });
        setEntry('');
        if (result.paused) trackPinPaused(result.paused.step);
        if (result.ok) {
          trackGateOpened(route.params.next, 'pin');
          gateSent.current = true;
          openLocked();
          return;
        }
        setNow(Date.now());
        setHint(result.reason === 'cooldown' ? null : triesHint(result.state));
        return;
      }
      // [OA] OA-D19: read, checked and written inside the shared attempt lock, so every tab counts the same misses.
      const result = await verifyPinAttempt(entry, { hasher: pinHasher, schedule });
      setEntry('');
      if (result.paused) trackPinPaused(result.paused.step);
      if (result.ok && cancelReset) {
        // [OA] OA-D21: the PIN stops the wait and opens nothing (no gate session, no fresh PIN).
        trackGateOpened(route.params.next, 'pin');
        clearPinResetRequest();
        void track(pinResetRequested('wait_cancelled'));
        leave();
        return;
      }
      if (result.ok) {
        trackGateOpened(route.params.next, 'pin');
        gateSent.current = true;
        // Remembering the PIN settles a pending Forgot PIN wait (F-LEARN-001 §3.5).
        if (pinResetRequestedAt !== null) clearPinResetRequest();
        // A PIN entered now counts for the grown-up hand-off for 2 minutes (F-APP-001 section 3.9).
        markPinVerified();
        if (verifiedGoesToSetup(route.params)) {
          // [OA] OA-D21: Change PIN after the current one was checked.
          setHint(null);
          setMode('setup-1');
          return;
        }
        // [OA] Row OA-5: the fresh PIN a control asked for; the control applies the change on the way back.
        if (freshPin) leave();
        else if (forGrownUpArea) await handOff();
        else proceed();
        return;
      }
      setNow(Date.now());
      if (result.reason === 'cooldown') {
        setHint(null);
      } else {
        const left = attemptsRemaining(result.state, Date.now(), schedule);
        setHint(left > 0 ? m.entry.triesLeft(left) : null);
      }
    } catch {
      // A check that could not finish (the hasher or the lock failed) is not a miss: the pad clears and stays usable.
      setEntry('');
    } finally {
      setBusy(false);
    }
  };

  const title = cancelReset
    ? messages.learner.who.resetCancel
    : lockedProfile && mode === 'verify' && lockedName !== null
      ? lockedName
      : mode === 'verify'
        ? copy.pinVerifyTitle
        : mode === 'setup-1'
          ? copy.pinCreateTitle
          : m.entry.createAgain;
  const subtitle =
    mode === 'verify'
      ? m.entry.verifySubtitle
      : mode === 'setup-1'
        ? copy.pinCreateSubtitle
        : m.entry.createAgainSubtitle;

  // [OA] Section 8.3: seconds under a minute, minutes above; the help line from the 3rd pause, Grown-up area only.
  const hintText = locked ? pauseText(cooldownMs, m) : hint;
  const pauseHelp = mode === 'verify' && showsPauseHelp(attempts, clock, route.params.next, schedule);
  // The screen reader hears the pause once a minute (section 14), not at every second the line changes.
  const announceKey = pauseAnnounceKey(cooldownMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed only when the minute changes, on purpose
  const announced = useMemo(() => (announceKey === null ? '' : pauseText(cooldownMs, m)), [announceKey, m]);

  // [OA] The void lock opens the learner and the empty fresh PIN goes back (the effect above); nothing to draw meanwhile.
  if (voided) return <Screen tone="canvas" header={{ title, titleInline: true }}>{null}</Screen>;

  if (noPin) {
    // F-APP-001 section 3.9: the grown-up area never creates a PIN here; the grown-up signs in instead.
    const g = messages.caregiver.grownUpHome;
    return (
      <Screen tone="canvas" header={{ title: copy.pinVerifyTitle, titleInline: true }}>
        <Spacer size="xs" />
        <Body tone="secondary">{g.noPin}</Body>
        <Spacer size="lg" />
        <Button
          label={g.continue.cta}
          tone="primary"
          size="lg"
          fullWidth
          onPress={() => {
            // [OA] Section 15: this gate opens with no PIN (none is stored), so it is sent as `open`.
            trackGateOpened(route.params.next, 'open');
            continueToGrownUpPage(route.params.url, locale);
          }}
        />
        <Spacer size="sm" />
        <Button label={messages.common.buttons.cancel} tone="ghost" size="md" fullWidth onPress={leave} />
      </Screen>
    );
  }

  return (
    // The title sits in the header row beside Close and the Display control, so the pad keeps the height it had.
    <Screen tone="canvas" header={{ title, titleInline: true, onHeight: setScreenHeaderHeight }}>
      {/* Measured: the keypad gets whatever height this block leaves (p1-L1). */}
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        {/*
          Feedback takes the subtitle's place instead of growing the header: it
          is never taller than the subtitle it covers (2 lines of 16sp vs 2-3 of
          18sp on a phone, 1 vs 1 on a wide column), so the measured header, and
          with it the keypad, keeps its size when a hint appears (p1-L1 follow-up).
        */}
        <View style={{ position: 'relative' }}>
          {/*
            [OA] With the help line (3rd pause on, the pad paused anyway) the pause line takes the subtitle's place in
            the flow, so the two lines never overlap at 320 px; the measured header gives the pad what is left.
          */}
          {pauseHelp ? null : (
            <View
              style={{ opacity: hintText ? 0 : 1 }}
              accessibilityElementsHidden={Boolean(hintText)}
              importantForAccessibility={hintText ? 'no-hide-descendants' : 'auto'}
            >
              <Body tone="secondary">{subtitle}</Body>
            </View>
          )}
          {hintText ? (
            <View
              // A pause line changes every second under a minute; the live region below carries it once a minute.
              {...(locked
                ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true }
                : { accessibilityLiveRegion: 'polite' as const })}
              testID={locked ? 'pin-pause-line' : 'pin-hint-line'}
              style={pauseHelp ? undefined : { position: 'absolute', top: 0, left: 0, right: 0 }}
            >
              <Body tone="secondary" size="sm" weight="semibold">
                {hintText}
              </Body>
            </View>
          ) : null}
        </View>
        {/* [OA] The pause, for screen readers: a polite live region that changes once a minute (section 14). */}
        <Text {...KOREAN_LINE_BREAK} testID="pin-pause-live" accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }} style={SR_ONLY}>
          {locked ? announced : ''}
        </Text>
        {pauseHelp ? (
          <View testID="pin-pause-help" style={{ paddingTop: spacing.xs }}>
            <Body tone="secondary" size="sm">
              {m.cooldownHelp}
            </Body>
          </View>
        ) : null}
      </View>

      <Spacer size="md" />
      <View
        accessibilityLabel={messages.a11y.pinDots(entry.length, PIN_LENGTH)}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: radii.circle,
              borderWidth: 2,
              borderColor: colors.brand.primary,
              backgroundColor: i < entry.length ? colors.brand.primary : colors.surface.paper,
            }}
          />
        ))}
      </View>
      <Spacer size="md" />

      <View onLayout={(e) => setPadWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
        <PinPad
          value={entry}
          onChange={(next) => {
            if (next.length >= entry.length) setHint(null);
            setEntry(next);
          }}
          disabled={locked || busy}
          layout={pad}
        />
      </View>

      <Spacer size="md" />
      <Button
        label={mode === 'verify' ? m.entry.unlock.cta : messages.common.buttons.next}
        tone="primary"
        size="lg"
        fullWidth
        disabled={entry.length !== PIN_LENGTH || locked || busy}
        onPress={() => void submit()}
      />
      <Spacer size="sm" />
      <Button label={messages.common.buttons.cancel} tone="ghost" size="md" fullWidth onPress={leave} />
      {/* Quiet on purpose: plain text, no icon, nothing for a child to gain from poking it. */}
      {showForgotPin(mode, route.params) ? (
        <Button
          label={m.entry.forgot.cta}
          tone="ghost"
          size="md"
          fullWidth
          onPress={() =>
            navigation.replace('PinReset', {
              next: route.params.next,
              profileId: route.params.profileId,
              ...(route.params.lockedFrom === undefined ? {} : { lockedFrom: route.params.lockedFrom }),
            })
          }
        />
      ) : null}
    </Screen>
  );
}
