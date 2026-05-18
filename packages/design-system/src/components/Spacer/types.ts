import type { SpacingTokens } from '../../tokens';

export interface SpacerProps {
  size?: keyof SpacingTokens;
  flex?: boolean;
}
