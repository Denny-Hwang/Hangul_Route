import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { Linking } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { LicensesLink } from '../LicensesLink';

/**
 * "Open-source notices" at the foot of Profiles & settings (owner decision 2026-10-14; wireframe
 * design/wireframes/site/licenses.md, "In the app"): a link to the site's /licenses page, and a calm line when no
 * browser opens.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  useLocaleStore.setState({ device: 'en', session: null, byProfile: {} });
});

const en = getMessages('en').learner.profile.licenses;

describe('LicensesLink', () => {
  it('is a link named "Open-source notices" that opens /licenses on the site', async () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const r = await render(<LicensesLink url="https://hangulroute.com/licenses" />);
    const [link] = byTestId(r.root, 'profile-licenses-link');
    expect(link).toBeDefined();
    expect(link!.props.role).toBe('link');
    expect(link!.props['aria-label']).toBe(en.label);
    await press(link!);
    expect(open).toHaveBeenCalledWith('https://hangulroute.com/licenses');
    expect(screenTexts(r.root)).not.toContain(en.fallback);
    await unmount(r);
  });

  it('says where the page is when no browser opens', async () => {
    vi.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    const r = await render(<LicensesLink url="https://hangulroute.com/licenses" />);
    await press(byTestId(r.root, 'profile-licenses-link')[0]!);
    expect(screenTexts(r.root)).toContain(en.fallback);
    await unmount(r);
  });

  it.each(['es', 'ko'] as const)('reads in %s', async (locale) => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    useLocaleStore.setState({ device: locale, session: null, byProfile: {} });
    const r = await render(<LicensesLink url="https://hangulroute.com/licenses" />);
    expect(screenTexts(r.root)).toContain(getMessages(locale).learner.profile.licenses.label);
    await unmount(r);
  });
});
