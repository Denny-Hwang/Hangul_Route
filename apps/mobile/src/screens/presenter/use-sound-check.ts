import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayResult, PlaySpec } from '../../logic/audio/controller';
import { soundCheckOutcome, type SoundCheckOutcome } from '../../logic/lecture/shell';

/**
 * Test the sound on the presenter start screen (F-TCH-004 section 3.7, design/screens/presenter/start-screen.md):
 * the tap, the result under the button, and when a result stops counting. The platform calls are arguments, so
 * `PresenterApp` passes `unlockAudio`, `playPrompt` and the store's unmute, and the render test passes fakes.
 */
export interface SoundCheckDeps {
  /** The start screen is showing. Leaving it clears the result, and a result that comes back after that is dropped. */
  onStartScreen: boolean;
  /** What the test plays, read at the tap (`soundCheckSpec` of the capability then). */
  spec: () => PlaySpec;
  /** The speech and clip unlock, run first in the same tap. */
  unlock: () => void;
  play: (spec: PlaySpec) => Promise<PlayResult>;
  /** Turn sound on: the same action as the sound chip's (`setMuted(false, 'fallback_panel')`). */
  turnSoundOn: () => void;
}

export interface SoundCheck {
  /** The last test's outcome; null before a test, while one plays, and after the start screen was left. */
  soundCheck: SoundCheckOutcome | null;
  onTestSound: () => void;
  /** Shown when the test found the sound switched off: switches it on and tests again, in its tap. */
  onTurnSoundOn: () => void;
}

export function useSoundCheck(deps: SoundCheckDeps): SoundCheck {
  const [soundCheck, setSoundCheck] = useState<SoundCheckOutcome | null>(null);
  // Every tap and every departure from the start screen starts a new run; only the newest run's result is shown.
  const run = useRef(0);
  const latest = useRef(deps);
  latest.current = deps;

  const onTestSound = useCallback(() => {
    const d = latest.current;
    // In the tap itself: the unlock, then the sound, so the browser lets it play (F-AUDIO-004 section 3.5).
    d.unlock();
    const mine = ++run.current;
    setSoundCheck(null);
    void d.play(d.spec()).then((result) => {
      if (mine === run.current) setSoundCheck(soundCheckOutcome(result));
    });
  }, []);

  const onTurnSoundOn = useCallback(() => {
    latest.current.turnSoundOn();
    onTestSound();
  }, [onTestSound]);

  // A result belongs to the start screen it was asked on.
  useEffect(() => {
    if (deps.onStartScreen) return;
    run.current += 1;
    setSoundCheck(null);
  }, [deps.onStartScreen]);

  return { soundCheck, onTestSound, onTurnSoundOn };
}
