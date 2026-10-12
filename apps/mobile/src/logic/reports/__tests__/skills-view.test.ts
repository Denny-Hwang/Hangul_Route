import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { MyRouteModel } from '../../my-route/types';
import { reportSkillsView } from '../skills-view';

/** F-REPORT-001 section 3.9, OD-8 (RP-9): the device-only skills rows in More detail, in the report's voice. */
const m = getMessages('en');
const model = {
  skills: [
    { skill: 'read', marks: 4, nextReachable: true, quests: 6 },
    { skill: 'listen', marks: 0, nextReachable: true, quests: 0 },
    { skill: 'write', marks: 2, nextReachable: false, quests: 2 },
  ],
  tiles: 1,
} as unknown as MyRouteModel;

describe('reportSkillsView', () => {
  it('third person: about the learner, with Spelling with tiles and the one skills note', () => {
    const view = reportSkillsView({ model, voice: 'third', name: 'Sam', messages: m });
    expect(view.title).toBe("What Sam's quests practice");
    expect(view.rows.map((row) => [row.skill, row.label, row.detail, row.marks.length])).toEqual([
      ['read', 'Read', 'In 6 quests Sam finished', 5],
      ['listen', 'Listen', m.caregiver.journey.ready('Sam'), 0],
      ['write', 'Write', 'In 2 quests Sam finished', 2],
    ]);
    expect(view.tiles).toBe('Spelling with tiles: 1 quest');
    expect(view.note).toBe(m.caregiver.skillsNote);
  });

  it('second person: the learner\'s own words; tiles and the note read the same', () => {
    const view = reportSkillsView({ model, voice: 'second', name: 'Sam', messages: m });
    expect(view.title).toBe(m.learner.myRoute.skills.title);
    expect(view.rows[0]?.detail).toBe(m.learner.myRoute.skill.quests(6));
    expect(view.tiles).toBe('Spelling with tiles: 1 quest');
    expect(view.note).toBe(m.caregiver.skillsNote);
    expect(JSON.stringify(view)).not.toMatch(/speak|pronunc|voice/i);
  });

  it('no tile quests: no tiles line', () => {
    expect(reportSkillsView({ model: { ...model, tiles: 0 } as MyRouteModel, voice: 'third', name: 'Sam', messages: m }).tiles).toBeNull();
  });
});
