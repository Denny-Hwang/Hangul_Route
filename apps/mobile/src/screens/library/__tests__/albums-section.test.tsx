import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardById } from '../../../content';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';
import { AlbumsSection } from '../upper-cards-chunk';
import { AlbumsSlot } from '../upper-cards-entry';

/**
 * The Library's category albums (F-CURR-002 §7.2, row CM-23): five rows in theme order, each with the cards held and how
 * many, or New; a held card opens its page; no empty slot and no count of what is left (D3, §7.7). The slot draws them
 * only while `upperCards` is on.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const EN = getMessages('en').learner.library.albums;

beforeEach(() => {
  resetRemoteConfigForTests();
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { upperCards: { on: true, pct: 100 } } } });
});
afterEach(cleanup);

describe('AlbumsSection', () => {
  it('lists the five albums; an album with none says New, one with cards shows them and their count', async () => {
    const onOpen = vi.fn();
    const r = await render(<AlbumsSection owned={new Set(['card:norae', 'card:hangeul', 'card:dosirak', 'card:sagwa'])} onOpenCard={onOpen} />);
    const texts = screenTexts(r.root);
    for (const name of Object.values(EN.names)) expect(texts).toContain(name);
    expect(texts).toContain(EN.title);
    expect(texts.filter((t) => t === EN.count(2))).toHaveLength(1);
    expect(texts.filter((t) => t === EN.count(1))).toHaveLength(1);
    expect(texts.filter((t) => t === EN.fresh)).toHaveLength(3);
    // Lunch Box Words' apple is a card of the cell, not its album card.
    expect(byTestId(r.root, 'library-album-card-card:sagwa')).toHaveLength(0);
    expect(texts.join(' ')).not.toMatch(/%|\d+\s*(\/|of)\s*\d+/);
    const [hangeul] = buttonsNamed(r.root, 'Hangeul');
    await press(hangeul!);
    expect(onOpen).toHaveBeenCalledWith(cardById('card:hangeul'));
  });
});

describe('AlbumsSection, a finished album (row CM-23 part 3)', () => {
  const LETTERS = ['card:norae', 'card:hangeul', 'card:mwoyeyo', 'card:won', 'card:ireum'];

  it('four of five is still a count; all five says Album complete, and the held legendary card leads the row', async () => {
    const four = await render(<AlbumsSection owned={new Set(LETTERS.slice(0, 4))} onOpenCard={() => undefined} />);
    expect(screenTexts(four.root)).toContain(EN.count(4));
    expect(screenTexts(four.root)).not.toContain(EN.complete);
    cleanup();
    const onOpen = vi.fn();
    const all = await render(<AlbumsSection owned={new Set([...LETTERS, 'card:hunminjeongeum'])} onOpenCard={onOpen} />);
    const texts = screenTexts(all.root);
    expect(texts.filter((t) => t === EN.complete)).toHaveLength(1);
    expect(texts.join(' ')).not.toMatch(/%|\d+\s*(\/|of)\s*\d+/);
    const row = byTestId(all.root, 'library-album-letters')[0]!;
    expect(byTestId(row, 'library-album-card-card:hunminjeongeum')).toHaveLength(1);
    const [legend] = buttonsNamed(all.root, 'Hangeul Book');
    await press(legend!);
    expect(onOpen).toHaveBeenCalledWith(cardById('card:hunminjeongeum'));
  });
});

describe('AlbumsSlot', () => {
  it('draws nothing while upperCards is off', async () => {
    const r = await render(<AlbumsSlot on={false} owned={new Set()} onOpenCard={() => undefined} />);
    expect(byTestId(r.root, 'library-albums')).toHaveLength(0);
  });

  it('loads the chunk and draws the albums while on', async () => {
    const r = await render(<AlbumsSlot on owned={new Set()} onOpenCard={() => undefined} />);
    await vi.waitFor(() => expect(byTestId(r.root, 'library-albums').length).toBeGreaterThan(0));
  });
});
