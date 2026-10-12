// @polsia:user-owned
import type { Metadata } from 'next';
import { FinancialAgentReview } from '@/components/custom/admin/financial-agent-review';

export const metadata: Metadata = {
  title: 'Expediente de evaluación',
  description: 'Respuestas, documentos y resultado de la evaluación financiera enviada.',
};

export default async function FinancialAgentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FinancialAgentReview submissionId={id} />;
}
