import type { ReactNode, Ref } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';

export type ChoiceCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

/** `replay`: "try another" (a retry follows). `dash`: a locked miss that moves on (F-VOC-004 Speed Round). */
export type ChoiceCardWrongMark = 'replay' | 'dash';

/** `row`: texts with the status mark at the end of the row. `tile`: centred art with the mark on the top corner. */
export type ChoiceCardLayout = 'row' | 'tile';

export interface ChoiceCardProps {
  /** Option text. Wraps, left-aligned, never truncated. */
  label?: string;
  /** Taught Hangul, drawn with `KoreanText`. */
  ko?: string;
  /** Revised Romanization for `ko`; an empty string (the default) draws no line. */
  romanization?: string;
  /**
   * `true` keeps the romanization line's room but draws it invisible and unannounced (`KoreanText`
   * `romanizationReserved`): an open question of a quest Check (AMENDMENTS-AUDIT-2026-11 AU-8). Default `false`.
   */
  romanizationReserved?: boolean;
  /** Meaning of `ko` in the UI language. */
  gloss?: string;
  /**
   * `true` keeps the gloss line's room but draws it invisible and unannounced (`KoreanText` `glossReserved`): the meaning
   * of a Korean option while a quest Check's question is open (AMENDMENTS-STAGE1-DECODING-CHECK DC-1c). Default `false`.
   */
  glossReserved?: boolean;
  /** Picture slot above the texts. Absent or `null`: the texts alone. */
  art?: ReactNode;
  state: ChoiceCardState;
  /** The mark of the `wrong` state. Default `replay`. */
  wrongMark?: ChoiceCardWrongMark;
  /**
   * Default `row`. `tile` is for a picture option in a grid: the content is centred and uses the whole
   * width, and the status mark sits on the top corner on a disc of the state's fill, so two 96 dp
   * pictures fit side by side at 320 wide (`choiceCardTileWidth`).
   */
  layout?: ChoiceCardLayout;
  /** Fires only in `idle` and `hint`. */
  onPress?: () => void;
  /** Already-localised accessible name; it should also name the outcome. */
  accessibilityLabel: string;
  testID?: string;
  /**
   * The pressable's node, for a screen that moves focus to this card (a DOM node on the web, a view for
   * `AccessibilityInfo.setAccessibilityFocus` on native), as Button's `pressableRef`. Optional; nothing else changes.
   */
  pressableRef?: Ref<View>;
  /**
   * The hit area's own style, around the drawn card: a frame the caller draws (Pic-Word's selection ring and its
   * padding) is part of the target, so a touch on it is a touch on the card (AMENDMENTS-TOUCH section 6, row KT-4b).
   * Optional; without it the target only stretches. Never the press look's place: that stays on the drawn card.
   */
  targetStyle?: StyleProp<ViewStyle>;
}
