// F-TCH-004 §3.6 (PR 3): the presenter font's @font-face in the HTML shell and the
// precache guard that keeps it available offline.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as designTokens from '@hangul-route/design-system/tokens';
import {
  PRESENTER_FONT_FILE,
  PRESENTER_FONT_URL,
  assertPresenterFontPrecached,
  presenterFontFace,
} from '../pwa/presenter-font.mjs';

const here = dirname(fileURLToPath(import.meta.url));

describe('presenterFontFace', () => {
  const css = presenterFontFace(designTokens.presenter.font);

  it('names the family from the presenter token and loads the committed subset as woff2', () => {
    expect(css).toContain(`font-family: "${designTokens.presenter.font}";`);
    expect(css).toContain(`src: url("${PRESENTER_FONT_URL}") format("woff2");`);
    expect(PRESENTER_FONT_URL).toBe(`/${PRESENTER_FONT_FILE}`);
  });

  it('declares the bold face with font-display: block (no flash of a system Hangul font on a projector)', () => {
    expect(css).toContain('font-weight: 700;');
    expect(css).toContain('font-style: normal;');
    expect(css).toContain('font-display: block;');
    expect(css).toMatch(/@font-face \{[^}]*font-display: block;[^}]*\}/);
  });

  it('points at the file expo copies from public/', () => {
    expect(existsSync(join(here, '..', '..', 'public', ...PRESENTER_FONT_FILE.split('/')))).toBe(true);
  });

  it('refuses a family name that could break out of the CSS string', () => {
    for (const bad of ['', 'A"B', "A'B", 'A\\B', 'A;B', 'A}B', 'A<B', 'A\nB']) {
      expect(() => presenterFontFace(bad), JSON.stringify(bad)).toThrow(/presenter font family/);
    }
  });
});

describe('assertPresenterFontPrecached', () => {
  it('passes when the font is in the precache manifest', () => {
    expect(() => assertPresenterFontPrecached(['index.html', PRESENTER_FONT_FILE, 'sw.js'])).not.toThrow();
  });

  it('fails the build when the font is missing, so the presenter never goes offline without it', () => {
    expect(() => assertPresenterFontPrecached(['index.html', 'sw.js'])).toThrow(
      `pwa-postbuild: the presenter font is not in the learner precache: ${PRESENTER_FONT_FILE}`,
    );
  });
});
