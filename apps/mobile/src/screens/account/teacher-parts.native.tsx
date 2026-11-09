import { Body, Heading, Icon, borderWidth, colors, layout, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { ReactElement, ReactNode, Ref } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { AccountButton } from './AccountButton';

/**
 * F-AUTH-004 sections 8.3 and 8.4 (row NS-6; design `homes.md` boards 8 to 14, D13): the rows the Teacher home, the
 * School use of it and the school page draw, on iOS and Android. No row links out, names a place, or ranks anything:
 * every list keeps creation order, and a count is a count of the class, never of a learner.
 *
 * - **A class row** (D13): one pressable top (the name, bold; the archived word; the count; the attention line as
 *   plain text; a chevron) that opens the class page, and **Class report** as its own paper button under it, never
 *   inside the pressable. An archived class sits on `surface.sunken`. A class the grown-up could not open (board 14)
 *   is plain text with the `cantLoad` line, no chevron and no button.
 * - **A school row**: a pressable with a chevron for its owner or admin; plain text (no chevron, no press) for a
 *   teacher member, whose school page would answer 403.
 */

/** A group heading over rows (`console.kind.group.*`: `size.body` bold, `text.secondary`). */
export function GroupHeading({ children, testID }: { children: string; testID?: string }): ReactElement {
  return (
    <Heading level="body" weight="bold" tone="secondary" testID={testID}>
      {children}
    </Heading>
  );
}

/** Rows one column on a phone, two across from `layout.breakpoint.wide` (the window's width, `tablet.html` board 2). */
export function RowGrid({ children, testID }: { children: ReactNode; testID?: string }): ReactElement {
  const { width } = useWindowDimensions();
  const two = width >= layout.breakpoint.wide;
  return (
    <View accessibilityRole="list" testID={testID} style={{ flexDirection: two ? 'row' : 'column', flexWrap: 'wrap', gap: spacing.md }}>
      {children}
    </View>
  );
}

/** One cell of a `RowGrid`: full width on a phone, half (less the gap) two across. */
function RowCell({ children, sunken, testID }: { children: ReactNode; sunken: boolean; testID: string }): ReactElement {
  const { width } = useWindowDimensions();
  const two = width >= layout.breakpoint.wide;
  return (
    <View
      testID={testID}
      style={{
        ...(two ? { flexBasis: '45%', flexGrow: 1 } : {}),
        backgroundColor: sunken ? colors.surface.sunken : colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

const Chevron = (): ReactElement => (
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
    <Icon name="arrow-right" size={24} color={colors.text.muted} />
  </View>
);

/** The words of a row's top: the name (with the archived word after it) over its lines. */
function RowText({ name, archivedWord, lines }: { name: string; archivedWord: string | null; lines: string[] }): ReactElement {
  return (
    <View style={{ flex: 1, gap: spacing.xxs }}>
      <Body weight="bold" tone={archivedWord === null ? 'primary' : 'secondary'}>
        {name}
        {archivedWord === null ? null : <Text> {archivedWord}</Text>}
      </Body>
      {lines.map((line) => (
        <Body key={line} size="sm" tone="secondary">
          {line}
        </Body>
      ))}
    </View>
  );
}

export interface ClassRowProps {
  id: string;
  name: string;
  /** `console.home.archived` for an archived class; null for a live one. */
  archivedWord: string | null;
  /** `console.spaceCounts.students(n)`. */
  count: string;
  /** `console.home.attention(n)`, plain text; null when nothing waits. */
  attention: string | null;
  /** Opens the class page; null for a class that could not be opened (plain text, `refused` under its name). */
  onOpen: (() => void) | null;
  /** `home.cantLoad`, for a class that could not be opened. */
  refused: string | null;
  /** `console.home.classReport` and its press; none for a refused class. */
  report: { label: string; onPress: () => void } | null;
  /** The pressable's ref, for the screen reader's focus. */
  openRef?: Ref<View>;
  testID: string;
}

export function ClassRow({ name, archivedWord, count, attention, onOpen, refused, report, openRef, testID }: ClassRowProps): ReactElement {
  const lines = refused !== null ? [refused] : [count, ...(attention === null ? [] : [attention])];
  return (
    <RowCell sunken={archivedWord !== null} testID={testID}>
      {onOpen === null ? (
        <View accessible accessibilityLabel={[`${name}${archivedWord === null ? '' : ` ${archivedWord}`}`, ...lines].join(', ')} testID={`${testID}-plain`} style={{ minHeight: touchTarget.min, justifyContent: 'center' }}>
          <RowText name={name} archivedWord={archivedWord} lines={lines} />
        </View>
      ) : (
        <Pressable
          ref={openRef}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={[`${name}${archivedWord === null ? '' : ` ${archivedWord}`}`, ...lines].join(', ')}
          testID={`${testID}-open`}
          style={({ pressed }) => ({ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}
        >
          <RowText name={name} archivedWord={archivedWord} lines={lines} />
          <Chevron />
        </Pressable>
      )}
      {report !== null ? <AccountButton label={report.label} tone="paper" onPress={report.onPress} testID={`${testID}-report`} /> : null}
    </RowCell>
  );
}

export interface SchoolRowProps {
  name: string;
  archivedWord: string | null;
  /** Opens the school page (owner, admin); null for a teacher member (plain text, no chevron, no press). */
  onOpen: (() => void) | null;
  /** The row's focus target (the School use moves the screen reader's focus here, section 8.4). */
  focusRef?: Ref<View>;
  testID: string;
}

export function SchoolRow({ name, archivedWord, onOpen, focusRef, testID }: SchoolRowProps): ReactElement {
  const label = `${name}${archivedWord === null ? '' : ` ${archivedWord}`}`;
  return (
    <RowCell sunken={archivedWord !== null} testID={testID}>
      {onOpen === null ? (
        <View ref={focusRef} accessible accessibilityLabel={label} testID={`${testID}-plain`} style={{ minHeight: touchTarget.min, justifyContent: 'center' }}>
          <RowText name={name} archivedWord={archivedWord} lines={[]} />
        </View>
      ) : (
        <Pressable
          ref={focusRef}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={label}
          testID={`${testID}-open`}
          style={({ pressed }) => ({ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}
        >
          <RowText name={name} archivedWord={archivedWord} lines={[]} />
          <Chevron />
        </Pressable>
      )}
    </RowCell>
  );
}
