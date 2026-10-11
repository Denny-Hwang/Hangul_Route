import { beforeEach, describe, expect, it } from 'vitest';
import { usePrereqSheetStore } from '../prereq-sheet-store';

describe('prereq-sheet-store (once per quest per session)', () => {
  beforeEach(() => usePrereqSheetStore.setState({ asked: [] }));

  it('starts empty', () => {
    expect(usePrereqSheetStore.getState().asked).toEqual([]);
  });

  it('remembers a quest once asked, without duplicates', () => {
    usePrereqSheetStore.getState().markAsked('quest:b');
    usePrereqSheetStore.getState().markAsked('quest:b');
    usePrereqSheetStore.getState().markAsked('quest:c');
    expect(usePrereqSheetStore.getState().asked).toEqual(['quest:b', 'quest:c']);
  });
});
