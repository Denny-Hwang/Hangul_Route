import { Body, Button, Heading, Hoya, HoyaBubble, Screen, Spacer, motion, spacing, type ScreenEdge } from '@hangul-route/design-system';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactElement, type Ref } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { announceForScreenReader, focusForScreenReader } from '../../platform/screen-reader';

/**
 * [DP] ProgressReadFailedScreen (AMENDMENTS-DURABLE-PROGRESS sections 3.4 and 3.5, row DP-1c). Design:
 * `design/screens/system/progress-read-failed/` (README D1 to D12, `mock/screen.html` frames A to G); wireframe
 * `design/wireframes/shell/progress-read-failed.md` revision 4a.
 *
 * `OopsScreen`'s layout and tokens (D1): Hoya `thinking` 140, the title (the screen's heading, first focus, D12), the
 * body, the amber `HoyaBubble` (never `feedback.danger`, no X, no warning icon), and the buttons in the Screen footer,
 * which stays in view at 320 x 568 with the Largest text. Try again is the hero; Choose another learner (learner
 * variant, 2 or more learners) is the one button that may join it in this row.
 *
 * A try (D2): every footer button is soft-disabled and the column is `busy` while it runs, so Try again cannot be
 * pressed twice and a try never races the chooser. It is held for at least `motion.duration.crawl`, so a read that
 * answers at once does not flash the footer. A try that ends without success answers: the bubble is said again (iOS
 * through VoiceOver; Android and the web through the bubble's polite live region, whose text changes by one zero-width
 * space, in place of D2's clear-and-fill, so the bubble never jumps). After 3 such tries in this app session the
 * still-stuck line fills its polite live region (D3), and stays.
 *
 * [DP] Row DP-1e (OD-DP6): every learner tab may hold a copy of this screen at once, so the session's count of tries
 * and the try running now are kept once for every copy (`session`): a try on one copy holds every copy busy and no
 * second try starts; the still-stuck line shows on every copy once the session reaches 3; each copy says its bubble
 * again after its own failed try (its own count of them drives the live region's change).
 *
 * [DP] Row DP-1d (frame B): **A grown-up can help**, a centred ghost button (`touchTarget.min`), for the list variant
 * whose bytes do not parse and were kept (`onGrownUpHelp`); it opens the grown-up gate to the RecoverRecord sheet
 * (`RecoverHoldScreen`). Held with the others while a try runs. At most one button joins Try again (the two extra
 * buttons belong to different variants).
 *
 * There is no "Start over" or "New learner" button (section 3.5).
 */
export interface ProgressReadFailedScreenProps {
  /** One try (section 3.5). Resolves `true` when the read worked (the caller then takes the screen away). */
  onTryAgain: () => Promise<boolean>;
  /** Learner variant with 2 or more learner profiles: opens the chooser. Absent: no button. */
  onChooseAnother?: () => void;
  /** [DP] Row DP-1d: list variant, bytes that do not parse with a copy kept: opens the grown-up gate. Absent: no button. */
  onGrownUpHelp?: () => void;
  /** [DP] The grown-up button's node, so focus can come back to it after the gate and the sheet (design D5). */
  grownUpRef?: Ref<View>;
  /** [DP] Something the caller runs (Start fresh) holds the screen as a try does (D2): every button soft-disabled. */
  busy?: boolean;
  /** [DP] Raised by the caller when what it ran did not work: the bubble is said again, as after a try (not a try). */
  retell?: number;
  /** The Screen's safe-area edges (Home, a tab screen, drops `bottom`). Default: all four. */
  edges?: readonly ScreenEdge[];
  /**
   * [DP] Row DP-1e (OD-DP6): whether this screen is the one in front, so the screen reader may move to its title (D12).
   * A learner tab that is not focused holds the learner too, but waits: its title takes the focus once, when the tab
   * comes to the front. Default: true (the boot; a tab passes whether it is focused).
   */
  focusTitle?: boolean;
  /** The shortest a try is shown as running, in ms; default `motion.duration.crawl`. */
  minBusyMs?: number;
}

/**
 * The tries of this app session that ended without success (section 3.5: the count is per session, not per mount), and
 * whether a try is running now; one for every copy of the screen (row DP-1e).
 */
const session = { failedTries: 0, running: false };
const sessionListeners = new Set<() => void>();
function setSession(next: Partial<typeof session>): void {
  Object.assign(session, next);
  for (const listener of [...sessionListeners]) listener();
}
function subscribeSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}
const sessionFailedTries = (): number => session.failedTries;
const sessionRunning = (): boolean => session.running;

/** After this many tries the still-stuck line shows (section 3.5). */
export const STILL_STUCK_AFTER = 3;
/** A zero-width space: the bubble's text changes by it after a try, so its live region says the line again. */
const REANNOUNCE = '​';

export function resetReadFailedTriesForTests(): void {
  setSession({ failedTries: 0, running: false });
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function ProgressReadFailedScreen({
  onTryAgain,
  onChooseAnother,
  onGrownUpHelp,
  grownUpRef,
  busy: held = false,
  retell = 0,
  edges,
  focusTitle = true,
  minBusyMs = motion.duration.crawl,
}: ProgressReadFailedScreenProps): ReactElement {
  const m = useMessages().learner.progressReadFailed;
  const tries = useSyncExternalStore(subscribeSession, sessionFailedTries);
  const trying = useSyncExternalStore(subscribeSession, sessionRunning);
  const busy = trying || held;
  // The caller's own `retell`s, so the bubble's line changes by one more step each time (its live region says it again).
  const [retold, setRetold] = useState(0);
  const retellSeen = useRef(retell);
  // This copy's own failed tries: each one changes its bubble's text, whatever the other copies did.
  const [ownTries, setOwnTries] = useState(0);
  const mounted = useRef(true);
  const titleRef = useRef<View>(null);
  const titleFocused = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // D12: the screen replaced the navigator or a tab, so the screen reader starts on the title, once, when the screen
    // is in front (`focusTitle`). Native: on the next tick, once the view that replaced the navigator has settled
    // (VoiceOver ignores a focus moved mid-mount).
    if (!focusTitle || titleFocused.current) return undefined;
    const focus = (): void => {
      titleFocused.current = true;
      focusForScreenReader(titleRef.current);
    };
    if (Platform.OS === 'web') {
      focus();
      return undefined;
    }
    const timer = setTimeout(focus, 0);
    return () => clearTimeout(timer);
  }, [focusTitle]);

  useEffect(() => {
    if (retell === retellSeen.current) return;
    retellSeen.current = retell;
    setRetold((n) => n + 1);
    announceForScreenReader(m.bubble);
    // `m.bubble` is read when the caller raises `retell`, as after a try.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retell]);

  const tryAgain = (): void => {
    if (session.running || held) return;
    setSession({ running: true });
    void Promise.all([onTryAgain().catch(() => false), wait(minBusyMs)]).then(([worked]) => {
      // Ended even when this copy went away meanwhile, so no other copy is left busy.
      if (worked) {
        setSession({ running: false });
        return;
      }
      const failed = session.failedTries + 1;
      setSession({ running: false, failedTries: failed });
      if (!mounted.current) return;
      setOwnTries((n) => n + 1);
      // iOS has no live regions: the still-stuck line is said with the bubble when it first fills (D3).
      announceForScreenReader(failed === STILL_STUCK_AFTER ? `${m.bubble} ${m.stillStuck}` : m.bubble);
    });
  };

  const stuck = tries >= STILL_STUCK_AFTER;
  const web = Platform.OS === 'web';

  return (
    <Screen
      tone="canvas"
      edges={edges}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label={m.tryAgain} tone="primary" size="hero" fullWidth softDisabled={busy} onPress={tryAgain} testID="read-failed-try-again" />
          {onChooseAnother ? (
            <Button
              label={m.chooseAnother}
              tone="secondary"
              size="lg"
              fullWidth
              softDisabled={busy}
              onPress={() => {
                if (!session.running && !held) onChooseAnother();
              }}
              testID="read-failed-choose-another"
            />
          ) : null}
          {onGrownUpHelp ? (
            // A Button without fullWidth aligns to the start: the View centres it (design Values).
            <View style={{ alignItems: 'center' }}>
              <Button
                label={m.grownUpHelp}
                tone="ghost"
                size="md"
                softDisabled={busy}
                pressableRef={grownUpRef}
                onPress={() => {
                  if (!session.running && !held) onGrownUpHelp();
                }}
                testID="read-failed-grown-up"
              />
            </View>
          ) : null}
        </View>
      }
    >
      <View
        aria-busy={busy}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}
        testID="read-failed-body"
      >
        <Hoya pose="thinking" size={140} />
        <Spacer size="lg" />
        {/* Web: focusable by script only (tabIndex -1), never a Tab stop. Native: one header element to move to. */}
        <View
          ref={titleRef}
          {...(web ? { tabIndex: -1 as const, style: { outlineStyle: 'none' } as object } : { accessible: true, accessibilityRole: 'header' as const })}
        >
          <Heading level="title" align="center">
            {m.title}
          </Heading>
        </View>
        <Spacer size="sm" />
        <Body tone="secondary" align="center">
          {m.body}
        </Body>
        <Spacer size="xl" />
        <HoyaBubble tone="thinking" message={(ownTries + retold) % 2 === 1 ? `${m.bubble}${REANNOUNCE}` : m.bubble} />
        <Spacer size="lg" />
        {/* Always mounted and empty until the third try ends, so it is announced once, when it fills (D3). */}
        <View accessibilityLiveRegion="polite" testID="read-failed-still-stuck">
          {stuck ? (
            <Body tone="secondary" align="center">
              {m.stillStuck}
            </Body>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
