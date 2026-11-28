import { getMessages } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactTestRenderer } from 'react-test-renderer';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { ContrastOptionExtras } from '../ContrastOptionExtras';

/**
 * What an answered contrast round adds under an option, once it lives in the contrast chunk (AMENDMENTS-START-BUNDLE-2026-11
 * row SB-4b). It is a fragment: the option's column spaces the line and the button, so a wrapping view would add a second gap.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('ContrastOptionExtras', () => {
  it('draws the kind line and the Hear it button as two siblings, with no view around them', async () => {
    const r = await render(<ContrastOptionExtras optionId="b" kindLine="Breathy, starts higher." sound="ka" onHear={() => undefined} />);
    mounted.push(r);
    const tree = r.toJSON();
    expect(Array.isArray(tree)).toBe(true);
    expect(tree).toHaveLength(2);
  });

  it('keeps its test ids, its line and its labels', async () => {
    const m = getMessages('en');
    const r = await render(<ContrastOptionExtras optionId="b" kindLine="Breathy, starts higher." sound="ka" onHear={() => undefined} />);
    mounted.push(r);
    expect(textOf(byTestId(r.root, 'contrast-kind-b')[0]!)).toBe('Breathy, starts higher.');
    const hear = byTestId(r.root, 'contrast-hear-b').find((n) => n.props['aria-label'] !== undefined)!;
    expect(hear.props['aria-label']).toBe(m.a11y.minigame.hear('ka'));
    expect(textOf(hear)).toContain(m.learner.audio.hearIt.cta);
  });

  it('a tap on Hear it calls the board\'s player', async () => {
    const onHear = vi.fn();
    const r = await render(<ContrastOptionExtras optionId="a" kindLine="Soft." sound="ga" onHear={onHear} />);
    mounted.push(r);
    await press(byTestId(r.root, 'contrast-hear-a')[0]!);
    expect(onHear).toHaveBeenCalledTimes(1);
  });
});
