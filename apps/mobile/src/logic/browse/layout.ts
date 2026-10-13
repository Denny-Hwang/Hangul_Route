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
