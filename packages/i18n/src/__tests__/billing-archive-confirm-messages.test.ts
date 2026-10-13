import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { getMessages } from '../resolve';

/**
 * F-BILL-002 B-12 (section 4.6): the lines the space settings archive confirm adds about the plan
 * the archive affects. English is the spec's text; es and ko are written in the same PR (F-I18N-001
 * section 3.10), never a price, never "lifetime", never a grown-up word.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

describe('console.billing.archiveConfirm (B-12)', () => {
  it('English is the spec text of section 4.6', () => {
    const a = en.console.billing.archiveConfirm;
    expect(`${a.familyLoses('Kim family')} ${a.familyRenews}`).toBe('Learners in Kim family lose the Family Plan while it is archived. It keeps renewing until you cancel it in Billing.');
    expect(a.licenseRenews).toBe('The Group License keeps renewing until you cancel it in Billing.');
  });

  it('es and ko are written in their overlays, not English fallbacks', () => {
    for (const [name, overlay] of Object.entries({ es, ko })) {
      const a = overlay.console?.billing?.archiveConfirm;
      expect(a, name).toBeDefined();
      expect(a?.familyLoses?.('Kim family'), name).not.toBe(en.console.billing.archiveConfirm.familyLoses('Kim family'));
      expect(a?.familyRenews, name).not.toBe(en.console.billing.archiveConfirm.familyRenews);
      expect(a?.licenseRenews, name).not.toBe(en.console.billing.archiveConfirm.licenseRenews);
    }
  });

  it('each locale names the space, its plan words and Billing as the page that cancels', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).console;
      const a = m.billing.archiveConfirm;
      expect(a.familyLoses('Kim family'), locale).toContain('Kim family');
      expect(a.familyLoses('Kim family'), locale).toContain(m.billing.coverage.family);
      expect(a.licenseRenews, locale).toContain(m.billing.coverage.license);
      for (const line of [a.familyRenews, a.licenseRenews]) expect(line, locale).toContain(m.billing.title);
    }
  });

  it('no price, no lifetime wording, no grown-up word; Hangul only in ko', () => {
    for (const locale of LOCALES) {
      const a = getMessages(locale).console.billing.archiveConfirm;
      for (const line of [a.familyLoses('Kim family'), a.familyRenews, a.licenseRenews]) {
        expect(line, locale).not.toMatch(/[$€£₩]\s?\d|lifetime|vitalicio|평생|grown-?up|adult[oa]s?|보호자|어른/i);
        if (locale === 'ko') expect(line).toMatch(HANGUL);
        else expect(line, locale).not.toMatch(HANGUL);
      }
    }
  });
});
