import type { PlacementLevel, PlacementMode } from '@hangul-route/content-schema';
import { findBannedWord, type Messages, type UiLocale } from '@hangul-route/i18n';
import { findBannedWord as findHomeworkBannedWord } from '../homework/banned-text';

/**
 * The level check's copy rules (F-PLC-001 section 3.12, AM-33), as pure
 * helpers the screens and the copy test share. Every string of
 * `learner.placement`, in every locale: no banned word, no percent, no ratio,
 * no digit outside the two allow-listed duration lines, no Hangul outside
 * `ko`, never the word "test"; the mode lines name no age; the Short cheers
 * are effort-only.
 */

export const PLACEMENT_DIGIT_ALLOW_LIST = [
  'learner.placement.options.mode.standard.duration',
  'learner.placement.options.mode.deep.duration',
] as const;

/** Hangul jamo, compatibility jamo and syllables (escaped, so this file holds no Hangul). */
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const RATIO = /\d\s*\/\s*\d|\b\w+\s+\/\s+\w+\b/;
/** No age, school year or "kids" in the mode labels and help lines. */
export const AGE_WORDS = /\b(kids?|child(ren)?|young(er)?|ages?|years?|grade|school|toddlers?|teens?|adults?)\b/i;
/** Never in `cheerShort`: Hoya cannot know whether an answer was right. */
export const SUCCESS_WORDS = /\b(right|correct|got it|perfect|great job)\b/i;
const SPEAKING_WORDS = /\b(speak|speaking|say|saying|talk|talking|pronounce|out loud)\b/i;

export type CopyEntry = readonly [path: string, text: string];

function walk(node: unknown, path: string, out: CopyEntry[]): void {
  if (typeof node === 'string') out.push([path, node]);
  else if (Array.isArray(node)) for (const item of node) walk(item, path, out);
  else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`, out);
  }
}

/** Every string under `learner.placement`, with its dotted path; arrays give one entry per line. */
export function placementCopyEntries(m: Messages): CopyEntry[] {
  const out: CopyEntry[] = [];
  walk(m.learner.placement, 'learner.placement', out);
  return out;
}

function problemsOf(path: string, text: string, locale: UiLocale): string[] {
  const out: string[] = [];
  const banned = findBannedWord(text, locale, 'learner') ?? (locale === 'en' ? findHomeworkBannedWord(text) : null);
  if (banned !== null) out.push(`banned word ${banned}`);
  if (text.includes('%')) out.push('percent');
  if (RATIO.test(text)) out.push('ratio');
  if (/\d/.test(text) && !(PLACEMENT_DIGIT_ALLOW_LIST as readonly string[]).includes(path)) out.push('digit');
  if (/\btests?\b/i.test(text)) out.push('the word test');
  if (locale !== 'ko' && HANGUL.test(text)) out.push('Hangul');
  if (path.startsWith('learner.placement.options.mode.') && AGE_WORDS.test(text)) out.push('age word');
  if (path === 'learner.placement.cheerShort' && SUCCESS_WORDS.test(text)) out.push('success word');
  return out.map((reason) => `${path}: ${reason}`);
}

/** Every rule broken by the given entries (all of `learner.placement` by default); empty when clean. */
export function copyProblems(m: Messages, locale: UiLocale, entries: readonly CopyEntry[] = placementCopyEntries(m)): string[] {
  return entries.flatMap(([path, text]) => problemsOf(path, text, locale));
}

/**
 * The weekly-plan strip on the result (AM-9): no percent, no ratio, no
 * "Premium", no speaking words (the check measures reading and listening).
 */
export function stripCopyProblems(m: Messages, texts?: readonly string[]): string[] {
  const strip = m.learner.placement.result.strip;
  const all = texts ?? [strip.title, strip.usePlan, strip.change, strip.justStart];
  return all.flatMap((text) => {
    const out: string[] = [];
    if (text.includes('%')) out.push('percent');
    if (RATIO.test(text)) out.push('ratio');
    if (/premium/i.test(text)) out.push('Premium');
    if (SPEAKING_WORDS.test(text)) out.push('speaking word');
    return out.map((reason) => `${text}: ${reason}`);
  });
}

/**
 * Hoya's encouraging line after `answered` answers, or null: every third
 * answer in Standard and Deep, every second in Short (effort-only lines),
 * rotating, whatever the answers were.
 */
export function cheerLine(m: Messages, mode: PlacementMode, answered: number): string | null {
  const every = mode === 'short' ? 2 : 3;
  if (answered <= 0 || answered % every !== 0) return null;
  const lines = mode === 'short' ? m.learner.placement.cheerShort : m.learner.placement.cheer;
  return lines[(answered / every - 1) % lines.length] as string;
}

/** The band label of a level: the only words about level a learner sees (section 3.6). */
export function bandLabel(m: Messages, level: PlacementLevel): string {
  const b = m.learner.placement.band;
  if (level.stage === 'stage1') return [b.beginning, b.lettersAndSounds, b.everyLetter, b.readingWords][level.band] as string;
  return level.stage === 'stage2' ? b.firstWords : b.firstSentences;
}

export interface ModeTileCopy {
  label: string;
  help: string;
  /** Hidden (null) while Take my time is on. */
  duration: string | null;
}

/** The words on one mode tile of the options screen. */
export function modeTileCopy(m: Messages, mode: PlacementMode, takeMyTime: boolean): ModeTileCopy {
  const tile = m.learner.placement.options.mode[mode];
  return { label: tile.label, help: tile.help, duration: takeMyTime ? null : tile.duration };
}
