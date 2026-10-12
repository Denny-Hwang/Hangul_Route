import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-REPORT-001 section 3.9 (RP-9): the screen-level rules the e2e (RP-11) also checks, held here on the source so a
 * change that breaks them fails the unit run. Screens have no renderer harness in vitest (vitest.config.ts).
 */
const src = (path: string): string => readFileSync(join(__dirname, '../../..', path), 'utf8');
const screen = src('screens/parent/LearnerReportScreen.tsx');
/** The code without its comments, for the "never" checks (the doc comment names what the screen must not do). */
const screenCode = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const dashboard = src('screens/parent/ParentDashboardScreen.tsx');
const root = src('navigation/root.tsx');
const pin = src('screens/parent/PinEntryScreen.tsx');

describe('LearnerReportScreen source rules', () => {
  it('the voice comes from reportVoice, never from gateOpensDirectly', () => {
    expect(screen).toContain('reportVoice({ profiles, activeProfileId: activeId, profileId })');
    expect(screenCode).not.toContain('gateOpensDirectly');
    expect(screenCode).not.toMatch(/voice[^\n]*opensDirectly/);
  });

  it('report.viewed goes through track without a profile id', () => {
    expect(screen).toContain('track(reportViewedEvent(period))');
    expect(screenCode).not.toMatch(/track\([^)]*profileId/);
  });

  it('Open Learning Route opens the grown-up read-only view of this report\'s profile', () => {
    expect(screen).toContain("navigation.navigate('MyRoute', { profileId, viewer: 'grownup' })");
    expect(screen).toContain('learningRoute: flags.myRouteEnabled');
  });

  it('SectionTabs with a panel, and no Print, Send a note or Browse entry in the app', () => {
    expect(screen).toContain('<SectionTabs');
    expect(screen).toContain('panelId={PANEL_ID}');
    expect(screenCode).not.toMatch(/print|sendNote|openBrowse/i);
  });

  it('read-only: no progress write, no profile switch', () => {
    expect(screenCode).not.toMatch(/setActive|recordQuest|unlockCard|beginSession|writeJson/);
  });
});

describe('entries', () => {
  it('the screen is registered only with the reports flag on', () => {
    expect(root).toContain('{flags.reportsEnabled ? <Stack.Screen name="LearnerReport" component={LearnerReportScreen} /> : null}');
  });

  it('the dashboard draws See report only with the flag on, through reportEntry', () => {
    expect(dashboard).toMatch(/flags\.reportsEnabled \? \(/);
    expect(dashboard).toContain('messages.report.action.seeReport');
    expect(dashboard).toContain('reportEntry(profileId, opensDirectly(sessionOpen))');
  });

  it('the PIN screen continues to the report it was asked for', () => {
    expect(pin).toContain("navigation.replace('LearnerReport', { profileId })");
  });
});
