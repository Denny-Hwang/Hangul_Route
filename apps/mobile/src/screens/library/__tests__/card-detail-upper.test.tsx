import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlipCard } from '../../../components/FlipCard';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { render, unmount } from '../../../test-support/render';
import { CardDetailView } from '../CardDetailView';

/**
 * An upper-cell card's page under `upperCards` (F-CURR-002 §7.2 and §12.2, row CM-23):
 *
 * - off, a card the learner does not hold is not in this build's view: a link to it opens "Card not found", with no
 *   earn hint (a grown-up preview shows the cards of All lessons' bundle, which leaves them out while off:
 *   `logic/browse/__tests__/bundle.test.ts`);
 * - a held card always opens, whatever the switch;
 * - while the upper-cards chunk (the card back) loads, the front shows no empty fact box.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunk = vi.hoisted(() => ({ ready: true }));
vi.mock('../upper-cards-entry', async (importOriginal) => {
  const real = await importOriginal<typeof import('../upper-cards-entry')>();
  return {
    ...real,
    useUpperCardBack: (...args: Parameters<typeof real.useUpperCardBack>) => {
      const out = real.useUpperCardBack(...args);
      return chunk.ready || out.hidden ? out : { ...out, card: args[0], ready: false };
    },
  };
});

const NOT_FOUND = getMessages('en').learner.cardDetail.notFound;
const ID = 'profile:upper';
const CARD = 'card:norae';
const mounted: ReactTestRenderer[] = [];
const flags = (pct: number) => ({ v: 1 as const, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards: { on: true, pct } } });

function hold(cardIds: string[]): void {
  useProgressStore.setState({
    byProfile: {
      [ID]: {
        profileId: ID,
        updatedAt: '2026-10-02T00:00:00.000Z',
        episodes: [],
        quests: [],
        cards: cardIds.map((cardId) => ({ cardId, unlockedAt: '2026-10-02T00:00:00.000Z', newSinceLastView: false })),
        sessions: [],
        homework: [],
        reviews: [],
        streakDays: 1,
      },
    },
  });
}

const texts = (root: ReactTestInstance): string[] =>
  root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

async function mount(state?: 'preview'): Promise<ReactTestRenderer> {
  const r = await render(<CardDetailView cardId={CARD} state={state} showHowToEarn />);
  mounted.push(r);
  // Let the upper-cards chunk's `import()` settle.
  await act(async () => {
    await import('../upper-cards-chunk');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return r;
}

beforeEach(() => {
  chunk.ready = true;
  resetRemoteConfigForTests();
  useProfileStore.setState({
    profiles: [{ id: ID, displayName: 'Dami', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }],
    activeId: ID,
  });
  hold([]);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {} });
  resetRemoteConfigForTests();
});

describe('CardDetailView: an upper-cell card under upperCards (row CM-23)', () => {
  it('off, not held: "Card not found", with no card and no earn hint', async () => {
    useRemoteConfigStore.setState({ cache: flags(0), hydrated: true });
    const r = await mount();
    expect(texts(r.root)).toContain(NOT_FOUND);
    expect(r.root.findAllByType(FlipCard)).toHaveLength(0);
  });

  it('a grown-up preview draws the card it is given (All lessons gives it only while the switch is on for everyone)', async () => {
    const r = await mount('preview');
    expect(texts(r.root)).not.toContain(NOT_FOUND);
  });

  it('off, held: the card opens and flips (a held card always stays)', async () => {
    useRemoteConfigStore.setState({ cache: flags(0), hydrated: true });
    hold([CARD]);
    const r = await mount();
    expect(texts(r.root)).not.toContain(NOT_FOUND);
    expect(r.root.findByType(FlipCard).props.disabled).toBe(false);
  });

  it('on, not held: the card page opens, locked', async () => {
    useRemoteConfigStore.setState({ cache: flags(100), hydrated: true });
    const r = await mount();
    expect(texts(r.root)).not.toContain(NOT_FOUND);
    expect(r.root.findByType(FlipCard).props.disabled).toBe(true);
  });

  it('held, while the chunk with its back loads: busy, and no empty fact box on the front', async () => {
    hold([CARD]);
    chunk.ready = false;
    const r = await mount();
    const flip = r.root.findByType(FlipCard);
    expect([flip.props.disabled, flip.props.busy]).toEqual([true, true]);
    // The fact card's sparkle line is the only `sparkle` icon on the page.
    expect(r.root.findAll((n) => n.props.name === 'sparkle')).toHaveLength(0);
    await unmount(mounted.pop()!);
    chunk.ready = true;
    const ready = await mount();
    expect(ready.root.findAll((n) => n.props.name === 'sparkle').length).toBeGreaterThan(0);
  });
});
