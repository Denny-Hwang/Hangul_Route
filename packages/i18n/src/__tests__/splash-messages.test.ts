import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';

/**
 * The static splash's line (AMENDMENTS-FINISH-2026-11 FN-2): every shipped locale has its own value (the build writes
 * each into `index.html`, so an English fallback would put English into a Korean splash), short and plain, and the
 * brand it sits under stays "Hangul Route" / "HR" in every locale.
 */
describe('common.splash', () => {
  it('has its own short line in en, es and ko', () => {
    expect(en.common.splash.loading).toBe('Loading');
    expect(es.common.splash.loading).toBe('Cargando');
    expect(ko.common.splash.loading).toBe('불러오는 중');
    for (const line of [en, es, ko].map((m) => m.common.splash.loading)) expect(line.length).toBeLessThanOrEqual(12);
  });

  it('sits under the same brand in every locale', () => {
    for (const m of [en, es, ko]) expect(m.landing.brand).toEqual({ name: 'Hangul Route', mark: 'HR' });
  });
});
