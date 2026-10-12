import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentWordsLines, WeekWordsRevisit } from '@/components/console/VocabWordsParts';
import { consoleWords, studentWords } from '@/lib/console/vocab-words';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-VOC-005 P-4 (section 3.8, behaviour 14): the word lines of a roster card and of the week.
 * The Hangul is drawn with lang="ko" and travels with its romanization and its gloss; the words
 * around it come from the dictionary (en-XA here). No percent, no rate, no ranking of students.
 */
let locale: UiLocale = 'en';
vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale, messages: getMessages(locale), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => locale, useSetLocale: () => () => undefined };
});

afterEach(() => {
  locale = 'en';
  vi.unstubAllEnvs();
});

const VOCAB = { collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.75, needsPractice: ['vocab:sagwa-apple', 'vocab:nun-eye'] };
const textOf = (html: string): string => html.replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '');

describe('StudentWordsLines', () => {
  it('reads "Words: 12 collected · 4 strong" and "Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)"', () => {
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: VOCAB }, 'en')} />);
    const lines = [...html.matchAll(/<div data-testid="(student-words[^"]*)"[^>]*>(.*?)<\/div>/g)].map((m) => [m[1], textOf(m[2] ?? '')]);
    expect(lines).toEqual([
      ['student-words', 'Words: 12 collected · 4 strong'],
      ['student-words-revisit', 'Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)'],
    ]);
    // The Hangul alone is marked Korean; the romanization and the gloss are in the UI language.
    expect(html).toContain('<span lang="ko">사과</span>');
    expect(html).toContain('<span lang="ko">눈</span>');
    expect(html).not.toMatch(/lang="ko">[^<]*[A-Za-z]/);
    // The Hangul and its romanization stay together on one line; the gloss may wrap after them.
    expect(html.match(/<span style="white-space:nowrap">/g)).toHaveLength(2);
    expect(html).toContain('<span style="white-space:nowrap"><span lang="ko">사과</span> sagwa</span> (apple)');
    // No rate, percent or ranking word reaches the card.
    expect(textOf(html)).not.toMatch(/%|0\.75|rank|weak|fail|behind/i);
  });

  it('shows only the counts when there is nothing to revisit', () => {
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: { ...VOCAB, needsPractice: [] } }, 'en')} />);
    expect(html).toContain('data-testid="student-words"');
    expect(html).not.toContain('student-words-revisit');
  });

  it('shows an unknown id by its romanized slug, with no Hangul and no gloss', () => {
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: { ...VOCAB, needsPractice: ['vocab:saeroun-mal', 'vocab:uyu'] } }, 'en')} />);
    expect(textOf(html)).toContain('Words to revisit: saeroun-mal · 우유 uyu (milk)');
    expect(html.match(/lang="ko"/g)).toHaveLength(1);
  });

  it('draws the lines from a slice without firstTryRate, as the roster will carry it (P-4b)', () => {
    const { firstTryRate: _rate, ...withoutRate } = VOCAB;
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: withoutRate }, 'en')} />);
    expect(textOf(html)).toContain('Words: 12 collected · 4 strong');
    expect(textOf(html)).toContain('Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)');
  });

  it('renders nothing without summary.vocab', () => {
    expect(renderToStaticMarkup(<StudentWordsLines words={null} />)).toBe('');
  });

  it('lets a long gloss wrap inside a narrow card: only the Hangul and its romanization are kept together', () => {
    // Real catalogue glosses run to 40-plus characters (es "tteokbokki (pasteles de arroz picantes)",
    // en "older sister (said by a woman or girl)"): kept unbreakable they would overflow a 280 px card.
    locale = 'es';
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: { ...VOCAB, needsPractice: ['vocab:tteokbokki', 'vocab:eonni'] } }, 'es')} />);
    const unbreakable = [...html.matchAll(/<span style="white-space:nowrap">((?:<span lang="ko">[^<]*<\/span>)?[^<]*)<\/span>/g)].map((m) => textOf(m[1] ?? ''));
    expect(unbreakable).toEqual(['떡볶이 tteokbokki', '언니 eonni']);
    for (const piece of unbreakable) expect(piece.length).toBeLessThan(20);
    // Each line may also break inside a single long word rather than overflow.
    expect(html.match(/<div data-testid="student-words[^"]*" style="overflow-wrap:anywhere">/g)).toHaveLength(2);
    // A gloss that opens with its own romanization is not repeated after it, and brackets never nest.
    expect(textOf(html)).toContain('떡볶이 tteokbokki (pasteles de arroz picantes)');
    expect(textOf(html)).toContain('언니 eonni (hermana mayor, lo dice una mujer o niña)');
    expect(textOf(html)).not.toMatch(/tteokbokki \(tteokbokki|\([^()]*\(/);
  });

  it('glosses in the UI language', () => {
    locale = 'es';
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: VOCAB }, 'es')} />);
    expect(textOf(html)).toContain('사과 sagwa (manzana)');
  });

  it('takes every word around the data from the dictionary (en-XA)', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    locale = 'en-XA' as UiLocale;
    const html = renderToStaticMarkup(<StudentWordsLines words={studentWords({ vocab: VOCAB }, 'en')} />);
    // A sentence split around its words (aroundSlot) is one message: read each line as one text.
    const lines = [...html.matchAll(/<div data-testid="student-words[^"]*"[^>]*>(.*?)<\/div>/g)].map((match) => textOf(match[1] ?? ''));
    expect(lines).toHaveLength(2);
    for (const line of lines) expectAllPseudo(line, ['사과', '눈', 'sagwa', 'nun', 'apple', 'eye'], 1);
  });
});

describe('WeekWordsRevisit', () => {
  it('reads "Words to revisit together: …" with each word marked', () => {
    const html = renderToStaticMarkup(<WeekWordsRevisit words={consoleWords(['vocab:nun-eye', 'vocab:nun-snow'], 'en')} />);
    expect(html).toMatch(/^<li data-testid="week-words-revisit" style="overflow-wrap:anywhere"/);
    expect(textOf(html)).toBe('Words to revisit together: 눈 nun (eye) · 눈 nun (snow)');
  });

  it('renders nothing for an empty list', () => {
    expect(renderToStaticMarkup(<WeekWordsRevisit words={[]} />)).toBe('');
  });
});
