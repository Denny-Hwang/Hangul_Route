import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { LicensesLink } from '../LicensesLink';

/**
 * "Open-source notices" at the foot of Profiles & settings (owner decision 2026-10-14; wireframe
 * design/wireframes/site/licenses.md, "In the app"): a link to the site's /licenses page. Leaving the app is a
 * grown-up action (F-STORY-002 §3.8): through the gate where the device has one, then native opens the waiting
 * link and the web asks for one more tap. A calm line when no browser opens.
 */
const focus = vi.hoisted(() => ({ effect: null as null | (() => void | (() => void)) }));

vi.mock('@react-navigation/native', async () => {
  const react = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      focus.effect = effect;
      react.useEffect(() => effect(), [effect]);
    },
  };
});

/** The screen gains focus again (back from the PIN screen). */
async function refocus(): Promise<void> {
  await act(async () => {
    focus.effect?.();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  useLocaleStore.setState({ device: 'en', session: null, byProfile: {} });
});

const URL = 'https://hangulroute.com/licenses';
const en = getMessages('en').learner.profile.licenses;

describe('LicensesLink', () => {
  it('is a link named "Open-source notices" that opens /licenses directly where the gate opens directly', async () => {
    const open = vi.fn().mockResolvedValue('opened');
    const onGate = vi.fn();
    const r = await render(<LicensesLink url={URL} onGate={onGate} opensDirectly={() => true} open={open} />);
    const [link] = byTestId(r.root, 'profile-licenses-link');
    expect(link).toBeDefined();
    expect(link!.props.role).toBe('link');
    expect(link!.props['aria-label']).toBe(en.label);
    await press(link!);
    expect(open).toHaveBeenCalledWith(URL);
    expect(onGate).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).not.toContain(en.fallback);
    await unmount(r);
  });

  it('goes through the grown-up gate where the device has one, and opens nothing before it', async () => {
    const open = vi.fn().mockResolvedValue('opened');
    const onGate = vi.fn();
    const r = await render(<LicensesLink url={URL} onGate={onGate} opensDirectly={() => false} open={open} />);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    expect(onGate).toHaveBeenCalledWith(URL);
    expect(open).not.toHaveBeenCalled();
    await unmount(r);
  });

  it('native: back from the gate with it passed, the waiting link opens by itself', async () => {
    const open = vi.fn().mockResolvedValue('opened');
    let gateOpen = false;
    const r = await render(<LicensesLink url={URL} onGate={() => undefined} opensDirectly={() => gateOpen} open={open} handOffNeedsTap={false} />);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    gateOpen = true;
    await refocus();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(URL);
    await unmount(r);
  });

  it('web: back from the gate with it passed, asks for one more tap (pop-up rules), which then opens', async () => {
    const open = vi.fn().mockResolvedValue('opened');
    let gateOpen = false;
    const r = await render(<LicensesLink url={URL} onGate={() => undefined} opensDirectly={() => gateOpen} open={open} handOffNeedsTap />);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    gateOpen = true;
    await refocus();
    expect(open).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(en.gateDone);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    expect(open).toHaveBeenCalledWith(URL);
    await unmount(r);
  });

  it('a cancelled gate drops the waiting link', async () => {
    const open = vi.fn().mockResolvedValue('opened');
    const r = await render(<LicensesLink url={URL} onGate={() => undefined} opensDirectly={() => false} open={open} handOffNeedsTap={false} />);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    await refocus();
    expect(open).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).not.toContain(en.gateDone);
    await unmount(r);
  });

  it.each(['failed', 'offline'] as const)('says where the page is when the hand-off is %s', async (outcome) => {
    const r = await render(<LicensesLink url={URL} onGate={() => undefined} opensDirectly={() => true} open={vi.fn().mockResolvedValue(outcome)} />);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    expect(screenTexts(r.root)).toContain(en.fallback);
    await unmount(r);
  });

  it.each(['es', 'ko'] as const)('reads in %s', async (locale) => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    useLocaleStore.setState({ device: locale, session: null, byProfile: {} });
    const r = await render(<LicensesLink url={URL} onGate={() => undefined} opensDirectly={() => true} open={vi.fn().mockResolvedValue('opened')} />);
    expect(screenTexts(r.root)).toContain(getMessages(locale).learner.profile.licenses.label);
    await unmount(r);
  });
});
