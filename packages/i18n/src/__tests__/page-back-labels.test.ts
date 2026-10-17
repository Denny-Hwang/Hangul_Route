import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';

/**
 * AMENDMENTS-DISPLAY-NAV sections 7.3, 8 and 10 (row DN-6): PageBack draws the `arrow-left` glyph itself, so no
 * message it draws starts with an arrow, in any locale; the frame's way to the learner app is one "Learner app"
 * exit; the space page's PageBack says "Back to {page}"; every ConfirmSheet label is a verb, never "OK".
 */
const ARROW = /^[\s←⟵⇐◀<]/;

describe('PageBack labels (AMENDMENTS-DISPLAY-NAV section 7.3)', () => {
  it.each(LOCALES)('%s: no message PageBack draws starts with an arrow', (locale) => {
    const c = getMessages(locale).console;
    const labels = [
      ...[null, 'Class 2B'].flatMap((space) => [c.plan.back(space), c.curriculum.back(space), c.lecture.back(space), c.settings.back(space), c.relink.back(space)]),
      ...Object.values(c.learningRoute.back),
      ...Object.values(c.notes.sent.back),
      c.billing.receipts.back.cta,
      c.transfer.back('Class 2B'),
      c.transfer.actions.backToRoster.cta,
      c.pageBack.to(c.shell.nav.classes),
      c.pageBack.to(c.shell.nav.home),
    ];
    for (const label of labels) {
      expect(label, `${locale}: "${label}"`).not.toMatch(ARROW);
      expect(label.trim()).toBe(label);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('the five back(space) messages name the space, or the space in general', () => {
    const en = getMessages('en').console;
    expect(en.plan.back('Class 2B')).toBe('Back to Class 2B');
    expect(en.settings.back(null)).toBe('Back to the space');
    expect(getMessages('es').console.lecture.back('Clase 2B')).toBe('Volver a Clase 2B');
    expect(getMessages('es').console.relink.back(null)).toBe('Volver al espacio');
    expect(getMessages('ko').console.curriculum.back('2반')).toBe('돌아가기: 2반');
    expect(getMessages('ko').console.plan.back(null)).toBe('공간으로 돌아가기');
  });

  it('a space page goes back to its persona home by the nav label', () => {
    expect(getMessages('en').console.pageBack.to('Classes')).toBe('Back to Classes');
    expect(getMessages('es').console.pageBack.to('Inicio')).toBe('Volver a Inicio');
    expect(getMessages('ko').console.pageBack.to('반')).toBe('돌아가기: 반');
  });

  it('the way to the learner app is one "Learner app" exit in every locale; "Open the learner app" is retired', () => {
    expect(getMessages('en').console.shell.backToLearning).toBe('Learner app');
    expect(getMessages('es').console.shell.backToLearning).toBe('App de estudiantes');
    expect(getMessages('ko').console.shell.backToLearning).toBe('학습자 앱');
    for (const locale of LOCALES) expect((getMessages(locale).console.shell as Record<string, unknown>).openLearnerApp).toBeUndefined();
  });
});

describe('ConfirmSheet labels (AMENDMENTS-DISPLAY-NAV section 8)', () => {
  const KEYS = ['newCode', 'remove', 'archive', 'copyAnyway', 'replace', 'discard', 'issueCode', 'update'] as const;

  it.each(LOCALES)('%s: every confirm label is a verb of its own, never "OK", and Cancel is the shared one', (locale) => {
    const m = getMessages(locale);
    const labels = KEYS.map((key) => m.console.confirm[key]);
    expect(new Set(labels).size).toBe(KEYS.length);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(m.common.buttons.ok);
      expect(label).not.toBe(m.common.buttons.cancel);
    }
  });

  it('the values of the amendment\'s table', () => {
    expect(getMessages('en').console.confirm).toEqual({
      newCode: 'Make a new code',
      remove: 'Remove',
      archive: 'Archive',
      copyAnyway: 'Copy anyway',
      replace: 'Replace the outline',
      discard: 'Discard changes',
      issueCode: 'Make a code',
      update: 'Update the plan',
    });
    expect(getMessages('es').console.confirm.newCode).toBe('Crear un código nuevo');
    expect(getMessages('ko').console.confirm.discard).toBe('바뀐 내용 버리기');
  });
});
