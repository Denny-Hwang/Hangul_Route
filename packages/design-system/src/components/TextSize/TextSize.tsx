import React, { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { STANDARD_TYPE_SCALE, cappedFont, effectiveFontScale, scaledFontCap, textSizeFactor, typeScale, type CappedFont, type TextSizeStep, type TypeScale, type TypeSizeName } from '../../text-size';

/**
 * The React layer of the text size engine (`../../text-size.ts`, owner items 6 and 7). The root
 * of each surface (learner app, All lessons, the presenter's chrome) puts the device record's
 * step in a `TextSizeProvider`; the design-system text components read `useTypeScale()`. With no
 * provider the scale is the token scale (standard), so tests and a surface that never chose see
 * the sizes they always had.
 */
const TextSizeContext = createContext<TypeScale>(STANDARD_TYPE_SCALE);

export interface TextSizeProviderProps {
  /** The device record's step; null, missing or unknown is standard. */
  step: TextSizeStep | string | null | undefined;
  children?: React.ReactNode;
}

export function TextSizeProvider({ step, children }: TextSizeProviderProps): React.ReactElement {
  // `typeScale` is memoised per factor, so the context value only changes with the step.
  return <TextSizeContext.Provider value={typeScale(textSizeFactor(step))}>{children}</TextSizeContext.Provider>;
}

/** The type scale at the chosen step: sizes in whole points and a line height helper. */
export function useTypeScale(): TypeScale {
  return useContext(TextSizeContext);
}

/** The chosen step's factor (1 = standard). */
export function useTextSizeFactor(): number {
  return useContext(TextSizeContext).factor;
}

/**
 * OS text size x the chosen step: what the layouts that used to read
 * `useWindowDimensions().fontScale` read now, so a larger step counts as larger text.
 */
export function useEffectiveFontScale(): number {
  const { fontScale } = useWindowDimensions();
  return effectiveFontScale(fontScale, useTextSizeFactor());
}

/** A native `maxFontSizeMultiplier` cap divided by the chosen step (never below 1), for text drawn at the step. */
export function useFontCap(cap: number): number {
  return scaledFontCap(cap, useTextSizeFactor());
}

/** A capped text's size and native cap at the chosen step (`cappedFont`): the cap holds for OS x step together. */
export function useCappedFont(name: TypeSizeName, cap: number): CappedFont {
  return cappedFont(name, useTextSizeFactor(), cap);
}
