// @polsia:user-owned
// Contratos compartidos para la revisión administrativa de evaluaciones.
import { z } from 'zod';
import { FinancialAgentStatusSchema } from '@/lib/contracts/financial-agents';

export const FinancialAgentReviewStatusSchema = z.enum(['pending_review', 'in_review', 'approved']);

export const FinancialAgentReviewDocumentStatusSchema = z.enum(['pending', 'reviewed', 'rejected']);

export const FinancialAgentReviewDocumentPatchSchema = z
  .object({
    classification: z
      .string()
      .trim()
      .min(1, 'Escribe una clasificación.')
      .max(120, 'La clasificación admite hasta 120 caracteres.'),
    status: FinancialAgentReviewDocumentStatusSchema,
  })
  .strict();

export const FinancialAgentReviewActionSchema = z.enum(['saved', 'approved']);

export const FinancialAgentReviewPatch = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('saved'),
      reviewResult: z.string().max(20000, 'El resultado admite hasta 20.000 caracteres.'),
    })
    .strict(),
  z
    .object({
      action: z.literal('approved'),
      reviewResult: z.string().max(20000, 'El resultado admite hasta 20.000 caracteres.'),
    })
    .strict(),
]);

export const FinancialAgentReviewQueueItem = z
  .object({
    id: z.string().min(1),
    agent: z
      .object({ id: z.string().min(1), name: z.string(), status: FinancialAgentStatusSchema })
      .strict(),
    workspace: z.object({ id: z.string().min(1), name: z.string() }).strict(),
    client: z
      .object({ id: z.string().min(1), name: z.string().nullable(), email: z.string().nullable() })
      .strict(),
    reviewStatus: FinancialAgentReviewStatusSchema,
    reviewResult: z.string().nullable(),
    submittedAt: z.string().datetime(),
    reviewUpdatedAt: z.string().datetime().nullable(),
  })
  .strict();

export const FinancialAgentReviewQueue = z
  .object({ items: z.array(FinancialAgentReviewQueueItem) })
  .strict();

export const FinancialAgentReviewAnswer = z
  .object({ question: z.string(), answer: z.string() })
  .strict();

export const FinancialAgentReviewDocument = z
  .object({
    id: z.string().min(1),
    documentName: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
    classification: z.string().max(120),
    status: FinancialAgentReviewDocumentStatusSchema,
    createdAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
  })
  .strict();

export const FinancialAgentReviewEvent = z
  .object({
    id: z.string().min(1),
    reviewerUserId: z.string().min(1),
    reviewerName: z.string().nullable(),
    reviewerEmail: z.string().nullable(),
    action: FinancialAgentReviewActionSchema,
    previousStatus: FinancialAgentReviewStatusSchema,
    newStatus: FinancialAgentReviewStatusSchema,
    resultSnapshot: z.string().nullable(),
    occurredAt: z.string().datetime(),
  })
  .strict();

export const FinancialAgentReviewDetail = z
  .object({
    id: z.string().min(1),
    agent: z
      .object({ id: z.string().min(1), name: z.string(), status: FinancialAgentStatusSchema })
      .strict(),
    workspace: z.object({ id: z.string().min(1), name: z.string() }).strict(),
    client: z
      .object({ id: z.string().min(1), name: z.string().nullable(), email: z.string().nullable() })
      .strict(),
    answers: z.array(FinancialAgentReviewAnswer),
    requestedDocuments: z.array(z.string()),
    documents: z.array(FinancialAgentReviewDocument),
    submittedAt: z.string().datetime(),
    review: z
      .object({
        status: FinancialAgentReviewStatusSchema,
        result: z.string().nullable(),
        updatedAt: z.string().datetime().nullable(),
      })
      .strict(),
    events: z.array(FinancialAgentReviewEvent),
  })
  .strict();

export const FinancialAgentReviewDocumentContent = z
  .object({ fileName: z.string(), mimeType: z.string(), base64: z.string().min(1) })
  .strict();

export type FinancialAgentReviewStatus = z.infer<typeof FinancialAgentReviewStatusSchema>;
export type FinancialAgentReviewDocumentStatus = z.infer<
  typeof FinancialAgentReviewDocumentStatusSchema
>;
export type FinancialAgentReviewDocumentPatch = z.infer<
  typeof FinancialAgentReviewDocumentPatchSchema
>;
export type FinancialAgentReviewAction = z.infer<typeof FinancialAgentReviewActionSchema>;
export type FinancialAgentReviewPatch = z.infer<typeof FinancialAgentReviewPatch>;
export type FinancialAgentReviewQueue = z.infer<typeof FinancialAgentReviewQueue>;
export type FinancialAgentReviewDetail = z.infer<typeof FinancialAgentReviewDetail>;
export type FinancialAgentReviewDocument = z.infer<typeof FinancialAgentReviewDocument>;
