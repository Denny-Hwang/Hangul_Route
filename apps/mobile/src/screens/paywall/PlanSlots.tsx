import { Body, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { FreeSlot } from '../../logic/plan-free-lines';

/**
 * The two slots F-ENT-003 E3-8 fills on the learner Plan screen (F-BILL-002 §4.7, wireframes
 * billing/plan-status and billing/plan-status-free-lessons). Neither ever holds an offer, a price,
 * a button, a link, a promo hint or a terms line. The words come from `planView` (`planFreeLines`).
 */

/**
 * Under the free title: "Stage 1 is always free." while F-ENT-003's switch is off; with it on, the
 * free-plan line, the What is free list (a list, read item by item) and at most one situation line.
 */
export function FreePlanLines({ slot }: { slot: FreeSlot }): React.ReactElement {
  return (
    <View testID="plan-free-slot">
      {slot.line !== null ? (
        <Body tone="secondary" align="center">
          {slot.line}
        </Body>
      ) : null}
      {slot.list.length > 0 ? (
        <View role="list" testID="plan-free-list" style={{ marginTop: slot.line !== null ? spacing.xs : 0 }}>
          {slot.list.map((item) => (
            <View key={item} role="listitem">
              <Body tone="secondary" align="center">
                {item}
              </Body>
            </View>
          ))}
        </View>
      ) : null}
      {slot.extra !== null ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary" align="center">
            {slot.extra}
          </Body>
        </>
      ) : null}
    </View>
  );
}

/** Under the full-route lines: F-ENT-003's "Set a plan to guide what comes next." (and on the web the grown-up page line) when no plan exists, whatever the switch (item 10). */
export function PlanGuidanceLine({ lines }: { lines: readonly string[] }): React.ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <View testID="plan-guidance">
      <Spacer size="sm" />
      {lines.map((line) => (
        <Body key={line} tone="secondary" align="center">
          {line}
        </Body>
      ))}
    </View>
  );
}
