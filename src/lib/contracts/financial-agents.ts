// @polsia:user-owned
// Contrato compartido de lectura y escritura para los borradores financieros.
import { z } from 'zod';

export const FinancialAgentQuestion = z
  .string()
  .trim()
  .min(1, 'Escribe una pregunta')
  .max(300, 'Cada pregunta admite hasta 300 caracteres');

export const FinancialAgentRequestedDocument = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre del documento')
  .max(120, 'Usa hasta 120 caracteres');

export const FinancialAgentRequestedDocuments = z
  .array(FinancialAgentRequestedDocument)
  .max(10, 'Puedes solicitar hasta 10 documentos')
  .refine(
    (documents) =>
      new Set(documents.map((document) => document.toLowerCase())).size === documents.length,
    'No repitas el nombre de un documento',
  );

export const FinancialAgentFields = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(120, 'Usa hasta 120 caracteres'),
  objective: z
    .string()
    .trim()
    .min(1, 'Describe el objetivo')
    .max(1000, 'Usa hasta 1.000 caracteres'),
  questions: z
    .array(FinancialAgentQuestion)
    .min(1, 'Añade al menos una pregunta')
    .max(10, 'Puedes añadir hasta 10 preguntas'),
  requestedDocuments: FinancialAgentRequestedDocuments,
});

export const FinancialAgentCreate = FinancialAgentFields.extend({
  requestedDocuments: FinancialAgentRequestedDocuments.default([]),
}).strict();

export const FinancialAgentStatusSchema = z.enum(['draft', 'published', 'retired']);

export const FinancialAgentStatusChange = z.object({ status: FinancialAgentStatusSchema }).strict();

export const FinancialAgentAvailabilityQuery = z
  .object({ availability: z.literal('published').optional() })
  .strict();

export const FinancialAgentPatch = FinancialAgentFields.partial()
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, 'Incluye al menos un campo para actualizar');

export const FinancialAgentRequestedDocumentsPatch = z
  .object({ requestedDocuments: FinancialAgentRequestedDocuments })
  .strict();

export const FinancialAgentItem = FinancialAgentFields.extend({
  id: z.string().min(1),
  status: FinancialAgentStatusSchema,
  updatedAt: z.string().datetime(),
}).strict();

export const FinancialAgentList = z
  .object({
    items: z.array(FinancialAgentItem),
  })
  .strict();

export type FinancialAgentInput = z.input<typeof FinancialAgentCreate>;
export type FinancialAgentCreateData = z.output<typeof FinancialAgentCreate>;
export type FinancialAgentStatus = z.infer<typeof FinancialAgentStatusSchema>;
export type FinancialAgentItem = z.infer<typeof FinancialAgentItem>;
export type FinancialAgentList = z.infer<typeof FinancialAgentList>;
