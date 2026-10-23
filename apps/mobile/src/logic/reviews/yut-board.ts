/**
 * The Yut Review board (F-CURR-002 section 7.1 F10, sections 7.5 and 7.7, row CM-39; design
 * design/wireframes/minigame/yut-review.md, design/screens/minigame-variety/ D9 and board B): pure rules, 100 % tested.
 *
 * Play only. Every finished review item throws the four yut sticks once (and again on 윷 or 모), whatever its result,
 * and the throw moves the learner's piece round the board. The throw is seeded by the session and the item's place in
 * it: the board is a function of those two alone, so no answer reaches it and the board never shows a miss, and
 * nothing it returns is a star, a point, a card or any other reward. The board state is not saved, synced or sent.
 *
 * What the board draws on (sourced; the skin shows no sources row, wireframe Navigation graph):
 * - the five throws and how far each moves, with another throw on 윷 and 모: the Encyclopedia of Korean Culture,
 *   "윷놀이" (Academy of Korean Studies, https://encykorea.aks.ac.kr/Article/E0042794, accessed 2026-10-09: "도는 한 발,
 *   개는 두 발, 걸은 세 발, 윷은 네 발, 모는 다섯 발을 간다", "모나 윷이 나오면 한번 더 할 수가 있으며"), as fact f8 of
 *   `content/stories/seollal-new-year.json`, with the Standard Korean Language Dictionary (National Institute of Korean
 *   Language) entries for the names;
 * - four wooden sticks thrown to move pieces on a board: the Korea Heritage Service portal, 국가무형유산 윷놀이 (fact f7);
 * - a board of 29 stations, pieces starting from the entrance and leaving by the exit, four pieces to a side: the same
 *   encyclopedia article (accessed 2026-10-21: "윷판은 29개의 동그라미로 되어 있다").
 * Left out on purpose, so every claim stays inside the sources: another side or player, capturing, a backward move,
 * the inner routes (the piece walks the outer ring of 20) and any rule on which way up a stick counts.
 */

/** The switch (section 12.2): built-in pct 0, so the skin merges dark; off, the plain review screen. */
export const YUT_REVIEW_FLAG = 'game.yut-review' as const;

export type ThrowName = 'do' | 'gae' | 'geol' | 'yut' | 'mo';

export interface YutThrow {
  name: ThrowName;
  /** The throw's name, taught Korean: always drawn with its romanization. */
  ko: string;
  /** Revised Romanization from the F-CNT-002 converter (`romanizeWord`, checked by the test). */
  romanization: string;
  /** Stations the piece moves. */
  stations: 1 | 2 | 3 | 4 | 5;
  /** 윷 and 모 give another throw. */
  again: boolean;
}

export const THROW_NAMES: readonly [ThrowName, ...ThrowName[]] = ['do', 'gae', 'geol', 'yut', 'mo'];

export const YUT_THROWS: Readonly<Record<ThrowName, YutThrow>> = {
  do: { name: 'do', ko: '도', romanization: 'do', stations: 1, again: false },
  gae: { name: 'gae', ko: '개', romanization: 'gae', stations: 2, again: false },
  geol: { name: 'geol', ko: '걸', romanization: 'geol', stations: 3, again: false },
  yut: { name: 'yut', ko: '윷', romanization: 'yut', stations: 4, again: true },
  mo: { name: 'mo', ko: '모', romanization: 'mo', stations: 5, again: true },
};

/**
 * How often each throw comes up: the counts of four sticks that each land one of two ways with even odds (1, 4, 6, 4,
 * 1 of 16). A play weight, not a claim about real sticks (the sources do not give one) or about which side counts.
 */
export const THROW_WEIGHTS: Readonly<Record<ThrowName, number>> = { do: 4, gae: 6, geol: 4, yut: 1, mo: 1 };

/**
 * At most this many throws for one item: the last one allowed is drawn from 도, 개 and 걸 only, so a chain always ends
 * on a throw that gives no other, and the board never holds the next item back.
 */
export const MAX_THROWS_PER_ITEM = 3;

/** The board's stations (the encyclopedia article): 20 on the edge, 6 to a side with shared corners, 9 on the cross. */
export const BOARD_STATIONS = 29;
/** The outer ring the piece walks. */
export const OUTER_STATIONS = 20;
/** Each side has four pieces: the home tray draws up to four, then starts again (wireframe, Laps). */
export const TRAY_PIECES = 4;

export interface Station {
  x: number;
  y: number;
}

/** The drawing's viewBox side; stations sit on a 10 to 110 square, 20 apart on the edge. */
export const BOARD_VIEW = 120;
const NEAR = 10;
const FAR = 110;
const GAP = 20;
const STEPS_PER_SIDE = 5;

function outerRing(): Station[] {
  const out: Station[] = [];
  // From the start (bottom right): up the right side, left along the top, down the left side, right along the bottom.
  for (let i = 0; i < STEPS_PER_SIDE; i += 1) out.push({ x: FAR, y: FAR - GAP * i });
  for (let i = 0; i < STEPS_PER_SIDE; i += 1) out.push({ x: FAR - GAP * i, y: NEAR });
  for (let i = 0; i < STEPS_PER_SIDE; i += 1) out.push({ x: NEAR, y: NEAR + GAP * i });
  for (let i = 0; i < STEPS_PER_SIDE; i += 1) out.push({ x: NEAR + GAP * i, y: FAR });
  return out;
}

function crossLines(): Station[] {
  const mid = BOARD_VIEW / 2;
  const out: Station[] = [{ x: mid, y: mid }];
  for (const [cx, cy] of [
    [NEAR, NEAR],
    [FAR, NEAR],
    [NEAR, FAR],
    [FAR, FAR],
  ] as const) {
    for (const f of [1 / 3, 2 / 3]) out.push({ x: Math.round((cx + (mid - cx) * f) * 10) / 10, y: Math.round((cy + (mid - cy) * f) * 10) / 10 });
  }
  return out;
}

/** The 29 stations: the outer ring first, in walk order from the start (index 0), then the 9 of the two crossing lines. */
export const YUT_STATIONS: readonly Station[] = [...outerRing(), ...crossLines()];

/** The board's lines: the square and its two diagonals (`border.strong`). */
export const BOARD_LINES = `M${NEAR} ${NEAR} H${FAR} V${FAR} H${NEAR} Z M${NEAR} ${NEAR} L${FAR} ${FAR} M${FAR} ${NEAR} L${NEAR} ${FAR}`;

// ---- seeded throws ----------------------------------------------------------------------------------------------

/** FNV-1a over the parts, each closed by a separator and its length, so ['ab', 'c'] differs from ['a', 'bc']. */
export function sessionSeed(parts: readonly string[]): number {
  let h = 0x811c9dc5;
  const mix = (code: number): void => {
    h = Math.imul(h ^ code, 0x01000193);
  };
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) mix(part.charCodeAt(i));
    mix(0x1f);
    mix(part.length & 0xff);
  }
  return h >>> 0;
}

/** mulberry32: floats in [0, 1), the same sequence for the same seed. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One throw from `names` by their weights; the last name takes what the others leave. */
function draw(next: () => number, names: readonly [ThrowName, ...ThrowName[]]): YutThrow {
  const total = names.reduce((s, n) => s + THROW_WEIGHTS[n], 0);
  let r = next() * total;
  const last = names.length - 1;
  for (let i = 0; i < last; i += 1) {
    const name = names[i] as ThrowName;
    r -= THROW_WEIGHTS[name];
    if (r < 0) return YUT_THROWS[name];
  }
  return YUT_THROWS[names[last] as ThrowName];
}

const NO_AGAIN: readonly [ThrowName, ...ThrowName[]] = ['do', 'gae', 'geol'];

/** The throws of the item at `itemIndex` (from 0) in the session `seed`: one, and another after each 윷 or 모. */
export function throwsFor(seed: number, itemIndex: number): YutThrow[] {
  const next = rng(sessionSeed([String(seed), String(itemIndex)]));
  const out: YutThrow[] = [];
  for (;;) {
    const last = out.length === MAX_THROWS_PER_ITEM - 1;
    const t = draw(next, last ? NO_AGAIN : THROW_NAMES);
    out.push(t);
    if (!t.again) return out;
  }
}

// ---- the piece --------------------------------------------------------------------------------------------------

export interface BoardState {
  /** The piece's station on the outer ring, 0 (the start) to 19. */
  position: number;
  /** Pieces that went home this session. */
  laps: number;
}

export const BOARD_START: BoardState = Object.freeze({ position: 0, laps: 0 });

export interface Walk {
  /** The stations the piece steps onto, in order; a piece that goes home ends on the start. */
  path: number[];
  to: BoardState;
  /** The piece reached the start again: a token goes to the home tray and a new piece starts there. */
  home: boolean;
}

/** Moves the piece `steps` stations forward; reaching the start again takes it home (the steps left over are not used). */
export function walk(from: BoardState, steps: number): Walk {
  const path: number[] = [];
  for (let s = 1; s <= steps; s += 1) {
    const at = (from.position + s) % OUTER_STATIONS;
    path.push(at);
    if (at === 0) return { path, to: { position: 0, laps: from.laps + 1 }, home: true };
  }
  return { path, to: { position: (from.position + steps) % OUTER_STATIONS, laps: from.laps }, home: false };
}

export interface Leg extends Walk {
  throw: YutThrow;
}

export interface Move {
  from: BoardState;
  /** One leg per throw of the chain, in order. */
  legs: Leg[];
  to: BoardState;
}

/** The move of the item at `itemIndex`, from `from`: each throw of its chain walks in turn. */
export function moveFor(seed: number, itemIndex: number, from: BoardState): Move {
  const legs: Leg[] = [];
  let at = from;
  for (const t of throwsFor(seed, itemIndex)) {
    const w = walk(at, t.stations);
    legs.push({ throw: t, ...w });
    at = w.to;
  }
  return { from, legs, to: at };
}

export interface Board {
  state: BoardState;
  /** The last finished item's move; null before the first. */
  last: Move | null;
  /** One per finished item. */
  throwCount: number;
}

/** The board after `finished` items of the session `seed` have finished, whatever their results. */
export function boardAfter(seed: number, finished: number): Board {
  let state: BoardState = BOARD_START;
  let last: Move | null = null;
  const n = Math.max(0, Math.floor(finished));
  for (let i = 0; i < n; i += 1) {
    last = moveFor(seed, i, state);
    state = last.to;
  }
  return { state, last, throwCount: n };
}

/** The pieces the home tray draws: none before the first lap, then 1 to 4, and the fifth lap starts the tray again. */
export function homeTray(laps: number): number {
  return laps <= 0 ? 0 : ((laps - 1) % TRAY_PIECES) + 1;
}

// ---- what the band shows, frame by frame ------------------------------------------------------------------------

export interface Frame {
  /** How many legs (throws) of the move are shown. */
  legs: number;
  /** The piece's station. */
  position: number;
  /** Pieces home so far (the tray draws `homeTray(laps)`). */
  laps: number;
  /** How long to wait after the frame before it shows (ms). */
  delay: number;
}

export interface FrameTimes {
  /** The sticks fall before the piece starts (`motion.duration.base`). */
  fall: number;
  /** Each station of the walk (`motion.duration.fast`). */
  step: number;
  /** Before another throw after 윷 or 모 (`motion.duration.slow`). */
  again: number;
}

/**
 * The frames of a move: each throw shows, the sticks fall, the piece walks station by station, and after 윷 or 모 the
 * next throw follows by itself. With reduced motion there is one frame: every throw at once and the piece at its station.
 */
export function moveFrames(move: Move, times: FrameTimes, reducedMotion: boolean): Frame[] {
  if (reducedMotion) return [{ legs: move.legs.length, position: move.to.position, laps: move.to.laps, delay: 0 }];
  const out: Frame[] = [];
  let at = move.from;
  move.legs.forEach((leg, i) => {
    out.push({ legs: i + 1, position: at.position, laps: at.laps, delay: i === 0 ? 0 : times.again });
    leg.path.forEach((station, k) => {
      const home = leg.home && k === leg.path.length - 1;
      out.push({ legs: i + 1, position: station, laps: home ? leg.to.laps : at.laps, delay: k === 0 ? times.fall : times.step });
    });
    at = leg.to;
  });
  return out;
}

/** How long a move's frames take on screen: the sum of their delays (ms). */
export function framesDuration(frames: readonly Frame[]): number {
  return frames.reduce((total, f) => total + f.delay, 0);
}
