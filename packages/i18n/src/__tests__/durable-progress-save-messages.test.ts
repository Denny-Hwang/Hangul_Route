import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The four quiet save lines of AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-2), pinned in all three languages.
 * The spec's `grownUp.saveTrouble` lives in `caregiver.dashboard` (owner item O1, 2026-11-22). On a family device the
 * Profile line asks for a grown-up's help and never asks the learner, possibly a child, to free up space (owner item
 * O4); the space ask is for the Grown-up area and for a self-only device, which never says "grown-up".
 */
const SPACE = /space|espacio|공간/i;
const GROWN_UP = /grown-up|adulto|어른/i;

describe('the save lines (DP-2)', () => {
  it('English is the spec text', () => {
    const m = getMessages('en');
    expect(m.learner.results.saveLater).toBe('We could not save this yet. Keep the app open and we will try again.');
    expect(m.caregiver.restore.saveLater).toBe('We could not save this yet. Keep the app open and we will try again.');
    expect(m.caregiver.dashboard.saveTrouble).toBe('This device could not save some progress. Free up some space on it.');
    expect(m.learner.profile.saveTrouble.self).toBe('This device is having trouble saving. Free up some space, then open the app again.');
    expect(m.learner.profile.saveTrouble.family).toBe('This device is having trouble saving. Ask a grown-up to help.');
  });

  it('Spanish and Korean carry their own reviewed values', () => {
    const es = getMessages('es');
    expect(es.learner.results.saveLater).toBe('Aún no pudimos guardar esto. Deja la app abierta y lo intentaremos de nuevo.');
    expect(es.caregiver.restore.saveLater).toBe(es.learner.results.saveLater);
    expect(es.caregiver.dashboard.saveTrouble).toBe('Este dispositivo no pudo guardar parte del progreso. Libera algo de espacio en él.');
    expect(es.learner.profile.saveTrouble.family).toBe('Este dispositivo tiene problemas para guardar. Pide ayuda a un adulto.');
    expect(es.learner.profile.saveTrouble.self).toBe('Este dispositivo tiene problemas para guardar. Libera algo de espacio y vuelve a abrir la app.');
    const ko = getMessages('ko');
    expect(ko.learner.results.saveLater).toBe('아직 저장하지 못했어요. 앱을 열어 두면 다시 저장해 볼게요.');
    expect(ko.caregiver.restore.saveLater).toBe(ko.learner.results.saveLater);
    expect(ko.caregiver.dashboard.saveTrouble).toBe('이 기기에 진도 일부를 저장하지 못했어요. 저장 공간을 조금 비워 주세요.');
    expect(ko.learner.profile.saveTrouble.family).toBe('이 기기에 저장하는 데 문제가 있어요. 어른에게 도와 달라고 해요.');
    expect(ko.learner.profile.saveTrouble.self).toBe('이 기기에 저장하는 데 문제가 있어요. 저장 공간을 조금 비운 다음 앱을 다시 열어 주세요.');
  });

  it.each(['en', 'es', 'ko'] as const)('%s: the family Profile line asks a grown-up, never the learner, to free up space; the self line never says grown-up', (locale) => {
    const t = getMessages(locale).learner.profile.saveTrouble;
    expect(t.family).toMatch(GROWN_UP);
    expect(t.family).not.toMatch(SPACE);
    expect(t.self).not.toMatch(GROWN_UP);
  });
});
