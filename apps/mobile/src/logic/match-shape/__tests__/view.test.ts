import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { minigameScopes } from '../../minigame-config';
import { startShape, stepShape, type OriginRound, type PairRound, type PairState } from '../flow';
import { shapeLetter } from '../letters';
import { originTiles, pairHeading, pairTiles, soundSpoken } from '../view';

/**
 * F-CURR-002 section 7.1 F4, row CM-33 (match-shape.md, Accessibility and "Where this comes from"): what a round draws
 * and how a screen reader names it, in every UI language, and the round never leaves the app.
 */

const ROUNDS = Object.values(minigameScopes).flatMap((s) => s.matchShape?.rounds ?? []);
const PAIRS = ROUNDS.filter((r): r is PairRound => r.shape === 'pair');
const ORIGINS = ROUNDS.filter((r): r is OriginRound => r.shape === 'origin');
const LOCALES = ['en', 'es', 'ko'] as const;

describe('pair tiles: named by the letter, never by its sound, until found', () => {
  it('the Stage 1 scopes hold pair rounds and origin rounds', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(4);
    expect(ORIGINS.length).toBeGreaterThanOrEqual(8);
  });

  it.each(LOCALES)('%s: the target tiles and the look-alike tiles have different names, and no unfound name holds the sound', (locale) => {
    const a11y = getMessages(locale).a11y.minigame.matchShape;
    for (const round of PAIRS) {
      const tiles = pairTiles(round, startShape(round) as PairState, a11y);
      const names = (t: 'l' | 't') => new Set(tiles.filter((x) => round.layout[x.index] === t).map((x) => x.accessibilityLabel));
      const [targetNames, lookNames] = [names('t'), names('l')];
      expect(targetNames.size, round.id).toBe(1);
      expect(lookNames.size, round.id).toBe(1);
      expect([...targetNames][0], round.id).not.toBe([...lookNames][0]);
      for (const tile of tiles) {
        expect(tile.sound, round.id).toBeNull();
        const letter = shapeLetter(round.layout[tile.index] === 't' ? round.target : round.lookAlike);
        // ", b or p" would answer the round; a vowel's name is its sound, as the Stage 1 lessons name it.
        if (letter.name !== letter.sound) expect(tile.accessibilityLabel.split(', '), `${locale} ${round.id}`).not.toContain(soundSpoken(letter.sound, a11y));
      }
    }
  });

  it('a found tile shows its sound and says it; the heading names the target and its sound', () => {
    const a11y = getMessages('en').a11y.minigame.matchShape;
    const round = PAIRS.find((r) => r.id === 'ms:pair:bieup')!;
    const first = round.layout.indexOf('t');
    const state = stepShape(startShape(round), { type: 'tap-tile', index: first }, round).state as PairState;
    const tiles = pairTiles(round, state, a11y);
    expect(tiles[first]).toMatchObject({ char: 'ㅂ', sound: 'b/p', look: 'found', accessibilityLabel: 'ㅂ, letter bieup, b or p, found' });
    expect(tiles[round.layout.indexOf('l')]).toMatchObject({ char: 'ㅍ', sound: null, look: 'plain', accessibilityLabel: 'ㅍ, letter pieup' });
    expect(pairHeading(round, a11y)).toEqual({ char: 'ㅂ', sound: 'b/p', accessibilityLabel: 'Tap every ㅂ, letter bieup, b or p' });
  });
});

describe('origin tiles', () => {
  it.each(LOCALES)('%s: each tile is named by its letter and its sound read as words', (locale) => {
    const a11y = getMessages(locale).a11y.minigame.matchShape;
    for (const round of ORIGINS) {
      const tiles = originTiles(round, startShape(round) as never, a11y);
      expect(tiles.map((t) => t.id), round.id).toEqual(round.options);
      expect(new Set(tiles.map((t) => t.accessibilityLabel)).size, round.id).toBe(3);
      for (const t of tiles) expect(t.accessibilityLabel, round.id).not.toContain('/');
    }
    expect(soundSpoken('g/k', a11y)).not.toContain('/');
    expect(soundSpoken('n', a11y)).toBe('n');
  });

  it('a miss locks the tile, a second rings the letter; the right tile is found', () => {
    const a11y = getMessages('en').a11y.minigame.matchShape;
    const round = ORIGINS.find((r) => r.id === 'ms:origin:nieun')!;
    let state = startShape(round);
    state = stepShape(state, { type: 'tap', id: 'jamo:giyeok' }, round).state;
    state = stepShape(state, { type: 'tap', id: 'jamo:mieum' }, round).state;
    expect(originTiles(round, state as never, a11y).map((t) => t.look)).toEqual(['marked', 'ring', 'marked']);
    state = stepShape(state, { type: 'tap', id: 'jamo:nieun' }, round).state;
    expect(originTiles(round, state as never, a11y).map((t) => t.look)).toEqual(['marked', 'found', 'marked']);
  });
});

describe('the round never leaves the app (no link, no navigation)', () => {
  const ROOT = join(__dirname, '..', '..', '..');
  const files = [
    ...readdirSync(join(ROOT, 'logic', 'match-shape')).filter((f) => f.endsWith('.ts')).map((f) => join(ROOT, 'logic', 'match-shape', f)),
    ...['MatchShapeBoard.tsx', 'MatchShapeGame.tsx', 'MatchShapeStepBody.tsx', 'ReadPickGame.tsx', 'ShapeRoundView.tsx', 'match-shape-chunk.tsx', 'match-shape-entry.tsx'].map((f) => join(ROOT, 'screens', 'minigames', f)),
  ];

  it.each(files.map((f) => [f.slice(ROOT.length + 1), f]))('%s imports no Linking, opens no URL and names no route out', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/\bLinking\b|openExternalUrl|openURL|navigation\.|navigate\(|'StorySources'|'ExternalLink'|'CultureNotes'/);
  });
});
