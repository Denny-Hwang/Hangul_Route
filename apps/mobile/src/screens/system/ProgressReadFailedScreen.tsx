import { Body, Button, Heading, Hoya, HoyaBubble, Screen, Spacer, motion, spacing, type ScreenEdge } from '@hangul-route/design-system';
import { useEffect, useRef, useState, type ReactElement } from 'react';
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
 * space, in place of D2's clear-and-fill, so the bubble never jumps). After 3 such tries in this app session the still-stuck line fills its polite live region (D3), and stays.
 *
 * There is no "Start over" or "New learner" button (section 3.5).
 */
export interface ProgressReadFailedScreenProps {
  /** One try (section 3.5). Resolves `true` when the read worked (the caller then takes the screen away). */
  onTryAgain: () => Promise<boolean>;
  /** Learner variant with 2 or more learner profiles: opens the chooser. Absent: no button. */
  onChooseAnother?: () => void;
  /** The Screen's safe-area edges (Home, a tab screen, drops `bottom`). Default: all four. */
  edges?: readonly ScreenEdge[];
  /** The shortest a try is shown as running, in ms; default `motion.duration.crawl`. */
  minBusyMs?: number;
}

/** Tries that ended without success in this app session (section 3.5: the count is per session, not per mount). */
let failedTries = 0;
/** After this many tries the still-stuck line shows (section 3.5). */
export const STILL_STUCK_AFTER = 3;
/** A zero-width space: the bubble's text changes by it after a try, so its live region says the line again. */
const REANNOUNCE = '​';

export function resetReadFailedTriesForTests(): void {
  failedTries = 0;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function ProgressReadFailedScreen({ onTryAgain, onChooseAnother, edges, minBusyMs = motion.duration.crawl }: ProgressReadFailedScreenProps): ReactElement {
  const m = useMessages().learner.progressReadFailed;
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(failedTries);
  const running = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef<View>(null);

  useEffect(() => {
    mounted.current = true;
    // D12: the screen replaced the navigator or Home, so the screen reader starts on the title. Native: on the next
    // tick, once the view that replaced the navigator has settled (VoiceOver ignores a focus moved mid-mount).
    if (Platform.OS === 'web') focusForScreenReader(titleRef.current);
    const timer = Platform.OS === 'web' ? undefined : setTimeout(() => focusForScreenReader(titleRef.current), 0);
    return () => {
      mounted.current = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  const tryAgain = (): void => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    void Promise.all([onTryAgain().catch(() => false), wait(minBusyMs)]).then(([worked]) => {
      running.current = false;
      if (worked) {
        if (mounted.current) setBusy(false);
        return;
      }
      failedTries += 1;
      if (!mounted.current) return;
      setBusy(false);
      setTries(failedTries);
      // iOS has no live regions: the still-stuck line is said with the bubble when it first fills (D3).
      announceForScreenReader(failedTries === STILL_STUCK_AFTER ? `${m.bubble} ${m.stillStuck}` : m.bubble);
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
                if (!running.current) onChooseAnother();
              }}
              testID="read-failed-choose-another"
            />
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
        <HoyaBubble tone="thinking" message={tries % 2 === 1 ? `${m.bubble}${REANNOUNCE}` : m.bubble} />
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
