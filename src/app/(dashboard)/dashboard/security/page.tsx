// @polsia:user-owned
import type { Metadata } from 'next';
import { WorkspaceSecurity } from '@/components/custom/workspace-security';

export const metadata: Metadata = {
  title: 'Seguridad del espacio',
  description:
    'Gestiona permisos por expediente, revisa accesos y configura la retención documental.',
};

export default function WorkspaceSecurityPage() {
  return <WorkspaceSecurity />;
}
