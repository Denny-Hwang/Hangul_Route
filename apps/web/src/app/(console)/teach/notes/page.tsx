'use client';

import { NotesHub } from '@/components/console/NotesHub';

/** `/teach/notes`: the class notes hub, the Teacher nav's Notes item (F-FEEDBACK-001 FB-11b, section 6.13). */
export default function TeacherNotesHubPage(): JSX.Element {
  return <NotesHub persona="teacher" />;
}
