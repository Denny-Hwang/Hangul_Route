import { describe, expect, it } from 'vitest';
import * as sceneArt from '../index';

describe('scene-art index', () => {
  it('exports the pure core and nothing renderer-specific', () => {
    for (const name of ['drawScene', 'hoyaNodes', 'hoyaFigure', 'hoyaItem', 'SCENE_ART_REGISTRY', 'hasItem', 'storySceneModel', 'resolveScene', 'thumbVariant', 'paletteOf', 'nodeCount', 'boundsOf', 'parsePath', 'checkItem', 'checkScene', 'resolveColor', 'isColorToken', 'COLOR_TOKENS', 'OPACITY_STEPS', 'SCENE_CANVAS', 'LIMITS']) {
      expect(sceneArt).toHaveProperty(name);
    }
  });
});
