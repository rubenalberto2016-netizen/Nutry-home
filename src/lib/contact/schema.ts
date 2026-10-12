// @polsia:user-owned
//
// Shared zod schema for a contact message. Safe to import from a 'use client'
// file: no server-only imports, so the client can reuse the input TYPE without
// pulling in the route handler or Prisma.

import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Escribe tu nombre.'),
  email: z.string().email('Escribe un correo electrónico válido.'),
  message: z.string().min(1, 'Escribe un mensaje.'),
});

export const contactResponseSchema = z.object({ ok: z.literal(true) });

export type ContactInput = z.infer<typeof contactSchema>;
