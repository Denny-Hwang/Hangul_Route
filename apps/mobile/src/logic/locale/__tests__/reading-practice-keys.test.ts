import { describe, expect, it } from 'vitest';
import { READING_CHOICES, readingChoiceForKey } from '../reading-practice-keys';

/** RF-0b Q3: the keys of the Reading practice radio group on the web. */
describe('readingChoiceForKey', () => {
  it('draws the three choices in the card order', () => {
    expect(READING_CHOICES).toEqual(['auto', 'always', 'tap']);
  });

  it('the arrows move to the next and the previous choice and wrap', () => {
    expect(readingChoiceForKey('auto', 'ArrowDown')).toBe('always');
    expect(readingChoiceForKey('auto', 'ArrowRight')).toBe('always');
    expect(readingChoiceForKey('tap', 'ArrowDown')).toBe('auto');
    expect(readingChoiceForKey('auto', 'ArrowUp')).toBe('tap');
    expect(readingChoiceForKey('always', 'ArrowLeft')).toBe('auto');
  });

  it('Home and End go to the first and the last choice', () => {
    expect(readingChoiceForKey('always', 'Home')).toBe('auto');
    expect(readingChoiceForKey('always', 'End')).toBe('tap');
  });

  it('Space and Enter choose the row that has focus', () => {
    expect(readingChoiceForKey('always', ' ')).toBe('always');
    expect(readingChoiceForKey('tap', 'Spacebar')).toBe('tap');
    expect(readingChoiceForKey('auto', 'Enter')).toBe('auto');
  });

  it('any other key is left alone, so Tab still leaves the group', () => {
    expect(readingChoiceForKey('auto', 'Tab')).toBeNull();
    expect(readingChoiceForKey('auto', 'a')).toBeNull();
  });
});
