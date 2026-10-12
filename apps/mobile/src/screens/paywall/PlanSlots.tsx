import { Body } from '@hangul-route/design-system';
import React from 'react';

/**
 * The two slots F-ENT-003 E3-8 fills on the learner Plan screen (F-BILL-002 §4.7, wireframes
 * billing/plan-status and billing/plan-status-free-lessons). Neither ever holds an offer, a price,
 * a button, a link, a promo hint or a terms line.
 */

/** Under the free title: "Stage 1 is always free." (`caregiver.plan.free.open`) until E3-8, and whenever F-ENT-003's switch is off. */
export function FreePlanLines({ line }: { line: string }): React.ReactElement {
  return (
    <Body tone="secondary" align="center">
      {line}
    </Body>
  );
}

/** Under the full-route lines: empty until E3-8 adds "Set a plan to guide what comes next." */
export function PlanGuidanceLine(): React.ReactElement | null {
  return null;
}
