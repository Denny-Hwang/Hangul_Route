import { getMessages } from '@hangul-route/i18n';
import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import React from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.3 and 7.1 (row GU-3 review, Codex P1): See my card opens the card page,
 * and the card page, the real `CardDetailView` with nothing mocked of it, reads the card under the active learner. A
 * guest has no profile record, so on the empty device GU-3 targets the card the guest just earned shows its earned
 * face, with the flip and Share and no earn hint. A run that is off reads as no guest, and a guest never sees the
 * cards of the active profile (Mina) as its own.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/sharing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isShareAvailable: () => Promise.resolve(true),
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));

import { FlipCard } from '../../../components/FlipCard';
import { useGuestStore } from '../../../store/guest-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { render, screenTexts, unmount } from '../../../test-support/render';
import { CardDetailScreen } from '../../library/CardDetailScreen';

const en = getMessages('en');
const CARD_ID = 'card:book';
const GUEST_ID = 'profile:guest001';
const T0 = '2026-10-22T10:00:00.000Z';
const guest: GuestRecord = { v: 1, id: GUEST_ID, startedAt: T0, lastAt: T0, via: 'site', questDone: true };
const mina: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };
const snapshot = (profileId: string, cards: string[]) => ({
  profileId,
  updatedAt: T0,
  episodes: [],
  quests: [],
  cards: cards.map((cardId) => ({ cardId, earnedAt: T0 })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  placements: [],
});
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  // The empty device of GU-3: no profile, the guest's run on, the card earned under the guest's id.
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useGuestStore.setState({ record: guest, running: true, hydrated: true, memoryOnly: false });
  useProgressStore.setState({ byProfile: { [GUEST_ID]: snapshot(GUEST_ID, [CARD_ID]) } } as never);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useGuestStore.setState({ record: null, running: false });
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {} });
});

async function cardPage(): Promise<ReactTestRenderer> {
  const r = await render(<CardDetailScreen route={{ key: 'c', name: 'CardDetail', params: { cardId: CARD_ID } } as never} navigation={{} as never} />);
  mounted.push(r);
  return r;
}

const flip = (root: ReactTestInstance): ReactTestInstance => root.findByType(FlipCard);
const shares = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => typeof n.type !== 'string' && n.props.label === en.learner.cardDetail.share.cta && 'disabled' in n.props);

describe('the guest\'s card page after See my card (5.3, 7.1)', () => {
  it('a card earned under the guest id, with no profile record: the earned face, the flip and Share, no earn hint', async () => {
    const r = await cardPage();
    expect(flip(r.root).props.disabled).toBe(false);
    expect(flip(r.root).props.accessibilityLabelFront).toBe(en.a11y.flipToBack);
    expect(screenTexts(r.root)).not.toContain(en.learner.cardDetail.earn.title);
    await vi.waitFor(() => expect(shares(r.root).length).toBeGreaterThan(0));
    // It also clears the card's New pill under the guest id.
    expect(useProgressStore.getState().byProfile[GUEST_ID]?.cards.find((c) => c.cardId === CARD_ID)).toBeDefined();
  });

  it('with the run off, the guest\'s card is no learner\'s: locked, with the earn hint', async () => {
    useGuestStore.setState({ running: false });
    const r = await cardPage();
    expect(flip(r.root).props.disabled).toBe(true);
    expect(screenTexts(r.root)).toContain(en.learner.cardDetail.earn.title);
    expect(shares(r.root)).toHaveLength(0);
  });

  it('with Mina active, the guest sees its own cards, never Mina\'s; after the run Mina sees hers', async () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    useProgressStore.setState({ byProfile: { [GUEST_ID]: snapshot(GUEST_ID, []), [mina.id]: snapshot(mina.id, [CARD_ID]) } } as never);
    const guestView = await cardPage();
    expect(flip(guestView.root).props.disabled).toBe(true);
    expect(screenTexts(guestView.root)).toContain(en.learner.cardDetail.earn.title);
    useGuestStore.setState({ running: false });
    const minaView = await cardPage();
    expect(flip(minaView.root).props.disabled).toBe(false);
    expect(screenTexts(minaView.root)).not.toContain(en.learner.cardDetail.earn.title);
  });
});
