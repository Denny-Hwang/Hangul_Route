import { getMessages, LOCALES } from '@hangul-route/i18n';
import type { ReactTestInstance } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { HELP_TOUCH } from '../../../logic/lecture/help-keys';
import { byTestId, hostNodes, render, textOf } from '../../../test-support/render';
import { HelpOverlay } from '../overlays/HelpOverlay';
import { PresenterViewProvider } from '../presenter-context';

/**
 * Keys and controls gains a Touch and mouse group above the key rows, in every layout (AMENDMENTS-PRESENTER-NAV
 * section 9.2, row PN-3; mock design/screens/presenter/overlays.md "Touch and mouse"): the heading and the lines
 * swipe, buttons, click, keep (`HELP_TOUCH`), in every locale, as plain text that takes no input. The phone line
 * (`help.phoneBar`) stays above it in a phone window only.
 */

async function help(locale: (typeof LOCALES)[number], phone = false) {
  return render(
    <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>
      <HelpOverlay romanization="always" onRomanization={() => undefined} keepVisible={false} onKeepVisible={() => undefined} onClose={() => undefined} phone={phone} />
    </PresenterViewProvider>,
  );
}

/** Every host node with a test id, in document order. */
function ids(root: ReactTestInstance): string[] {
  return hostNodes(root, (n) => typeof n.props['data-testid'] === 'string').map((n) => String(n.props['data-testid']));
}

describe('Help: the Touch and mouse group (section 9.2)', () => {
  it.each(LOCALES)('%s: the heading and the four lines, in order, in the locale', async (locale) => {
    const r = await help(locale);
    const m = getMessages(locale).learner.presenter.help.touch;
    const group = byTestId(r.root, 'presenter-help-touch')[0]!;
    const heading = hostNodes(group, (n) => n.props.role === 'heading')[0]!;
    expect(textOf(heading)).toBe(m.title);
    expect(heading.props['aria-level']).toBe(3);
    expect(HELP_TOUCH.map((row) => textOf(byTestId(group, `presenter-help-touch-${row}`)[0]!))).toEqual([m.swipe, m.buttons, m.click, m.keep]);
    // Plain lines: nothing in the group takes input.
    expect(hostNodes(group, (n) => n.props.role === 'button' || n.props.role === 'switch' || typeof n.props.onClick === 'function')).toEqual([]);
  });

  it('sits above the key rows and the Keep controls visible switch', async () => {
    const r = await help('en');
    const all = ids(r.root);
    const group = all.indexOf('presenter-help-touch');
    expect(group).toBeGreaterThan(-1);
    expect(group).toBeLessThan(all.indexOf('presenter-help-keep-visible'));
    const list = hostNodes(r.root, (n) => n.props.role === 'list')[0]!;
    const order = hostNodes(r.root, (n) => n === list || n.props['data-testid'] === 'presenter-help-touch');
    expect(order[0]!.props['data-testid']).toBe('presenter-help-touch');
  });

  it('shows in every layout; the phone line is added above it in a phone window only', async () => {
    const docked = await help('en');
    expect(byTestId(docked.root, 'presenter-help-touch')).toHaveLength(1);
    expect(byTestId(docked.root, 'presenter-help-phone-bar')).toHaveLength(0);
    const phone = await help('en', true);
    expect(byTestId(phone.root, 'presenter-help-touch')).toHaveLength(1);
    const all = ids(phone.root);
    expect(all.indexOf('presenter-help-phone-bar')).toBeLessThan(all.indexOf('presenter-help-touch'));
  });
});
