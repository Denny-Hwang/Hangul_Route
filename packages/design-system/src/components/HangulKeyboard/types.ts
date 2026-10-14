import type { LayoutClass } from '../../layout';

/** Accessible names (and the Space face), localised by the caller from `a11y.minigame.keyboard`. */
export interface HangulKeyboardLabels {
  /** A letter key: its jamo and its sound value read as words ("ㄱ, g or k"). */
  key: (jamo: string, sound: string) => string;
  shift: string;
  delete: string;
  /** Also the visible face of the Space key. */
  space: string;
}

export interface HangulKeyboardProps {
  /** The jamo of the key as drawn (the shifted letter while Shift is on). */
  onKey: (jamo: string) => void;
  onDelete: () => void;
  onSpace: () => void;
  /** The width it gets (`keyboardWidth`); `keyboardLayout` picks the arrangement from it. */
  width: number;
  layoutClass: Pick<LayoutClass, 'width' | 'short' | 'mediaScale'>;
  /** The face's sound value ('g/k', 'silent/ng', 'kk'). */
  soundOf: (jamo: string) => string;
  /** The sound value as screen-reader words ('g or k'); default: the face value. */
  speakSound?: (sound: string) => string;
  labels: HangulKeyboardLabels;
  /** A preview: keys drawn, presses ignored. While a result panel is up the keyboard is not drawn at all. */
  disabled?: boolean;
  testID?: string;
}
