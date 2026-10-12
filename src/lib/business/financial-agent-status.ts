// @polsia:user-owned
import type { FinancialAgentStatus } from '@/lib/contracts/financial-agents';

export function canTransitionFinancialAgentStatus(
  current: string,
  next: FinancialAgentStatus,
): boolean {
  if (current === 'draft') return next === 'published';
  if (current === 'published') return next === 'retired';
  return false;
}
