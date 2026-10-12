// @polsia:user-owned
// Contratos compartidos para propuestas de traducción jurídica.
import { z } from 'zod';

export const FinancialAgentTranslationSource = z.discriminatedUnion('type', [
  z.object({ type: z.literal('answer'), index: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('document'), documentId: z.string().min(1) }).strict(),
]);

export const FinancialAgentTranslationRequest = z
  .object({ source: FinancialAgentTranslationSource })
  .strict();

export const FinancialAgentTranslationStatus = z.enum(['pending', 'approved']);

export const FinancialAgentTranslationItem = z
  .object({
    id: z.string().min(1),
    submissionId: z.string().min(1),
    sourceType: z.enum(['answer', 'document']),
    sourceKey: z.string().min(1),
    sourceLabel: z.string().min(1),
    originalText: z.string().min(1),
    translatedText: z.string().min(1),
    targetLanguage: z.literal('es'),
    status: FinancialAgentTranslationStatus,
    createdAt: z.string().datetime(),
    approvedByUserId: z.string().min(1).nullable(),
    approvedByUserName: z.string().nullable(),
    approvedByUserEmail: z.string().nullable(),
    approvedAt: z.string().datetime().nullable(),
  })
  .strict();

export const FinancialAgentTranslationList = z
  .object({ items: z.array(FinancialAgentTranslationItem) })
  .strict();

export const FinancialAgentTranslationApproval = z
  .object({ action: z.literal('approve') })
  .strict();

export type FinancialAgentTranslationSource = z.infer<typeof FinancialAgentTranslationSource>;
export type FinancialAgentTranslationStatus = z.infer<typeof FinancialAgentTranslationStatus>;
export type FinancialAgentTranslationItem = z.infer<typeof FinancialAgentTranslationItem>;
