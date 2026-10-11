/**
 * Scene art core (F-STORY-002 §3.9): pure, no React, no react-native. The
 * registry, Hoya data port and renderers arrive in later PRs.
 */
export * from './types';
export { COLOR_TOKENS, isColorToken, resolveColor, resolveStroke } from './tokens-map';
export {
  boundsOf,
  nodeCount,
  paletteOf,
  parsePath,
  resolveScene,
  thumbVariant,
  type Bounds,
  type Matrix,
  type PathSegment,
  type Registry,
  type ResolveIssue,
  type ResolvedCard,
  type ResolvedLayer,
  type ResolvedNode,
  type ResolvedScene,
} from './resolve';
export { LIMITS, checkItem, checkScene, serializedBytes, type Finding } from './rules';
