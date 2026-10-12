// @polsia:user-owned
import { z } from 'zod';

const sourceUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'Usa una URL pública HTTP o HTTPS');

export const EditorialSource = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['web_search', 'provided_material']),
    title: z.string().min(1).max(300),
    url: sourceUrl.nullable(),
    excerpt: z.string().min(1).max(8000),
    checkedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const EditorialSourceList = z
  .object({
    items: z.array(EditorialSource),
  })
  .strict();

export const EditorialSourceMaterialCreate = z
  .object({
    title: z.string().trim().min(1).max(300),
    excerpt: z.string().trim().min(20).max(8000),
  })
  .strict();

export const EditorialSearchRequest = z
  .object({
    query: z.string().trim().min(4).max(300),
  })
  .strict();

const EditorialDraftSectionFields = z
  .object({
    heading: z.string().trim().min(1).max(120),
    body: z.string().trim().min(20).max(1600),
    sourceIds: z.array(z.string().min(1)).min(1).max(5),
  })
  .strict();

export const EditorialDraftSection = EditorialDraftSectionFields.extend({
  id: z.string().min(1),
}).strict();
export const EditorialGeneratedSection = EditorialDraftSectionFields;

export const EditorialDraftStatus = z.enum(['pending_review', 'changes_requested', 'approved']);

export const EditorialDraft = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    createdByUserId: z.string().min(1),
    title: z.string().min(1).max(160),
    brief: z.string().min(1).max(1500),
    sections: z.array(EditorialDraftSection).min(1).max(6),
    sources: z.array(EditorialSource).min(1).max(8),
    status: EditorialDraftStatus,
    approvedAt: z.string().datetime().nullable(),
    approvedBySnapshot: z.string().nullable(),
    latestReviewNote: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const EditorialDraftList = z.object({ items: z.array(EditorialDraft) }).strict();

export const EditorialDraftCreate = z
  .object({
    title: z.string().trim().min(1).max(160),
    brief: z.string().trim().min(10).max(1500),
    sourceIds: z.array(z.string().min(1)).min(1).max(8),
  })
  .strict();

export const EditorialDraftPatch = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    sections: z.array(EditorialDraftSection).min(1).max(6).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Incluye cambios para guardar');

export const EditorialReviewAction = z
  .object({
    action: z.enum(['approved', 'changes_requested']),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((value) => value.action !== 'changes_requested' || Boolean(value.note), {
    message: 'Añade una nota cuando solicites cambios',
    path: ['note'],
  });

export const EditorialReviewerCreate = z
  .object({
    email: z.string().trim().email().max(320),
    profession: z.string().trim().min(2).max(120),
    registryName: z.string().trim().min(2).max(160),
    registrationNumber: z.string().trim().min(2).max(120),
    jurisdiction: z.string().trim().min(2).max(120),
    credentialsConfirmed: z.literal(true),
  })
  .strict();

export const EditorialReviewerCreateResult = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    active: z.boolean(),
  })
  .strict();

export const EditorialReviewerRevocation = z
  .object({
    id: z.string().min(1),
    active: z.literal(false),
  })
  .strict();

export const EditorialReviewResult = z
  .object({
    id: z.string().min(1),
    status: z.enum(['approved', 'changes_requested']),
    reviewerSnapshot: z.string().min(1),
  })
  .strict();

export const EditorialReviewer = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().email(),
    profession: z.string().min(1),
    registryName: z.string().min(1),
    registrationNumber: z.string().min(1),
    jurisdiction: z.string().min(1),
    active: z.boolean(),
    authorizedAt: z.string().datetime(),
    authorizedByEmail: z.string().email().nullable(),
    revokedAt: z.string().datetime().nullable(),
  })
  .strict();

export const EditorialReviewQueue = z
  .object({
    items: z.array(EditorialDraft),
    reviewers: z.array(EditorialReviewer),
    currentReviewer: EditorialReviewer.nullable(),
  })
  .strict();

export type EditorialSource = z.infer<typeof EditorialSource>;
export type EditorialDraft = z.infer<typeof EditorialDraft>;
export type EditorialDraftSection = z.infer<typeof EditorialDraftSection>;
export type EditorialReviewer = z.infer<typeof EditorialReviewer>;
