import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconNames } from '@hangul-route/design-system/icon-glyphs';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { SPEAKING_GAME_KINDS, minigameCatalog, siteGames, type MinigameFamily } from '../minigame-catalog';

const VALID_FAMILIES: readonly MinigameFamily[] = ['recognition', 'production', 'application', 'review'];

/**
 * The Stage 1 kinds the learner app plays, read from `apps/mobile/src/logic/minigame-config.ts` (every
 * `'minigame:s1-…': { kind: '…' }` scope), with how many steps use each. Read as text: the web app does not import the
 * learner app's modules.
 */
function stage1KindsInApp(): Map<string, number> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const source = readFileSync(join(root, 'mobile', 'src', 'logic', 'minigame-config.ts'), 'utf8');
  const counts = new Map<string, number>();
  for (const match of source.matchAll(/^\s*'minigame:s1-[^']+':\s*\{\s*kind:\s*'([a-z-]+)'/gm)) {
    const kind = match[1] ?? '';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

describe('minigameCatalog (the /learners games fold, F-SITE-002 §3.4)', () => {
  const app = stage1KindsInApp();

  it('reads the Stage 1 scopes of the learner app', () => {
    expect(Object.fromEntries(app)).toEqual({
      'listen-pick': 22,
      'match-sound': 7,
      'build-letter': 7,
      'pic-word-match': 4,
      'trace-stroke': 2,
      'odd-one-out': 1,
      'culture-quiz': 1,
      'story-sequence': 1,
    });
  });

  it('lists every Stage 1 kind the app plays, and only those, most played first', () => {
    const kinds = minigameCatalog.map((m) => m.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect([...kinds].sort()).toEqual([...app.keys()].sort());
    const plays = kinds.map((kind) => app.get(kind) ?? 0);
    expect(plays).toEqual([...plays].sort((a, b) => b - a));
  });

  it('holds no game of a later stage: no Tap to Respond (Stage 4 and 6 dialogues), no Card Match (Stage 2)', () => {
    const kinds: readonly string[] = minigameCatalog.map((m) => m.kind);
    expect(kinds).not.toContain('tap-respond');
    expect(kinds).not.toContain('card-match');
  });

  it('every game has a valid family, and its copy lives in the dictionary, not here', () => {
    for (const game of minigameCatalog) {
      expect(VALID_FAMILIES).toContain(game.family);
      expect(Object.keys(game).sort()).toEqual(['family', 'icon', 'kind', 'status']);
    }
  });

  it('every game has a title and a blurb in en, es and ko, each in its own language', () => {
    const en = getMessages('en').landing.games.items;
    for (const locale of ['en', 'es', 'ko'] as const) {
      const items = getMessages(locale).landing.games.items;
      expect(Object.keys(items).sort(), locale).toEqual(minigameCatalog.map((m) => m.kind).sort());
      for (const { kind } of minigameCatalog) {
        expect(items[kind].title.trim().length, `${locale} ${kind}`).toBeGreaterThan(0);
        expect(items[kind].blurb.trim().length, `${locale} ${kind}`).toBeGreaterThan(0);
        if (locale !== 'en') {
          expect(items[kind].title, `${locale} ${kind}`).not.toBe(en[kind].title);
          expect(items[kind].blurb, `${locale} ${kind}`).not.toBe(en[kind].blurb);
        }
      }
    }
  });

  it('pins the English copy, checked against each game screen (no timer, no "laughs")', () => {
    const en = getMessages('en').landing.games.items;
    expect(en).toEqual({
      'listen-pick': { title: 'Listen and pick', blurb: 'Hear a sound, then tap the letter or word.' },
      'match-sound': { title: 'Match the sound', blurb: 'Hear a letter. Tap the matching tile. No rush.' },
      'build-letter': { title: 'Build the syllable', blurb: 'Put letters together to make a real Korean syllable.' },
      'pic-word-match': { title: 'Picture and word', blurb: 'Tap a picture, then its word.' },
      'trace-stroke': { title: 'Trace the letter', blurb: 'Follow the stroke order. Your finger learns the shape.' },
      // OddOneOutGame: three tiles of one kind and one of the other (round-builder buildOddOneOutRounds).
      'odd-one-out': { title: 'Odd one out', blurb: 'Three belong together. Can you find the one that is different?' },
      // CultureQuizGame: a Korean word (no picture, no timer) and four meanings (buildCultureQuizRounds optionCount 4).
      'culture-quiz': { title: 'Culture quiz', blurb: 'A Korean word and four answers. Pick what it means.' },
      // StorySequenceGame on 'minigame:s1-rites-q3-apply': four New Year steps, tapped in order.
      'story-sequence': { title: 'Story sequence', blurb: 'Four cards, one story. Tap them in the order they happen.' },
    });
  });

  it('every game draws a distinct design-system icon, never an emoji', () => {
    for (const game of minigameCatalog) {
      expect(iconNames, game.kind).toContain(game.icon);
      expect(game).not.toHaveProperty('emoji');
    }
    expect(new Set(minigameCatalog.map((m) => m.icon)).size).toBe(minigameCatalog.length);
  });

  it('every listed game is shipped (none is in beta)', () => {
    expect(minigameCatalog.filter((m) => m.status !== 'shipped')).toEqual([]);
  });
});

describe('siteGames (F-SITE-002 §3.4: no speaking line on the site)', () => {
  it('is the catalogue without a speaking game, in catalogue order', () => {
    expect(SPEAKING_GAME_KINDS).toEqual(['voice-echo']);
    expect(siteGames.map((g) => g.kind)).toEqual(minigameCatalog.filter((g) => !SPEAKING_GAME_KINDS.includes(g.kind)).map((g) => g.kind));
    expect(siteGames.map((g) => g.kind)).not.toContain('voice-echo');
  });

  it('holds no line about saying anything, in any UI locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const items = getMessages(locale).landing.games.items;
      for (const game of siteGames) {
        expect(`${items[game.kind].title} ${items[game.kind].blurb}`, locale).not.toMatch(/\b(say|speak|speaking|pronounce|di|habla|pronuncia)\b|말해|발음/i);
      }
    }
  });
});
