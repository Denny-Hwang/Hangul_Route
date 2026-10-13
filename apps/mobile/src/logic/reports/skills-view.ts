import type { ReportVoice } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { skillsNoteCopy, skillsTitle, tilesCopy, type CopyContext } from '../my-route/copy';
import type { MyRouteModel } from '../my-route/types';
import { myRouteMessages, skillRowView, type SkillRowView } from '../my-route/view';

/**
 * The device-only skills rows of the in-app report — F-REPORT-001 section 3.9, OD-8 (RP-9; design
 * `design/screens/reports/in-app-report.md` "Skills rows"): the last block of More detail, drawn as the Learning
 * Route's `SkillsCard` draws them, read-only. Counts of finished quests from `logic/my-route/skills.ts` (through the
 * route model), never a score. Reading, listening and writing only.
 *
 * In the third person the rows are about the learner (`caregiver.journey`); in the second person (OD-17) the title and
 * the rows are the learner's own words (`learner.myRoute`). "Spelling with tiles" and the one skills note
 * (`caregiver.skillsNote`) read the same in both voices: neither names the learner.
 */
export interface ReportSkillsView {
  title: string;
  rows: SkillRowView[];
  tiles: string | null;
  note: string;
}

export function reportSkillsView(i: { model: MyRouteModel; voice: ReportVoice; name: string; messages: Messages }): ReportSkillsView {
  const words = myRouteMessages(i.messages);
  const grownup: CopyContext = { viewer: 'grownup', name: i.name, m: words };
  const ctx: CopyContext = i.voice === 'second' ? { viewer: 'self', name: i.name, m: words } : grownup;
  return {
    title: skillsTitle(ctx),
    rows: i.model.skills.map((row) => skillRowView(row, ctx, i.messages)),
    tiles: tilesCopy(i.model, grownup),
    note: skillsNoteCopy(grownup) as string,
  };
}
