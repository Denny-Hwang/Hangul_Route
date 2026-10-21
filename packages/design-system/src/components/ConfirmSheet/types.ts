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
  /**
   * [OA] A second paragraph under the message, part of the description too (AMENDMENTS-ONE-ACCOUNT-MANY-USERS
   * section 10.4: "Their place in a family or class stays.").
   */
  detail?: string;
  /**
   * [OA] `danger` fills the confirm with `feedback.danger` (OA-0b addendum): only for a grown-up's destructive
   * confirmation (the Remove anyway step), never on a learner screen or for a learner's miss. Default `primary`.
   */
  confirmTone?: 'primary' | 'danger';
  /**
   * [OA] The confirm is the main action (Save progress first, which leaves the sheet): it is drawn first, the cancel
   * second. The cancel still takes focus, so no single activation from the opening focus leaves or removes.
   */
  confirmFirst?: boolean;
  /** [OA] A third, quiet text action, last (Remove anyway); both or neither. */
  quietLabel?: string;
  onQuiet?: () => void;
  /** [OA] Working (the sync check): only the cancel is offered, and the message is marked busy. */
  busy?: boolean;
}
