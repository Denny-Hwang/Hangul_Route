import { Button, Hoya, Screen, TextSizeProvider, colors } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { isValidElement } from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reader = vi.hoisted(() => ({ announce: vi.fn(), focus: vi.fn() }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: reader.announce, focusForScreenReader: reader.focus }));

import { buttonsNamed, byTestId, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { SaveFailedPage } from '../SaveFailedPage';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME section 3.5 (row LR-4; wireframe `reviews/save-failed.md`, mock `design/screens/
 * quest-leave-resume/` D4 to D6, D12): the words, the one button, the title's focus, a try (busy, never twice, said
 * again when it did not save) and the still-stuck line after 3 tries in a row.
 */

const EN = getMessages('en');
const m = EN.learner.dailyReview.saveFailed;
const ID = 'daily-review-save-failed';

function deferred(): { promise: Promise<boolean>; resolve: (worked: boolean) => void } {
  let resolve!: (worked: boolean) => void;
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const tryButton = (root: ReactTestInstance): ReactTestInstance => buttonsNamed(root, EN.common.buttons.tryAgain)[0] as ReactTestInstance;
const buttonProps = (root: ReactTestInstance): { softDisabled?: boolean; tone?: string; size?: string } =>
  root.findAll((n) => n.type === Button && n.props.label === EN.common.buttons.tryAgain)[0]?.props as { softDisabled?: boolean; tone?: string; size?: string };

beforeEach(() => {
  reader.announce.mockReset();
  reader.focus.mockReset();
});
afterEach(() => {
  resetPlatform();
});

describe('what the page shows', () => {
  it('Hoya thinking, the title, the one line, and Try again as the hero button in the footer; nothing else to press', async () => {
    const r = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
    const texts = screenTexts(r.root);
    expect(texts).toContain('We could not save this yet.');
    expect(texts).toContain('Your answers are still here.');
    expect(texts).not.toContain(m.stillStuck);
    expect(r.root.findByType(Hoya).props.pose).toBe('thinking');
    expect(buttonProps(r.root)).toMatchObject({ tone: 'primary', size: 'hero' });
    expect(buttonsNamed(r.root, EN.common.buttons.tryAgain)).toHaveLength(1);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'button')).toHaveLength(1);
    expect(isValidElement(r.root.findByType(Screen).props.footer)).toBe(true);
  });

  it('never says failed or error, shows no score, no count and no danger colour', async () => {
    const r = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
    const text = screenTexts(r.root).join(' ').toLowerCase();
    expect(text).not.toMatch(/fail|error|wrong|%|\d/);
    expect(JSON.stringify(r.toJSON())).not.toContain(colors.feedback.danger);
  });

  it('Hoya is 140, and 72 at a text scale of 1.5 or more (D12)', async () => {
    const plain = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
    expect(plain.root.findByType(Hoya).props.size).toBe(140);
    const large = await render(
      <TextSizeProvider step="largest">
        <SaveFailedPage onTryAgain={async () => false} testID={ID} />
      </TextSizeProvider>,
    );
    expect(large.root.findByType(Hoya).props.size).toBe(72);
  });
});

describe('focus on open', () => {
  it('web: the title takes the screen reader focus once, when the page opens', async () => {
    const node = (): object => ({ focus: vi.fn(), addEventListener: () => undefined, removeEventListener: () => undefined });
    const title = node();
    // The title's wrapper is the one node focusable by script only (tabIndex -1).
    const createNodeMock = (element: { props: Record<string, unknown> }): object => (element.props.tabIndex === -1 ? title : node());
    const r = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />, { createNodeMock });
    const headings = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'heading');
    expect(headings.map((h) => screenTexts(h).join(''))).toEqual([m.title]);
    expect(reader.focus).toHaveBeenCalledTimes(1);
    expect(reader.focus).toHaveBeenCalledWith(title);
  });

  it('native: focus moves on the next tick, to the one header element', async () => {
    setPlatform('ios');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
      expect(reader.focus).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(reader.focus).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a try', () => {
  it('Try again is soft-disabled and the column busy while it runs, and cannot start a second try', async () => {
    const run = deferred();
    const onTryAgain = vi.fn(() => run.promise);
    const r = await render(<SaveFailedPage onTryAgain={onTryAgain} testID={ID} />);
    await press(tryButton(r.root));
    expect(buttonProps(r.root).softDisabled).toBe(true);
    const busy = (): unknown => byTestId(r.root, `${ID}-body`)[0]?.props['aria-busy'];
    expect(busy()).toBe(true);
    await press(tryButton(r.root));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    run.resolve(false);
    await flush();
    expect(buttonProps(r.root).softDisabled).toBe(false);
    expect(busy()).toBeFalsy();
  });

  it('a try that did not save says the title again once: its live region text changes (web, Android), VoiceOver is told (iOS)', async () => {
    setPlatform('ios');
    const r = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
    const title = (): string => screenTexts(byTestId(r.root, `${ID}-title`)[0] as ReactTestInstance).join('');
    const before = title();
    await press(tryButton(r.root));
    await flush();
    expect(title()).not.toBe(before);
    expect(title().replace(/​/g, '')).toBe(m.title);
    expect(reader.announce).toHaveBeenCalledTimes(1);
    expect(reader.announce).toHaveBeenCalledWith(m.title);
    const live = r.root.findAll((n) => typeof n.type === 'string' && n.props['aria-live'] === 'polite');
    expect(live.length).toBeGreaterThan(0);
  });

  it('a rejected try counts as one that did not save', async () => {
    setPlatform('ios');
    const r = await render(<SaveFailedPage onTryAgain={() => Promise.reject(new Error('x'))} testID={ID} />);
    await press(tryButton(r.root));
    await flush();
    expect(buttonProps(r.root).softDisabled).toBe(false);
    expect(reader.announce).toHaveBeenCalledWith(m.title);
  });

  it('a try that saved says nothing more: the caller takes the page away', async () => {
    setPlatform('ios');
    const r = await render(<SaveFailedPage onTryAgain={async () => true} testID={ID} />);
    await press(tryButton(r.root));
    await flush();
    expect(reader.announce).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).not.toContain(m.stillStuck);
  });
});

describe('the still-stuck line', () => {
  it('fills its polite live region when the third try in a row ends without saving, and stays', async () => {
    const r = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
    const region = (): ReactTestInstance => byTestId(r.root, `${ID}-still-stuck`)[0] as ReactTestInstance;
    expect(region().props['aria-live']).toBe('polite');
    for (let i = 0; i < 2; i += 1) {
      await press(tryButton(r.root));
      await flush();
      expect(screenTexts(region())).toEqual([]);
    }
    await press(tryButton(r.root));
    await flush();
    expect(screenTexts(region())).toEqual(['It still did not save. You can stop for now and try another time.']);
    await press(tryButton(r.root));
    await flush();
    expect(screenTexts(region())).toEqual([m.stillStuck]);
  });

  it('iOS: the third failed try says the still-stuck line with the title (no live regions there)', async () => {
    setPlatform('ios');
    const r = await render(<SaveFailedPage onTryAgain={async () => false} testID={ID} />);
    for (let i = 0; i < 3; i += 1) {
      await press(tryButton(r.root));
      await flush();
    }
    expect(reader.announce.mock.calls.map((c) => c[0])).toEqual([m.title, m.title, `${m.title} ${m.stillStuck}`]);
  });
});
