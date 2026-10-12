// @polsia:user-owned
import type { Metadata } from 'next';
import { FinancialAgentReviewQueue } from '@/components/custom/admin/financial-agent-review-queue';

export const metadata: Metadata = {
  title: 'Revisión de evaluaciones',
  description: 'Cola administrativa para revisar las evaluaciones financieras recibidas.',
};

export default function FinancialAgentReviewQueuePage() {
  return <FinancialAgentReviewQueue />;
}
