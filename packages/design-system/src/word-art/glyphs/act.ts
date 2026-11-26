/**
 * WordArt action pictures (AMENDMENTS-PLC-VALIDITY S3, S5, row PV-1a; F-VOC-002
 * §3.9): one animal or one person doing one thing, for the level check's
 * sentence items. A key is `act-<predicate>-<noun>`; the three pictures of a
 * noun are its family, and only the action tells them apart:
 *
 * - run (ttwieoyo): side view in mid-stride, legs stretched out, motion lines behind, a ground shadow;
 * - swim (heeomchyeoyo): the head and back above the water, one limb reaching forward in a stroke, splashes;
 * - sleep (jayo): lying down, eyes closed (still smiling), a crescent moon;
 * - eat (meogeoyo): sitting, food held at the mouth with a bite taken (a person: a bowl and a spoon);
 * - fly (narayo): in the air, wings up, a cloud below.
 *
 * The animals keep the faces of their word pictures (`animal.ts`, placed
 * smaller), so `act-run-bear` is the bear of `animal-bear`. Every key is
 * `reserved` (no vocabulary topic uses it). No text, digits, arrows or emoji.
 *
 * Never import this file from the package barrel: the app reaches it by its
 * own path from the level check's chunk, which calls `loadActWordArt()`, so the
 * start bundle carries only the names (`ACT_KEYS` in the registry).
 */
import { arc, blob, circle, curve, drop, ellipse, groundShadow, leaf, line, path, poly, pts, star } from '../builders';
import type { Pt } from '../builders';
import { formatNumber as n } from '../path';
import { placeGlyph, placePath } from '../place';
import { ACT_KEYS, addWordArt } from '../registry';
import type { WordArtEntry } from '../registry';
import type { WordArtGlyph, WordArtShape, WordArtTone } from '../types';
import { ANIMAL_GLYPHS } from './animal';
import { hand, head, limb } from './pose';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const INK_FILL = { f: 'text.primary', ...INK } as const;
const fur = (f: WordArtTone) => ({ f, ...INK }) as const;

/** An ink-filled small circle with no stroke is an eye of `face()`: asleep, it becomes a closed eye, still smiling (C5). */
const isEye = (s: WordArtShape): boolean => s.t === 'circle' && s.f === 'text.primary' && s.s === undefined && s.r <= 3.5;
const closeEyes = (g: readonly WordArtShape[]): WordArtShape[] =>
  g.map((s) => (s.t === 'circle' && isEye(s) ? arc(s.x, s.y - 1.5, s.r * 1.5, 25, 155, { s: 'text.primary', sw: 3 }) : s));

/** A word picture's face, centred on (x, y) at `scale`, maybe asleep, maybe without some tones (C4). */
function faceOf(key: string, x: number, y: number, scale: number, asleep = false, drop: readonly WordArtTone[] = []): WordArtShape[] {
  const g = ANIMAL_GLYPHS[key]!.filter((s) => s.f === undefined || !drop.includes(s.f));
  return placeGlyph(asleep ? closeEyes(g) : g, { scale, dx: x - 50 * scale, dy: y - 50 * scale });
}

/** A crescent moon and a small star (the sleep cue): a broad crescent opening to the right, so it reads at 48 px. */
const moon = (x: number, y: number, r: number): WordArtShape[] => [
  path(placePath('M 0 -1 A 1 1 0 1 0 0 1 A 2 2 0 0 1 0 -1 Z', { dx: x, dy: y, scale: r }), fur('hoya.fur')),
  star(x + 9, y - 6, 4.5, 2, 4, { f: 'hoya.fur', ...DETAIL }, 0.5),
];

/** Motion lines behind a runner (the run cue). */
const SPEED = path('M 12 50 H 22 M 8 59 H 20 M 12 68 H 22', DETAIL);

/**
 * Open water (the swim cue): only the wave crest is outlined, so the band has no tub sides or bottom (blind review:
 * an outlined band read as a bath). Ripples are paper strokes, so the water is one fill tone.
 */
const CREST = 'M 12 62 Q 18.2 57 24.3 62 Q 30.5 67 36.7 62 Q 42.8 57 49 62 Q 55.2 67 61.3 62 Q 67.5 57 73.7 62 Q 79.8 67 86 62';
const SEA: WordArtShape[] = [
  path(`${CREST} L 86 76 Q 79.8 81 73.7 76 Q 67.5 71 61.3 76 Q 55.2 81 49 76 Q 42.8 71 36.7 76 Q 30.5 81 24.3 76 Q 18.2 71 12 76 Z`, { f: 'vocab.skyBlue' }),
  path(CREST, INK),
  path('M 18 70 Q 24 67 30 70 M 36 71 Q 42 68 48 71 M 60 72 Q 66 69 72 72', { s: 'surface.paper', sw: 2 }),
];
/** A swim picture raised to the centre of the frame (C2). */
const up = (g: readonly WordArtShape[]): WordArtShape[] => placeGlyph(g, { dx: 0, dy: -5, scale: 1 });
/** Motion lines above the water behind a swimmer: it is going somewhere (swimming), not sitting in water. */
const SWIM_SPEED = path('M 13 36 H 24 M 16 44 H 26', DETAIL);
/** Spray lines where the forward stroke meets the water, ahead of the swimmer (not drops: a drop by a face reads as sweat). */
const STROKE_SPLASH: WordArtShape[] = [path('M 80 53 Q 82 47 85 46 M 86 53 Q 88 48 87.5 45', DETAIL)];
/** The kick splash behind a swimmer, at the waterline. */
const KICK: WordArtShape[] = [drop(16, 48, 57, 5.5, { f: 'vocab.skyBlue', ...DETAIL }), drop(24, 44, 52, 4.5, { f: 'vocab.skyBlue', ...DETAIL })];

/** A cloud below a flyer (the fly cue): three round bumps on a flat base, like `nature-cloud`. */
const cloud = (x: number, y: number, k: number): WordArtShape =>
  path(placePath('M -15 5 A 5 5 0 0 1 -11 -3 A 8 8 0 0 1 3 -6 A 6 6 0 0 1 13 -1 A 4 4 0 0 1 15 5 Z', { dx: x, dy: y, scale: k }), fur('surface.paper'));

/** The four-legged animals: their word picture's face, a fur tone, the face's size, the tail of each pose, tones left out for the C4 budget. */
interface Beast {
  key: string;
  f: WordArtTone;
  s: number;
  tail: (pose: 'run' | 'swim' | 'sleep' | 'eat') => WordArtShape[];
  drop?: readonly WordArtTone[];
  /** Belly patch tone, drawn on a sitting body. */
  belly?: WordArtTone;
  /** Extra marks on the body (the tiger's stripes). */
  marks?: (x: number, y: number) => WordArtShape[];
}

const stripes = (x: number, y: number): WordArtShape[] => [leaf(x - 8, y - 12, x - 6, y - 3, 2, INK_FILL), leaf(x + 2, y - 13, x + 3, y - 4, 2, INK_FILL), leaf(x + 12, y - 12, x + 12, y - 4, 2, INK_FILL)];

/** A tail from `a` bending at `b` to `c`, two capsules. */
const tail2 = (f: WordArtTone, a: Pt, b: Pt, c: Pt, w = 6): WordArtShape[] => [limb(a, b, w, fur(f)), limb(b, c, w, fur(f))];

const BEASTS: Readonly<Record<string, Beast>> = {
  bear: { key: 'animal-bear', f: 'vocab.brown', s: 0.46, tail: () => [], belly: 'feedback.nudgeLight' },
  tiger: {
    key: 'animal-tiger',
    f: 'hoya.fur',
    s: 0.44,
    tail: (p) => (p === 'run' ? tail2('hoya.fur', [26, 56], [16, 48], [14, 38]) : p === 'sleep' ? tail2('hoya.fur', [80, 74], [88, 66], [84, 56]) : p === 'swim' ? tail2('hoya.fur', [24, 60], [17, 55], [15, 48]) : []),
    belly: 'hoya.belly',
    marks: stripes,
  },
  puppy: {
    key: 'animal-puppy',
    f: 'stage.stage2',
    s: 0.44,
    tail: (p) => (p === 'run' ? [limb([26, 54], [16, 44], 6, fur('stage.stage2'))] : p === 'sleep' ? [limb([80, 72], [88, 64], 6, fur('stage.stage2'))] : p === 'swim' ? [limb([24, 58], [16, 50], 6, fur('stage.stage2'))] : []),
    drop: ['hoya.cheek'],
  },
  rabbit: { key: 'animal-rabbit', f: 'vocab.white', s: 0.4, tail: (p) => [p === 'sleep' ? circle(83, 66, 5, fur('vocab.white')) : p === 'eat' ? circle(70, 80, 5, fur('vocab.white')) : circle(23, 54, 5, fur('vocab.white'))] },
  cat: {
    key: 'animal-cat',
    f: 'vocab.orange',
    s: 0.44,
    tail: (p) => (p === 'run' ? tail2('vocab.orange', [26, 56], [16, 50], [12, 40]) : p === 'sleep' ? tail2('vocab.orange', [80, 74], [86, 82], [64, 84]) : tail2('vocab.orange', [62, 82], [76, 85], [84, 78])),
    belly: 'surface.paper',
  },
  monkey: {
    key: 'animal-monkey',
    f: 'vocab.brown',
    s: 0.42,
    tail: (p) =>
      p === 'run'
        ? [...tail2('vocab.brown', [26, 56], [16, 46], [20, 36], 5), limb([20, 36], [26, 38], 5, fur('vocab.brown'))]
        : p === 'sleep'
          ? tail2('vocab.brown', [80, 74], [88, 64], [82, 56], 5)
          : [...tail2('vocab.brown', [62, 82], [78, 85], [85, 77], 5), limb([85, 77], [80, 72], 5, fur('vocab.brown'))],
    belly: 'feedback.nudgeLight',
  },
};

/** Running, side view to the right: front legs reach forward, hind legs push back, motion lines behind. */
function run(b: Beast): WordArtShape[] {
  const leg = (a: Pt, z: Pt): WordArtShape => limb(a, z, 8, fur(b.f));
  return [
    groundShadow(50, 86, 28),
    SPEED,
    ...b.tail('run'),
    leg([58, 64], [74, 72]),
    leg([34, 64], [22, 74]),
    ellipse(46, 58, 22, 12, fur(b.f)),
    ...(b.marks ? b.marks(46, 60) : []),
    leg([60, 64], [70, 80]),
    leg([34, 64], [30, 81]),
    ...faceOf(b.key, 68, 44, b.s, false, b.drop),
  ];
}

/** Swimming, side on to the right: the body level in open water, a front leg reaching ahead at the surface, a kick splash behind. */
function swim(b: Beast): WordArtShape[] {
  return up([
    SWIM_SPEED,
    ...b.tail('swim'),
    ellipse(42, 61, 21, 8, fur(b.f)),
    ...SEA,
    ...faceOf(b.key, 60, 50, b.s * 1.05, false, [...(b.drop ?? []), 'hoya.cheek']),
    limb([70, 62], [85, 59], 9, fur(b.f)),
    ...STROKE_SPLASH,
  ]);
}

/** Asleep: lying down with the head on the front paws, eyes closed, a crescent moon. */
function sleep(b: Beast): WordArtShape[] {
  return [
    groundShadow(52, 85, 32),
    ...moon(74, 26, 10),
    ...b.tail('sleep'),
    ellipse(58, 70, 26, 13, fur(b.f)),
    ...(b.marks ? b.marks(60, 72) : []),
    ellipse(30, 80, 8, 4.5, fur(b.f)),
    ellipse(44, 81, 8, 4.5, fur(b.f)),
    ...faceOf(b.key, 34, 63, b.s * 1.12, true, b.drop),
  ];
}

/** Eating, sitting up: the food held at the mouth in both paws, a bite taken out of it. */
function eat(b: Beast, food: WordArtShape[]): WordArtShape[] {
  return [
    groundShadow(50, 87, 24),
    ...b.tail('eat'),
    ellipse(50, 70, 20, 16, fur(b.f)),
    ...(b.belly ? [ellipse(50, 73, 11, 10, { f: b.belly })] : []),
    ellipse(37, 85, 8, 4, fur(b.f)),
    ellipse(63, 85, 8, 4, fur(b.f)),
    ...faceOf(b.key, 50, 41, b.s * 1.08, false, b.drop),
    ...food,
  ];
}

/** The birds and the duck are side views to the right; points turned about a centre for a pose that leans. */
const turn = (p: readonly Pt[], deg: number, cx: number, cy: number): Pt[] => {
  const a = (deg * Math.PI) / 180;
  return p.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
};

/** Points on food held from the mouth corner down to the right: `u` along the food from its bitten end, `v` across it. */
const along = (...uv: number[]): Pt[] => turn(pts(...uv).map(([u, v]) => [55 + u, 49 + v] as Pt), 42, 55, 49);
const at1 = (u: number, v: number): Pt => along(u, v)[0]!;
/** Two paws on the food, one each side. */
const paws = (f: WordArtTone): WordArtShape[] => [circle(...at1(10, -6), 4.5, fur(f)), circle(...at1(17, 6), 4.5, fur(f))];

/** A carrot, its tip bitten off, with its leaves (the rabbit). */
const carrot = (): WordArtShape[] => [
  leaf(...at1(25, -2), ...at1(33, -9), 3, { f: 'vocab.green', ...DETAIL }),
  leaf(...at1(25, 2), ...at1(34, 6), 3, { f: 'vocab.green', ...DETAIL }),
  poly(along(1, -3, 26, -6.5, 26, 6.5, 1, 3), fur('vocab.orange'), 2),
  path(`M ${along(9, -4, 9, -1).map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')} M ${along(16, 2, 16, 5).map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')}`, DETAIL),
  ...paws('vocab.white'),
];

/** A fish held across the chest in both paws, its head up at the mouth (the cat). */
const fish = (): WordArtShape[] => {
  const f = (...xy: number[]): Pt[] => turn(pts(...xy).map(([x, y]) => [48 + (x - 46) * 1.05, 47 + (y - 52) * 1.05] as Pt), 22, 48, 47);
  const [eye] = f(52, 51);
  return [
    poly(f(68, 52, 80, 43, 77, 52, 80, 61), fur('vocab.skyBlue'), 2),
    blob(f(45, 52, 52, 45, 62, 44, 70, 52, 62, 60, 52, 59), fur('vocab.skyBlue')),
    path(`M ${f(58, 47, 58, 57).map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')}`, DETAIL),
    circle(eye![0], eye![1], 2.2, { f: 'text.primary' }),
    ...f(50, 61, 66, 62).map(([x, y]) => circle(x, y, 4, fur('vocab.orange'))),
  ];
};

/** A half-peeled banana beside the face, its cream top bitten flat at the mouth corner, the peel in two flaps, a paw at the stem (the monkey). */
const banana = (): WordArtShape[] => {
  const b = (...xy: number[]): Pt[] => turn(pts(...xy).map(([x, y]) => [x - 5, y] as Pt), -30, 63, 60);
  const [p0, p1, p2] = b(68, 56, 59, 66, 77, 66);
  return [
    poly(b(62, 45, 74, 45, 74, 58, 62, 58), fur('feedback.nudgeLight'), 4),
    blob(b(61, 54, 75, 54, 74, 68, 70, 78, 66, 78, 62, 68), fur('vocab.yellow')),
    ...[p1, p2].map((q) => leaf(p0![0], p0![1], q![0], q![1], 3.5, fur('vocab.yellow'))),
    circle(...b(68, 74)[0]!, 5, fur('vocab.brown')),
  ];
};

/**
 * The blue bird of `animal-bird`, its body at (x, y) with scale 1, leaning by
 * `deg`: tail, body, belly, a folded wing (or none, when the caller draws the
 * wings up), the beak with the smiling mouth line, one eye (closed when asleep).
 */
function bird(x: number, y: number, deg: number, o: { wing?: boolean; asleep?: boolean } = {}): WordArtShape[] {
  const t = (p: readonly Pt[]): Pt[] => turn(p.map(([px, py]) => [px - 52 + x, py - 50 + y] as Pt), deg, x, y);
  const [eye] = t([[63, 40]]);
  const [w0, w1] = t(pts(58, 50, 32, 60));
  return [
    poly(t(pts(32, 58, 13, 46, 14, 56, 30, 68)), fur('vocab.blue'), 3),
    blob(t(pts(50, 27, 66, 31, 74, 46, 70, 62, 56, 71, 40, 69, 30, 58, 30, 42, 37, 31)), fur('vocab.blue')),
    blob(t(pts(46, 60, 58, 52, 68, 56, 64, 66, 52, 68)), { f: 'vocab.skyBlue' }),
    ...(o.wing === false ? [] : [leaf(w0![0], w0![1], w1![0], w1![1], 7, { f: 'vocab.skyBlue', ...DETAIL })]),
    poly(t(pts(72, 40, 84, 45, 72, 50)), { f: 'hoya.fur', ...DETAIL }, 1.5),
    curve(t(pts(65, 47, 68.5, 49.5, 72.5, 48)), DETAIL),
    o.asleep ? arc(eye![0], eye![1] - 1.5, 5, 20, 160, INK) : circle(eye![0], eye![1], 3, { f: 'text.primary' }),
  ];
}

/** The yellow duck of `animal-duck`, its body centred on (x, y). */
function duck(x: number, y: number, o: { wing?: boolean; asleep?: boolean } = {}): WordArtShape[] {
  const p = (...xy: number[]): Pt[] => pts(...xy).map(([px, py]) => [px - 48 + x, py - 62 + y] as Pt);
  const q = (px: number, py: number): Pt => [px - 48 + x, py - 62 + y];
  const [hx, hy] = q(64, 36);
  const [ex, ey] = q(68, 33);
  return [
    blob(p(20, 48, 34, 55, 50, 53, 63, 49, 76, 57, 72, 70, 54, 76, 34, 74, 25, 64), fur('vocab.yellow')),
    ...(o.wing === false ? [] : [leaf(...q(36, 60), ...q(58, 61), 6, { f: 'vocab.yellow', ...DETAIL })]),
    circle(hx, hy, 13, fur('vocab.yellow')),
    poly(p(74, 35, 87, 37, 87, 42, 74, 43), { f: 'vocab.orange', ...DETAIL }, 2.5),
    curve(p(66.5, 42, 70, 44, 73.5, 42.5), DETAIL),
    o.asleep ? arc(ex, ey - 1.5, 5, 20, 160, INK) : circle(ex, ey, 2.8, { f: 'text.primary' }),
    circle(...q(60, 41), 3, { f: 'hoya.cheek' }),
  ];
}

/** A wing raised from the back (x, y) up and backwards, with two feather lines: the flyer's near wing. */
const wingUp = (x: number, y: number, f: WordArtTone): WordArtShape[] => [
  path(`M ${x + 8} ${y} Q ${x - 2} ${y - 30} ${x - 30} ${y - 34} Q ${x - 24} ${y - 26} ${x - 28} ${y - 20} Q ${x - 20} ${y - 16} ${x - 22} ${y - 9} Q ${x - 10} ${y - 8} ${x - 8} ${y + 2} Z`, fur(f)),
  path(`M ${x - 4} ${y - 8} L ${x - 18} ${y - 22} M ${x - 2} ${y - 2} L ${x - 14} ${y - 11}`, DETAIL),
];

/** The people: a paper head with a hair cap and a smile (`pose.ts`), clothes and hair carry the cues (C12). */
interface Person {
  hair: WordArtTone;
  clothes: WordArtTone;
  shoes: WordArtTone;
  /** A ponytail behind the head, at (dx, dy) from the head's centre. */
  tail?: boolean;
  r: number;
}

const PEOPLE: Readonly<Record<string, Person>> = {
  // the younger sibling: a child, short black hair, a green top, blue shoes
  sibling: { hair: 'text.primary', clothes: 'vocab.green', shoes: 'vocab.blue', r: 11 },
  // the friend: a ponytail in brown, a blue top, red shoes
  friend: { hair: 'vocab.brown', clothes: 'brand.secondary', shoes: 'vocab.red', tail: true, r: 10 },
};

const personHead = (p: Person, x: number, y: number, side = -1): WordArtShape[] => [
  ...(p.tail ? [leaf(x + side * 8, y - 4, x + side * 22, y + 4, 4.5, fur(p.hair))] : []),
  ...head(x, y, p.r, p.hair),
];

/** Running, like `sport-running`: leaning forward in mid-stride, motion lines behind. */
function personRun(p: Person): WordArtShape[] {
  const c = fur(p.clothes);
  return [
    groundShadow(48, 87, 22),
    path('M 14 42 H 24 M 10 52 H 22 M 14 62 H 24', DETAIL),
    limb([46, 58], [36, 70], 9, INK_FILL),
    limb([36, 70], [26, 74], 9, INK_FILL),
    ellipse(24, 76, 6, 3.5, fur(p.shoes)),
    limb([50, 40], [41, 47], 7, c),
    limb([41, 47], [37, 56], 7, c),
    hand([37, 57]),
    limb([48, 58], [55, 37], 15, c),
    limb([50, 58], [62, 68], 9, INK_FILL),
    limb([62, 68], [58, 82], 9, INK_FILL),
    ellipse(62, 84, 7, 3.5, fur(p.shoes)),
    limb([56, 41], [65, 48], 7, c),
    limb([65, 48], [72, 40], 7, c),
    hand([73, 39]),
    ...personHead(p, 60, 24),
  ];
}

/** Swimming: the head and shoulders above the water, one arm reaching forward in a crawl stroke, splashes. */
function personSwim(p: Person): WordArtShape[] {
  const [face0, cap, ...face] = personHead({ ...p, r: 12 }, 54, 50).slice(p.tail ? 1 : 0);
  const k = 12 / 18;
  const lens = (dx: number): WordArtShape => circle(54 + dx * 9 * 0.85 * k, 50 + 2 * k, 4, { f: 'vocab.skyBlue', ...DETAIL });
  return up([
    SWIM_SPEED,
    ...KICK,
    limb([34, 62], [24, 58], 8, { f: 'surface.paper', ...INK }),
    limb([34, 62], [60, 60], 14, fur(p.clothes)),
    ...SEA,
    ...(p.tail ? [leaf(46, 46, 32, 52, 4.5, fur(p.hair))] : []),
    face0!,
    cap!,
    lens(-1),
    lens(1),
    ...face,
    limb([64, 61], [80, 58], 8, fur(p.clothes)),
    hand([83, 58], 4.5),
    ...STROKE_SPLASH,
  ]);
}

/** Eating: sitting with a bowl of rice in one hand and a spoon to the mouth in the other. */
function personEat(p: Person): WordArtShape[] {
  const c = fur(p.clothes);
  return [
    groundShadow(50, 87, 28),
    ellipse(35, 79, 13, 7, INK_FILL),
    ellipse(65, 79, 13, 7, INK_FILL),
    poly(pts(38, 46, 62, 46, 66, 78, 34, 78), c, 6),
    limb([39, 50], [36, 58], 7, c),
    limb([61, 50], [68, 60], 7, c),
    limb([68, 60], [64, 48], 7, c),
    ...personHead(p, 50, 31, 1),
    path('M 25 55 A 13 10 0 0 0 51 55 Z', fur('vocab.red')),
    path('M 27 55 Q 38 44 49 55 Z', { f: 'surface.paper', ...DETAIL }),
    hand([38, 64]),
    line(64, 46, 59, 39, INK),
    ellipse(57.5, 37.5, 3.5, 2.5, INK_FILL),
    hand([64, 47]),
  ];
}

/** The bird and the duck, drawn picture by picture. */
const FLYERS: Readonly<Record<string, () => WordArtShape[]>> = {
  // the bird: up among the clouds with its wing raised; pecking seeds on the ground; asleep on a branch under the moon
  'act-fly-bird': () => [cloud(26, 84, 0.8), cloud(76, 86, 0.6), path('M 12 50 H 20 M 14 58 H 22', DETAIL), ...bird(56, 54, -12, { wing: false }), ...wingUp(52, 48, 'vocab.skyBlue')],
  'act-eat-bird': () => [groundShadow(50, 84, 28), ...bird(40, 58, 38), ...pts(69, 77, 76, 81, 64, 82).map(([x, y]) => ellipse(x, y, 4, 3, { f: 'vocab.brown', ...DETAIL }))],
  'act-sleep-bird': () => [...moon(72, 22, 9), path('M 44 70 V 78 M 54 70 V 78', INK), ...bird(48, 50, 0, { asleep: true }), poly(pts(14, 76, 86, 76, 86, 83, 14, 83), fur('vocab.brown'), 3.5)],
  // the duck: on the water with its wake; up in the air with its wing raised; asleep on the ground under the moon
  'act-swim-duck': () => up([path('M 17 54 Q 13 59 17 64 M 23 52 Q 19 57 22 61', DETAIL), ...duck(50, 58), ...SEA]),
  'act-fly-duck': () => [cloud(26, 86, 0.8), cloud(76, 88, 0.6), path('M 12 50 H 20 M 14 58 H 22', DETAIL), ...duck(50, 54, { wing: false }), ...wingUp(48, 52, 'vocab.yellow')],
  'act-sleep-duck': () => [groundShadow(50, 84, 30), ...moon(22, 26, 9), ...duck(50, 66, { asleep: true })],
};

/** What each eater holds at its mouth. */
const FOOD: Readonly<Record<string, () => WordArtShape[]>> = { rabbit: carrot, cat: fish, monkey: banana };

/** One picture by its key (`act-<predicate>-<noun>`): the four-legged animals and the people by pose, the flyers one by one. */
function draw(key: string): WordArtShape[] {
  const [, act, noun] = key.split('-') as [string, string, string];
  const person = PEOPLE[noun];
  if (person) return act === 'run' ? personRun(person) : act === 'swim' ? personSwim(person) : personEat(person);
  const beast = BEASTS[noun];
  if (beast) return act === 'run' ? run(beast) : act === 'swim' ? swim(beast) : act === 'sleep' ? sleep(beast) : eat(beast, FOOD[noun]!());
  return FLYERS[key]!();
}

/** Every action picture, by the family table's keys (`ACT_KEYS`, registry.ts), so the names and the drawings cannot drift. */
export const ACT_GLYPHS: Readonly<Record<string, WordArtGlyph>> = Object.fromEntries(ACT_KEYS.map((k) => [k, draw(k)]));

/** Hand the action pictures to the registry (the level check's chunk calls this when it loads); returns their entries. */
export const loadActWordArt = (): Readonly<Record<string, WordArtEntry>> => addWordArt(['act', ACT_GLYPHS]);
