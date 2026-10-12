import { describe, expect, it } from 'vitest';
import { canTransitionFinancialAgentStatus } from '@/lib/business/financial-agent-status';

describe('transiciones de estado de agentes financieros', () => {
  it.each([
    ['draft', 'published'],
    ['published', 'retired'],
  ] as const)('permite %s → %s', (current, next) => {
    expect(canTransitionFinancialAgentStatus(current, next)).toBe(true);
  });

  it.each([
    ['draft', 'draft'],
    ['draft', 'retired'],
    ['published', 'draft'],
    ['published', 'published'],
    ['retired', 'draft'],
    ['retired', 'published'],
    ['retired', 'retired'],
    ['unknown', 'published'],
  ] as const)('rechaza %s → %s', (current, next) => {
    expect(canTransitionFinancialAgentStatus(current, next)).toBe(false);
  });
});
