import { FamilyDashboard } from '@/components/parent/FamilyDashboard';
import { mockFamily } from '@/data/mock-family';

/** The `/parent` demo dashboard (F-CONSOLE-001 §3.7); the body reads the dictionary (F-I18N-001 PR 10c). */
export default function ParentPage(): JSX.Element {
  return <FamilyDashboard family={mockFamily()} />;
}
