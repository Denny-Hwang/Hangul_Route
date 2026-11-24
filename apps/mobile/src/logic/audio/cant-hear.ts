import type { DeviceFamily } from '../device-family';
import type { AudioCopy } from './copy';

/**
 * The one line of the "Can't hear it?" sheet (AMENDMENTS-AUDIO-CANT-HEAR section 3.4 and 3.10): the line for this
 * device's family, never the other devices' lines. The words are `learner.audio.cantHear.lines`, passed in; the family
 * comes from `logic/device-family.ts`.
 */
export function cantHearLine(family: DeviceFamily, copy: AudioCopy): string {
  return copy.cantHear.lines[family];
}
