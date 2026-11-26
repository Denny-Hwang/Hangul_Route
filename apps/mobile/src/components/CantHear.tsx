import { Body, Button, Icon, Spacer, colors, motion, spacing } from '@hangul-route/design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { cantHearLine } from '../logic/audio/cant-hear';
import type { DeviceFamily } from '../logic/device-family';
import { currentDeviceFamily } from '../platform/device-family';
import { announceAndWait, announceForScreenReader, focusForScreenReader } from '../platform/screen-reader';
import { SheetFrame } from './SheetFrame';

/**
 * "Can't hear it?" (AMENDMENTS-AUDIO-CANT-HEAR sections 3.2, 3.3, 3.7; design/components/CantHear/spec.md): a small
 * link in the speaker row of a sound-only round, and the sheet it opens with one line for this device and two ways on,
 * **Show the letters** (this round's text fallback) and **Hear it** (play once more). It is help, never a gate:
 * nothing is scored, stored or marked wrong.
 *
 * The surface renders it only while `slot.cantHear` is true (no text up), passes `active={slot.cantHearActive}` and
 * `onShowLetters={slot.showLetters}`, so the link is gone whenever a text shows and an open sheet goes with it. A new
 * `round` closes an open sheet, so Show the letters always acts on the round on screen.
 */
interface CommonProps {
  /** The surface's round index or key. */
  round: number | string;
  /** False while the round holds (the voice check): the link is drawn but takes no tap. */
  active: boolean;
  /** Plays the prompt once through the surface's own hear function (the speaker's). */
  onHear: () => void;
  /**
   * The learner opened the sheet (a tap on the link that took it). A contrast round drops the step's later rounds on it
   * (AMENDMENTS-MINIMAL-PAIRS section 3.9). Optional; nothing else changes.
   */
  onOpen?: () => void;
  testID?: string;
}

interface FullProps extends CommonProps {
  guidanceOnly?: false;
  /** Asks the slot for the text; called one beat after focus moves, so a screen reader says the letters once. */
  onShowLetters: () => void;
  /** Where focus goes after Show the letters (the surface's target, spec 3.1 "Focus after"). */
  focusAfter: RefObject<View | null>;
  /**
   * The letters as a screen reader should say them, said once after the beat (`announceForScreenReader`). iOS has no
   * live regions, so **without it iOS says nothing** when the text comes up (the web and Android read the panel's live
   * region instead). Pass it on every surface whose Show the letters brings text up.
   */
  lettersText?: string;
}

/** The cue rule and Discover: no Show the letters, and Hear it is the primary action. */
interface GuidanceProps extends CommonProps {
  guidanceOnly: true;
}

export type CantHearProps = FullProps | GuidanceProps;

/**
 * Where the sheet's "after" step waits for `Modal`'s `onDismiss`: iOS (`setAccessibilityFocus` does not reach the screen
 * while the modal is still up) and the web (react-native-web puts focus back on the link when the modal is gone, so
 * the surface's focus target must be set after that). Android has no `onDismiss`: it goes on when the sheet is closed.
 * If `onDismiss` does not come, go on anyway after this long, so a learner is never left waiting.
 */
const DISMISS_FALLBACK_MS = motion.duration.crawl;
const waitsForDismiss = (): boolean => Platform.OS !== 'android';

type After = 'link' | 'letters' | 'hear';

export function CantHear(props: CantHearProps): ReactElement {
  const { round, active, onHear, testID = 'cant-hear' } = props;
  const m = useMessages();
  const copy = m.learner.audio;
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<DeviceFamily>('computer');
  const linkRef = useRef<View | null>(null);
  const after = useRef<After | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The wait for `onDismiss` (iOS and the web). One at a time: a sheet closed again within it drops the old one.
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A new round or an unmount drops whatever is still waiting (a beat before the letters, the readout before the sound).
  const epoch = useRef(0);
  const latest = useRef(props);
  latest.current = props;

  const clearFallback = useCallback((): void => {
    if (fallback.current !== null) clearTimeout(fallback.current);
    fallback.current = null;
  }, []);

  const forget = useCallback((): void => {
    epoch.current += 1;
    after.current = null;
    for (const t of timers.current.splice(0)) clearTimeout(t);
    clearFallback();
  }, [clearFallback]);

  const run = useCallback((): void => {
    // Whoever got here (onDismiss, the closed sheet or the fallback), the fallback has nothing left to do.
    clearFallback();
    const kind = after.current;
    after.current = null;
    if (kind === null) return;
    const mine = epoch.current;
    const now = latest.current;
    if (kind === 'link') {
      focusForScreenReader(linkRef.current);
      return;
    }
    if (kind === 'letters' && now.guidanceOnly !== true) {
      // Focus first; one beat later the text enters the surface's polite live regions, and iOS is told once.
      focusForScreenReader(now.focusAfter.current);
      timers.current.push(
        setTimeout(() => {
          if (mine !== epoch.current) return;
          now.onShowLetters();
          if (now.lettersText !== undefined) announceForScreenReader(now.lettersText);
        }, motion.duration.slow),
      );
      return;
    }
    // Hear it: focus returns to the link, and the prompt plays only once its name has been said.
    focusForScreenReader(linkRef.current);
    void announceAndWait(copy.cantHear.cta, motion.duration.slow).then(() => {
      if (mine === epoch.current) latest.current.onHear();
    });
  }, [copy.cantHear.cta, clearFallback]);

  const finish = (kind: After): void => {
    after.current = kind;
    setOpen(false);
    // iOS and the web go on in `onDismiss` (the modal is really gone, so focus reaches the screen); Android, when the sheet is closed.
    clearFallback();
    if (waitsForDismiss()) fallback.current = setTimeout(run, DISMISS_FALLBACK_MS);
  };

  useEffect(() => {
    if (!open && !waitsForDismiss()) run();
  }, [open, run]);

  const roundSeen = useRef(round);
  useEffect(() => {
    if (roundSeen.current === round) return;
    roundSeen.current = round;
    forget();
    setOpen(false);
  }, [round, forget]);

  useEffect(() => forget, [forget]);

  const openSheet = (): void => {
    setFamily(currentDeviceFamily());
    setOpen(true);
    props.onOpen?.();
  };

  const guidance = props.guidanceOnly === true;
  const hearIcon = <Icon name="speaker" size={spacing.xl} color={guidance ? colors.text.onPrimary : colors.text.onSecondary} />;
  return (
    <>
      <Button
        label={copy.cantHear.cta}
        tone="ghost"
        size="sm"
        softDisabled={!active}
        onPress={openSheet}
        pressableRef={linkRef}
        testID={testID}
      />
      <SheetFrame
        visible={open}
        onClose={() => finish('link')}
        onDismiss={run}
        title={copy.cantHear.cta}
        closeLabel={m.common.buttons.close}
        testID={`${testID}-sheet`}
        footer={
          <View style={{ gap: spacing.sm }}>
            {guidance ? null : (
              <Button
                label={copy.cantHear.showLetters.cta}
                tone="primary"
                size="md"
                fullWidth
                onPress={() => finish('letters')}
                testID={`${testID}-show-letters`}
              />
            )}
            <Button
              label={copy.hearIt.cta}
              tone={guidance ? 'primary' : 'secondary'}
              size="md"
              fullWidth
              leading={hearIcon}
              onPress={() => finish('hear')}
              testID={`${testID}-hear`}
            />
          </View>
        }
      >
        <Spacer size="sm" />
        <Body testID={`${testID}-line`}>{cantHearLine(family, copy)}</Body>
      </SheetFrame>
    </>
  );
}
