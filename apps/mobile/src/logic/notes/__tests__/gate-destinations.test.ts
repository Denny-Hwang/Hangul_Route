import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GrownUpDestination, RootStackParamList } from '../../../navigation/types';

/**
 * F-FEEDBACK-001 section 6.10 (FB-7, types only): the grown-up gate can continue to a learner's
 * notes or to the report sheet of one note, so FB-8's "Tell a grown-up" and FB-9's dashboard rows
 * can target them. The screens arrive with FB-9.
 *
 * This file is a type-checker fixture: `expectTypeOf` does nothing at run time outside vitest's
 * typecheck mode, so the guarantee comes from `pnpm run typecheck` (tsc includes `__tests__`), which
 * fails if a destination or `PinEntry.noteId` is removed. The run-time line below is a smoke check.
 */
describe('notes gate destinations', () => {
  it('names NotesGrownUp and NoteReport as gate destinations, and PinEntry carries the note id', () => {
    expectTypeOf<'NotesGrownUp'>().toMatchTypeOf<GrownUpDestination>();
    expectTypeOf<'NoteReport'>().toMatchTypeOf<GrownUpDestination>();
    const report: RootStackParamList['PinEntry'] = { next: 'NoteReport', noteId: 'note:aaaaaaaa' };
    const grownUp: RootStackParamList['PinEntry'] = { next: 'NotesGrownUp', profileId: 'profile:a' };
    expectTypeOf(report.noteId).toEqualTypeOf<string | undefined>();
    expect([report.next, grownUp.next]).toEqual(['NoteReport', 'NotesGrownUp']);
  });
});
