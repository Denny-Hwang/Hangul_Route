import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlacementBankSchema, PlacementTemplateSchema } from '@hangul-route/content-schema';
import { loadModel, renderBank } from '../../../../../scripts/build-placement-bank.mjs';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../placement.generated';

/**
 * F-PLC-001 section 5: the generated bank equals content/placement/*.json, and every
 * `card:` picture of a drawable (ready) template resolves in the design system's art.
 */

const REPO_ROOT = join(__dirname, '../../../../..');

/**
 * `supportedCardIds` of HeritageCardArt, read from its source: the design-system
 * entry pulls in react-native, which the node test environment cannot load.
 */
function supportedCardIds(): string[] {
  const source = readFileSync(
    join(REPO_ROOT, 'packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx'),
    'utf8',
  );
  const block = /export const supportedCardIds[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  if (block === null) throw new Error('supportedCardIds not found in HeritageCardArt.tsx');
  return [...(block[1] as string).matchAll(/'(card:[a-z0-9-]+)'/g)].map((m) => m[1] as string);
}

const pictures = (options: ReadonlyArray<{ pictureRef?: string }>): string[] =>
  options.flatMap((o) => (o.pictureRef === undefined ? [] : [o.pictureRef]));

describe('placement.generated.ts (F-PLC-001 P-4)', () => {
  it('is exactly what the builder makes from content/placement/*.json', () => {
    const model = loadModel(REPO_ROOT);
    expect(PLACEMENT_BANK).toEqual(model.bank);
    expect(PLACEMENT_WARMUP).toEqual(model.warmup);
    const onDisk = readFileSync(join(REPO_ROOT, 'apps/mobile/src/content/placement.generated.ts'), 'utf8');
    expect(onDisk).toBe(renderBank(model));
  });

  it('parses with PlacementBankSchema, and the warm-up with PlacementTemplateSchema', () => {
    expect(() => PlacementBankSchema.parse(PLACEMENT_BANK)).not.toThrow();
    expect(() => PlacementTemplateSchema.parse(PLACEMENT_WARMUP)).not.toThrow();
    expect(PLACEMENT_BANK.templates).toHaveLength(265);
  });

  it('every picture of a ready template, and of the warm-up, resolves in supportedCardIds', () => {
    const art = supportedCardIds();
    expect(art).toHaveLength(30);
    for (const t of [...PLACEMENT_BANK.templates.filter((x) => x.status === 'ready'), PLACEMENT_WARMUP]) {
      for (const ref of pictures(t.question.options)) expect(art, `${t.id} ${ref}`).toContain(ref);
    }
  });

  it('a template whose picture has no art yet is draft, so it is never drawn', () => {
    const art = supportedCardIds();
    const missing = PLACEMENT_BANK.templates.filter((t) => pictures(t.question.options).some((ref) => !art.includes(ref)));
    expect(missing).toHaveLength(17);
    expect(missing.every((t) => t.status === 'draft')).toBe(true);
  });
});
