import { describe, expect, it } from 'vitest';
import { askedOfScope } from '../../memory/resolve';
import { SKILL_OF_KIND } from '../../my-route/skills';
import { shortenScope } from '../../quest-flow/quest-adapt';
import { scaffoldScope, scopeItems } from '../../quest-flow/quest-scaffold';
import { clozeFixtureScope } from '../e2e-rounds';

/**
 * F-CURR-002 row CM-30: what the rest of the app reads from a `cloze-pick` scope. The memory store records the
 * produce rung of the completed sentence (a `pat` item) or, for a value gap, of the card it is read from (the `rea`
 * item), from the game and its fallback alike (same round ids). The adaptive pacing drops a last round and builds its
 * scaffold round from the completed sentences. My Route counts the game for reading.
 */

describe('the memory store reads a Cloze Pick round', () => {
  const scope = clozeFixtureScope(['word', 'particle', 'value']);

  it('a word or particle gap asks only the completed sentence at the produce rung (one answer grades one item)', () => {
    // The answer word is an item (extract.ts) but no tile pick is a lex produce format (section 4.3): a due answer word
    // gets its read-rung credit inside the sentence (withSentenceCredit), never a produce grade from this round.
    expect(askedOfScope(scope, 'e2e-cloze-word')).toEqual({ texts: [{ ko: '책을 읽어요.', kind: 'pat' }], jamoIds: [], rung: 'produce' });
    expect(askedOfScope(scope, 'e2e-cloze-particle')).toEqual({ texts: [{ ko: '물을 마셔요.', kind: 'pat' }], jamoIds: [], rung: 'produce' });
  });

  it('a value gap asks its card; without a card, or an unknown round, nothing', () => {
    expect(askedOfScope(scope, 'e2e-cloze-value')).toEqual({ texts: [{ ko: '사과', kind: 'rea' }], jamoIds: [], rung: 'produce' });
    expect(askedOfScope(clozeFixtureScope(['word']), 'e2e-cloze-value')).toBeUndefined();
    const noCard = { ...scope, clozePick: { rounds: scope.clozePick!.rounds } };
    expect(askedOfScope(noCard, 'e2e-cloze-value')).toBeUndefined();
    expect(askedOfScope(scope, 'nope')).toBeUndefined();
  });
});

describe('adaptive pacing (row CM-24) on a Cloze Pick scope', () => {
  it('a shorter Apply drops the last round and keeps the card', () => {
    const short = shortenScope(clozeFixtureScope(['word', 'particle', 'value']));
    expect(short?.clozePick?.rounds.map((r) => r.id)).toEqual(['e2e-cloze-word', 'e2e-cloze-particle']);
    expect(short?.clozePick?.realia?.ref).toBe('realia:e2e-cloze-prices');
    expect(short?.rounds).toBe(2);
    expect(shortenScope(clozeFixtureScope(['word', 'particle']))).toBeNull();
  });

  it('the scaffold round hears the completed sentences; a value gap adds none', () => {
    const scope = clozeFixtureScope(['word', 'particle', 'value']);
    expect(scopeItems(scope).map((t) => t.ko)).toEqual(['책을 읽어요.', '물을 마셔요.']);
    const scaffold = scaffoldScope(scope, [{ scope, itemId: 'e2e-cloze-particle' }]);
    expect(scaffold?.listenPick?.rounds[0]?.prompt.ko).toBe('물을 마셔요.');
    expect(scaffold?.listenPick?.rounds[0]?.options.map((o) => o.text?.ko)).toEqual(['물을 마셔요.', '책을 읽어요.']);
    expect(scaffoldScope(scope, [{ scope, itemId: 'e2e-cloze-value' }])).toBeNull();
  });
});

describe('My Route', () => {
  it('counts Cloze Pick for reading', () => {
    expect(SKILL_OF_KIND['cloze-pick']).toEqual(['read']);
  });
});
