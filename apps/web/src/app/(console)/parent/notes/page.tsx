'use client';

import { NotesHub } from '@/components/console/NotesHub';

/** `/parent/notes`: the family notes hub, the Family nav's Notes item (F-FEEDBACK-001 FB-11b, section 6.13). */
export default function ParentNotesHubPage(): JSX.Element {
  return <NotesHub persona="parent" />;
}
