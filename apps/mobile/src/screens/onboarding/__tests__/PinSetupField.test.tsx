import { getMessages } from '@hangul-route/i18n';
import { afterEach, describe, expect, it } from 'vitest';
import { PIN_SETUP_START } from '../../../logic/onboarding/pin-setup';
import { PIN_LENGTH } from '../../../logic/profiles/pin-hash';
import { cleanup, hostNodes, render } from '../../../test-support/render';
import { PinSetupField } from '../../../components/PinSetupField';

/**
 * AMENDMENTS-A11Y-CI AC-1 (axe `aria-prohibited-attr`): the dots row carries "2 of 4 digits entered", so it needs a
 * role that allows a name. It is an image: the dots are a picture of how far the PIN has got.
 */
const a11y = getMessages('en').a11y;
afterEach(cleanup);

describe('PinSetupField dots row', () => {
  it('names the dots with a role that allows a name', async () => {
    const r = await render(<PinSetupField heading="Create a PIN" state={{ ...PIN_SETUP_START, entry: '12' }} onChange={() => undefined} />);
    const rows = hostNodes(r.root, (n) => n.props['aria-label'] === a11y.pinDots(2, PIN_LENGTH));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((n) => n.props.role === 'img')).toBe(true);
  });
});
