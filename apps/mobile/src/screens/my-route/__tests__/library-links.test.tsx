import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GainTileView } from '../../../logic/my-route/view';
import { cleanup, hostNodes, press, render, resetPlatform } from '../../../test-support/render';
import { GainsCard } from '../GainsCard';

/**
 * Owner request OW-2: a count of cards that opens the Library opens it on the learner's cards, not on whatever section
 * or filter the tab was left on. The Journey Gains cards tile says so with its section; the stories tile opens Story
 * Time. Home's catch-up button shares the Cards chip's way in (the screens are pinned by source, as the lane does not
 * mount them).
 */

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

const tiles: GainTileView[] = [
  { key: 'stars', icon: 'star', value: 2, label: 'Stars', a11yLabel: 'Stars 2', opensLibrary: false },
  { key: 'cards', icon: 'card', value: 3, label: 'Cards', a11yLabel: 'Cards 3', opensLibrary: true },
  { key: 'stories', icon: 'book', value: 1, label: 'Stories', a11yLabel: 'Stories 1', opensLibrary: true },
];

const button = (root: Parameters<typeof hostNodes>[0], name: string) =>
  hostNodes(root, (n) => n.props.role === 'button' && n.props['aria-label'] === name)[0]!;

describe('GainsCard links', () => {
  it('the cards tile opens the Library on the cards section, the stories tile on Story Time, stars are no button', async () => {
    const onOpenLibrary = vi.fn();
    const r = await render(<GainsCard tiles={tiles} onOpenLibrary={onOpenLibrary} />);
    await press(button(r.root, 'Cards 3'));
    expect(onOpenLibrary).toHaveBeenLastCalledWith('cards');
    await press(button(r.root, 'Stories 1'));
    expect(onOpenLibrary).toHaveBeenLastCalledWith('story-time');
    expect(hostNodes(r.root, (n) => n.props.role === 'button' && n.props['aria-label'] === 'Stars 2')).toHaveLength(0);
    expect(onOpenLibrary).toHaveBeenCalledTimes(2);
  });
});

describe('screens that show a cards count open the cards section', () => {
  const read = (...p: string[]): string => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

  it('Home: the Cards chip and the catch-up See my cards share one way in, with the cards section', () => {
    const src = read('home', 'HomeScreen.tsx');
    expect(src).toContain("const openYourCards = (): void => navigation.navigate('Main', { screen: 'Library', params: { section: 'cards' } });");
    const seeCards = src.slice(src.indexOf('const seeCaughtUpCards'), src.indexOf('const seeCaughtUpCards') + 300);
    expect(seeCards).toContain('markCardsSeen(profile.id, catchUp.cardIds)');
    expect(seeCards).toContain('openYourCards()');
    expect(seeCards).not.toContain("screen: 'Library' }");
    expect(src).toContain('<CardsChip cards={cardsUnlocked} onOpen={openYourCards} />');
  });

  it('Journey: the Library link carries a section; the stories note opens Story Time', () => {
    const src = read('my-route', 'MyRouteScreen.tsx');
    expect(src).toContain("{ screen: 'Library', params: { section } }");
    expect(src).toContain("onOpen={() => openLibrary('story-time')}");
    expect(src).toContain('<GainsCard tiles={view.gains} onOpenLibrary={openLibrary} />');
  });
});
