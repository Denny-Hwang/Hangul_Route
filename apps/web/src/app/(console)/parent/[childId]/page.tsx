import { notFound } from 'next/navigation';
import { ChildDetail } from '@/components/parent/ChildDetail';
import { findMockChild, mockFamily } from '@/data/mock-family';

/**
 * Static export (F-CONSOLE-001 §3.7): the demo family is the only data, so its children are
 * the only pages. Each is exported under its colon-free slug (issue #237): a colon in the
 * file name made the host redirect to `%3A` and serve the 404 page.
 */
export const dynamicParams = false;
export function generateStaticParams(): Array<{ childId: string }> {
  return mockFamily().profiles.map((p) => ({ childId: p.slug }));
}

export default function ChildDetailPage({ params }: { params: { childId: string } }): JSX.Element {
  const child = findMockChild(params.childId);
  if (!child) notFound();
  return <ChildDetail child={child} />;
}
