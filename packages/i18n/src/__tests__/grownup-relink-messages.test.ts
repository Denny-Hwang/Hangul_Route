import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * AMENDMENTS-GROWNUP-UX row GX-12 (section 8 T12, section 9 P8, section 10.2): the re-link page and its class-page
 * entry use the one name of the glossary ("new device" / "dispositivo nuevo" / "새 기기"), the card heading is calm, the
 * platform has a name, the time rolls up past an hour, a family's denial names a grown-up, and the "Another way"
 * sentence no longer repeats its heading. en, es and ko land together; the es and ko values are the spec's drafts for
 * the row's language review.
 */
describe('re-link page words (GX-12)', () => {
  const en = getMessages('en').console;
  const es = getMessages('es').console;
  const ko = getMessages('ko').console;

  it('names a re-link "new device" on the page title and the class-page entry, in all three', () => {
    expect([en.relink.title, en.relink.titleFor('Kim family')]).toEqual(['New device requests', 'Kim family · new device requests']);
    expect([es.relink.title, es.relink.titleFor('Familia Kim')]).toEqual(['Solicitudes de dispositivo nuevo', 'Familia Kim · solicitudes de dispositivo nuevo']);
    expect([ko.relink.title, ko.relink.titleFor('김씨 가족')]).toEqual(['새 기기 연결 요청', '김씨 가족 · 새 기기 연결 요청']);
    expect([es.space.relinkRequests.cta, es.space.relinkPending.cta(1), es.space.relinkPending.cta(2)]).toEqual(['Dispositivos nuevos', '1 dispositivo nuevo por aprobar', '2 dispositivos nuevos por aprobar']);
    expect([ko.space.relinkRequests.cta, ko.space.relinkPending.cta(1), ko.space.relinkPending.cta(3)]).toEqual(['새 기기 연결 요청', '새 기기 승인 대기 1건', '새 기기 승인 대기 3건']);
    // No locale keeps the old word for the same thing.
    for (const text of [ko.relink.title, ko.space.relinkRequests.cta, ko.space.relinkPending.cta(2)]) expect(text).not.toContain('다시 연결');
    for (const text of [es.relink.title, es.space.relinkRequests.cta, es.space.relinkPending.cta(2)]) expect(text.toLowerCase()).not.toContain('reconexi');
  });

  it('heads the card with the name and what is asked, no alarm', () => {
    expect(es.relink.askingToBe('Mina')).toBe('Mina · desde un dispositivo nuevo');
    expect(ko.relink.askingToBe('Mina')).toBe('Mina · 새 기기에서 요청');
    for (const words of [en, es, ko]) expect(words.relink.askingToBe('Mina')).not.toMatch(/Someone|Alguien|누군가/);
  });

  it('names the platform', () => {
    expect(es.relink.platform).toEqual({ ios: 'iPhone o iPad', android: 'Android', web: 'Web' });
    expect(ko.relink.platform).toEqual({ ios: 'iPhone 또는 iPad', android: 'Android', web: '웹' });
  });

  it('rolls the request time up to hours and days', () => {
    expect([es.relink.askedHoursAgo(1), es.relink.askedHoursAgo(4), es.relink.askedDaysAgo(1), es.relink.askedDaysAgo(2)]).toEqual([
      'pidió hace 1 hora',
      'pidió hace 4 horas',
      'pidió hace 1 día',
      'pidió hace 2 días',
    ]);
    expect([ko.relink.askedHoursAgo(4), ko.relink.askedDaysAgo(2)]).toEqual(['4시간 전에 요청함', '2일 전에 요청함']);
  });

  it("words a family's denial for a grown-up, not a teacher (P8)", () => {
    expect(es.relink.deniedFamily('Mina')).toBe('Cerrada. El dispositivo de Mina dirá "pregúntale a un adulto".');
    expect(ko.relink.deniedFamily('Mina')).toBe('닫았어요. Mina의 기기에는 "어른에게 물어보세요"라고 보여요.');
    for (const words of [en, es, ko]) expect(words.relink.deniedFamily('Mina')).not.toBe(words.relink.denied('Mina'));
  });

  it('says "Another way" once: the sentence under the heading drops the prefix', () => {
    for (const words of [en, es, ko]) {
      expect(words.relinkAnotherWay.startsWith(words.relink.anotherWay)).toBe(false);
      expect(words.relinkAnotherWay).not.toContain(words.relink.anotherWay);
    }
    expect(en.relinkAnotherWay).toBe('Issue a new rescue code and read it to the learner. The old code stops working.');
    expect(es.relinkAnotherWay).toBe('Crea un código de rescate nuevo y díctaselo al estudiante. El código anterior deja de funcionar.');
    expect(ko.relinkAnotherWay).toBe('새 복구 코드를 발급해서 학습자에게 읽어 주세요. 예전 코드는 더 이상 쓸 수 없어요.');
  });
});
