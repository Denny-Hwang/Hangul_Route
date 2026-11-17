import { useEffect, useRef } from 'react';
import { createSoundPacing, type SoundPacing } from '../logic/audio/sound-pacing';

/**
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3, QS-4: one `SoundPacing` for a game screen's life. The first round's own
 * prompt waits for the screen (`opening`), what follows an answer waits for the sound that is playing (`after`), and
 * every wait still pending is dropped when the screen goes away. The rules live in `logic/audio/sound-pacing.ts`.
 */
export function useSoundPacing(): SoundPacing {
  const ref = useRef<SoundPacing | null>(null);
  if (ref.current === null) ref.current = createSoundPacing();
  const pacing = ref.current;
  useEffect(() => () => pacing.dispose(), [pacing]);
  return pacing;
}
