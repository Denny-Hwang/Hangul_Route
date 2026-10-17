export interface ConfirmSheetProps {
  visible: boolean;
  /** The question, the sheet's heading (its accessible name). */
  title: string;
  /** One line under it (its description). */
  message?: string;
  /** The safe choice: first, and focused when the sheet opens ("Keep playing", "Cancel"). */
  cancelLabel: string;
  /** A verb, never "OK" ("Leave", "Remove"). */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  testID?: string;
}
