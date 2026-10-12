// @polsia:user-owned
import type { Metadata } from 'next';
import { FinancialAgentWorkspace } from '@/components/custom/financial-agent-workspace';
import { WorkspaceMembers } from '@/components/custom/workspace-members';
import { WorkspaceSubscriptionPanel } from '@/components/custom/workspace-subscription-panel';

export const metadata: Metadata = {
  title: 'Agentes financieros',
  description: 'Configura y guarda borradores de evaluación financiera en Vardelume.',
};

export default function DashboardPage() {
  return (
    <div className="grid min-w-0 gap-6">
      <WorkspaceSubscriptionPanel />
      <WorkspaceMembers />
      <FinancialAgentWorkspace />
    </div>
  );
}
