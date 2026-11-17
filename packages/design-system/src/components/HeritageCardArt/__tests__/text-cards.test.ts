import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedCardIds } from '../card-ids';
import { albumLegendArtIds, upperCellCardArtIds } from '../upper-card-ids';

/**
 * AMENDMENTS-PICTURES-2026-11 rule R5 (row PX-0): no picture names itself in
 * print where it can be a question's picture. Some card arts draw their own
 * word as text (the Stage 6 and 7 cards and the legendary cards of
 * `UpperCellArt.tsx`); such a card is a collectible and is never the picture of
 * a vocabulary word or of a question, where the print would give the answer.
 *
 * The text cards are read from the drawings' source, not listed here: a card
 * is a text card when its drawing reaches a text element (`SvgText`, through
 * `word(...)`, `<Page>` or `<Legend>`). The picture sources are every
 * `visual`, `picture` and `pictureRef` of `content/**` (vocabulary words,
 * quest questions, placement questions, fixtures included).
 */

const HERE = join(__dirname, '..');
const CONTENT = join(__dirname, '..', '..', '..', '..', '..', '..', 'content');

/** Card ids whose drawing function reaches a text element, read from a card-art source file. */
export function textCardIds(source: string): string[] {
  const fns = new Map([...source.matchAll(/^function (\w+)\([^)]*\)[^{]*\{[\s\S]*?^}$/gm)].map((m) => [m[1]!, m[0]]));
  // helpers that draw text: `word(...)` wraps SvgText, and any component whose body draws text passes it on
  const drawsText = (body: string, seen: ReadonlySet<string> = new Set()): boolean =>
    /<SvgText\b|\bword\(/.test(body) ||
    [...body.matchAll(/<([A-Z]\w*)\b/g)].some(([, name]) => !seen.has(name!) && fns.has(name!) && drawsText(fns.get(name!)!, new Set([...seen, name!])));
  return [...source.matchAll(/case '(card:[a-z0-9-]+)':\s*return <(\w+)\b/g)].filter(([, , fn]) => drawsText(fns.get(fn!) ?? '')).map(([, id]) => id!);
}

export interface PictureUse {
  file: string;
  key: string;
  ref: string;
}

const PICTURE_KEYS = new Set(['visual', 'picture', 'pictureRef']);

/** Every `visual`, `picture` and `pictureRef` string under a parsed JSON value. */
export function pictureUses(value: unknown, file: string): PictureUse[] {
  if (Array.isArray(value)) return value.flatMap((v) => pictureUses(v, file));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, v]) => (PICTURE_KEYS.has(key) && typeof v === 'string' ? [{ file, key, ref: v }] : pictureUses(v, file)));
}

/** The uses whose card draws text: the R5 violations. */
export const textCardUses = (uses: readonly PictureUse[], textCards: readonly string[]): PictureUse[] => uses.filter((u) => textCards.includes(u.ref));

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsonFiles(path);
    return name.endsWith('.json') ? [path] : [];
  });
}

const TEXT_CARDS = [...textCardIds(readFileSync(join(HERE, 'HeritageCardArt.tsx'), 'utf8')), ...textCardIds(readFileSync(join(HERE, 'UpperCellArt.tsx'), 'utf8'))];

describe('text cards (rule R5)', () => {
  it('finds the cards that draw text from the drawings: the Stage 6 and 7 cards and the legendary cards, no Stage 1 card', () => {
    expect([...TEXT_CARDS].sort()).toEqual(
      ['won', 'yeogiyo', 'gichapyo', 'jeongsang', 'deom', 'ireum', 'achim', 'saengil', 'tokki', 'bihaenggi', 'hunminjeongeum', 'jang', 'hangawi', 'jirisan', 'ssireum'].map((c) => `card:${c}`).sort(),
    );
    for (const id of TEXT_CARDS) {
      expect(supportedCardIds).not.toContain(id);
      expect([...upperCellCardArtIds, ...albumLegendArtIds]).toContain(id);
    }
  });

  it('the reader follows a helper to the text and ignores a drawing without any', () => {
    const source = [
      'const word = (t: string) => <SvgText>{t}</SvgText>;',
      'function Frame({ name }: P) {\n  return <G>{word(name)}</G>;\n}',
      'function PlainArt(p: ArtProps) {\n  return <Circle r={4} />;\n}',
      'function DirectArt(p: ArtProps) {\n  return <SvgText>a</SvgText>;\n}',
      'function CalledArt(p: ArtProps) {\n  return <G>{word("a")}</G>;\n}',
      'function FramedArt(p: ArtProps) {\n  return <Frame name="a" />;\n}',
      "switch (id) {\n  case 'card:plain': return <PlainArt {...p} />;\n  case 'card:direct': return <DirectArt {...p} />;\n  case 'card:called': return <CalledArt {...p} />;\n  case 'card:framed':\n    return <FramedArt {...p} />;\n}",
    ].join('\n');
    expect(textCardIds(source)).toEqual(['card:direct', 'card:called', 'card:framed']);
  });

  it('reads visual, picture and pictureRef at any depth, and nothing else', () => {
    const uses = pictureUses({ items: [{ id: 'card:won', visual: 'card:rice', steps: [{ picture: 'word:food-apple', options: [{ pictureRef: 'card:won', rewardCardId: 'card:jang' }] }] }] }, 'x.json');
    expect(uses.map((u) => `${u.key}=${u.ref}`)).toEqual(['visual=card:rice', 'picture=word:food-apple', 'pictureRef=card:won']);
  });

  it('would fail on a vocabulary word or a question that takes a text card as its picture', () => {
    const vocab = pictureUses({ items: [{ id: 'vocab:won', visual: 'card:won' }] }, 'content/vocab/shopping.json');
    const quest = pictureUses({ quests: [{ check: { options: [{ pictureRef: 'card:hangawi' }, { pictureRef: 'card:chuseok' }] } }] }, 'content/episodes/x.json');
    expect(textCardUses(vocab, TEXT_CARDS)).toEqual([{ file: 'content/vocab/shopping.json', key: 'visual', ref: 'card:won' }]);
    expect(textCardUses(quest, TEXT_CARDS).map((u) => u.ref)).toEqual(['card:hangawi']);
  });

  const files = jsonFiles(CONTENT);
  const uses = files.flatMap((file) => pictureUses(JSON.parse(readFileSync(file, 'utf8')) as unknown, relative(CONTENT, file)));

  it('scans the vocabulary topics and the lessons', () => {
    const scanned = new Set(uses.map((u) => u.file.split(/[\\/]/)[0]));
    expect(scanned).toContain('vocab');
    expect(scanned).toContain('episodes');
    expect(uses.filter((u) => u.file.startsWith('vocab')).length).toBeGreaterThan(100);
    expect(uses.length).toBeGreaterThan(500);
  });

  it('no vocabulary word and no question picture in content/ is a card that draws text', () => {
    expect(textCardUses(uses, TEXT_CARDS).map((u) => `${u.file} ${u.key} ${u.ref}`)).toEqual([]);
  });
});
