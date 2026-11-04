import { borderWidth, colors, radii, spacing, touchTarget } from '../../tokens';
import { REALIA_CARD_MIN_WIDTH, REALIA_TOP_DRESSING } from './style';
import type { RealiaAddedKind } from './types';

/**
 * Pure looks behind `RealiaKindSheet`, the eight realia layouts of F-CURR-002 row CM-47
 * (design/screens/minigame-realia-read/README.md D9-D12, design/wireframes/minigame/realia-read.md "The eight kinds").
 * Tokens only; the named constants are derived from tokens. Reached by its own path (never a barrel), so the start
 * bundle carries none of it: the learner's chunk (`screen-chunk:realia-kinds`) and the presenter read it.
 */

/** The CM-47 kinds, in the order of `REALIA_KINDS` (content-schema). */
export const REALIA_ADDED_KINDS = ['recipe', 'receipt', 'label', 'forecast', 'calendar', 'timetable', 'map', 'poster'] as const satisfies readonly RealiaAddedKind[];

/** Whether a kind is one of CM-47's (drawn by `RealiaKindSheet`). */
export function isRealiaAddedKind(kind: string): kind is RealiaAddedKind {
  return (REALIA_ADDED_KINDS as readonly string[]).includes(kind);
}

/**
 * The four shapes the eight kinds share: `rows` (text at the start of a row, its value at the end), `tiles` (the
 * price-card grid: cards that wrap and stack), `legend` (a drawn map above a list of places, each with a pin) and
 * `poster` (lines centred one under the other).
 */
export type RealiaAnatomy = 'rows' | 'tiles' | 'legend' | 'poster';

/** A receipt is a narrow strip: four hero targets wide at most, centred in its column. */
export const REALIA_RECEIPT_MAX_WIDTH = touchTarget.hero * 4;
/** The torn edge under a receipt. */
export const REALIA_EDGE_HEIGHT = spacing.md;
/** A calendar day's minimum width before the days stack: a hero target (a two-digit date and a short word). */
export const REALIA_DAY_MIN_WIDTH = touchTarget.hero;
/** The drawn park above a map's places. */
export const REALIA_MAP_HEIGHT = touchTarget.hero;
/** The pin before each place of a map (the Icon row size). */
export const REALIA_PIN_SIZE = spacing.xl;

export interface RealiaKindDressing {
  /** A `REALIA_KIND_REGISTRY` prop. */
  ref: string;
  height: number;
  /** Stretched to the sheet's width, else kept at its aspect ratio (`centered` or at the start). */
  stretch: boolean;
  centered?: boolean;
  /** The strip's ground behind the drawing (a timetable's and a forecast's band); none: the canvas. */
  band?: string;
}

export interface RealiaKindLook {
  anatomy: RealiaAnatomy;
  top?: RealiaKindDressing;
  /** Drawn under the sheet (a receipt's torn edge). */
  bottom?: RealiaKindDressing;
  /** The sheet the lines sit on (on tiles, the board under the tiles). */
  paper: { backgroundColor: string; borderColor: string; borderWidth: number; borderRadius: number };
  /** What lies between two rows: a solid rule, a dashed rule, or nothing. */
  rule: 'solid' | 'dashed' | 'none';
  /** A dotted leader between a row's text and its value. */
  leader: boolean;
  centeredTitle: boolean;
  /** A tile's minimum width before the tiles stack (tiles only). */
  tileMin?: number;
  /** The sheet's greatest width (a receipt), else its column's width. */
  maxWidth?: number;
}

const paper = (borderColor: string, width: number = borderWidth.base, radius: number = radii.md, backgroundColor: string = colors.surface.paper) => ({
  backgroundColor,
  borderColor,
  borderWidth: width,
  borderRadius: radius,
});
const strip = (ref: string, extra: Partial<RealiaKindDressing> = {}): RealiaKindDressing => ({ ref, height: REALIA_TOP_DRESSING, stretch: false, ...extra });

/** Each CM-47 kind's anatomy, dressing and surface (README D9-D12). */
export const REALIA_KIND_LOOKS: Readonly<Record<RealiaAddedKind, RealiaKindLook>> = {
  // A recipe card: a bowl and utensils above, a rule under each line, a leader to its amount.
  recipe: { anatomy: 'rows', top: strip('prop:realia-recipe-bowl', { centered: true }), paper: paper(colors.text.secondary), rule: 'solid', leader: true, centeredTitle: true },
  // A receipt: a narrow strip with square corners, a dashed rule between lines and a torn edge below.
  receipt: {
    anatomy: 'rows',
    bottom: { ref: 'prop:realia-receipt-edge', height: REALIA_EDGE_HEIGHT, stretch: true },
    paper: paper(colors.border.strong, borderWidth.base, radii.none),
    rule: 'dashed',
    leader: false,
    centeredTitle: true,
    maxWidth: REALIA_RECEIPT_MAX_WIDTH,
  },
  // A packaged-food label: a box and a jar above, a thick frame and a rule between lines.
  label: { anatomy: 'rows', top: strip('prop:realia-label-pack', { centered: true }), paper: paper(colors.text.primary, borderWidth.thick, radii.sm), rule: 'solid', leader: false, centeredTitle: false },
  // A weather card: a sun and a rain cloud on a sky band, day tiles on the sky board.
  forecast: {
    anatomy: 'tiles',
    top: strip('prop:realia-forecast-sky', { band: colors.brand.secondaryLight }),
    paper: paper(colors.border.strong, borderWidth.base, radii.md, colors.brand.secondaryLight),
    rule: 'none',
    leader: false,
    centeredTitle: false,
    tileMin: REALIA_CARD_MIN_WIDTH,
  },
  // A calendar page: the bound top with its rings, day tiles on the page.
  calendar: {
    anatomy: 'tiles',
    top: strip('prop:realia-calendar-rings', { stretch: true }),
    paper: paper(colors.text.secondary),
    rule: 'none',
    leader: false,
    centeredTitle: true,
    tileMin: REALIA_DAY_MIN_WIDTH,
  },
  // A timetable or station board: a clock on a band, the time in its own column, a rule between rows.
  timetable: { anatomy: 'rows', top: strip('prop:realia-timetable-clock', { band: colors.brand.secondaryLight }), paper: paper(colors.text.secondary), rule: 'solid', leader: false, centeredTitle: false },
  // A park map: the drawn park above, each place with a pin and a leader to its value.
  map: { anatomy: 'legend', top: { ref: 'prop:realia-map-park', height: REALIA_MAP_HEIGHT, stretch: true }, paper: paper(colors.text.secondary), rule: 'none', leader: true, centeredTitle: false },
  // A poster: bunting above, a thick frame, every line centred.
  poster: { anatomy: 'poster', top: strip('prop:realia-poster-bunting', { stretch: true }), paper: paper(colors.theme.rites, borderWidth.thick, radii.sm), rule: 'none', leader: false, centeredTitle: true },
};

/** The rule between two rows of a kind (none on the first row). */
export function realiaRowRule(look: Pick<RealiaKindLook, 'rule'>, index: number): { borderTopWidth: number; borderStyle: 'solid' | 'dashed'; borderColor: string } {
  const drawn = index > 0 && look.rule !== 'none';
  return { borderTopWidth: drawn ? borderWidth.thin : 0, borderStyle: look.rule === 'dashed' ? 'dashed' : 'solid', borderColor: colors.border.strong };
}

/** A tile's surface: white paper on the kind's board (a forecast's sky, a calendar's page). */
export const REALIA_TILE = { backgroundColor: colors.surface.paper, borderColor: colors.border.strong, borderWidth: borderWidth.base, borderRadius: radii.sm } as const;
