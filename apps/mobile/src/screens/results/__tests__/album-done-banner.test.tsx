import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardById } from '../../../content';
import { buttonsNamed, byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';
import { CardUnlockBanner } from '../CardUnlockBanner';

/**
 * The album-complete celebration (F-CURR-002 §7.2, row CM-23 part 3; F-MOTION-003): a run that fills a category album
 * shows its legendary card in the new-card banner with "Album complete!" and the album's line, the drop-in and the
 * sparkles; under reduced motion the same banner is there at once, with no sparkles.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const EN = getMessages('en').learner.results;
const LEGEND = cardById('card:hunminjeongeum')!;

afterEach(cleanup);

const draw = (reducedMotion: boolean, onSeeCard = vi.fn()) =>
  render(
    <CardUnlockBanner
      m={EN}
      card={LEGEND}
      title={EN.albumDone.title}
      line={EN.albumDone.line(LEGEND.theme)}
      showSparkles
      reducedMotion={reducedMotion}
      testID="results-album-done"
      onSeeCard={onSeeCard}
    />,
  );

describe('the album-complete banner (row CM-23 part 3)', () => {
  it('names the album and its legendary card, with the F-MOTION-003 sparkles; See my card opens it', async () => {
    const onSee = vi.fn();
    const r = await draw(false, onSee);
    const texts = screenTexts(r.root);
    expect(texts).toEqual(expect.arrayContaining(['Album complete!', 'Your Letters album is full. Here is its legendary card.', 'Hangeul Book']));
    expect(texts).not.toContain(EN.newCard.title);
    expect(byTestId(r.root, 'card-unlock-sparkles').length).toBeGreaterThan(0);
    const [see] = buttonsNamed(r.root, EN.newCard.seeA11y('Hangeul Book'));
    await press(see!);
    expect(onSee).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: the same banner and words at once, no sparkles', async () => {
    const r = await draw(true);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining(['Album complete!', 'Hangeul Book']));
    expect(byTestId(r.root, 'results-album-done').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'card-unlock-sparkles')).toHaveLength(0);
  });

  it('the new-card banner keeps its own heading when no album title is given', async () => {
    const r = await render(<CardUnlockBanner m={EN} card={cardById('card:norae')!} showSparkles={false} reducedMotion onSeeCard={() => undefined} />);
    expect(screenTexts(r.root)).toContain(EN.newCard.title);
    expect(screenTexts(r.root)).not.toContain(EN.albumDone.title);
  });
});
