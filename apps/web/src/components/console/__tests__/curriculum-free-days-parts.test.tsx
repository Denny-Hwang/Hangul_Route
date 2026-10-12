import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ShortPlanLine, WarningList } from '@/components/console/CurriculumParts';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-ENT-003 section 3.9.3 (E3-9; wireframe console/curriculum-free-days): the wizard preview's
 * left-out warning with the free-plan switch on, its Open billing link, and the short-plan line
 * with its **Use {weeks} weeks** button. Every word comes from the dictionary (en-XA here).
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const en = getMessages('en').console;
/** Read inside a test: the pseudo locale is switched on in `beforeAll`. */
const pseudoWords = () => getMessages(PSEUDO).console;
const warnings = [
  { code: 'coming-soon-included', week: 7, count: 5 },
  { code: 'premium-needed', count: 3 },
] as const;
const noop = (): void => undefined;

describe('WarningList with the free-plan switch on', () => {
  it('words the left-out line by space kind and links Open billing for a class and a family', () => {
    const pseudo = pseudoWords();
    for (const kind of ['class', 'family'] as const) {
      const html = renderToStaticMarkup(<WarningList warnings={warnings} locale={PSEUDO} billingLink={kind === 'class'} free={{ kind, firstWeek: 1, lastWeek: 7 }} />);
      expect(html).toContain(pseudo.curriculum.freeDays.warning(1, 7, 3, pseudo.access.product[kind]).replace(/&/g, '&amp;'));
      expect(html).toContain('href="/teach/billing"');
      expect(html).toContain(`>${pseudo.access.openBilling.cta}</a>`);
      expect(html).not.toContain(pseudo.curriculum.preview.warnings.seePlans.cta);
      expect(html).not.toContain(pseudo.curriculum.preview.warnings.premium(3));
      expectAllPseudo(html, [], 3);
    }
  });

  it('keeps the existing line and link with the switch off', () => {
    const pseudo = pseudoWords();
    const html = renderToStaticMarkup(<WarningList warnings={warnings} locale={PSEUDO} billingLink />);
    expect(html).toContain(pseudo.curriculum.preview.warnings.premium(3));
    expect(html).toContain(`>${pseudo.curriculum.preview.warnings.seePlans.cta}</a>`);
    expect(html).not.toContain(pseudo.access.openBilling.cta);
    const family = renderToStaticMarkup(<WarningList warnings={warnings} locale={PSEUDO} billingLink={false} free={null} />);
    expect(family).not.toContain('href="/teach/billing"');
  });

  it('renders nothing when there is no warning', () => {
    expect(renderToStaticMarkup(<WarningList warnings={[]} locale={PSEUDO} billingLink free={{ kind: 'class', firstWeek: 1, lastWeek: 7 }} />)).toBe('');
  });
});

describe('ShortPlanLine', () => {
  it('says where the lessons end and offers a shorter preset as a button', () => {
    const pseudo = pseudoWords();
    const html = renderToStaticMarkup(<ShortPlanLine lastWeek={5} storiesAfter shorterWeeks={4} onUseWeeks={noop} />);
    expect(html).toContain(pseudo.curriculum.freeDays.shortPlan(5));
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*data-testid="route-use-weeks"[^>]*>${escape(pseudo.curriculum.freeDays.useWeeks.cta(4))}</button>`));
    expectAllPseudo(html, [], 2);
  });

  it('says practice, not stories, when no story follows; no button when no shorter preset holds every lesson', () => {
    const pseudo = pseudoWords();
    const html = renderToStaticMarkup(<ShortPlanLine lastWeek={7} storiesAfter={false} shorterWeeks={null} onUseWeeks={noop} />);
    expect(html).toContain(pseudo.curriculum.freeDays.shortPlanPractice(7));
    expect(html).not.toContain(pseudo.curriculum.freeDays.shortPlan(7));
    expect(html).not.toContain('<button');
  });

  it('reads in plain English', () => {
    expect(en.curriculum.freeDays.shortPlan(7)).toBe('This plan has lessons until week 7. After that it has stories and practice.');
    expect(en.curriculum.freeDays.shortPlanPractice(7)).toBe('This plan has lessons until week 7. After that it has practice.');
    expect(en.curriculum.freeDays.useWeeks.cta(4)).toBe('Use 4 weeks');
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
