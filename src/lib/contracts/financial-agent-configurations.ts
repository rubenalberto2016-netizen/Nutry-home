// @polsia:user-owned
import { z } from 'zod';

export const FinancialAgentConfigurationStatus = z.enum([
  'draft',
  'active',
  'inactive',
  'archived',
]);

export const FinancialAgentSupervisionLevel = z.enum(['Alta', 'Media', 'Baja']);

export const FinancialAgentConfigurationInput = z
  .object({
    rules: z.string().max(10_000, 'Usa hasta 10.000 caracteres'),
    instructions: z.string().max(10_000, 'Usa hasta 10.000 caracteres'),
    supervisionLevel: FinancialAgentSupervisionLevel,
  })
  .strict();

export const FinancialAgentConfigurationItem = z
  .object({
    id: z.string().min(1),
    financialAgentId: z.string().min(1),
    version: z.number().int().positive(),
    rules: z.string(),
    instructions: z.string(),
    supervisionLevel: FinancialAgentSupervisionLevel,
    status: FinancialAgentConfigurationStatus,
    archivedAt: z.string().datetime().nullable(),
    createdByUserId: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

export const FinancialAgentConfigurationList = z
  .object({
    items: z.array(FinancialAgentConfigurationItem),
    activeConfigurationId: z.string().min(1).nullable(),
  })
  .strict();

export const FinancialAgentConfigurationAction = z
  .object({ action: z.enum(['activate', 'archive']) })
  .strict();

export type FinancialAgentConfigurationInput = z.infer<typeof FinancialAgentConfigurationInput>;
export type FinancialAgentConfigurationItem = z.infer<typeof FinancialAgentConfigurationItem>;
export type FinancialAgentConfigurationList = z.infer<typeof FinancialAgentConfigurationList>;
