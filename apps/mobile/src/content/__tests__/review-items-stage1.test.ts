import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Stage1TableSchema, serializeStage1Table, stage1Table } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { minigameScopes } from '../../logic/minigame-config';
import { jamoAll, jamoKnown } from '../jamo';
import { stage1Quests } from '../quests';

/**
 * F-CURR-002 §4.2 (row CM-10): Stage 1 is hand-written TypeScript, so its review items come from
 * a frozen table, packages/content-schema/src/review-items/stage1-items.json, that the build reads
 * (scripts/build-review-items.mjs) without loading the app. This parity test re-extracts the table
 * from the live Stage 1 data (the symbol table, the 15 quests, their game scopes) and fails on any
 * difference, so the frozen copy can never drift from what Stage 1 teaches.
 *
 * After a Stage 1 edit (row CM-33's new rows, say), rewrite the table with
 *   REVIEW_ITEMS_STAGE1_WRITE=1 pnpm --filter @hangul-route/mobile exec vitest run src/content/__tests__/review-items-stage1.test.ts
 * and commit it with the edit; scripts/build-review-items.mjs then names any frozen id the edit changed.
 */

const TABLE = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'content-schema', 'src', 'review-items', 'stage1-items.json');

const live = stage1Table({ symbols: jamoKnown, quests: stage1Quests, scopes: minigameScopes });

describe('Stage 1 review items (F-CURR-002 §4.2, row CM-10)', () => {
  if (process.env.REVIEW_ITEMS_STAGE1_WRITE === '1') writeFileSync(TABLE, serializeStage1Table(live));
  const text = readFileSync(TABLE, 'utf8');
  const frozen = Stage1TableSchema.parse(JSON.parse(text));

  it('the frozen table equals the Stage 1 data (parity)', () => {
    expect(frozen).toEqual(live);
  });

  it('is committed in its canonical form, one entry per line', () => {
    expect(text).toBe(serializeStage1Table(live));
  });

  it('carries the whole symbol table: the 30 Stage 1 symbols and the Word Builder ones', () => {
    expect(frozen.symbols.map((s) => s.id)).toEqual(jamoKnown.map((j) => j.id));
  });

  it('every Stage 1 symbol is taught on a Discover page of Stage 1', () => {
    const taught = new Set(frozen.occurrences.filter((o) => o.kind === 'sym' && o.source === 'discover').map((o) => o.ref));
    expect(jamoAll.filter((j) => !taught.has(j.id)).map((j) => j.id)).toEqual([]);
  });

  it('every scored Stage 1 game step gives items, each in its own Stage 1 cell', () => {
    for (const quest of stage1Quests) {
      const theme = /^quest:stage1-([a-z]+)-q\d+$/.exec(quest.id)?.[1];
      for (const step of quest.steps.filter((s) => ['practice', 'apply', 'check'].includes(s.kind))) {
        const items = frozen.occurrences.filter((o) => o.at.startsWith(`${quest.id} `) && o.at.includes(` ${step.minigameRef}`));
        expect(items.length, `${quest.id} ${step.id}`).toBeGreaterThan(0);
        expect(new Set(items.map((o) => o.cell))).toEqual(new Set([`episode:stage1-${theme}`]));
      }
    }
  });

  it('reads symbols, syllable blocks and words, all at Stage 1 Volume 1', () => {
    expect(new Set(frozen.occurrences.map((o) => o.kind))).toEqual(new Set(['sym', 'syl', 'lex']));
    expect(frozen.occurrences.every((o) => o.stage === 1 && o.volume === 1)).toBe(true);
  });
});
