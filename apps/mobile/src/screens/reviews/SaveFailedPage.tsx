import { Body, Button, Heading, Hoya, Screen, Spacer, spacing, useEffectiveFontScale } from '@hangul-route/design-system';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { announceForScreenReader, focusForScreenReader } from '../../platform/screen-reader';

/**
 * The page a review or check shows when its finish could not be saved (AMENDMENTS-QUEST-LEAVE-RESUME section 3.5, row
 * LR-4; wireframe `design/wireframes/reviews/save-failed.md`, mocks `design/screens/quest-leave-resume/`). The Daily
 * Review and the Stage Check draw it in place of the untrue "All refreshed today" and "This check is not open yet".
 * It is part of the Daily Review chunk; the Stage Check reaches it through `dailyReviewChunk()`, as it does the rounds.
 *
 * Layout and accessibility are the read-failed screen's (`screens/system/ProgressReadFailedScreen.tsx`): Hoya
 * `thinking` (never a sad pose), the title (the page's heading; takes the focus when the page opens), one line, and Try
 * again in the Screen's footer, which stays in view at 320 x 568 with the largest text. No danger colour, no X, no
 * warning icon, no "failed" or "error" word, no score and no count of answers, and no HoyaBubble (mock D5).
 *
 * A try (mock D6): Try again is soft-disabled and the column is busy while it runs, so it cannot be pressed twice. A try
 * that did not save announces the title once, politely (iOS through VoiceOver; Android and the web through the title's
 * live region, whose text changes by one zero-width space). After 3 tries in a row that did not save, the still-stuck
 * line fills its polite live region and stays. A try that saved is the caller's to show (it takes this page away).
 */
export interface SaveFailedPageProps {
  /** One try. Resolves `true` when the finish worked (the caller then shows the result), `false` when it did not. */
  onTryAgain: () => Promise<boolean>;
  /** The page's test id; Try again and the still-stuck line add `-try-again` and `-still-stuck`. */
  testID: string;
}

/** After this many tries in a row that did not save, the still-stuck line shows. */
export const SAVE_STILL_STUCK_AFTER = 3;
/** Hoya's size here (the crash screen's), and the compact one at a text scale of 1.5 or more (HoyaBubble's; mock D12). */
const HOYA_SIZE = 140;
const HOYA_COMPACT_SIZE = 72;
const COMPACT_FROM_SCALE = 1.5;
/** A zero-width space: the title's text changes by it after a try, so its live region says the title again. */
const REANNOUNCE = '\u200B';

export function SaveFailedPage({ onTryAgain, testID }: SaveFailedPageProps): ReactElement {
  const messages = useMessages();
  const m = messages.learner.dailyReview.saveFailed;
  const compact = useEffectiveFontScale() >= COMPACT_FROM_SCALE;
  const [busy, setBusy] = useState(false);
  const [failedTries, setFailedTries] = useState(0);
  const trying = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef<View>(null);
  const web = Platform.OS === 'web';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // The page replaced the last round, so the screen reader starts on the title, once. Native: on the next tick, once
    // the view has settled (VoiceOver ignores a focus moved mid-mount).
    const focus = (): void => focusForScreenReader(titleRef.current);
    if (web) {
      focus();
      return undefined;
    }
    const timer = setTimeout(focus, 0);
    return () => clearTimeout(timer);
  }, [web]);

  const tryAgain = (): void => {
    if (trying.current) return;
    trying.current = true;
    setBusy(true);
    void onTryAgain()
      .catch(() => false)
      .then((worked) => {
        trying.current = false;
        if (!mounted.current) return;
        setBusy(false);
        if (worked) return;
        const failed = failedTries + 1;
        setFailedTries(failed);
        // iOS has no live regions: the still-stuck line is said with the title when it first fills.
        announceForScreenReader(failed === SAVE_STILL_STUCK_AFTER ? `${m.title} ${m.stillStuck}` : m.title);
      });
  };

  const stuck = failedTries >= SAVE_STILL_STUCK_AFTER;

  return (
    <Screen
      tone="canvas"
      testID={testID}
      footer={<Button label={messages.common.buttons.tryAgain} tone="primary" size="hero" fullWidth softDisabled={busy} onPress={tryAgain} testID={`${testID}-try-again`} />}
    >
      <View aria-busy={busy} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }} testID={`${testID}-body`}>
        <Hoya pose="thinking" size={compact ? HOYA_COMPACT_SIZE : HOYA_SIZE} />
        <Spacer size={compact ? 'sm' : 'lg'} />
        {/* Web: focusable by script only (tabIndex -1), never a Tab stop. Native: one header element to move to. */}
        <View
          ref={titleRef}
          accessibilityLiveRegion="polite"
          {...(web ? { tabIndex: -1 as const, style: { outlineStyle: 'none' } as object } : { accessible: true, accessibilityRole: 'header' as const })}
        >
          <Heading level="title" align="center" testID={`${testID}-title`}>
            {failedTries % 2 === 1 ? `${m.title}${REANNOUNCE}` : m.title}
          </Heading>
        </View>
        <Spacer size="sm" />
        <Body tone="secondary" align="center">
          {m.body}
        </Body>
        <Spacer size="lg" />
        {/* Always mounted and empty until the third try in a row ends, so it is announced once, when it fills. */}
        <View accessibilityLiveRegion="polite" testID={`${testID}-still-stuck`}>
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
