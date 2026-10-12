// @polsia:user-owned
import type { Metadata } from 'next';
import { FinancialAgentRun } from '@/components/custom/financial-agent-run';

export const metadata: Metadata = {
  title: 'Completar evaluación financiera',
  description: 'Responde y presenta de forma segura una evaluación financiera de Vardelume.',
};

export default async function FinancialAgentRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FinancialAgentRun agentId={id} />;
}
