import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-BROWSE-001 BR-12a (sections 4.3, 4.11 items 2, 3 and 6): where the learner app opens All lessons, behind the
 * grown-up gate and on web only. Screens have no renderer harness in the vitest lane (vitest.config.ts), so these
 * pin on the source what a render test would; `browse-handoff.web.test.ts` covers the hand-off itself.
 */
const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
/** The code without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const button = read('screens/parent/GateLessonsButton.tsx');
const dashboard = read('screens/parent/ParentDashboardScreen.tsx');
const report = read('screens/parent/LearnerReportScreen.tsx');
const route = read('screens/my-route/MyRouteScreen.tsx');
const trail = read('screens/my-route/TrailRow.tsx');

describe('GateLessonsButton', () => {
  it('draws nothing off web (section 4.14) and calls only the gate hand-off', () => {
    expect(code(button)).toContain("if (Platform.OS !== 'web') return null;");
    expect(code(button)).toContain('setBlocked(!openBrowseFromGate(target));');
    expect(button).toContain("from '../../platform/browse-handoff'");
    // No other way to All lessons: no hand-built address, no direct storage.
    expect(code(button)).not.toMatch(/['"`]\/browse|location\.|sessionStorage|localStorage|AsyncStorage/);
  });

  it('reads its words from the dictionary, never inline', () => {
    expect(code(button)).toContain('useMessages().caregiver.dashboard.browse');
    expect(code(button)).toContain('m.open.cta');
    expect(code(button)).toContain('m.preview.cta');
    expect(code(button)).toContain('m.storageBlocked');
    expect(code(button)).not.toMatch(/['"`](Open all lessons|Preview lessons)['"`]/);
  });

  it('is at least touchTarget.min tall and wide, with tokens only, and names its design reference', () => {
    expect(button).toContain('minHeight: touchTarget.min');
    expect(button).toContain('minWidth: touchTarget.min');
    expect(button).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(button).toMatch(/design\/(wireframes|screens)\//);
  });
});

describe('the three entries', () => {
  it('the parent dashboard shows [ Open all lessons ] with no target, web only', () => {
    expect(code(dashboard)).toContain("{Platform.OS === 'web' ? (");
    expect(code(dashboard)).toContain('<GateLessonsButton kind="open" testID="dashboard-open-all-lessons" />');
  });

  it('the in-app report has one Preview lessons row at the end of What to practice next, with the journey.here stage', () => {
    const section = code(report).slice(code(report).indexOf('testID="learner-report-practice-next"'));
    expect(section.slice(0, section.indexOf('</InsightSection>'))).toContain(
      '<GateLessonsButton kind="preview" target={{ kind: \'stage\', stage: view.previewStage }} testID="learner-report-preview-lessons" />',
    );
    expect(code(report).match(/<GateLessonsButton/g)).toHaveLength(1);
    // No letter or quest links: the letter chips stay disclosures (F-REPORT-001 section 3.9).
    expect(code(report)).not.toMatch(/kind: '(char|quest|jamo)'/);
  });

  it('the read-only Learning Route page has a Preview lessons row per stage row, for a grown-up only', () => {
    expect(code(route)).toContain(
      "action={readOnly ? <GateLessonsButton kind=\"preview\" target={{ kind: 'stage', stage: row.stage }} testID={`my-route-preview-${row.order}`} /> : undefined}",
    );
    expect(code(route).match(/<GateLessonsButton/g)).toHaveLength(1);
    // The slot sits outside the row's own button, so a press never toggles the stage.
    const item = code(trail).slice(code(trail).indexOf('export function StageRowItem'));
    expect(item.indexOf('{action === undefined ? null :')).toBeGreaterThan(item.indexOf('</Pressable>'));
  });
});
