import { useContext, useEffect, useId, useRef } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { TapBoardContext } from './context';
import type { TapControlProps } from './types';

/**
 * A control inside a board that is not an answer (a speaker, a hint button; docs/specs/AMENDMENTS-TOUCH.md rule 2): the
 * board never claims a touch on it, even within the gap reach of a target, so the control keeps its own press. It
 * registers its rectangle with the nearest board; outside a board it is a plain View.
 */
export function TapControl({ children, testID, style }: TapControlProps): ReactElement {
  const board = useContext(TapBoardContext);
  const id = useId();
  const node = useRef<unknown>(null);
  const registerControl = board?.registerControl;
  useEffect(() => (registerControl === undefined ? undefined : registerControl(id, { node: () => node.current })), [registerControl, id]);
  return (
    <View
      ref={(v) => {
        node.current = v;
      }}
      testID={testID}
      style={style}
      onLayout={board === null ? undefined : () => board.remeasure()}
    >
      {children}
    </View>
  );
}
