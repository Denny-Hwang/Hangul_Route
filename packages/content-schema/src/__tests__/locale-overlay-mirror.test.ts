import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as mirror from '../../../../scripts/overlay-fields.mjs';
import {
  NEVER_OVERRIDABLE_FIELDS,
  OVERLAY_ENTITY_ID,
  OVERLAY_FIELDS,
  OVERLAY_LOCALES,
  isOverlayFieldAllowed,
  overlayElementKey,
  overlayPrefix,
  overlayTargets,
  translatableFields,
} from '../index';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-I18N-001 §3.7: `scripts/overlay-fields.mjs` (read by the validator and the
 * generator, plain Node) mirrors the TypeScript allow-list and path rules. This
 * keeps them equal: the tables are compared, and both implementations run over
 * every entity of the shipped JSON content.
 */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'research' || e.name === 'i18n' ? [] : jsonFiles(full);
    return e.name.endsWith('.json') ? [full] : [];
  });
}

/** Every object of the base content that carries an entity id. */
function baseEntities(): Array<[string, Rec]> {
  const out: Array<[string, Rec]> = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!isRec(value)) return;
    if (typeof value.id === 'string' && OVERLAY_ENTITY_ID.test(value.id)) out.push([value.id, value]);
    Object.values(value).forEach(walk);
  };
  for (const file of jsonFiles(join(REPO_ROOT, 'content'))) walk(JSON.parse(readFileSync(file, 'utf8')));
  return out;
}

describe('scripts/overlay-fields.mjs mirrors the TypeScript allow-list', () => {
  it('has the same locales, id grammar, table and never-overridable list', () => {
    expect([...mirror.OVERLAY_LOCALES]).toEqual([...OVERLAY_LOCALES]);
    expect(mirror.OVERLAY_ENTITY_ID.source).toBe(OVERLAY_ENTITY_ID.source);
    expect(JSON.parse(JSON.stringify(mirror.OVERLAY_FIELDS))).toEqual(JSON.parse(JSON.stringify(OVERLAY_FIELDS)));
    expect([...mirror.NEVER_OVERRIDABLE_FIELDS]).toEqual([...NEVER_OVERRIDABLE_FIELDS]);
    for (const prefix of mirror.TS_RESIDENT_PREFIXES) expect(Object.keys(OVERLAY_FIELDS)).toContain(prefix);
  });

  it('decides every field of every overlay in content/i18n the same way, plus hand-picked edge cases', () => {
    const cases: Array<[string, string]> = [
      ['card:a', 'title'],
      ['card:a', 'romanization'],
      ['quest:q', 'steps.intro.title'],
      ['quest:q', 'steps..title'],
      ['story:s', 'checks.c1.options.a'],
      ['story:s', 'scenes.s1.narration.x'],
      ['story:s', 'tiers.read.scenes.s1.narration'],
      ['story:s', 'tiers.listen.scenes.s1.alt'],
      ['story:s', 'tiers.read.checks.r1.prompt'],
      ['minigame:m', 'listenPick.rounds.lp-sym-jamo-eo.prompt'],
      ['minigame:m', 'rounds.r1.prompt'],
      ['minigame:m', 'realiaRead.rounds.q4.options.bread.label'],
      ['minigame:m', 'realiaRead.rounds.q1.question'],
      ['minigame:m', 'realiaRead.realia.entries.ramyeon.value.gloss'],
      ['minigame:m', 'realiaRead.rounds.q1.key.gloss'],
      ['quest:q', 'teaser'],
      ['quest:q', 'steps.d.discover.pages.0.items.1.example.gloss'],
      ['quest:q', 'steps.d.discover.pages.0.items.1.word.ko'],
      ['nocolon', 'title'],
      ['planet:x', 'title'],
    ];
    const i18n = join(REPO_ROOT, 'content', 'i18n');
    const locales = readdirSync(i18n, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    for (const locale of locales) {
      for (const name of readdirSync(join(i18n, locale)).filter((n) => n.endsWith('.json'))) {
        const file = JSON.parse(readFileSync(join(i18n, locale, name), 'utf8')) as { entries: Record<string, Rec> };
        for (const [id, entry] of Object.entries(file.entries)) for (const field of Object.keys(entry)) cases.push([id, field]);
      }
    }
    expect(cases.length).toBeGreaterThan(300);
    for (const [id, field] of cases) {
      expect(mirror.isOverlayFieldAllowed(id, field), `${id} ${field}`).toBe(isOverlayFieldAllowed(id, field));
      expect(mirror.overlayPrefix(id)).toBe(overlayPrefix(id));
    }
  });

  it('enumerates and resolves the same paths over every base content entity', () => {
    const entities = baseEntities();
    const prefixes = new Set(entities.map(([id]) => overlayPrefix(id)));
    for (const p of ['card', 'jamo', 'story', 'vocab', 'vocab-topic', 'pitem']) expect(prefixes.has(p), p).toBe(true);
    let fields = 0;
    for (const [id, entity] of entities) {
      const ts = translatableFields(id, entity);
      expect(mirror.translatableFields(id, entity), id).toEqual(ts);
      for (const { field, path } of ts) {
        fields += 1;
        expect(overlayTargets(entity, field), `${id} ${field}`).toContainEqual(path);
        expect(mirror.overlayTargets(entity, field), `${id} ${field}`).toEqual(overlayTargets(entity, field));
      }
    }
    expect(fields).toBeGreaterThan(1000);
  });

  it('keys elements the same way', () => {
    const samples: unknown[] = [
      { id: 'a' },
      { key: 'k' },
      { romanization: 'Ne, joayo!' },
      { romanization: '' },
      'x',
      null,
      { id: '' },
      { id: 'lp:sym:jamo:eo' },
      { id: 'lp:syl:가' },
      { id: 'lp:word:강아지', key: 'Odd Key' },
      { id: '::' },
      { id: 'a--b' },
    ];
    samples.forEach((s, i) => expect(mirror.overlayElementKey(s, i)).toBe(overlayElementKey(s, i)));
  });

  it('resolves and enumerates two-tier stories the same way (tiers by level, untiered scenes on the listen tier)', () => {
    const story = {
      tiers: [
        { level: 'listen', scenes: [{ id: 's1', narrationEn: 'L1' }, { id: 's2', narrationEn: 'L2' }], checks: [{ id: 'c1', promptEn: 'C' }] },
        { level: 'read', scenes: [{ id: 's1', narrationEn: 'R1', captionEn: 'RC' }], checks: [{ id: 'r1', promptEn: 'R' }] },
      ],
    };
    const fields = [
      'scenes.s1.narration',
      'scenes.s2.narration',
      'tiers.read.scenes.s1.narration',
      'tiers.listen.scenes.s1.narration',
      'tiers.write.scenes.s1.narration',
      'checks.r1.prompt',
    ];
    for (const field of fields) expect(mirror.overlayTargets(story, field), field).toEqual(overlayTargets(story, field));
    expect(mirror.translatableFields('story:t', story)).toEqual(translatableFields('story:t', story));
    expect(mirror.missingSelector(story, 'tiers.read.scenes.s1.narration')).toBeNull();
    expect(mirror.missingSelector(story, 'tiers.read.scenes.s2.narration')).toEqual({ collection: 'scenes', key: 's2' });
    expect(mirror.missingSelector(story, 'tiers.write.scenes.s1.narration')).toEqual({ collection: 'tiers', key: 'write' });
    expect(mirror.missingSelector(story, 'scenes.s2.narration')).toBeNull();
    expect(mirror.missingSelector({ tiers: [story.tiers[1]] }, 'scenes.s9.narration')).toEqual({ collection: 'scenes', key: 's9' });
  });

  it('finds a selector that matches nothing (the validator rule behind overlay-unknown-id for sub-ids)', () => {
    const story = { tiers: [{ scenes: [{ id: 's1', narrationEn: 'x' }], checks: [{ id: 'c1', options: [{ id: 'a' }] }] }] };
    expect(mirror.missingSelector(story, 'scenes.s1.narration')).toBeNull();
    expect(mirror.missingSelector(story, 'scenes.s9.narration')).toEqual({ collection: 'scenes', key: 's9' });
    expect(mirror.missingSelector(story, 'checks.c1.options.b')).toEqual({ collection: 'options', key: 'b' });
    expect(mirror.missingSelector(story, 'errata.e1.summary')).toEqual({ collection: 'errata', key: 'e1' });
    expect(mirror.missingSelector({ en: 'x' }, 'exampleWord.gloss')).toBeNull();
    expect(mirror.missingSelector({ exampleWord: { en: 'x' } }, 'exampleWord.gloss')).toBeNull();
    expect(mirror.missingSelector({ title: 'x' }, 'title')).toBeNull();
    expect(mirror.missingSelector('x', 'a.b.c')).toBeNull();
  });
});
