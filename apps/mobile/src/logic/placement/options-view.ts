import { PLACEMENT_MODES, SpeechLangSchema, type Motivation, type PlacementMode, type SpeechLang, type UiLocale } from '@hangul-route/content-schema';
import { LOCALE_META, type Messages } from '@hangul-route/i18n';
import type { AudioCapability } from '../audio/capability';
import { modeTileCopy, type ModeTileCopy } from './copy';
import type { FlowCapability, FlowState } from './flow';

/**
 * The options screen (F-PLC-001 section 3.1 step 3, wireframe placement C1 /
 * C2): the three mode tiles, their layout, "Why Korean?" and the device
 * capability the flow reads when the screen opens. Pure; the screen renders it.
 */

/** The three tiles sit side by side only from this content width, and only up to this font scale. */
export const MODE_TILES_ROW_MIN_WIDTH = 480;
export const MODE_TILES_ROW_MAX_FONT_SCALE = 1.3;

export function modeTilesSideBySide(contentWidth: number, fontScale: number): boolean {
  return contentWidth >= MODE_TILES_ROW_MIN_WIDTH && fontScale <= MODE_TILES_ROW_MAX_FONT_SCALE;
}

export interface ModeTile {
  mode: PlacementMode;
  /** A radio: `accessibilityState.selected`. */
  selected: boolean;
  /** Short without sound or an instruction voice. */
  disabled: boolean;
  /** The disabled Short tile's line and accessibility hint: "The short check needs sound." */
  hint: string | null;
  copy: ModeTileCopy;
}

/** Short, Standard, Deep: equal tiles, no badge; Short disabled whenever it is unavailable. */
export function modeTiles(state: Pick<FlowState, 'mode' | 'shortAvailable' | 'takeMyTime'>, m: Messages): ModeTile[] {
  return PLACEMENT_MODES.map((mode) => {
    const disabled = mode === 'short' && !state.shortAvailable;
    return {
      mode,
      selected: state.mode === mode,
      disabled,
      hint: disabled ? m.learner.placement.options.mode.short.needsSound : null,
      copy: modeTileCopy(m, mode, state.takeMyTime),
    };
  });
}

/** "Why Korean?": four icon choices (blueprint 02 section 2.2); only the theme order of the route changes. */
export const MOTIVATION_CHOICES: ReadonlyArray<{ motivation: Motivation; icon: 'parent' | 'sparkle' | 'book' | 'profile' }> = [
  { motivation: 'heritage', icon: 'parent' },
  { motivation: 'kculture', icon: 'sparkle' },
  { motivation: 'curious', icon: 'book' },
  { motivation: 'friends', icon: 'profile' },
];

/** The instruction voice language of a test language (`LOCALE_META[l].speechLang`). */
export function speechLangOf(locale: UiLocale): SpeechLang {
  return SpeechLangSchema.parse(LOCALE_META[locale].speechLang);
}

/**
 * What the flow needs of the device, read when the options screen opens
 * (section 3.1 steps 2 and 3): a Korean voice for the prompts, a voice for the
 * test language's instructions, and a Korean voice for Korean instructions.
 */
export function flowCapability(input: {
  /** `canPlayKorean(getCapability())`. */
  koreanAudio: boolean;
  /** `platform/audio` `hasVoiceFor`. */
  hasVoiceFor: (lang: SpeechLang) => boolean;
  testLocale: UiLocale;
}): FlowCapability {
  return {
    koreanAudio: input.koreanAudio,
    instructionVoice: input.hasVoiceFor(speechLangOf(input.testLocale)),
    koreanInstructionVoice: input.hasVoiceFor(speechLangOf('ko')),
  };
}

/** Whether any prompt of the placement bank or its warm-up has a bundled clip (`audioRef`). */
export function bankHasClips(
  bank: { templates: ReadonlyArray<{ question: { audioRef?: string } }> },
  warmup: { question: { audioRef?: string } },
): boolean {
  return warmup.question.audioRef !== undefined || bank.templates.some((t) => t.question.audioRef !== undefined);
}

/**
 * Whether the level check can play its Korean prompts (section 3.1 steps 2 and
 * 3, section 3.11): a ready Korean voice, or bundled clips when the placement
 * bank carries them. `canPlayKorean` alone also counts clips the bank does not
 * use, which would offer Short on a device that cannot play its prompts.
 */
export function placementKoreanAudio(cap: AudioCapability, hasClips: boolean): boolean {
  return cap.tts.state === 'ready' || (cap.clips && hasClips);
}
