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

  it('renders nothing without summary.vocab', () => {
    expect(renderToStaticMarkup(<StudentWordsLines words={null} />)).toBe('');
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
    expect(html).toMatch(/^<li data-testid="week-words-revisit"/);
    expect(textOf(html)).toBe('Words to revisit together: 눈 nun (eye) · 눈 nun (snow)');
  });

  it('renders nothing for an empty list', () => {
    expect(renderToStaticMarkup(<WeekWordsRevisit words={[]} />)).toBe('');
  });
});
