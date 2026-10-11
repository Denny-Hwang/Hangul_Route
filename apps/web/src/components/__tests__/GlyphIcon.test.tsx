import { iconGlyphs } from '@hangul-route/design-system/icon-glyphs';
import { colors } from '@hangul-route/design-system/tokens';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlyphIcon } from '../landing/GlyphIcon';

/** The landing's plain-DOM twin of the design-system Icon (design/components/Icon/spec.md): same glyph data, tokens only. */
describe('GlyphIcon', () => {
  it('draws every part of the glyph on the 24-unit grid, decorative', () => {
    const html = renderToStaticMarkup(<GlyphIcon name="speaker" size={36} />);
    expect(html).toMatch(/^<svg[^>]* width="36" height="36" viewBox="0 0 24 24"[^>]* aria-hidden="true"/);
    expect(html.match(/<path /g)).toHaveLength(iconGlyphs.speaker.length);
    for (const part of iconGlyphs.speaker) expect(html).toContain(`d="${part.d}"`);
  });

  it('fills solid parts and strokes outlined ones with round caps, in the token colour', () => {
    const html = renderToStaticMarkup(<GlyphIcon name="speaker" color={colors.brand.primary} />);
    expect(html).toContain(`fill="${colors.brand.primary}"`);
    expect(html).toContain(`stroke="${colors.brand.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`);
    expect(renderToStaticMarkup(<GlyphIcon name="check" />)).toContain('stroke-width="2.6"');
  });

  it('defaults to 24 px in the primary text colour', () => {
    const html = renderToStaticMarkup(<GlyphIcon name="check" />);
    expect(html).toContain('width="24"');
    expect(html).toContain(`stroke="${colors.text.primary}"`);
  });
});
