import { layout, touchTarget } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../../test-support/render';
import { ControlBar, type ControlBarProps } from '../ControlBar';
import { PresenterViewProvider } from '../presenter-context';
import { NEXT_MIN_WIDTH } from '../stage-metrics';

/**
 * The docked More sheet's focus return (AMENDMENTS-PRESENTER-NAV section 5.1, row PN-3): when a wider
 * window no longer needs More, the band closes its sheet and More leaves the band in the same pass, so
 * the remembered opener is gone; focus then goes to Next, a control that stays, never to the page body.
 * The web `rememberFocus` reports a removed opener as `false`; this file stands that in for the render lane.
 */
const restored = { value: true };
vi.mock('../../../platform/presenter', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../platform/presenter')>();
  return { ...original, rememberFocus: () => () => restored.value };
});

const noop = (): void => undefined;

function bar(overrides: Partial<ControlBarProps>): React.ReactElement {
  const props: ControlBarProps = {
    hidden: false,
    revealNext: false,
    muted: false,
    fullscreenSupported: true,
    fullscreen: false,
    onPrev: noop,
    onNext: noop,
    onSound: noop,
    onFullscreen: noop,
    onExit: noop,
    onTimer: noop,
    onBlank: noop,
    onGrid: noop,
    onHelp: noop,
    chips: [],
    onTurnSoundOn: noop,
    onFocusWithin: noop,
    ...overrides,
  };
  return (
    <PresenterViewProvider value={{ messages: getMessages('es'), locale: 'es', unit: 1, reducedMotion: true }}>
      <ControlBar {...props} />
    </PresenterViewProvider>
  );
}

function layoutOf(node: ReactTestInstance, width: number): void {
  act(() => {
    (node.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width, height: touchTarget.hero } } });
  });
}

const ES: Record<string, number> = {
  'presenter-back': touchTarget.hero,
  'presenter-next': NEXT_MIN_WIDTH,
  'presenter-exit': 96,
  'presenter-fullscreen': 144,
  'presenter-grid-button': 130,
  'presenter-blank-button': 96,
  'presenter-timer': 142,
  'presenter-sound': 96,
};

function measure(r: ReactTestRenderer, windowWidth: number): void {
  const row = r.root.find((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-bar-docked' && typeof n.props.onLayout === 'function');
  layoutOf(row, windowWidth - 2 * layout.gutter.regular);
  for (const [id, width] of Object.entries(ES)) {
    const node = r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id && typeof n.props.onLayout === 'function')[0];
    if (node) layoutOf(node, width);
  }
}

/** Each host node gets a `focus` spy; the Next button's is kept apart. */
function nodeMocks(): { nextFocus: ReturnType<typeof vi.fn>; createNodeMock: (element: React.ReactElement) => unknown } {
  const nextFocus = vi.fn();
  return {
    nextFocus,
    createNodeMock: (element: React.ReactElement) => {
      const p = element.props as Record<string, unknown>;
      return {
        focus: p['data-testid'] === 'presenter-next' || p.testID === 'presenter-next' ? nextFocus : vi.fn(),
        addEventListener: noop,
        removeEventListener: noop,
      };
    },
  };
}

describe('the docked More sheet gives focus to Next when More leaves the band', () => {
  it('a wider window closes the sheet and More with it: focus goes to Next', async () => {
    restored.value = false;
    const { nextFocus, createNodeMock } = nodeMocks();
    let open = true;
    const onMore = vi.fn((next: boolean) => {
      open = next;
    });
    const r = await render(bar({ moreOpen: open, onMore }), { createNodeMock });
    measure(r, 768);
    expect(r.root.findAll((n) => n.props.testID === 'presenter-more-sheet').length).toBeGreaterThan(0);
    expect(nextFocus).not.toHaveBeenCalled();
    measure(r, 1920);
    expect(r.root.findAll((n) => n.props.testID === 'presenter-more-sheet')).toHaveLength(0);
    expect(nextFocus).toHaveBeenCalledTimes(1);
    expect(onMore).toHaveBeenCalledWith(false);
  });

  it('a sheet closed while More stays (Close, Esc, a tool) gives focus back to More, not Next', async () => {
    restored.value = true;
    const { nextFocus, createNodeMock } = nodeMocks();
    const r = await render(bar({ moreOpen: true }), { createNodeMock });
    measure(r, 768);
    await act(async () => {
      r.update(bar({ moreOpen: false }));
    });
    expect(r.root.findAll((n) => n.props.testID === 'presenter-more-sheet')).toHaveLength(0);
    expect(nextFocus).not.toHaveBeenCalled();
  });
});
