import { TEXT_SIZE_FACTORS, TEXT_SIZE_STEPS, typeScale, type TextSizeStep } from '../../text-size';

/**
 * Pure model of the Display (Aa) sheet (owner items 6 and 7): what each segment of the two
 * controls shows. No React, so the DOM sheet of the grown-up pages draws the same steps.
 */

/** One option of a segmented control: its value, its visible label and, for a language, its `lang`. */
export interface DisplayOption<T extends string = string> {
  value: T;
  label: string;
  lang?: string;
}

/** The four Text size segments, smallest first, labelled by the caller's dictionary. */
export function textSizeOptions(labels: Readonly<Record<TextSizeStep, string>>): DisplayOption<TextSizeStep>[] {
  return TEXT_SIZE_STEPS.map((step) => ({ value: step, label: labels[step] }));
}

/**
 * The size of the "Aa" a Text size segment draws: the body size at that step, so the row itself
 * shows the four steps growing, whatever step is chosen now.
 */
export function segmentGlyphSize(step: TextSizeStep): number {
  return typeScale(TEXT_SIZE_FACTORS[step]).size.body;
}

/** The Language row shows only when there is more than one language to choose from. */
export function showLanguageRow(options: readonly DisplayOption[] | null | undefined): boolean {
  return options !== null && options !== undefined && options.length > 1;
}
