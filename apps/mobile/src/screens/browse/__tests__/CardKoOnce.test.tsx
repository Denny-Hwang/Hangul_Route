import type { UiLocale } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardById } from '../../../content/heritage-cards';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { byTestId, cleanup, render, resetPlatform } from '../../../test-support/render';
import { CardRow } from '../browse-ui';

/**
 * F-I18N-001 15b/16b (ko MAR finding 1): a Korean overlay titles most cards with the Korean word
 * itself (card:book reads 책 / 책), so a card surface that prints the Korean line and the title
 * would show the word twice. Each surface shows it once in ko and keeps both lines in en.
 */

function seed(locale: UiLocale): void {
  // es and ko are hidden at launch (LOCALE_STATUS); the QA switch shows them.
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useProfileStore.setState({ profiles: [], activeId: null });
  useLocaleStore.setState({ device: locale, byProfile: {} });
}

const book = (): NonNullable<ReturnType<typeof cardById>> => {
  const card = cardById('card:book');
  if (!card) throw new Error('card:book is missing');
  return card;
};

/** The text a sighted reader sees: string children only (no labels; the card art draws the word as a picture). */
function visibleTexts(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string): void => {
    if (typeof node === 'string') {
      if (node.trim() !== '') out.push(node);
      return;
    }
    if (typeof node.type === 'string' && (node.props['data-testid'] === 'card-art' || node.props.role === 'img')) return;
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

const count = (texts: readonly string[], needle: string): number => texts.join('\n').split(needle).length - 1;

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('CardRow (browse card row)', () => {
  it('ko: the word shows once (title, then the romanization alone), and the label says it once', async () => {
    seed('ko');
    const r = await render(<CardRow card={book()} onPress={() => undefined} testID="row" />);
    const texts = visibleTexts(r.root);
    expect(count(texts, '책')).toBe(1);
    expect(texts.join(' ')).toContain('chaek');
    const label = String(byTestId(r.root, 'row')[0]?.props['aria-label'] ?? '');
    expect(count([label], '책')).toBe(1);
  });

  it('en: the English title and the Korean chip both show', async () => {
    seed('en');
    const r = await render(<CardRow card={book()} onPress={() => undefined} testID="row" />);
    const texts = visibleTexts(r.root).join(' ');
    expect(texts).toContain('Book');
    expect(count([texts], '책')).toBe(1);
  });
});

/**
 * The other card surfaces have no render harness of their own (they need navigation and the learner
 * stores), so this guard reads their source: each one decides the Korean line or the trailing title
 * through `cardKoLine` / `cardTitleIsKo`, never by printing `subtitleKo` and `titleEn` unconditionally.
 */
describe('card surfaces dedupe the Korean word through card-art helpers', () => {
  const read = (file: string): string => readFileSync(resolve(__dirname, '../..', file), 'utf8');
  it.each([
    ['browse/HomeSections.tsx', /cardTitleIsKo\(card\) \? null/],
    ['browse/HomeSections.tsx', /cardSlotA11y\(rarity, card\.titleEn, cardKoLine\(card\) \?\? ''/],
    ['library/LibraryScreen.tsx', /cardTitleIsKo\(card\) \? null : <Caption tone="secondary">\{card\.titleEn\}/],
    ['library/CardDetailView.tsx', /cardKoLine\(card\) \?/],
    ['library/CardDetailView.tsx', /cardTitleIsKo\(card\) \? null/],
    ['episode/EpisodeDetailView.tsx', /cardKoLine\(c\) \?/],
    // The quest card celebration of Results (learner and guest), in its own file since row GU-3.
    ['results/CardUnlockBanner.tsx', /cardKoLine\(card\) \?/],
  ])('%s', (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });
});
