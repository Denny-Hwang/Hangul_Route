import { hoyaVariantColors } from '@hangul-route/design-system/tokens';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AvatarChip } from '../AvatarChip';

/** F-LEARN-001 §3.6: 28 px circle, variant shade, English label as aria-label, no name or initial. */
describe('AvatarChip', () => {
  it('is a 28 px circle in the cub\'s shade with the English label as its accessible name', () => {
    const html = renderToStaticMarkup(<AvatarChip avatar="hoya-blue" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Home Tiger"');
    expect(html).toContain('width:28px');
    expect(html).toContain('height:28px');
    expect(html.toLowerCase()).toContain(`background-color:${hoyaVariantColors('blue').furDark.toLowerCase()}`);
  });

  it('carries no text, so no name or initial can leak when the class hides names', () => {
    const html = renderToStaticMarkup(<AvatarChip avatar="hoya-pink" />);
    expect(html.replace(/<[^>]+>/g, '')).toBe('');
  });

  it('is decorative (hidden from assistive tech) for an unknown avatar string', () => {
    const html = renderToStaticMarkup(<AvatarChip avatar="hoya-teal" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-label');
  });
});
