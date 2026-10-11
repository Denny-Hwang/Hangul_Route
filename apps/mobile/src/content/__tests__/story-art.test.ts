import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseStory, type Story } from '@hangul-route/content-schema';
import { SCENE_ART_REGISTRY, checkScene, hasItem } from '@hangul-route/design-system/scene-art';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-002 §5 story-art integration: every scene that carries `art`, in any
 * story state, names registered items and passes the composition rules
 * (§3.9.5) with no error; ready stories have art or `artPending` on every scene
 * (F-STORY-001 lint `art-missing`). The records-joseon (PR 2.10a),
 * hangul-printing (PR 2.10b) and science-art-life (PR 2.10c) clusters are
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

const HANGUL_PRINTING = [
  'story:sejong-new-letters',
  'story:shapes-of-hangeul',
  'story:hangeul-day',
  'story:jikji-metal-type',
  'story:tripitaka-koreana',
  'story:janggyeong-panjeon',
];

const SCIENCE_ART_LIFE = [
  'story:cheugugi-rain-gauge',
  'story:angbuilgu-sundial',
  'story:jagyeongnu-water-clock',
  'story:donguibogam',
  'story:nanjung-ilgi',
  'story:kim-hongdo-genre-paintings',
];

/** Every illustrated cluster, with its scene count (F-STORY-002 §3.9.8 cadence). */
const CLUSTERS: ReadonlyArray<{ name: string; ids: readonly string[]; scenes: number }> = [
  { name: 'records-joseon', ids: RECORDS_JOSEON, scenes: 45 },
  { name: 'hangul-printing', ids: HANGUL_PRINTING, scenes: 46 },
  { name: 'science-art-life', ids: SCIENCE_ART_LIFE, scenes: 43 },
];

describe('story scene art', () => {
  it('has art to check', () => {
    expect(withArt.length).toBeGreaterThanOrEqual(134);
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

  // §5: the artPending count is reported (in the test name, so it shows in every
  // run) and per story, so a review sees which stories still wait for pictures.
  const pending = scenes.filter((s) => s.scene.artPending === true);
  const pendingByStory = Object.fromEntries(
    stories.map((story) => [story.id, pending.filter((s) => s.story.id === story.id).length] as const).filter(([, n]) => n > 0),
  );
  it(`reports ${pending.length} artPending scenes of ${scenes.length} across ${Object.keys(pendingByStory).length} stories`, () => {
    expect(pending.length + withArt.length).toBeLessThanOrEqual(scenes.length);
    for (const id of CLUSTERS.flatMap((c) => c.ids)) expect(pendingByStory[id], id).toBeUndefined();
    expect(Object.values(pendingByStory).reduce((a, n) => a + n, 0)).toBe(pending.length);
  });

  // F-STORY-001 §3.7: art is learner-visible content; these stories were ready
  // on main before their art landed, so their contentVer moved past 1.
  it.each(CLUSTERS)('bumped contentVer on the $name stories for their art', ({ ids }) => {
    for (const story of stories.filter((s) => ids.includes(s.id))) expect(story.contentVer, story.id).toBeGreaterThanOrEqual(2);
  });

  it.each(CLUSTERS)('illustrates every scene of the $name cluster, with no warnings either', ({ ids, scenes: count }) => {
    const cluster = scenes.filter((s) => ids.includes(s.story.id));
    expect(new Set(cluster.map((s) => s.story.id)).size).toBe(6);
    expect(cluster.length).toBe(count);
    for (const { story, scene } of cluster) {
      expect(scene.art, `${story.id} ${scene.id}`).toBeDefined();
      expect(checkScene(scene.art!, SCENE_ART_REGISTRY), `${story.id} ${scene.id}`).toEqual([]);
    }
  });
});
