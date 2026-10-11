import type { AssessmentOption, AssessmentQuestion } from '../../assessment/question';
import { RUNG_SYMBOLS } from '../../placement/rungs';
import type { PlacementBankInput, PlacementTemplateInput } from '../../placement/run';
import type { PlacementForm, PlacementGate, PlacementStrand } from '../../schemas/placement';

/**
 * A synthetic bank for the engine tests: the shape of the real bank (spec 3.4,
 * appendix A) with generated content, so the engine is tested without
 * `content/placement/` (P-4). Every gate and form has well over nine ready
 * templates; each question has one correct option, listed first in the data.
 */

type Kind = 'ko' | 'sound' | 'picture';
type Format = AssessmentQuestion['format'];

const STRAND: Record<PlacementGate, PlacementStrand> = {
  recog: 'hangul-recognition',
  'sound-basic': 'sound-letter',
  'sound-rest': 'sound-letter',
  'syl-cv': 'syllable-reading',
  'syl-cvc': 'syllable-reading',
  vocab: 'vocabulary',
  sentence: 'sentences',
};

const SOUNDS = ['ga', 'na', 'da', 'ra'];
let counter = 0;

const options = (idBase: string, kind: Kind, count: number): AssessmentOption[] =>
  Array.from({ length: count }, (_, i) => {
    counter += 1;
    const id = `o${i + 1}`;
    if (kind === 'ko') return { id, ko: String.fromCodePoint(0xac00 + counter), romanization: `r${counter}`, en: `gloss ${idBase}-${i}`, isCorrect: i === 0 };
    if (kind === 'sound') return { id, sound: SOUNDS[i % 4] as string, isCorrect: i === 0 };
    return { id, pictureRef: `card:${idBase}-${i}`, en: `picture ${i}`, isCorrect: i === 0 };
  });

export interface TemplateSpec {
  id: string;
  gate: PlacementGate;
  form: PlacementForm;
  format: Format;
  tags: string[];
  kind: Kind;
  count?: number;
  status?: 'draft' | 'ready';
  audio?: boolean;
}

// The same list as PLACEMENT_AUDIO_FORMATS (build-syllable's prompt is the speaker).
const AUDIO_FORMATS: Format[] = ['hear-pick-written', 'build-syllable', 'hear-pick-picture', 'reply-pick'];

export const template = (spec: TemplateSpec): PlacementTemplateInput => ({
  id: `pitem:${spec.id}`,
  strand: STRAND[spec.gate],
  gate: spec.gate,
  form: spec.form,
  question: {
    format: spec.format,
    options: options(spec.id, spec.kind, spec.count ?? 4),
    tags: spec.tags,
    requires: { audio: spec.audio ?? AUDIO_FORMATS.includes(spec.format), picture: spec.kind === 'picture' ? 'card' : null },
    leaks: spec.format !== 'hear-pick-picture' && spec.format !== 'shape-odd-one-out',
  },
  glossEn: spec.id,
  status: spec.status ?? 'ready',
});

const sym = (k: string): string => `sym:${k}`;

export const buildBankTemplates = (): PlacementTemplateInput[] => {
  counter = 0;
  const out: PlacementTemplateInput[] = [];
  const basic = RUNG_SYMBOLS.basic;
  const rest = RUNG_SYMBOLS.rest;
  const finals = RUNG_SYMBOLS.finals;

  for (let i = 0; i < 20; i += 1) {
    const a = basic[i % 12] as string;
    const b = basic[(i + 1) % 12] as string;
    out.push(template({ id: `recog-odd-${i}`, gate: 'recog', form: 'decode', format: 'shape-odd-one-out', tags: [sym(a), sym(b), 'look-alike'], kind: 'ko' }));
  }
  for (const [gate, group, symbols] of [
    ['sound-basic', 'basic', basic],
    ['sound-rest', 'rest', rest],
  ] as const) {
    symbols.forEach((s, i) => {
      out.push(template({ id: `${gate}-hear-${i}`, gate, form: 'decode', format: 'hear-pick-written', tags: [sym(s), `group:${group}`], kind: 'ko' }));
      out.push(template({ id: `${gate}-see-${i}`, gate, form: 'decode', format: 'see-pick-sound', tags: [sym(s), `group:${group}`], kind: 'sound' }));
    });
  }
  const formats: Format[] = ['hear-pick-written', 'see-pick-sound', 'build-syllable'];
  for (let i = 0; i < 18; i += 1) {
    const format = formats[i % 3] as Format;
    out.push(
      template({
        id: `syl-cv-${i}`,
        gate: 'syl-cv',
        form: 'decode',
        format,
        tags: [sym(basic[i % 12] as string), sym(basic[(i + 4) % 12] as string), `syl:cv${i}`, 'shape:cv'],
        kind: format === 'see-pick-sound' ? 'sound' : 'ko',
      }),
    );
    out.push(
      template({
        id: `syl-cvc-${i}`,
        gate: 'syl-cvc',
        form: 'decode',
        format,
        tags: [sym(basic[i % 12] as string), sym(finals[i % 6] as string), `syl:cvc${i}`, 'shape:cvc'],
        kind: format === 'see-pick-sound' ? 'sound' : 'ko',
      }),
    );
  }
  for (let i = 0; i < 12; i += 1) {
    out.push(template({ id: `vocab-hear-${i}`, gate: 'vocab', form: 'oral', format: 'hear-pick-picture', tags: [`word:w${i}`], kind: 'picture' }));
    out.push(template({ id: `vocab-read-${i}`, gate: 'vocab', form: 'read', format: 'read-pick-picture', tags: [`word:r${i}`], kind: 'picture' }));
    out.push(template({ id: `sent-hear-${i}`, gate: 'sentence', form: 'oral', format: 'hear-pick-picture', tags: [`pattern:n-ieyo`, `word:s${i}`], kind: 'picture' }));
  }
  for (let i = 0; i < 9; i += 1) {
    out.push(template({ id: `sent-read-${i}`, gate: 'sentence', form: 'read', format: 'read-pick-picture', tags: ['pattern:n-eul-v', `word:t${i}`], kind: 'picture' }));
  }
  for (let i = 0; i < 6; i += 1) {
    out.push(template({ id: `sent-reply-${i}`, gate: 'sentence', form: 'read', format: 'reply-pick', tags: ['pattern:reply'], kind: 'ko', count: 3 }));
  }
  return out;
};

export const makeBank = (over: Partial<PlacementBankInput> = {}): PlacementBankInput => ({
  version: 1,
  templates: buildBankTemplates(),
  ...over,
});

export const only = (bank: PlacementBankInput, keep: (t: PlacementTemplateInput) => boolean): PlacementBankInput => ({
  ...bank,
  templates: bank.templates.filter(keep),
});
