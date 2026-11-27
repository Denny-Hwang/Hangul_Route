import { createContext } from 'react';

/**
 * [TC] Height a frame above a screen has taken from the window (the All lessons preview's strip, `PreviewFrame`): a screen that
 * sizes itself from the window (the trace page of Discover, `useScreenContentBox`) subtracts it, so it never plans room that
 * the frame already uses. 0 where nothing sits above the screen.
 */
export const ScreenReserveContext = createContext(0);
