import { borderWidth, layout, presenter, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import {
  CTL_MAX_FACTOR,
  EXIT_DIALOG_REM,
  NEXT_MIN_FACTOR,
  HELP_W_REM,
  KBD_MIN_REM,
  KEY_COL_REM,
  READABLE_LINE_REM,
  RING_CORNER_FACTOR,
  STATUS_MIN_REM,
  THUMB_H_REM,
  THUMB_W_REM,
  START_BUTTON_FACTOR,
  STATE_HOYA_FACTOR,
  PHONE_COMPACT_WIDTH,
  barBand,
  type PhoneRule,
} from '../../logic/lecture/stage-constants';
import type { StageBounds } from '../../logic/lecture/stage-scale';

/**
 * The presenter's layout numbers with the design tokens applied (design/screens/presenter/README.md
 * "Constants"): the named factors and rem counts of `logic/lecture/stage-constants.ts` times their
 * tokens. Stage numbers are in units; the rest are real pixels.
 */

/** `presenter.stage` and the compact breakpoint for `stageScale` (spec section 3.6 amendment). */
export const STAGE_BOUNDS: StageBounds = { ...presenter.stage, compactWidth: layout.breakpoint.regular };
/** A phone window's stage: the same stage, judged too small only below `PHONE_COMPACT_WIDTH` (README Constants). */
export const PHONE_STAGE_BOUNDS: StageBounds = { ...presenter.stage, compactWidth: PHONE_COMPACT_WIDTH };
/** The design system's phone form factor (`layout.phoneShortSide`, `layout.phoneMaxLongSide`). */
export const PHONE_RULE: PhoneRule = { shortSide: layout.phoneShortSide, maxLongSide: layout.phoneMaxLongSide };
/** No text below `typography.size.body` anywhere (README D2). */
export const TEXT_FLOOR = typography.size.body;
/** 120 px: `touchTarget.hero + 2 x spacing.md` (README D1). */
export const BAR_BAND = barBand(touchTarget.hero, spacing.md);

/** Every slide keeps this margin inside the stage, in units. */
export const STAGE_PADDING = spacing.xxxl;
/** Gap between slide parts, and inside a part, in units. */
export const STAGE_GAP = spacing.xxxl;
export const STAGE_GAP_INNER = spacing.xl;
/** Borders on the stage, in units: a 1 or 2 px border vanishes on a projector. */
export const STAGE_BORDER = borderWidth.thick;
export const STAGE_RADIUS = radii.xl;
/** The thinnest a stage border draws in real pixels, however small the unit. */
export const STAGE_BORDER_MIN = borderWidth.base;

export const CTL_MAX_WIDTH = CTL_MAX_FACTOR * touchTarget.hero;
export const NEXT_MIN_WIDTH = NEXT_MIN_FACTOR * touchTarget.hero;
/** The compact (phone) bar's Next / Reveal: 1.5 x `touchTarget.min`. */
export const NEXT_MIN_WIDTH_COMPACT = NEXT_MIN_FACTOR * touchTarget.min;
export const START_BUTTON_HEIGHT = START_BUTTON_FACTOR * touchTarget.hero;
export const STATE_HOYA = STATE_HOYA_FACTOR * touchTarget.hero;
/** A teacher page's readable column (the start screen). */
export const TEACHER_COLUMN = layout.maxWidth.reading;
export const READABLE_LINE = READABLE_LINE_REM * typography.size.bodySm;
export const EXIT_DIALOG_WIDTH = EXIT_DIALOG_REM * typography.size.bodySm;

/** PR 9's class tools in real pixels (README Constants). */
export const RING_CORNER = RING_CORNER_FACTOR * spacing.lg;
export const THUMB_WIDTH = THUMB_W_REM * typography.size.bodySm;
export const THUMB_HEIGHT = THUMB_H_REM * typography.size.bodySm;
export const HELP_WIDTH = HELP_W_REM * typography.size.bodySm;
export const KEY_COL = KEY_COL_REM * typography.size.bodySm;
export const KBD_MIN = KBD_MIN_REM * typography.size.bodySm;
export const STATUS_MIN = STATUS_MIN_REM * typography.size.bodySm;
