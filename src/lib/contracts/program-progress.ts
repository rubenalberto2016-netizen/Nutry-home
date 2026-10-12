// @polsia:user-owned — contrato compartido para materiales y progreso del programa.
import { z } from 'zod';

export const ProgramProgressUpdate = z.object({
  weekNumber: z.number().int().min(1).max(12),
  completed: z.boolean(),
});

export const ProgramProgressUpdateResult = ProgramProgressUpdate.extend({
  updatedAt: z.string().datetime(),
});

export const ProgramOverview = z.object({
  title: z.string(),
  contentStatus: z.literal('sample'),
  disclaimer: z.string(),
  weeks: z.array(
    z.object({
      weekNumber: z.number().int().min(1).max(12),
      title: z.string(),
      summary: z.string(),
      materials: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
        }),
      ),
      practice: z.string(),
      completed: z.boolean(),
      updatedAt: z.string().datetime().nullable(),
    }),
  ),
});

export type ProgramOverview = z.infer<typeof ProgramOverview>;
export type ProgramProgressUpdate = z.infer<typeof ProgramProgressUpdate>;
export type ProgramProgressUpdateResult = z.infer<typeof ProgramProgressUpdateResult>;
