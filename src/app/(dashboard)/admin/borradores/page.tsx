// @polsia:user-owned
import type { Metadata } from 'next';
import { EditorialReviewWorkspace } from '@/components/custom/editorial-review-workspace';

export const metadata: Metadata = {
  title: 'Revisión profesional de contenido',
  description: 'Revisa fuentes y aprueba borradores de contenido de forma privada.',
};

export default function EditorialReviewPage() {
  return <EditorialReviewWorkspace />;
}
