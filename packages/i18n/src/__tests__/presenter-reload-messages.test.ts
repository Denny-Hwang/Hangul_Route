import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';

/**
 * AMENDMENTS-LECTURE-V2 section 4.5 and 12.3 (row LV-2): the invalid-link page of a presenter that
 * cannot read a newer deck link offers Reload, which updates the presenter and opens the link again.
 * Every locale has its own value, inside the 28-character button budget (F-I18N-001 §3.11).
 */
describe('learner.presenter.state.invalid.reload (LV-2)', () => {
  it('has the section 12.3 values in en, es and ko', () => {
    expect(getMessages('en').learner.presenter.state.invalid.reload).toBe('Reload');
    expect(getMessages('es').learner.presenter.state.invalid.reload).toBe('Volver a cargar');
    expect(getMessages('ko').learner.presenter.state.invalid.reload).toBe('다시 불러오기');
    expect(getMessages('en').learner.presenter.state.invalid.staleLine).toBe('This link is from a newer version. Close other Hangul Route tabs, then reload.');
    expect(getMessages('es').learner.presenter.state.invalid.staleLine).toBe(
      'Este enlace es de una versión más nueva. Cierra las otras pestañas de Hangul Route y vuelve a cargar.',
    );
    expect(getMessages('ko').learner.presenter.state.invalid.staleLine).toBe('새 버전에서 만든 링크예요. 다른 Hangul Route 탭을 닫고 다시 불러와요.');
  });

  it.each(LOCALES)('%s: a short button label that trips no ban list', (locale) => {
    const value = getMessages(locale).learner.presenter.state.invalid.reload;
    expect(value.length).toBeLessThanOrEqual(28);
    expect(findBannedWord(value, locale, 'learner')).toBeNull();
    expect(findBannedWord(getMessages(locale).learner.presenter.state.invalid.staleLine, locale, 'learner')).toBeNull();
  });
});
