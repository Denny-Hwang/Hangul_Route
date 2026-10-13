import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LearnersPage } from '../../components/landing/LearnersPage';
import { ParentsPage } from '../../components/landing/ParentsPage';
import { TeachersPage } from '../../components/landing/TeachersPage';
import { ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';

/**
 * Visible-word budgets of the site pages without a browser (F-SITE-002 §3.11): each page rendered in its longest
 * state (`ALL_CLAIMS_ON`, every claim line shown), folded `<details>` bodies removed (closed by default, so a visitor
 * reads only the summary) and the header items that are `display: none` on phones removed (`hr-site-wide-only`: the
 * wide header repeats links the footer already has). Visually hidden headings and decorative art carry no visible
 * words either. The e2e budget (`e2e/site-budgets.spec.ts`) measures the real export with `innerText`.
 */
const PERSONA_PAGE_WORDS = 550;

/** Removes every element `<tag …class="…name…">…</tag>` (no nesting of the same tag inside). */
function dropByClass(html: string, tag: string, name: string): string {
  return html.replace(new RegExp(`<${tag}\\b[^>]*class="[^"]*\\b${name}\\b[^"]*"[^>]*>[\\s\\S]*?</${tag}>`, 'g'), '');
}

/** The words a visitor reads with every fold closed. */
function visibleWords(html: string): string[] {
  let visible = html
    // A fold shows its summary only.
    .replace(/<details\b[^>]*>\s*(<summary\b[\s\S]*?<\/summary>)[\s\S]*?<\/details>/g, '$1')
    // Decorative art and visually hidden text.
    .replace(/<span aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<(h2|span)\b[^>]*style="[^"]*position:absolute[^"]*"[^>]*>[\s\S]*?<\/\1>/g, '');
  visible = dropByClass(visible, 'a', 'hr-site-wide-only');
  visible = dropByClass(visible, 'nav', 'hr-site-wide-only');
  // The skip link is shown only on keyboard focus.
  visible = visible.replace(/<a [^>]*href="#content"[^>]*>[\s\S]*?<\/a>/, '');
  const text = visible.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
}

describe('visible-word budgets with every claim on (F-SITE-002 §3.11)', () => {
  it.each([
    ['/learners', LearnersPage],
    ['/parents', ParentsPage],
    ['/teachers', TeachersPage],
  ] as const)(`%s: at most ${PERSONA_PAGE_WORDS} words`, (_path, Page) => {
    const words = visibleWords(renderToStaticMarkup(<Page locale="en" claims={ALL_CLAIMS_ON} />));
    expect(words.length).toBeGreaterThan(100);
    expect(words.length).toBeLessThanOrEqual(PERSONA_PAGE_WORDS);
  });

  it('the counter drops folded bodies, phone-hidden header items, hidden headings and the skip link (self-check)', () => {
    const html =
      '<a href="#content">Skip to content</a><a class="hr-site-wide-only x">Start learning</a><nav class="hr-site-wide-only">A B</nav>' +
      '<h2 style="position:absolute;width:1px">Questions</h2><details><summary><span>Open me</span></summary><p>hidden body text</p></details>' +
      '<span aria-hidden="true">HR</span><p>one two</p>';
    expect(visibleWords(html)).toEqual(['Open', 'me', 'one', 'two']);
  });
});
