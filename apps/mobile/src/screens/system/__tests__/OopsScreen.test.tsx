import { Screen } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buttonsNamed, press, render, screenTexts } from '../../../test-support/render';
import { OopsScreen } from '../OopsScreen';

/**
 * The crash screen ("Hoya tripped over a rock", `learner.oops`) is the learner's only way out of a failed render or a
 * lesson chunk that cannot load, so its one action must never sit below the first screen. At 320 x 568 and the
 * largest text step, the tiger, the title, the line and the bubble fill the screen; as the last child of the scrolling
 * body the button started below the fold (measured at y 778 of 568) and nothing said to scroll. It is the Screen's
 * footer, which stays in view.
 */
const messages = getMessages('en');
const TRY_AGAIN = messages.common.buttons.tryAgain;

describe('OopsScreen', () => {
  it('draws the tiger, the warm lines and Try again, and Try again retries', async () => {
    const onRetry = vi.fn();
    const r = await render(<OopsScreen onRetry={onRetry} />);
    const texts = screenTexts(r.root);
    expect(texts).toContain(messages.learner.oops.title);
    expect(texts).toContain(messages.learner.oops.body);
    expect(texts).toContain(messages.learner.oops.bubble);
    const [again] = buttonsNamed(r.root, TRY_AGAIN);
    expect(again).toBeDefined();
    await press(again!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('pins its action in the Screen footer, outside the scrolling body, with a given label too', async () => {
    const r = await render(<OopsScreen onRetry={() => undefined} actionLabel="Back to the lesson page" />);
    const footer = r.root.findByType(Screen).props.footer as unknown;
    expect(isValidElement(footer)).toBe(true);
    expect((footer as { props: { label?: string } }).props.label).toBe('Back to the lesson page');
    expect(buttonsNamed(r.root, 'Back to the lesson page')).toHaveLength(1);
    expect(buttonsNamed(r.root, TRY_AGAIN)).toHaveLength(0);
  });
});
