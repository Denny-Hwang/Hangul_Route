import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LicensesPage } from '../../components/landing/LicensesPage';
import { THIRD_PARTY_NOTICES, assetLicenses, licenseGroups, type ThirdPartyNotices } from '../../lib/third-party-notices';
import EnLicensesPage from '../(en)/licenses/page';
import LocLicensesPage from '../(loc)/[locale]/licenses/page';

/**
 * `/licenses` (owner decision 2026-10-14: the proprietary LICENSE; wireframe design/wireframes/site/licenses.md):
 * every production dependency of the shipped apps, with its license, copyright line and the license text, from the
 * data `scripts/third-party-notices.mjs` generates (its `--check` keeps the data current in CI).
 */
const en = getMessages('en').landing;
const escapeText = (text: string): string => renderToStaticMarkup(<>{text}</>);

const SMALL: ThirdPartyNotices = {
  packages: [
    { name: 'b-lib', version: '2.0.0', license: 'MIT', copyright: 'Copyright (c) 2020 B', usedIn: ['app', 'web'] },
    { name: 'a-lib', version: '1.0.0', license: 'Apache-2.0', copyright: 'Copyright 2019 A', usedIn: ['server'] },
    { name: 'c-lib', version: '3.0.0', license: 'MIT', note: 'MIT chosen from (MIT OR CC0-1.0)', copyright: '(no copyright line in the package)', usedIn: ['app'] },
  ],
  assets: [{ path: 'fonts/x.woff2', source: 'X Sans', url: 'https://example.com/x', license: 'OFL-1.1', attribution: 'Copyright 2020 X' }],
  notices: [{ name: 'a-lib', version: '1.0.0', text: 'A lib\nCopyright 2019 A' }],
  licenses: [
    { id: 'Apache-2.0', name: 'Apache License 2.0', text: 'Apache License Version 2.0' },
    { id: 'MIT', name: 'MIT License', text: 'MIT License text' },
    { id: 'OFL-1.1', name: 'SIL Open Font License 1.1', text: 'SIL OPEN FONT LICENSE Version 1.1' },
  ],
};

describe('licenseGroups and assetLicenses', () => {
  it('groups packages by license, the largest group first, and leaves the font license to assetLicenses', () => {
    const groups = licenseGroups(SMALL);
    expect(groups.map((g) => [g.license.id, g.packages.map((p) => p.name)])).toEqual([
      ['MIT', ['b-lib', 'c-lib']],
      ['Apache-2.0', ['a-lib']],
    ]);
    expect(assetLicenses(SMALL).map((l) => l.id)).toEqual(['OFL-1.1']);
  });

  it('breaks a tie by license id', () => {
    const tie: ThirdPartyNotices = { ...SMALL, packages: SMALL.packages.filter((p) => p.name !== 'c-lib') };
    expect(licenseGroups(tie).map((g) => g.license.id)).toEqual(['Apache-2.0', 'MIT']);
  });

  it('refuses data with a license that has no text (regenerate the notices)', () => {
    expect(() => licenseGroups({ ...SMALL, licenses: SMALL.licenses.filter((l) => l.id !== 'MIT') })).toThrow(/no text for MIT/);
  });

  it('the generated data names every license its packages and assets use', () => {
    const ids = new Set(THIRD_PARTY_NOTICES.licenses.map((l) => l.id));
    for (const p of THIRD_PARTY_NOTICES.packages) expect(ids.has(p.license), `${p.name}@${p.version}`).toBe(true);
    for (const a of THIRD_PARTY_NOTICES.assets) expect(ids.has(a.license), a.path).toBe(true);
    expect(THIRD_PARTY_NOTICES.licenses.every((l) => l.text.length > 0)).toBe(true);
  });
});

describe('LicensesPage', () => {
  it('shows the proprietary line, each package with its copyright line and where it ships, and each license text', () => {
    const html = renderToStaticMarkup(<LicensesPage locale="en" notices={SMALL} />);
    expect(html).toContain(`<h1 style="`);
    expect(html).toContain(escapeText(en.licenses.title));
    expect(html).toContain(escapeText(`${en.licenses.notOpen} ${en.licenses.copyright}`));
    expect(html).toContain('<strong>b-lib</strong> 2.0.0');
    expect(html).toContain(escapeText('Copyright (c) 2020 B'));
    expect(html).toContain(escapeText(`${en.licenses.usedIn}: ${en.licenses.where.app}, ${en.licenses.where.web}`));
    expect(html).toContain(escapeText('MIT chosen from (MIT OR CC0-1.0)'));
    expect(html).toContain('MIT License (2)');
    expect(html).toContain('Apache License 2.0 (1)');
    expect(html).toContain('MIT License text');
    expect(html).toContain(escapeText(`${en.licenses.fullText}: SIL Open Font License 1.1`));
    expect(html).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(html).toContain(escapeText(en.licenses.noticesTitle));
    expect(html).toContain('A lib\nCopyright 2019 A');
    // English page: no English-authoritative line, no lang marks.
    expect(html).not.toContain('data-testid="english-authoritative"');
    expect(html).not.toContain('lang="en"');
  });

  it('leaves out the NOTICE section when no package ships a NOTICE file', () => {
    const html = renderToStaticMarkup(<LicensesPage locale="en" notices={{ ...SMALL, notices: [] }} />);
    expect(html).not.toContain(escapeText(en.licenses.noticesTitle));
  });

  it.each(['es', 'ko'] as const)('/%s: its own words around the list, which stays English legal text marked lang="en"', (locale) => {
    const t = getMessages(locale).landing;
    const html = renderToStaticMarkup(<LicensesPage locale={locale} notices={SMALL} />);
    expect(html).toContain('data-testid="english-authoritative"');
    expect(html).toContain(escapeText(t.legal.englishAuthoritative));
    expect(html).toContain(escapeText(t.licenses.title));
    expect(html).toContain(`<section lang="en" data-license="MIT"`);
    expect(html).toContain(`lang="${locale}">${escapeText(`${t.licenses.usedIn}: ${t.licenses.where.app}`)}`);
  });

  it('the routes render every package of the generated notices', () => {
    const html = renderToStaticMarkup(<EnLicensesPage />);
    for (const p of THIRD_PARTY_NOTICES.packages) expect(html).toContain(`<strong>${escapeText(p.name)}</strong> ${escapeText(p.version)}`);
    const ko = renderToStaticMarkup(<LocLicensesPage params={{ locale: 'ko' }} />);
    expect(ko).toContain(escapeText(getMessages('ko').landing.licenses.title));
  });
});
