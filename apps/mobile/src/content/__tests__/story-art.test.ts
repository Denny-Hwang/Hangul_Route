import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseStory, type Story } from '@hangul-route/content-schema';
import { SCENE_ART_REGISTRY, checkScene, hasItem, parsePath, resolveScene } from '@hangul-route/design-system/scene-art';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-002 §5 story-art integration: every scene that carries `art`, in any
 * story state, names registered items and passes the composition rules
 * (§3.9.5) with no error; ready stories have art or `artPending` on every scene
 * (F-STORY-001 lint `art-missing`). The records-joseon (PR 2.10a),
 * hangul-printing (PR 2.10b), science-art-life (PR 2.10c) and seasons-tales
 * (PR 2.10d) clusters are fully illustrated and passed review with no
 * warnings either, so every launch scene now has art.
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

const SEASONS_TALES = [
  'story:seollal-new-year',
  'story:chuseok-ganggangsullae',
  'story:dano-ssireum',
  'story:gimjang-arirang',
  'story:pansori-tales',
  'story:sun-and-moon',
];

/** Every illustrated cluster, with its scene count (F-STORY-002 §3.9.8 cadence). */
const CLUSTERS: ReadonlyArray<{ name: string; ids: readonly string[]; scenes: number }> = [
  { name: 'records-joseon', ids: RECORDS_JOSEON, scenes: 45 },
  // + 18 read scenes of the Stage 5 letters book (F-STORY-005 PR 5.6; art reused from the listen scene).
  { name: 'hangul-printing', ids: HANGUL_PRINTING, scenes: 64 },
  // + 30 read scenes of the Stage 5 life, nature and crafts books (F-STORY-005 PR 5.6).
  { name: 'science-art-life', ids: SCIENCE_ART_LIFE, scenes: 73 },
  // 48 listen scenes + 19 read scenes of the Stage 5 rites book + 17 of the life, nature and crafts books
  // (F-STORY-005 PR 5.6; art reused from the listen scene).
  { name: 'seasons-tales', ids: SEASONS_TALES, scenes: 84 },
];

describe('story scene art', () => {
  it('has art to check', () => {
    expect(withArt.length).toBeGreaterThanOrEqual(182);
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

  // F-STORY-001 §3.7: the follow-up to PR 2.10c (post-merge review of #265)
  // reworded alt text and narration on these ready stories, so each moved to 3.
  const REWORDED_AFTER_ART = [
    'story:cheugugi-rain-gauge',
    'story:donguibogam',
    'story:nanjung-ilgi',
    'story:kim-hongdo-genre-paintings',
    'story:shapes-of-hangeul',
    'story:sillok-royal-historians',
  ];
  it('bumped contentVer again on the stories reworded after their art', () => {
    for (const id of REWORDED_AFTER_ART) {
      const story = stories.find((s) => s.id === id);
      expect(story?.state, id).toBe('ready');
      expect(story?.contentVer, id).toBeGreaterThanOrEqual(3);
    }
  });

  // F-STORY-001 §3.7: the follow-up to PR 2.10d (post-merge review of #310)
  // changed narration, alt text or pictures on every seasons-tales story.
  it('bumped contentVer again on the seasons-tales stories changed after their art', () => {
    for (const id of SEASONS_TALES) {
      const story = stories.find((s) => s.id === id);
      expect(story?.state, id).toBe('ready');
      expect(story?.contentVer, id).toBeGreaterThanOrEqual(3);
    }
  });

  // §3.9.5 rule 9: the alt states what is drawn. Hoya has five poses
  // (idle, cheering, thinking, reading, waving); none points, grips, kneels,
  // holds a paw out, hugs, rolls up his sleeves or stands in a ready stance.
  // The narration a learner hears beside the picture may not say so either.
  // A relative clause ("where a signpost points") is about something else.
  const UNDRAWN_GESTURE =
    /\bHoya\b(?:(?!\b(?:where|which|that|while)\b)[^.;:])*?\b(points?|pointing|holds out|stands? ready|grips?|gripping|kneels?|kneeling|hugs?|hugging|rolls? up)\b/i;
  // Post-merge review of #310: on the seasons-tales cluster he also never
  // bows, sniffs, leans in, stretches, walks or sits.
  const UNDRAWN_GESTURE_SEASONS = new RegExp(
    UNDRAWN_GESTURE.source.replace('|rolls? up)', '|rolls? up|bows?|bowing|sniffs?|sniffing|leans?|leaning|stretch(?:es|ing)?|walks?|walking|sits?|sitting)'),
    'i',
  );
  const illustrated = CLUSTERS.flatMap((c) => c.ids);
  const hoyaScenes = scenes.filter(
    (s) => illustrated.includes(s.story.id) && s.scene.art?.layers.some((l) => l.ref.startsWith('hoya:')),
  );

  it('has illustrated scenes with Hoya to check', () => {
    expect(hoyaScenes.length).toBeGreaterThan(30);
  });

  it('alt text of every illustrated cluster names only gestures Hoya is drawn in', () => {
    for (const { story, scene } of hoyaScenes) expect(scene.art!.altEn, `${story.id} ${scene.id}`).not.toMatch(UNDRAWN_GESTURE);
  });

  it('narration beside a picture of Hoya names only gestures he is drawn in', () => {
    for (const { story, scene } of hoyaScenes) expect(scene.narrationEn, `${story.id} ${scene.id}`).not.toMatch(UNDRAWN_GESTURE);
  });

  it('the gesture guard ignores a relative clause about something else', () => {
    expect('Hoya stands at a crossroads where a signpost points three ways.').not.toMatch(UNDRAWN_GESTURE);
    expect('Hoya grins and points at the sky.').toMatch(UNDRAWN_GESTURE);
  });

  const seasonsHoya = hoyaScenes.filter((s) => SEASONS_TALES.includes(s.story.id));
  it('alt text and narration of the seasons-tales cluster name no bow, sniff, lean, stretch, walk or sit', () => {
    expect(seasonsHoya.length).toBeGreaterThan(20);
    expect("Hoya bows: 'Saehae bok mani badeuseyo!'").toMatch(UNDRAWN_GESTURE_SEASONS);
    expect('Hoya sits ready for story time.').toMatch(UNDRAWN_GESTURE_SEASONS);
    expect('Hoya grins and points at the sky.').toMatch(UNDRAWN_GESTURE_SEASONS);
    expect('Hoya waves where a child bows.').not.toMatch(UNDRAWN_GESTURE_SEASONS);
    for (const { story, scene } of seasonsHoya) {
      expect(scene.art!.altEn, `${story.id} ${scene.id}`).not.toMatch(UNDRAWN_GESTURE_SEASONS);
      expect(scene.narrationEn, `${story.id} ${scene.id}`).not.toMatch(UNDRAWN_GESTURE_SEASONS);
    }
  });

  // §3.9.5 rule 9 again: an alt that says night or evening needs a drawn night
  // cue (a night window, a night sky or the moon); a lamp alone is not one.
  const NIGHT_WORDS = /\b(night|nightfall|evening|moonlight)\b/i;
  const NIGHT_CUES = new Set(['prop:night-window', 'prop:night-sky', 'prop:full-moon']);
  it('an alt that says night or evening draws a night cue', () => {
    for (const { story, scene } of withArt.filter((s) => NIGHT_WORDS.test(s.scene.art!.altEn))) {
      expect(scene.art!.layers.some((l) => NIGHT_CUES.has(l.ref)), `${story.id} ${scene.id}`).toBe(true);
    }
  });

  // §3.9.10: a detail the sources do not support is left out. The museum's
  // Seodang shows the teacher in a square indoor cap, never an outdoor gat, so
  // the teacher is the bare-topknot seated writer and no gat-drawing figure is
  // in the scene (checked by id, not by the words of a registry alt).
  const GAT_FIGURES = ['prop:fig-scholar', 'prop:crowd-seated'];
  it('draws the Seodang teacher without a gat', () => {
    const seodang = scenes.find((s) => s.story.id === 'story:kim-hongdo-genre-paintings' && s.scene.id === 's6');
    const refs = seodang?.scene.art?.layers.map((l) => l.ref) ?? [];
    expect(refs).toContain('prop:fig-writer-seated');
    for (const id of GAT_FIGURES) {
      expect(hasItem(id), id).toBe(true);
      expect(refs, id).not.toContain(id);
    }
  });

  // §3.9.5 R-S10 and §3.9.10 (PR 2.10d): the folk tale's peril is shown as
  // setting and objects. The rotten rope (s6) and the sorghum field (s7) draw
  // no tiger, so its fall is never pictured; the trickster tiger is never
  // tinted into Hoya's yellow.
  // Post-merge review of #310: the tiger at the children's door (s3) is the
  // peril moment too, so s3 shows the children and the closed door only (the
  // brief keeps the tiger outside). The tiger keeps its one orange in every
  // scene: no layer tints it (a tint could bring Hoya's yellow or the red).
  it('draws no tiger where the sun-and-moon tale tells of its trick at the door or its fall', () => {
    for (const id of ['s3', 's6', 's7']) {
      const art = scenes.find((s) => s.story.id === 'story:sun-and-moon' && s.scene.id === id)?.scene.art;
      expect(art, id).toBeDefined();
      expect(art!.layers.map((l) => l.ref), id).not.toContain('prop:tiger-trickster');
    }
  });

  it('never tints the trickster tiger', () => {
    const tigers = withArt.flatMap(({ story, scene }) =>
      scene.art!.layers.filter((l) => l.ref === 'prop:tiger-trickster').map((layer) => ({ where: `${story.id} ${scene.id}`, layer })),
    );
    expect(tigers.length).toBeGreaterThan(0);
    for (const { where, layer } of tigers) expect(layer.tint, where).toBeUndefined();
  });

  // The sun-and-moon screen puts the sun on the right (registry test); the yut
  // throws read do to mo left to right. A flipped layer would reverse either.
  const NO_FLIP = new Set(['prop:sun-moon-screen', 'prop:yut-throws']);
  it('never flips an orientation-sensitive item', () => {
    for (const { story, scene } of withArt) {
      for (const layer of scene.art!.layers.filter((l) => NO_FLIP.has(l.ref))) expect(layer.flip, `${story.id} ${scene.id} ${layer.ref}`).not.toBe(true);
    }
  });

  // §3.9.10: the pansori drummer (gosu) sits beside his drum; the seated
  // writer figure carries paper and a brush, so it is not used for him.
  it('draws the pansori drummer without paper and brush', () => {
    const pansori = scenes.filter((s) => s.story.id === 'story:pansori-tales');
    for (const { scene } of pansori) expect(scene.art?.layers.map((l) => l.ref) ?? [], scene.id).not.toContain('prop:fig-writer-seated');
    for (const id of ['s1', 's2']) {
      const refs = pansori.find((s) => s.scene.id === id)?.scene.art?.layers.map((l) => l.ref) ?? [];
      expect(refs, id).toContain('prop:fig-elder-seated');
      expect(refs, id).toContain('prop:drum');
    }
  });

  // Chuseok falls on the fifteenth lunar day, a full-moon night: every
  // Chuseok scene with a night cue shows the full moon, not only a crescent.
  it('shows the full moon on every Chuseok night', () => {
    const chuseok = withArt.filter((s) => s.story.id === 'story:chuseok-ganggangsullae');
    const nights = chuseok.filter((s) => s.scene.art!.layers.some((l) => NIGHT_CUES.has(l.ref)));
    expect(nights.length).toBeGreaterThanOrEqual(4);
    for (const { scene } of nights) expect(scene.art!.layers.map((l) => l.ref), scene.id).toContain('prop:full-moon');
  });

  // Post-merge verification of the #310 follow-up: `prop:night-window` paints
  // its own crescent, so a full moon laid over it must hide the crescent
  // completely. The moon's opaque disk, drawn after the window, has to contain
  // the circle the crescent's outer arc belongs to (the crescent lies inside
  // that circle), measured on the canvas after both placements.
  it('a full moon over a night window hides the window crescent', () => {
    const both = withArt.filter(({ scene }) => {
      const refs = scene.art!.layers.map((l) => l.ref);
      return refs.includes('prop:night-window') && refs.includes('prop:full-moon');
    });
    expect(both.length).toBeGreaterThanOrEqual(1);
    for (const { story, scene } of both) {
      const where = `${story.id} ${scene.id}`;
      const { nodes } = resolveScene(scene.art!, SCENE_ART_REGISTRY);
      const crescents = nodes.filter((n) => n.ref === 'prop:night-window' && n.shape.t === 'path' && n.shape.fill === 'feedback.nudgeLight');
      const disks = nodes.filter((n) => n.ref === 'prop:full-moon' && n.shape.t === 'circle' && n.shape.o === undefined);
      expect(crescents.length, where).toBeGreaterThanOrEqual(1);
      expect(disks.length, where).toBeGreaterThanOrEqual(1);
      for (const crescent of crescents) {
        const shape = crescent.shape as { d: string };
        const segs = parsePath(shape.d)!;
        const start = segs.find((s) => s.cmd === 'M')!.args;
        const arc = segs.find((s) => s.cmd === 'A')!.args;
        // SVG endpoint-to-centre conversion for a circular arc (rx = ry, no rotation).
        const [r, , , large, sweep, x2, y2] = arc as [number, number, number, number, number, number, number];
        const [x1, y1] = start as [number, number];
        const hx = (x1 - x2) / 2;
        const hy = (y1 - y2) / 2;
        const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (r * r - hx * hx - hy * hy) / (hx * hx + hy * hy)));
        const lcx = k * hy + (x1 + x2) / 2;
        const lcy = -k * hx + (y1 + y2) / 2;
        const [a, , , d, e, f] = crescent.matrix;
        const cc = { x: a * lcx + e, y: d * lcy + f, r: Math.abs(a) * r };
        const covered = disks.some((disk) => {
          const c = disk.shape as { cx: number; cy: number; r: number };
          const [da, , , dd, de, df] = disk.matrix;
          const dc = { x: da * c.cx + de, y: dd * c.cy + df, r: Math.abs(da) * c.r };
          return disk.rank > crescent.rank && Math.hypot(dc.x - cc.x, dc.y - cc.y) + cc.r <= dc.r;
        });
        expect(covered, where).toBe(true);
      }
    }
  });

  // §3.9.5 rule 9, post-merge review of #310: these alts named an action or an
  // object the picture leaves out (a bound leg, a carried bundle, a sliding
  // tiger, dancers sitting where the figures kneel).
  const UNDRAWN_IN_ALT: ReadonlyArray<[string, string, RegExp]> = [
    ['story:pansori-tales', 's3', /\bbinds?\b/i],
    ['story:sun-and-moon', 's2', /\bcarrying\b/i],
    ['story:sun-and-moon', 's5', /\bslides?\b|\bslips?\b/i],
    ['story:chuseok-ganggangsullae', 's7', /\bsit\b/i],
  ];
  it.each(UNDRAWN_IN_ALT)('the %s %s alt names only what is drawn', (storyId, sceneId, undrawn) => {
    const art = scenes.find((s) => s.story.id === storyId && s.scene.id === sceneId)?.scene.art;
    expect(art).toBeDefined();
    expect(art!.altEn).not.toMatch(undrawn);
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
