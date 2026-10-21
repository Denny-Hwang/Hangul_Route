import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlipCard } from '../../../components/FlipCard';
import { heritageCardsAll } from '../../../content/heritage-cards';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { render, unmount } from '../../../test-support/render';
import { CardDetailView } from '../CardDetailView';

/**
 * A story card's page while its story's chunk loads (F-CURR-002 §10, row CM-8): the blurb, fact and
 * citation of the back come from the chunk, so until it is in the card shows its front only: no flip and
 * no Share, so a blank back is never drawn or shared. The global test setup preloads every chunk, so this
 * file holds `useStoryLoaded` (driven from a cold store in `screens/__tests__/story-content.test.tsx`).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const loaded = vi.hoisted(() => ({ value: false, asked: [] as Array<string | null | undefined> }));
vi.mock('../../story-content', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useStoryLoaded: (storyId: string | null | undefined) => {
    loaded.asked.push(storyId);
    return storyId == null || loaded.value;
  },
}));
vi.mock('../../../platform/sharing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isShareAvailable: () => Promise.resolve(true),
}));

const SHARE = getMessages('en').learner.cardDetail.share.cta;
const PROFILE_ID = 'profile:cards';
const storyCard = heritageCardsAll.find((c) => c.storyId !== undefined);
if (storyCard === undefined) throw new Error('a story card ships');
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  loaded.value = false;
  loaded.asked.length = 0;
  useProfileStore.setState({
    profiles: [{ id: PROFILE_ID, displayName: 'Dami', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }],
    activeId: PROFILE_ID,
  });
  useProgressStore.setState({
    byProfile: {
      [PROFILE_ID]: {
        profileId: PROFILE_ID,
        updatedAt: '2026-10-02T00:00:00.000Z',
        episodes: [],
        quests: [],
        cards: [{ cardId: storyCard.id, earnedAt: '2026-10-02T00:00:00.000Z' }],
        sessions: [],
        homework: [],
        reviews: [],
        streakDays: 1,
        placements: [],
      },
    },
  } as never);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {} });
});

const flipCard = (root: ReactTestInstance): ReactTestInstance => root.findByType(FlipCard);
const shareButtons = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => typeof n.type !== 'string' && n.props.label === SHARE && 'disabled' in n.props);

async function mount(): Promise<ReactTestRenderer> {
  const r = await render(<CardDetailView cardId={storyCard!.id} />);
  mounted.push(r);
  return r;
}

describe('CardDetailView: an earned story card before its story chunk is in', () => {
  it('cannot flip or share until the chunk is in, and is not called locked meanwhile', async () => {
    const r = await mount();
    expect(loaded.asked).toContain(storyCard.storyId);
    const flip = flipCard(r.root);
    expect(flip.props.disabled).toBe(true);
    expect(flip.props.accessibilityLabelFront).toBe(getMessages('en').a11y.flipToBack);
    const share = shareButtons(r.root);
    expect(share.length).toBeGreaterThan(0);
    expect(share.every((b) => b.props.disabled === true)).toBe(true);
  });

  it('flips and shares once the chunk is in', async () => {
    loaded.value = true;
    const r = await mount();
    expect(flipCard(r.root).props.disabled).toBe(false);
    const share = shareButtons(r.root);
    expect(share.length).toBeGreaterThan(0);
    expect(share.every((b) => b.props.disabled === false)).toBe(true);
  });
});
