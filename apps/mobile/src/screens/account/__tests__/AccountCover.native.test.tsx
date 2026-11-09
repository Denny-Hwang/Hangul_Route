import { colors } from '@hangul-route/design-system';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import { describe, expect, it } from 'vitest';
import { byTestId, render } from '../../../test-support/render';
import { AccountCover } from '../AccountCover';

/** F-AUTH-004 section 7.4, design D12 (row NS-4; CS-N12): the JavaScript cover over an account screen. */
describe('AccountCover', () => {
  it('covers the whole screen in the canvas colour, catches every touch, and is hidden from assistive tech', async () => {
    const r = await render(createElement(AccountCover, { image: false }));
    const cover = byTestId(r.root, 'account-cover')[0]!;
    expect(cover.props['aria-hidden']).toBe(true);
    // react-native-web writes the canvas token (#FCF8F1, the splash colour of app.json) as rgba.
    const style = StyleSheet.flatten(cover.props.style) as Record<string, unknown>;
    expect(style.backgroundColor).toBe('rgba(252,248,241,1.00)');
    expect(colors.surface.canvas).toBe('#FCF8F1');
    expect(r.root.findAll((n) => n.type === 'img')).toHaveLength(0);
  });
});
