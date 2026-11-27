import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTEN_FIRST_FORMATS, PlacementBankSchema, PlacementTemplateSchema } from '@hangul-route/content-schema';
import { loadModel, renderBank } from '../../../../../scripts/build-placement-bank.mjs';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../placement.generated';

/**
 * F-PLC-001 section 5: the generated bank equals content/placement/*.json, and every
 * `card:` picture of a drawable (ready) template resolves in the design system's art.
 */

const REPO_ROOT = join(__dirname, '../../../../..');

/**
 * `supportedCardIds` of HeritageCardArt, read from its pure source file
 * (`card-ids.ts`, F-VOC-002 W-1a): the design-system entry pulls in
 * react-native, which the node test environment cannot load.
 */
function supportedCardIds(): string[] {
  const source = readFileSync(
    join(REPO_ROOT, 'packages/design-system/src/components/HeritageCardArt/card-ids.ts'),
    'utf8',
  );
  const block = /export const supportedCardIds[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  if (block === null) throw new Error('supportedCardIds not found in HeritageCardArt/card-ids.ts');
  return [...(block[1] as string).matchAll(/'(card:[a-z0-9-]+)'/g)].map((m) => m[1] as string);
}

/**
 * The level check's action pictures (`ACT_FAMILIES` of the WordArt registry, AMENDMENTS-PLC-VALIDITY PV-1a), as
 * `word:act-<predicate>-<noun>` refs, read from the registry's source for the same reason as above.
 */
function actKeys(): string[] {
  const source = readFileSync(join(REPO_ROOT, 'packages/design-system/src/word-art/registry.ts'), 'utf8');
  const table = source.slice(source.indexOf('export const ACT_FAMILIES')).split('});')[0] as string;
  return [...table.matchAll(/(\w+): Object\.freeze\(\[([^\]]*)\]\)/g)].flatMap((m) =>
    [...(m[2] as string).matchAll(/'([a-z]+)'/g)].map((p) => `word:act-${p[1] as string}-${m[1] as string}`),
  );
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
    expect(PLACEMENT_BANK.templates).toHaveLength(276);
  });

  it('every template is ready, and every picture resolves: a card in supportedCardIds, an action picture in ACT_KEYS (PV-1c)', () => {
    const art = supportedCardIds();
    expect(art).toHaveLength(30);
    const acts = actKeys();
    expect(acts).toHaveLength(30);
    expect(PLACEMENT_BANK.templates.filter((t) => t.status !== 'ready').map((t) => t.id)).toEqual([]);
    let actRefs = 0;
    for (const t of [...PLACEMENT_BANK.templates, PLACEMENT_WARMUP]) {
      for (const ref of pictures(t.question.options)) {
        if (ref.startsWith('word:act-')) {
          actRefs += 1;
          expect(acts, `${t.id} ${ref}`).toContain(ref);
        } else expect(art, `${t.id} ${ref}`).toContain(ref);
      }
    }
    expect(actRefs).toBe(240);
  });
});

describe('recognition templates (the report reads a screen reader from them)', () => {
  it('need no sound, no picture, never leak and are listen-first formats, so only a screen reader makes the rung unavailable', () => {
    const recog = PLACEMENT_BANK.templates.filter((t) => t.gate === 'recog' && t.status === 'ready');
    expect(recog.length).toBeGreaterThanOrEqual(3);
    for (const t of recog) {
      expect(t.question.requires, t.id).toEqual({ audio: false, picture: null });
      expect(t.question.leaks, t.id).toBe(false);
      expect(LISTEN_FIRST_FORMATS, t.id).toContain(t.question.format);
      expect(t.question.tags.some((tag) => tag.startsWith('word:')), t.id).toBe(false);
    }
  });
});
