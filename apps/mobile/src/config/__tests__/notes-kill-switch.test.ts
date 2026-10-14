import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * F-FEEDBACK-001 FB-14: notes are on by default, so no CI e2e lane builds with
 * `EXPO_PUBLIC_NOTES_ENABLED=false` any more. The kill switch must still hide every
 * notes surface. The repo has no RN renderer in vitest (see vitest.config.ts), so this
 * guard pins each notes entry point to `flags.notesEnabled` at the source: removing a
 * gate turns CI red. The store half (no flush, no inbox notes kept with the flag off)
 * is covered in src/store/__tests__/membership-notes.test.ts.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string => readFileSync(join(src, rel), 'utf8');

describe('notes kill switch: every notes surface is gated by flags.notesEnabled', () => {
  it('the Home card renders nothing with the flag off', () => {
    expect(read('screens/notes/NotesHomeCard.tsx')).toMatch(/return flags\.notesEnabled \? <NotesHomeCardInner [^>]*\/> : null;/);
    expect(read('screens/home/HomeScreen.tsx')).toMatch(/flags\.notesEnabled \? <NotesHomeCard [^>]*\/> : null/);
  });

  it('the My notes row on the profile renders nothing with the flag off', () => {
    expect(read('screens/notes/MyNotesRow.tsx')).toMatch(/return flags\.notesEnabled \? <MyNotesRowInner [^>]*\/> : null;/);
    expect(read('screens/profile/ProfileScreen.tsx')).toContain('MyNotesRow');
  });

  it('the grown-up dashboard notes rows sit behind the flag', () => {
    const dashboard = read('screens/parent/ParentDashboardScreen.tsx');
    const gate = dashboard.indexOf('{flags.notesEnabled ? (');
    const row = dashboard.indexOf('<NotesDashboardRow');
    expect(gate).toBeGreaterThan(-1);
    expect(row).toBeGreaterThan(gate);
  });

  it('the notes routes are registered only with the flag on', () => {
    const root = read('navigation/root.tsx');
    for (const [name, component] of [
      ['Notes', 'NotesScreen'],
      ['NoteDetail', 'NoteDetailScreen'],
      ['NotesGrownUp', 'NotesGrownUpScreen'],
      ['NoteReport', 'NoteReportScreen'],
    ] as const) {
      expect(root).toContain(`{flags.notesEnabled ? <Stack.Screen name="${name}" component={${component}} /> : null}`);
    }
  });

  it('the sync neither flushes nor keeps inbox notes with the flag off', () => {
    const membership = read('store/membership-store.ts');
    expect(membership).toMatch(/if \(flags\.notesEnabled\) await useNotesStore\.getState\(\)\.flush\(/);
    expect(membership).toMatch(/if \(flags\.notesEnabled\) await useNotesStore\.getState\(\)\.applyInbox\(/);
  });
});
