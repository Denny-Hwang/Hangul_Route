import { SceneArtSchema, type SceneArt } from '@hangul-route/content-schema';
import type { SceneArtLike, StorySceneProps } from '@hangul-route/design-system';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-002 §3.9.9: the design system does not depend on content-schema, so
 * `SceneArtLike` is a structural twin of `SceneArt`. These assignments fail to
 * compile (`pnpm typecheck`) if the two ever drift apart. Type-only imports from
 * the package root: the root is the path Metro can resolve.
 */
describe('SceneArt and SceneArtLike stay assignable', () => {
  const parsed: SceneArt = SceneArtSchema.parse({
    setting: 'scene:palace-hall',
    layers: [{ ref: 'hoya:idle', x: 100, y: 250 }, { ref: 'prop:desk', x: 200, y: 220, s: 1.5, flip: true, z: 'front', tint: 'theme.rites' }],
    altEn: 'Hoya sits in a palace hall.',
  });

  it('a parsed SceneArt is a SceneArtLike and a StoryScene art prop', () => {
    const like: SceneArtLike = parsed;
    const props: Pick<StorySceneProps, 'art'> = { art: parsed };
    expect(like.layers).toHaveLength(2);
    expect(props.art).toBe(parsed);
  });

  it('a layer parsed with its default scale carries it', () => {
    expect(parsed.layers[0]!.s).toBe(1);
  });
});
