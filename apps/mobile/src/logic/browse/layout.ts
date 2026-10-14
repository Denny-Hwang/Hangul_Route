/**
 * All lessons sizes that are not tokens (F-BROWSE-001 sections 4.7 and 7;
 * `design/screens/browse/README.md`, Constants). Each is derived from a token
 * or measured on the mock, and named once here.
 */

/** `maxFontSizeMultiplier` of the preview strip text, its Leave preview label and the section control: 1.3 x body (23.4). */
export const BROWSE_TEXT_SCALE_CAP = 1.3;

/**
 * The preview strip's height ceiling, measured on the mock at 320 wide with 200 % text. No runtime code
 * reads it: BR-8's `browse.spec.ts` measures the mounted `PreviewFrame` against it (F-BROWSE-001 section 10).
 */
export const PREVIEW_STRIP_MAX_HEIGHT = 135;

/** Full-width actions stop at 26rem (26 x 16) from the regular class, as in the mock's `.actions .btn`. */
export const BROWSE_ACTION_MAX_WIDTH = 416;

/** The section control's track from the regular class: at most 30rem (30 x 16). */
export const BROWSE_SECTION_TRACK_MAX = 480;

/** The Library gallery card face: CardArt's gallery slot at the compact class. */
export const BROWSE_GALLERY_FACE = 132;

/** The item page's facts label column from the regular class (8rem). */
export const BROWSE_LABEL_COLUMN = 128;

/** A centred dialog sheet (Lesson display, Leave preview) from the regular class: at most 32rem. */
export const BROWSE_DIALOG_MAX = 512;

/**
 * The window height from which a phone's pinned action bar also holds [ Present this ] (BR-13): the
 * two `lg` buttons and their gap measure 168 on the mock, and pinned they stay at most 35 % of the
 * window. Below it (a phone in landscape) only the preview stays pinned and Present this ends the page.
 */
export const BROWSE_PIN_SECONDARY_MIN_HEIGHT = 480;
