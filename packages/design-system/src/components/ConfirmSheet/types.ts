export interface ConfirmSheetProps {
  /** Shown while true. */
  visible: boolean;
  /** The question, e.g. "Leave this quest?". */
  title: string;
  /** One calm line under it, e.g. "Stars from this try will not be saved." */
  message?: string;
  /** The safe choice, already localised ("Keep playing"): first, filled and focused. */
  keepLabel: string;
  /** The other choice, already localised ("Leave"): an outline button under Keep. */
  confirmLabel: string;
  /** Keep, Escape, the Android back button and a tap on the scrim. */
  onKeep: () => void;
  onConfirm: () => void;
  /** The sheet is `testID`, its buttons `${testID}-keep` and `${testID}-confirm`. */
  testID?: string;
}
