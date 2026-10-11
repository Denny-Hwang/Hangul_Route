/**
 * Scene art (F-STORY-002 §3.9): pure, no React, no react-native. The plain-DOM
 * renderer is `./dom` and the react-native one is `StoryScene`; both draw what
 * `drawScene` returns.
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
export { CARD_SIZE, drawScene, type DrawCard, type DrawItem, type DrawNode, type DrawPaint, type DrawnScene } from './draw';
export { HOYA_BOX, HOYA_POSES, hoyaItem, hoyaNodes, type HoyaPose } from './hoya';
export { SCENE_ART_REGISTRY, hasItem } from './registry';
export {
  DEFAULT_FALLBACK_THEME,
  DEFAULT_SCENE_WIDTH,
  FALLBACK_TINT_OPACITY,
  storySceneModel,
  type StorySceneModel,
  type StorySceneModelInput,
} from './story-scene-model';
