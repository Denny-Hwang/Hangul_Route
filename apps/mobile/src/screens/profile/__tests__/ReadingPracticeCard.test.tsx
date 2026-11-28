import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-test-renderer';
import { getMessages } from '@hangul-route/i18n';

/**
 * AMENDMENTS-ROMANIZATION-FADE row RF-2, section 3.10 and section 6 test 10 (mock
 * `design/screens/profile/reading-practice.md` Panel A): the Reading practice card is a radiogroup of three radios that
 * shows the stored choice, stores a press at once, names each radio by its label alone with the hint as its description,
 * keeps every row at least `touchTarget.min` high, and on the web (only) has one Tab stop and moves with the keys.
 */
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/storage', async (importOriginal) => ({ ...(await importOriginal<object>()), writeJson: vi.fn(async () => undefined) }));

import { touchTarget } from '@hangul-route/design-system';
import { ReadingPracticeCard } from '../../../components/ReadingPracticeCard';
import { romanizationChoiceOf } from '../../../logic/locale/romanization-mode';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, cleanup, press, render, resetPlatform, setPlatform, textOf } from '../../../test-support/render';

const ID = 'profile:mina';
const m = getMessages('en').learner.profile.reading;

const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const found = byTestId(root, id);
  expect(found, id).toHaveLength(1);
  return found[0]!;
};

async function key(node: ReactTestInstance, name: string): Promise<{ prevented: boolean }> {
  const onKeyDown = node.props.onKeyDown as ((event: unknown) => void) | undefined;
  if (onKeyDown === undefined) throw new Error('no key handler');
  const out = { prevented: false };
  // The event as react-native-web's press responder and the card's own handler both receive it.
  const target = { getAttribute: (attr: string): unknown => node.props[attr] ?? null, tagName: String(node.type) };
  await act(async () => {
    onKeyDown({ key: name, target, currentTarget: target, nativeEvent: {}, preventDefault: () => (out.prevented = true), stopPropagation: () => undefined });
  });
  return out;
}

beforeEach(() => {
  setPlatform('web');
  useLocaleStore.setState({ byProfile: {}, device: 'en' });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

const checkedOf = (root: ReactTestInstance): string[] =>
  (['auto', 'always', 'tap'] as const).filter((c) => one(root, `reading-practice-${c}`).props['aria-checked'] === true);

describe('Reading practice card: what it shows', () => {
  it('is a radiogroup named by its visible label, with the three radios in order, and no other text', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    const group = one(r.root, 'reading-practice-group');
    expect(group.props.role).toBe('radiogroup');
    expect(group.props['aria-labelledby']).toBe('reading-practice-label');
    expect(group.props['aria-label']).toBe(m.groupLabel);
    const radios = ['auto', 'always', 'tap'].map((c) => one(r.root, `reading-practice-${c}`));
    expect(radios.map((n) => n.props.role)).toEqual(['radio', 'radio', 'radio']);
    expect(radios.map((n) => n.props['aria-label'])).toEqual([m.auto.label, m.always.label, m.tap.label]);
    expect(textOf(r.root)).toContain(m.title);
    expect(textOf(r.root)).toContain(m.groupLabel);
    expect(textOf(r.root)).toContain(m.auto.hint);
    expect(m.auto.label).toBe('As I learn');
  });

  it('a profile with no record shows the default, As I learn, checked', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    expect(checkedOf(r.root)).toEqual(['auto']);
  });

  it.each([
    ['a legacy stored always (the old switch Off, or a filled value) reads as the default', { romanizationMode: 'always' as const }, 'auto'],
    ['a legacy stored tap stays Only when I tap', { romanizationMode: 'tap' as const }, 'tap'],
    ['a stored Always choice', { romanizationMode: 'always' as const, romanizationChoice: 'always' as const }, 'always'],
    ['a stored As I learn choice', { romanizationMode: 'always' as const, romanizationChoice: 'auto' as const }, 'auto'],
    ['a stored Only when I tap choice', { romanizationMode: 'tap' as const, romanizationChoice: 'tap' as const }, 'tap'],
  ])('%s', async (_, stored, expected) => {
    useLocaleStore.setState({ byProfile: { [ID]: stored } });
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    expect(checkedOf(r.root)).toEqual([expected]);
    expect(expected).toBe(romanizationChoiceOf(stored));
  });

  it('every radio states checked or not, in both attributes, and each row is at least touchTarget.min high', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    for (const c of ['auto', 'always', 'tap']) {
      const node = one(r.root, `reading-practice-${c}`);
      expect(typeof node.props['aria-checked']).toBe('boolean');
      const style = node.props.style as Record<string, unknown>;
      // react-native-web writes a pixel string
      expect(Number.parseInt(String(style.minHeight), 10)).toBeGreaterThanOrEqual(touchTarget.min);
    }
  });

  it('the hint is the description of As I learn only, and the name is the label alone', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    const auto = one(r.root, 'reading-practice-auto');
    expect(auto.props['aria-describedby']).toBe('reading-practice-hint-auto');
    expect(auto.props['aria-label']).toBe(m.auto.label);
    expect(auto.props['aria-label']).not.toContain(m.auto.hint);
    expect(one(r.root, 'reading-practice-always').props['aria-describedby']).toBeUndefined();
    expect(one(r.root, 'reading-practice-tap').props['aria-describedby']).toBeUndefined();
  });
});

describe('Reading practice card: choosing', () => {
  it('a press stores the choice with its mirror at once, per profile, and moves the check', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    await press(one(r.root, 'reading-practice-tap'));
    expect(useLocaleStore.getState().byProfile[ID]).toEqual({ romanizationMode: 'tap', romanizationChoice: 'tap' });
    expect(checkedOf(r.root)).toEqual(['tap']);
    await press(one(r.root, 'reading-practice-always'));
    expect(useLocaleStore.getState().byProfile[ID]).toEqual({ romanizationMode: 'always', romanizationChoice: 'always' });
    expect(checkedOf(r.root)).toEqual(['always']);
    await press(one(r.root, 'reading-practice-auto'));
    expect(useLocaleStore.getState().byProfile[ID]).toEqual({ romanizationMode: 'always', romanizationChoice: 'auto' });
    expect(checkedOf(r.root)).toEqual(['auto']);
    expect(useLocaleStore.getState().byProfile['profile:other']).toBeUndefined();
  });

  it('keeps the profile’s other settings when it chooses', async () => {
    useLocaleStore.setState({ byProfile: { [ID]: { romanizationMode: 'always', readToMe: true, challengeMode: true } } });
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    await press(one(r.root, 'reading-practice-tap'));
    expect(useLocaleStore.getState().byProfile[ID]).toMatchObject({ readToMe: true, challengeMode: true, romanizationChoice: 'tap' });
  });
});

describe('Reading practice card: the web keys (RF-0b Q3)', () => {
  it('one Tab stop: only the checked radio has tabIndex 0', async () => {
    useLocaleStore.setState({ byProfile: { [ID]: { romanizationMode: 'always', romanizationChoice: 'always' } } });
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    const stops = (['auto', 'always', 'tap'] as const).map((c) => one(r.root, `reading-practice-${c}`).props.tabIndex);
    expect(stops).toEqual([-1, 0, -1]);
  });

  it('the arrows, Home and End move the choice and store it at once; Space and Enter choose the focused row', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    const auto = (): ReactTestInstance => one(r.root, 'reading-practice-auto');
    expect((await key(auto(), 'ArrowDown')).prevented).toBe(true);
    expect(checkedOf(r.root)).toEqual(['always']);
    expect(useLocaleStore.getState().byProfile[ID]?.romanizationChoice).toBe('always');
    await key(one(r.root, 'reading-practice-always'), 'End');
    expect(checkedOf(r.root)).toEqual(['tap']);
    await key(one(r.root, 'reading-practice-tap'), 'Home');
    expect(checkedOf(r.root)).toEqual(['auto']);
    await key(auto(), 'ArrowUp');
    expect(checkedOf(r.root)).toEqual(['tap']);
    // Space chooses the focused row and does not scroll the page
    await key(one(r.root, 'reading-practice-tap'), 'Home');
    const space = await key(one(r.root, 'reading-practice-auto'), ' ');
    expect(space.prevented).toBe(true);
    expect(checkedOf(r.root)).toEqual(['auto']);
  });

  it('a key that is not the group’s is left alone', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    const out = await key(one(r.root, 'reading-practice-auto'), 'Tab');
    expect(out.prevented).toBe(false);
    expect(useLocaleStore.getState().byProfile[ID]).toBeUndefined();
  });
});

describe('Reading practice card: native', () => {
  it.each(['ios', 'android'] as const)('on %s no row is taken out of the tab order (tabIndex -1 is focusable={false} on Android, DN-2b)', async (os) => {
    setPlatform(os);
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    for (const c of ['auto', 'always', 'tap']) {
      expect(one(r.root, `reading-practice-${c}`).props.tabIndex).not.toBe(-1);
    }
  });

  it('on the web an unchecked row is out of the tab order (the contrast with native)', async () => {
    const r = await render(<ReadingPracticeCard profileId={ID} />);
    expect(one(r.root, 'reading-practice-tap').props.tabIndex).toBe(-1);
  });
});
