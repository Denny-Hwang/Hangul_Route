import type { ViewStyle } from 'react-native';

/**
 * A build that is not reached yet keeps its space on the stage and is not drawn or read, so nothing
 * shifts when it arrives (design/screens/presenter/slide-letter.md "Builds"); the swap is instant.
 */
export function revealProps(on: boolean): { style: Pick<ViewStyle, 'opacity'>; 'aria-hidden': boolean } {
  return { style: { opacity: on ? 1 : 0 }, 'aria-hidden': !on };
}
