import { describe, expect, it } from 'vitest';
import * as myRoute from '..';

describe('logic/my-route public surface', () => {
  it('exports the builder, the shared predicates and the summary', () => {
    for (const name of ['buildMyRoute', 'pipStateOf', 'routeCursor', 'routeOrder', 'stageStateOf', 'skillRows', 'gainsOf', 'summarizeJourney', 'routeGoalSummaryOf', 'SKILL_OF_KIND'])
      expect(myRoute).toHaveProperty(name);
  });
});
