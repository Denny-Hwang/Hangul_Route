import { Icon, MARK_DISC, MARK_MIN, choiceCardRingStyle, choiceCardStyle, colors, radii } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { View } from 'react-native';

/**
 * The marks of the board games (F-A11Y-001 row AF-4c; design/components/AnswerFeedback/spec.md D1, D2, D4): three small
 * drawn parts the boards share, so every game reads the same sizes and the same look-here ring.
 *
 * - `DiscMark`: a 20 mark on a 26 disc of the state's light fill with a `text.primary` casing, straddling the answer's
 *   top-end corner (`MARK_DISC.outside` outside the border), out of the flow, so the answer keeps its size.
 * - `CornerMark`: a 20 mark inside the answer's rounded corner, out of the flow.
 * - `LookHereRing`: the one look-here shape, a dashed ring `spacing.xs` outside the answer (`choiceCardRingStyle`), an
 *   absolute child that takes no room.
 *
 * Every mark is decorative: the answer's accessible name carries the state.
 */

/** The marks a board draws: `check` right, `replay` a miss to try again, `dash` tried here and still tappable. */
export type BoardMark = 'right' | 'miss' | 'tried';

const LOOK: Record<BoardMark, { icon: 'check' | 'replay' | 'dash'; color: string; disc: string }> = {
  right: { icon: 'check', color: colors.feedback.success, disc: colors.feedback.successLight },
  miss: { icon: 'replay', color: colors.text.primary, disc: colors.feedback.nudgeLight },
  tried: { icon: 'dash', color: colors.text.primary, disc: colors.feedback.nudgeLight },
};

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

/** A mark on its disc, placed by `place` (an absolute offset the caller computes). */
export function MarkDisc({ mark, place, testID }: { mark: BoardMark; place: { top: number; left?: number; right?: number }; testID?: string }): ReactElement {
  const look = LOOK[mark];
  return (
    <View
      {...hidden}
      pointerEvents="none"
      testID={testID}
      style={{
        position: 'absolute',
        ...place,
        padding: MARK_DISC.padding,
        borderRadius: radii.circle,
        borderWidth: MARK_DISC.casing,
        borderColor: colors.text.primary,
        backgroundColor: look.disc,
      }}
    >
      <Icon name={look.icon} size={MARK_MIN} color={look.color} />
    </View>
  );
}

/** A mark on a disc straddling the answer's top-end corner; `answerBorder` is the border the answer draws now. */
export function DiscMark({ mark, answerBorder, testID }: { mark: BoardMark; answerBorder: number; testID?: string }): ReactElement {
  const offset = -(MARK_DISC.outside + answerBorder);
  return <MarkDisc mark={mark} place={{ top: offset, right: offset }} testID={testID} />;
}

/** A mark inside the answer's top-end corner, `inset` from the edges. */
export function CornerMark({ mark, inset, testID }: { mark: Exclude<BoardMark, 'tried'>; inset: number; testID?: string }): ReactElement {
  const look = LOOK[mark];
  return (
    <View {...hidden} pointerEvents="none" testID={testID} style={{ position: 'absolute', top: inset, right: inset }}>
      <Icon name={look.icon} size={MARK_MIN} color={look.color} />
    </View>
  );
}

/** The look-here ring around an answer of this corner radius and drawn border width (AnswerFeedback D4). */
export function LookHereRing({ radius, answerBorder, testID }: { radius: number; answerBorder: number; testID?: string }): ReactElement {
  const ring = choiceCardStyle('hint').ring;
  return <View {...hidden} pointerEvents="none" testID={testID} style={ring ? choiceCardRingStyle(ring, radius, answerBorder) : undefined} />;
}
