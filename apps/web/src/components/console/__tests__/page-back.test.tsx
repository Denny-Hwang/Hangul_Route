import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SPACE_PAGES } from '@/lib/console/space-pages';

/**
 * PageBack (AMENDMENTS-DISPLAY-NAV section 7.3, row DN-6): the one way back of a console page that is not a persona
 * home or a nav target, a link to the page above with the arrow glyph before the page's own back message. Every page
 * of a space (`SPACE_PAGES`) and the receipts page draw it; the persona homes and the nav targets do not.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PAGE_BACK_CSS, PageBack } from '../PageBack';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));

describe('PageBack', () => {
  it('a link to the page above: the arrow glyph, then the page\'s own back message', () => {
    act(() => {
      mounted = create(<PageBack href="/teach/space?id=sp_c" label="Back to Class 2B" />);
    });
    const link = (mounted as ReactTestRenderer).root.findAll((n) => n.type === 'a')[0]!;
    expect(link.props.href).toBe('/teach/space?id=sp_c');
    expect(link.props.className).toBe('hr-page-back');
    expect(link.props['data-testid']).toBe('page-back');
    const kids = link.children as ReactTestInstance[];
    // The glyph first (an svg), then the label.
    expect(kids).toHaveLength(2);
    expect(kids[0]!.type === 'svg' || kids[0]!.findAll((n) => n.type === 'svg').length === 1).toBe(true);
    expect(kids[1]!.type).toBe('span');
    expect(textOf(link)).toBe('Back to Class 2B');
  });

  it('is a touch target at least, wraps its label instead of scrolling, and shows the focus ring', () => {
    expect(PAGE_BACK_CSS).toMatch(/\.hr-page-back\{[^}]*min-height:64px/);
    expect(PAGE_BACK_CSS).toMatch(/\.hr-page-back\{[^}]*overflow-wrap:anywhere/);
    expect(PAGE_BACK_CSS).toMatch(/\.hr-page-back:focus-visible\{outline:/);
    expect(PAGE_BACK_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^{]*\})/);
  });
});

describe('PageBack on every page of a space and the account pages (AMENDMENTS-DISPLAY-NAV section 7.3)', () => {
  const SRC = join(__dirname, '..', '..', '..');
  const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
  const draws = (source: string): boolean => /<AdultFrame[^>]*\bback=\{/.test(source) || /<PageBack\b/.test(source) || /<ReportBack\b|<ReportHeader back=/.test(source);

  it.each(SPACE_PAGES.map((sub) => [sub === '' ? '(the space page)' : sub, sub]))('%s draws PageBack', (_label, sub) => {
    expect(draws(read(`app/(console)/teach/space/${sub ? `${sub}/` : ''}page.tsx`))).toBe(true);
  });

  it('a school\'s own page (the space page for a school) draws PageBack too', () => {
    expect(draws(read('components/console/SchoolAdmin.tsx'))).toBe(true);
  });

  it('the receipts page draws PageBack; Billing, a nav target, does not', () => {
    expect(read('components/console/BillingHomeParts.tsx')).toMatch(/export function BackToBilling[\s\S]*?<PageBack /);
    expect(read('app/(console)/account/billing/receipts/page.tsx')).toContain('<BackToBilling');
  });

  it('the persona homes draw none', () => {
    expect(draws(read('app/(console)/teach/home/page.tsx'))).toBe(false);
    expect(draws(read('app/(console)/parent/page.tsx'))).toBe(false);
  });

  it('the report pages draw their way back as PageBack', () => {
    expect(read('components/console/ReportParts.tsx')).toMatch(/export function ReportBack[\s\S]*?<PageBack /);
  });
});
