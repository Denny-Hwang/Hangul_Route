import type { CheckKind, KoText, StoryCheck } from '@hangul-route/content-schema';
import { hashSeed, shuffleSeeded } from './seeded-order';

/**
 * View-model of one story check (F-STORY-003 §3.3): the prompt split around
 * the `{target}` token and the options in their display order. Pure.
 */

export type PromptPart = { text: string } | { target: KoText };

export interface OptionView {
  id: string;
  en?: string;
  ko?: string;
  romanization?: string;
  art?: string;
  isCorrect: boolean;
}

export interface CheckView {
  checkId: string;
  kind: CheckKind;
  promptParts: PromptPart[];
  /** The Korean the question is about; drawn inline when `targetInline`, else as a word card. */
  target?: KoText;
  targetInline: boolean;
  /** pick-meaning / fill-word: the target's English gloss would give the answer away until the item resolves. */
  hideTargetGloss: boolean;
  /** Display order. */
  options: OptionView[];
  correctOptionId: string;
  explainEn?: string;
  hintEn?: string;
}

const TOKEN = '{target}';
/**
 * Check kinds whose target gloss is the answer, so it stays hidden until the check is answered.
 * Shared with the lecture presenter's projected checks (F-TCH-004 PR 11), so the two never drift.
 */
export const GLOSS_HIDDEN_KINDS: readonly CheckKind[] = ['pick-meaning', 'fill-word'];

/**
 * A check prompt in parts: the text around the `{target}` token with the target in its place. A
 * prompt without the token (or a check without a target) is one text part. Shared with the
 * lecture presenter (F-TCH-004 PR 11), generic over the target's shape.
 */
export function splitPrompt<T>(promptEn: string, target: T | undefined): Array<{ text: string } | { target: T }> {
  const at = promptEn.indexOf(TOKEN);
  if (at < 0 || !target) return [{ text: promptEn }];
  const before = promptEn.slice(0, at);
  const after = promptEn.slice(at + TOKEN.length);
  const parts: Array<{ text: string } | { target: T }> = [];
  if (before) parts.push({ text: before });
  parts.push({ target });
  if (after) parts.push({ text: after });
  return parts;
}

function toOptionView(o: StoryCheck['options'][number]): OptionView {
  const view: OptionView = { id: o.id, isCorrect: o.isCorrect };
  if (o.en !== undefined) view.en = o.en;
  if (o.ko !== undefined) view.ko = o.ko;
  if (o.romanization !== undefined) view.romanization = o.romanization;
  if (o.art !== undefined) view.art = o.art;
  return view;
}

/**
 * Options are shuffled with a seed made of the story id and the check id, so
 * the order is stable across re-renders and identical on every device, and the
 * authors' answer position never decides where the answer sits. True-false
 * and `shuffle: false` keep the authored order.
 *
 * @param storyId the story id (`story:seollal-new-year`) that seeds the shuffle
 */
export function buildCheckView(check: StoryCheck, storyId: string): CheckView {
  const authored = check.options.map(toOptionView);
  const keepOrder = check.kind === 'true-false' || check.shuffle === false;
  const options = keepOrder ? authored : shuffleSeeded(authored, hashSeed(`${storyId}|${check.id}`));
  const inline = check.promptEn.includes(TOKEN) && check.target !== undefined;
  const view: CheckView = {
    checkId: check.id,
    kind: check.kind,
    promptParts: splitPrompt(check.promptEn, check.target),
    targetInline: inline,
    hideTargetGloss: GLOSS_HIDDEN_KINDS.includes(check.kind),
    options,
    correctOptionId: authored.find((o) => o.isCorrect)?.id ?? '',
  };
  if (check.target) view.target = check.target;
  if (check.explainEn !== undefined) view.explainEn = check.explainEn;
  if (check.hintEn !== undefined) view.hintEn = check.hintEn;
  return view;
}
