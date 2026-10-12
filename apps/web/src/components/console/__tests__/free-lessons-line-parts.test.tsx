import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FreeLessonsLine } from '@/components/console/FreeLessonsParts';
import { rosterFreeLessonsLine } from '@/lib/console/free-lessons-line-view';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-ENT-003 section 3.9.2 (E3-12; wireframe console/free-lessons-line A): the line on a roster
 * card is plain body text followed by a real **Open billing** link to the console's Billing
 * route. Every word comes from the dictionary (en-XA here); the learner name is data.
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

describe('FreeLessonsLine on a roster card', () => {
  it('renders the line and a real Open billing link', () => {
    const line = rosterFreeLessonsLine(
      {
        gating: true,
        role: 'owner',
        coverage: 'uncovered',
        spaceKind: 'class',
        learner: { id: 'l:1', displayName: 'Mina', summary: { planProgress: { 'plan:1': { done: 1, total: 1, notReady: 3 } } } as never },
        today: '2026-10-18',
        plans: [
          {
            id: 'plan:1',
            spaceId: 'space:c1',
            authorAccountId: 'acct',
            title: 'Week three',
            items: [
              { kind: 'quest', id: 'quest:stage1-letters-q1' },
              { kind: 'quest', id: 'quest:stage2-life-q1' },
              { kind: 'quest', id: 'quest:stage2-nature-q1' },
              { kind: 'quest', id: 'quest:stage4-rites-q1' },
            ],
            targetLearnerIds: null,
            publishedAt: '2026-10-10T09:00:00.000Z',
            archivedAt: null,
            createdAt: '2026-10-09T09:00:00.000Z',
            updatedAt: '2026-10-10T09:00:00.000Z',
          },
        ],
      },
      PSEUDO,
    );
    if (!line) throw new Error('line');
    const html = renderToStaticMarkup(<FreeLessonsLine line={line} />);
    const words = getMessages(PSEUDO).console.access;
    expect(html).toContain('data-testid="free-lessons-line"');
    expect(html).toContain(words.planWaiting('Mina', 3, words.product.class).replace(/&/g, '&amp;'));
    expect(html).toMatch(new RegExp(`<a [^>]*href="/teach/billing"[^>]*>${words.openBilling.cta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`));
    expectAllPseudo(html, ['Mina'], 2);
  });

  it('renders nothing without a line', () => {
    expect(renderToStaticMarkup(<FreeLessonsLine line={null} />)).toBe('');
  });
});
