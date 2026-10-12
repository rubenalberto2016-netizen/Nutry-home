// @polsia:user-owned
// Contrato compartido para ejecutar y presentar una evaluación financiera.
import { z } from 'zod';
import {
  FinancialAgentQuestion,
  FinancialAgentRequestedDocuments,
} from '@/lib/contracts/financial-agents';

export const FinancialAgentEvaluationConfig = z
  .object({
    agent: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        objective: z.string().min(1),
        questions: z.array(FinancialAgentQuestion).min(1).max(10),
        requestedDocuments: FinancialAgentRequestedDocuments,
      })
      .strict(),
    submission: z.object({ submittedAt: z.string().datetime() }).strict().nullable(),
  })
  .strict();

export const FinancialAgentEvaluationFile = z
  .object({
    documentName: z.string().trim().min(1).max(120),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(128),
    sizeBytes: z.number().int().positive(),
    base64: z.string().min(1),
  })
  .strict();

export const FinancialAgentEvaluationSubmit = z
  .object({
    answers: z.array(z.string().trim().min(1, 'Completa todas las respuestas').max(10000)).max(10),
    files: z.array(FinancialAgentEvaluationFile).max(10),
  })
  .strict();

export const FinancialAgentEvaluationSubmitResult = z
  .object({ submittedAt: z.string().datetime() })
  .strict();

export type FinancialAgentEvaluationConfig = z.infer<typeof FinancialAgentEvaluationConfig>;
export type FinancialAgentEvaluationFile = z.infer<typeof FinancialAgentEvaluationFile>;
export type FinancialAgentEvaluationSubmit = z.infer<typeof FinancialAgentEvaluationSubmit>;
