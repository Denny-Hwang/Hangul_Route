import type { PressableProps } from 'react-native';

/**
 * No press delay (docs/specs/AMENDMENTS-TOUCH.md section 3.1 and 4.4): the press look shows on the first touch frame,
 * not after react-native-web's 50 ms `delayPressIn` (native: `unstable_pressDelay`). Neither prop is in react-native's
 * `PressableProps` type, hence the cast. Shared by `TapTarget`, `Button`, `Card`, `KoreanText`, `HoyaBubble` and the
 * app's guarded non-game Pressables (row KT-9, section 6.9).
 */
export const NO_PRESS_DELAY = { delayPressIn: 0, unstable_pressDelay: 0 } as unknown as Partial<PressableProps>;
