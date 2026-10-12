// @polsia:user-owned — contrato del asistente educativo privado del programa.

import { z } from 'zod';

export const ProgramTutorMaterialsRequest = z.object({
  weekNumber: z.coerce.number().int().min(1).max(12),
});

export const ProgramTutorMaterial = z.object({
  id: z.string().min(1),
  weekNumber: z.number().int().min(1).max(12).nullable(),
  title: z.string().min(1),
  content: z.string().min(1),
  sourceHref: z.string().startsWith('/'),
});

export const ProgramTutorMaterialsResponse = z.object({
  weekNumber: z.number().int().min(1).max(12),
  materials: z.array(ProgramTutorMaterial),
});

export const ProgramTutorRequest = z
  .object({
    weekNumber: z.number().int().min(1).max(12),
    question: z.string().trim().min(2).max(500),
  })
  .strict();

export const ProgramTutorResponse = z.object({
  status: z.enum(['answered', 'clinical', 'unsupported', 'no_materials', 'unavailable']),
  answer: z.string().min(1).max(2400),
  citations: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        sourceHref: z.string().startsWith('/'),
      }),
    )
    .max(5),
});

export type ProgramTutorMaterial = z.infer<typeof ProgramTutorMaterial>;
export type ProgramTutorMaterialsResponse = z.infer<typeof ProgramTutorMaterialsResponse>;
export type ProgramTutorRequest = z.infer<typeof ProgramTutorRequest>;
export type ProgramTutorResponse = z.infer<typeof ProgramTutorResponse>;
