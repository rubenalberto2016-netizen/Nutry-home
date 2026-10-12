// @polsia:user-owned
import type { Metadata } from 'next';
import { EditorialDraftWorkspace } from '@/components/custom/editorial-draft-workspace';

export const metadata: Metadata = {
  title: 'Borradores de contenido',
  description: 'Prepara borradores privados y respaldados por fuentes para revisión profesional.',
};

export default function EditorialContentPage() {
  return <EditorialDraftWorkspace />;
}
