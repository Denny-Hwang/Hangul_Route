/**
 * Where **See report** goes — F-REPORT-001 section 3.9 (RP-9). Straight to `LearnerReport` while the grown-up gate
 * opens directly (`gateOpensDirectly`: an open 15-minute session, or a self-only device without a PIN), else through
 * `PinEntry`, which continues to the report. The same rule guards the screen itself when it is reached with the gate
 * closed (a lapsed session). `gateOpensDirectly` decides the entry only, never the voice (`voice.ts`).
 */
export type ReportEntry =
  | { screen: 'LearnerReport'; params: { profileId: string } }
  | { screen: 'PinEntry'; params: { next: 'LearnerReport'; profileId: string } };

export function reportEntry(profileId: string, opensDirectly: boolean): ReportEntry {
  return opensDirectly ? { screen: 'LearnerReport', params: { profileId } } : { screen: 'PinEntry', params: { next: 'LearnerReport', profileId } };
}
