// @polsia:user-owned — contrato del asistente público de admisión.

import { z } from 'zod';

export const admissionAssistantRequestSchema = z
  .object({
    question: z.string().trim().min(2).max(500),
  })
  .strict();

export const admissionAssistantResponseSchema = z
  .object({
    answer: z.string().min(1).max(1200),
  })
  .strict();

export const admissionIntentSchema = z.enum([
  'duration',
  'format',
  'topics',
  'price',
  'access',
  'call_prep',
  'scope',
  'unknown',
]);

export type AdmissionAssistantRequest = z.infer<typeof admissionAssistantRequestSchema>;
export type AdmissionAssistantResponse = z.infer<typeof admissionAssistantResponseSchema>;
export type AdmissionIntent = z.infer<typeof admissionIntentSchema>;
