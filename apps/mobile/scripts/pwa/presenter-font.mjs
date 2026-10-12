// F-TCH-004 §3.6 (TD4, PR 3): the lecture presenter's Hangul subset font in the learner
// shell. `public/fonts/hr-presenter-kr.woff2` (built and checked by
// scripts/build-presenter-font.mjs, SIL OFL 1.1 in public/fonts/OFL.txt) reaches the
// export through expo's public/ copy and the precache through the existing woff2 glob,
// so the presenter draws large Korean offline. The face is declared once in the shell
// CSS; only text that asks for the family (the presenter) ever downloads it.

/** The export path of the font (relative to dist, as the precache manifest lists it). */
export const PRESENTER_FONT_FILE = 'fonts/hr-presenter-kr.woff2';
export const PRESENTER_FONT_URL = `/${PRESENTER_FONT_FILE}`;

/**
 * The @font-face rule for `family` (design-system `presenter.font`). The subset is Noto
 * Sans KR Bold, so the face is weight 700; `font-display: block` keeps a projector from
 * flashing a system Hangul font first (the start screen waits for the load, §3.6).
 */
export function presenterFontFace(family) {
  if (typeof family !== 'string' || !/^[A-Za-z0-9 -]+$/.test(family)) {
    throw new Error(`pwa-postbuild: the presenter font family must be plain letters, digits, spaces or hyphens: ${JSON.stringify(family)}`);
  }
  return `
    /* Lecture presenter Hangul subset (F-TCH-004 §3.6): Noto Sans KR Bold, SIL OFL 1.1 (/fonts/OFL.txt). */
    @font-face {
      font-family: "${family}";
      src: url("${PRESENTER_FONT_URL}") format("woff2");
      font-weight: 700;
      font-style: normal;
      font-display: block;
    }`;
}

/** Fails the build when the font is not precached (the presenter must work offline, §3.8). */
export function assertPresenterFontPrecached(manifestUrls) {
  if (!manifestUrls.includes(PRESENTER_FONT_FILE)) {
    throw new Error(`pwa-postbuild: the presenter font is not in the learner precache: ${PRESENTER_FONT_FILE}`);
  }
}
