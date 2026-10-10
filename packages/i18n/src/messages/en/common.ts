/** Generic buttons, time words and errors shared by every surface (F-I18N-001 §3.4 rule 2). */
export const common = {
  buttons: {
    ok: 'OK',
    cancel: 'Cancel',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    save: 'Save',
    tryAgain: 'Try again',
  },
  /** Words for `describeRelativeDay`. */
  time: {
    today: 'today',
    yesterday: 'yesterday',
    notYet: 'not yet',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
  },
} as const;
