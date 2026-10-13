import { readFileSync } from 'node:fs';
import {
  ROMANIZATION_EXCEPTIONS,
  checkConsistency,
  checkProse,
  checkRomanization,
  formatRomanizationFinding,
  lineOfText,
  type RomanizationEntry,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll } from '../../../../mobile/src/content/heritage-cards';
import { stage1Cards } from '../stage1-cards';

// F-CNT-002 PR 3, source class B2 (web landing data): the landing cards are Revised
// Romanization, unhyphenated, and agree with the app's cards that share a Korean string.

const FILE = 'apps/web/src/data/stage1-cards.ts';
const source = readFileSync(new URL('../stage1-cards.ts', import.meta.url), 'utf8');
const line = (ko: string): number | undefined => lineOfText(source, `ko: '${ko}'`);

describe('stage1Cards romanization (landing data, B2)', () => {
  it('every card passes R1 to R4 (Revised Romanization, no hyphens, one word per word)', () => {
    const found = stage1Cards.flatMap((c) =>
      checkRomanization(c.ko, c.romanization, { exceptions: ROMANIZATION_EXCEPTIONS }).map((i) =>
        formatRomanizationFinding(FILE, line(c.ko), i),
      ),
    );
    expect(found).toEqual([]);
  });

  it('shows how K-pop and yutnori are said, keeping the English names', () => {
    const byId = (id: string) => stage1Cards.find((c) => c.id === id);
    expect(byId('card:kpop')).toMatchObject({ title: 'K-pop', en: 'K-pop music', romanization: 'keipap' });
    expect(byId('card:yutnori')?.romanization).toBe('yunnori');
  });

  it('prose spells registered words without syllable hyphens (R6)', () => {
    const registry = stage1Cards.map((c) => c.ko);
    const found = stage1Cards.flatMap((c) =>
      checkProse(`${c.blurb} ${c.en} ${c.title}`, registry).map((i) => formatRomanizationFinding(FILE, line(c.ko), i)),
    );
    expect(found).toEqual([]);
  });

  it('R5: a Korean string shared with the app cards or the stage 1 JSON has the same spelling', () => {
    const jsonCards = JSON.parse(
      readFileSync(new URL('../../../../../content/episodes/stage-1/cards.json', import.meta.url), 'utf8'),
    ) as Array<{ ko: string; romanization: string }>;
    const entries: RomanizationEntry[] = [
      ...stage1Cards.map((c) => ({ ko: c.ko, romanization: c.romanization, where: `${FILE}:${line(c.ko) ?? 0}` })),
      ...heritageCardsAll.flatMap((c) =>
        c.subtitleKo === undefined ? [] : [{ ko: c.subtitleKo, romanization: c.romanization ?? '', where: `apps/mobile/src/content/heritage-cards.ts:${c.id}` }],
      ),
      ...jsonCards.map((c) => ({ ko: c.ko, romanization: c.romanization, where: `content/episodes/stage-1/cards.json:${c.ko}` })),
    ];
    const shared = new Set(stage1Cards.map((c) => c.ko));
    expect(entries.filter((e) => shared.has(e.ko)).length).toBeGreaterThan(stage1Cards.length);
    expect(checkConsistency(entries).map((i) => formatRomanizationFinding(FILE, undefined, i))).toEqual([]);
  });
});
