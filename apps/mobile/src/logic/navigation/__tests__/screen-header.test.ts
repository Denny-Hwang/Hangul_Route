import { describe, expect, it } from 'vitest';
import { missingWayBack, screenHeaderDecision } from '../screen-header';

/** Which header a screen draws (AMENDMENTS-DISPLAY-NAV section 7.1, row DN-4). */
const base = { exception: false, declared: false, canGoBack: true } as const;

describe('screenHeaderDecision', () => {
  it('a stack screen draws Back, a flow Close, when the navigator can go back', () => {
    expect(screenHeaderDecision({ ...base, variant: 'back' })).toEqual({ draw: true, leading: 'back' });
    expect(screenHeaderDecision({ ...base, variant: 'close' })).toEqual({ draw: true, leading: 'close' });
  });

  it('Back only where there is somewhere to go: the header stays (for the Display control), the control goes', () => {
    expect(screenHeaderDecision({ ...base, variant: 'back', canGoBack: false })).toEqual({ draw: true, leading: 'none' });
  });

  it('a route the table does not know reads as a stack screen', () => {
    expect(screenHeaderDecision({ ...base, variant: undefined })).toEqual({ draw: true, leading: 'back' });
  });

  it('a root has no leading control and draws a header only when the screen asks for one', () => {
    expect(screenHeaderDecision({ ...base, variant: 'none' })).toEqual({ draw: false, leading: 'none' });
    expect(screenHeaderDecision({ ...base, variant: 'none', declared: true })).toEqual({ draw: true, leading: 'none' });
  });

  it('the exception list draws the header with no way back, even when the navigator could go back', () => {
    expect(screenHeaderDecision({ ...base, variant: 'none', exception: true })).toEqual({ draw: true, leading: 'none' });
    expect(screenHeaderDecision({ ...base, variant: 'back', exception: true, override: { kind: 'close', hasAction: true } })).toEqual({ draw: true, leading: 'none' });
  });

  it('a root with its own way out names its control; without an action it needs the navigator', () => {
    expect(screenHeaderDecision({ ...base, variant: 'none', canGoBack: false, override: { kind: 'close', hasAction: true } })).toEqual({ draw: true, leading: 'close' });
    expect(screenHeaderDecision({ ...base, variant: 'none', canGoBack: false, override: { kind: 'back', hasAction: false } })).toEqual({ draw: true, leading: 'none' });
    expect(screenHeaderDecision({ ...base, variant: 'back', override: { kind: 'none', hasAction: false } })).toEqual({ draw: true, leading: 'none' });
  });
});

describe('missingWayBack (the development check of section 7.1)', () => {
  const at = { exception: false, hasOwnLeading: false, canGoBack: false } as const;
  it('a Back or Close route with nowhere to go has lost its way back', () => {
    expect(missingWayBack({ ...at, variant: 'back' })).toBe(true);
    expect(missingWayBack({ ...at, variant: 'close' })).toBe(true);
    expect(missingWayBack({ ...at, variant: undefined })).toBe(true);
  });
  it('a root, the exception list, a screen with its own way out and a navigator that can go back are fine', () => {
    expect(missingWayBack({ ...at, variant: 'none' })).toBe(false);
    expect(missingWayBack({ ...at, variant: 'back', exception: true })).toBe(false);
    expect(missingWayBack({ ...at, variant: 'back', hasOwnLeading: true })).toBe(false);
    expect(missingWayBack({ ...at, variant: 'back', canGoBack: true })).toBe(false);
  });
});
