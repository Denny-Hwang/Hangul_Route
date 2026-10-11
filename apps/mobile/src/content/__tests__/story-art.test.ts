import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseStory, type Story } from '@hangul-route/content-schema';
import { SCENE_ART_REGISTRY, checkScene, hasItem } from '@hangul-route/design-system/scene-art';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-002 §5 story-art integration: every scene that carries `art`, in any
 * story state, names registered items and passes the composition rules
 * (§3.9.5) with no error; ready stories have art or `artPending` on every scene
 * (F-STORY-001 lint `art-missing`). The records-joseon cluster (PR 2.10a) is
 * fully illustrated and passed review with no warnings either.
 */
const DIR = join(__dirname, '../../../../../content/stories');
const stories: Story[] = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => parseStory(JSON.parse(readFileSync(join(DIR, n), 'utf8'))));
const scenes = stories.flatMap((story) => story.tiers.flatMap((tier) => tier.scenes.map((scene) => ({ story, tier, scene }))));
const withArt = scenes.filter((s) => s.scene.art);

const RECORDS_JOSEON = [
  'story:sillok-royal-historians',
  'story:sillok-mountain-archives',
  'story:seungjeongwon-ilgi-every-day',
  'story:ilseongnok-daily-reflection',
  'story:uigwe-royal-birthday',
  'story:joseon-records-today',
];

describe('story scene art', () => {
  it('has art to check', () => {
    expect(withArt.length).toBeGreaterThanOrEqual(45);
  });

  it('every setting and layer ref is in the registry', () => {
    for (const { story, scene } of withArt) {
      const art = scene.art!;
      expect(hasItem(art.setting), `${story.id} ${scene.id} ${art.setting}`).toBe(true);
      for (const layer of art.layers) expect(hasItem(layer.ref), `${story.id} ${scene.id} ${layer.ref}`).toBe(true);
    }
  });

  it('every illustrated scene passes the composition rules with no error and has alt text', () => {
    for (const { story, scene } of withArt) {
      const errors = checkScene(scene.art!, SCENE_ART_REGISTRY).filter((f) => f.severity === 'error');
      expect(errors, `${story.id} ${scene.id}`).toEqual([]);
      expect(scene.art!.altEn.trim().length, `${story.id} ${scene.id}`).toBeGreaterThan(20);
    }
  });

  it('a scene with art is not also marked artPending', () => {
    for (const { story, scene } of withArt) expect(scene.artPending, `${story.id} ${scene.id}`).not.toBe(true);
  });

  it('every scene of a ready story has art or artPending', () => {
    for (const { story, scene } of scenes.filter((s) => s.story.state === 'ready')) {
      expect(scene.art !== undefined || scene.artPending === true, `${story.id} ${scene.id}`).toBe(true);
    }
  });

  it('illustrates every scene of the records-joseon cluster, with no warnings either', () => {
    const cluster = scenes.filter((s) => RECORDS_JOSEON.includes(s.story.id));
    expect(new Set(cluster.map((s) => s.story.id)).size).toBe(6);
    expect(cluster.length).toBe(45);
    for (const { story, scene } of cluster) {
      expect(scene.art, `${story.id} ${scene.id}`).toBeDefined();
      expect(checkScene(scene.art!, SCENE_ART_REGISTRY), `${story.id} ${scene.id}`).toEqual([]);
    }
  });
});
