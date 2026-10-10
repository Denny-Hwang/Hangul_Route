import { describe, expect, it } from 'vitest';
import { detectLocale } from '../detect';

const ALL = ['en', 'es', 'ko'] as const;

describe('detectLocale', () => {
  it('takes the primary subtag: es-MX -> es, ko_KR -> ko, en-GB -> en', () => {
    expect(detectLocale(['es-MX'], ALL)).toBe('es');
    expect(detectLocale(['ko_KR'], ALL)).toBe('ko');
    expect(detectLocale(['en-GB'], ALL)).toBe('en');
    expect(detectLocale(['ES'], ALL)).toBe('es');
  });

  it('keeps the order of preference', () => {
    expect(detectLocale(['ko-KR', 'es-MX', 'en'], ALL)).toBe('ko');
    expect(detectLocale(['en', 'es'], ALL)).toBe('en');
  });

  it('skips unknown languages', () => {
    expect(detectLocale(['fr', 'es-MX'], ALL)).toBe('es');
    expect(detectLocale(['', 'de-DE', 'ko'], ALL)).toBe('ko');
  });

  it('returns en for an empty list or no match', () => {
    expect(detectLocale([], ALL)).toBe('en');
    expect(detectLocale(['fr', 'de'], ALL)).toBe('en');
  });

  it('never selects a hidden locale', () => {
    expect(detectLocale(['es-MX', 'en'], ['en'])).toBe('en');
    expect(detectLocale(['ko'], ['en', 'es'])).toBe('en');
    expect(detectLocale(['ko', 'es'], ['en', 'es'])).toBe('es');
  });

  it('defaults to the shipped locales (Spanish phone sees English today)', () => {
    expect(detectLocale(['es-MX'])).toBe('en');
  });
});
