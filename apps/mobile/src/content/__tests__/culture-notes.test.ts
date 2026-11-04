import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LessonCellSchema, overlayTargets, type LessonNote } from '@hangul-route/content-schema';
import { allowlistedInstitution, lintCurriculum } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { LESSON_EPISODES } from '../__generated__/lessons-index';
import { LESSON_CELL_MODULES } from './helpers/lesson-stages';

/**
 * The cells' culture notes on screen (F-CURR-002 §1, §5.7, §6.6 and §9.3, row CM-3C):
 * - `culture-source`: every note of Volume 1 has a source from the §6.6 allowlist, on a host the institution runs, named
 *   as on its access date, so CM-3B can turn the rule into an error with no change to the content;
 * - the source line the tip prints is the note's first source, so that one is allowlisted too;
 * - the four cells that had no note (S2 Nature, S4 Letters, S4 Nature, S7 Food) have at least one culture note;
 * - every quest of a cell with notes has its note in the cell's chunk, culture notes before language notes.
 */
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const EPISODES = join(ROOT, 'content', 'episodes');

const files: string[] = readdirSync(EPISODES)
  .filter((d) => /^stage-[2-7]$/.test(d))
  .flatMap((d) => readdirSync(join(EPISODES, d)).filter((f) => f.endsWith('.json')).map((f) => `content/episodes/${d}/${f}`));
const raw = new Map<string, unknown>(files.map((f) => [f, JSON.parse(readFileSync(join(ROOT, f), 'utf8')) as unknown]));
const cells = [...raw.entries()].map(([file, json]) => ({ file, cell: LessonCellSchema.parse(json) }));

describe('culture notes (row CM-3C)', () => {
  it('every Volume 1 cell is read (25 cells)', () => {
    expect(cells).toHaveLength(25);
  });

  it('culture-source: no note of Volume 1 is reported, so CM-3B can make it an error', () => {
    const findings = lintCurriculum(raw, { today: '2026-10-23' }).filter((f) => f.rule === 'culture-source');
    expect(findings).toEqual([]);
  });

  it("every note's first source, the tip's source line, is from the §6.6 allowlist and named as on its access date", () => {
    for (const { file, cell } of cells) {
      for (const note of cell.culture) {
        const first = note.sources?.[0];
        expect(first, `${file} ${note.id} has its own sources`).toBeDefined();
        const match = allowlistedInstitution(first!.publisher, first!.accessed, first!.url);
        expect(match, `${file} ${note.id}: ${first!.publisher}`).toBeDefined();
        expect(match!.nameAsOfAccess, `${file} ${note.id}`).toBe(true);
      }
    }
  });

  it('the four cells with no note now carry at least one sourced culture note (§1, §5.2, §5.3, §5.5)', () => {
    for (const file of ['stage-2/nature', 'stage-4/letters', 'stage-4/nature', 'stage-7/life']) {
      const cell = cells.find((c) => c.file === `content/episodes/${file}.json`)!.cell;
      const culture = cell.culture.filter((n) => n.kind === 'culture');
      expect(culture.length, file).toBeGreaterThanOrEqual(1);
      for (const note of culture) {
        expect(note.verification.passes, `${file} ${note.id}`).toBeGreaterThanOrEqual(3);
        expect(note.sources!.length, `${file} ${note.id}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the spec topics: the magpie and the tiger in minhwa, Hangeul Day on 9 October, a Korea National Park Service source, banchan and table manners', () => {
    const text = (file: string): string => cells.find((c) => c.file === `content/episodes/${file}.json`)!.cell.culture.map((n) => n.textEn).join(' ');
    expect(text('stage-2/nature')).toMatch(/magpie/);
    expect(text('stage-2/nature')).toMatch(/\{ko:민화\}/);
    expect(text('stage-4/letters')).toMatch(/9 October/);
    expect(text('stage-4/letters')).toMatch(/Hunminjeongeum/);
    const parks = cells.find((c) => c.file === 'content/episodes/stage-4/nature.json')!.cell.culture;
    expect(parks.some((n) => n.sources?.some((s) => new URL(s.url).hostname === 'www.knps.or.kr'))).toBe(true);
    expect(text('stage-7/life')).toMatch(/\{ko:반찬\}/);
    expect(text('stage-7/life')).toMatch(/eldest/);
  });

  it("each quest's note is in its cell's chunk: culture notes first, quest k takes note k, with the first source as its line", () => {
    for (const { cell } of cells) {
      const notes = LESSON_CELL_MODULES[cell.id]!.LESSON_NOTES;
      const ordered: LessonNote[] = [...cell.culture.filter((n) => n.kind === 'culture'), ...cell.culture.filter((n) => n.kind === 'language')];
      const quests = LESSON_EPISODES.find((e) => e.id === cell.id)!.questIds;
      if (ordered.length === 0) {
        expect(notes, cell.id).toEqual({});
        continue;
      }
      quests.forEach((questId, k) => {
        const note = ordered[k % ordered.length]!;
        expect(notes[questId], `${cell.id} ${questId}`).toEqual({
          id: note.id,
          textEn: note.textEn,
          citation: { title: note.sources![0]!.title, publisher: note.sources![0]!.publisher, more: note.sources!.length - 1 },
        });
      });
    }
  });

  it("each note's es and ko text rides in its cell's chunk and lands on that cell's note, keeping its {ko:} tokens", () => {
    const tokens = (text: string): string[] => [...text.matchAll(/\{ko:([^}]*)\}/g)].map((m) => m[1]!).sort();
    for (const { file, cell } of cells) {
      const overlays = LESSON_CELL_MODULES[cell.id]!.LESSON_OVERLAYS;
      for (const locale of ['es', 'ko'] as const) {
        const entry = overlays[locale][cell.id] ?? {};
        for (const note of cell.culture) {
          const field = `culture.${note.id}.text`;
          const text = entry[field];
          expect(text, `${file} ${locale} ${field}`).toBeDefined();
          expect(overlayTargets(raw.get(file), field), `${file} ${field}`).toEqual([['culture', cell.culture.indexOf(note), 'textEn']]);
          expect(tokens(text!), `${file} ${locale} ${field}`).toEqual(tokens(note.textEn));
        }
      }
    }
  });

  it('every cell now has a note to show at each reward step (no Volume 1 cell is left without one)', () => {
    for (const { cell } of cells) expect(Object.keys(LESSON_CELL_MODULES[cell.id]!.LESSON_NOTES).length, cell.id).toBe(cell.quests.length);
  });
});
