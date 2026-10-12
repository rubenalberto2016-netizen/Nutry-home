// @polsia:user-owned
import { z } from 'zod';

export const WorkspaceSubmissionAccessRole = z.enum(['LECTOR', 'REVISOR']);
export const WorkspaceSubmissionEffectiveRole = z.enum([
  'PROPIETARIO',
  'REMITENTE',
  'LECTOR',
  'REVISOR',
]);
export const WorkspaceRetentionDays = z.union([
  z.literal(30),
  z.literal(90),
  z.literal(180),
  z.literal(365),
]);

export const WorkspaceSubmissionList = z
  .object({
    workspaceId: z.string().nullable(),
    canManage: z.boolean(),
    items: z.array(
      z
        .object({
          id: z.string(),
          agentName: z.string(),
          submittedAt: z.string().datetime(),
          documentCount: z.number().int().nonnegative(),
          role: WorkspaceSubmissionEffectiveRole,
        })
        .strict(),
    ),
  })
  .strict();

export const WorkspaceSubmissionDetail = z
  .object({
    id: z.string(),
    agentName: z.string(),
    submittedAt: z.string().datetime(),
    answers: z.array(z.object({ question: z.string(), answer: z.string() }).strict()),
    requestedDocuments: z.array(z.string()),
    documents: z.array(
      z
        .object({
          id: z.string(),
          documentName: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number().int().nonnegative(),
          createdAt: z.string().datetime(),
          deletedAt: z.string().datetime().nullable(),
        })
        .strict(),
    ),
    access: z
      .object({
        role: WorkspaceSubmissionEffectiveRole,
        canManage: z.boolean(),
        canReadDocuments: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const WorkspaceSubmissionDocumentContent = z
  .object({ fileName: z.string(), mimeType: z.string(), base64: z.string().min(1) })
  .strict();

export const WorkspaceSubmissionAccessList = z
  .object({
    canManage: z.boolean(),
    senderUserId: z.string().nullable(),
    members: z.array(
      z
        .object({
          userId: z.string(),
          name: z.string().nullable(),
          email: z.string().nullable(),
          role: WorkspaceSubmissionAccessRole.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const WorkspaceSubmissionAccessChange = z
  .object({
    userId: z.string().min(1),
    role: WorkspaceSubmissionAccessRole,
  })
  .strict();

export const WorkspaceSubmissionAccessPatch = z
  .object({
    userId: z.string().min(1),
    role: WorkspaceSubmissionAccessRole.nullable(),
  })
  .strict();

export const WorkspaceDocumentRetentionState = z
  .object({
    workspaceId: z.string().nullable(),
    canManage: z.boolean(),
    retentionDays: WorkspaceRetentionDays.nullable(),
    updatedAt: z.string().datetime().nullable(),
    documents: z.array(
      z
        .object({
          id: z.string(),
          fileName: z.string(),
          uploadedAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();

export const WorkspaceDocumentRetentionChange = z
  .object({ retentionDays: WorkspaceRetentionDays.nullable() })
  .strict();

export const WorkspaceAccessEventList = z
  .object({
    canManage: z.boolean(),
    items: z.array(
      z
        .object({
          id: z.string(),
          submissionId: z.string().nullable(),
          submissionName: z.string().nullable(),
          documentId: z.string().nullable(),
          documentName: z.string().nullable(),
          actorUserId: z.string().nullable(),
          actorName: z.string().nullable(),
          actorEmail: z.string().nullable(),
          actorLabel: z.string().nullable(),
          subjectUserId: z.string().nullable(),
          subjectName: z.string().nullable(),
          subjectEmail: z.string().nullable(),
          action: z.enum([
            'SUBMISSION_OPENED',
            'DOCUMENT_OPENED',
            'ACCESS_GRANTED',
            'ACCESS_CHANGED',
            'ACCESS_REVOKED',
            'RETENTION_CHANGED',
            'DOCUMENT_DELETED',
          ]),
          previousRole: WorkspaceSubmissionAccessRole.nullable(),
          newRole: WorkspaceSubmissionAccessRole.nullable(),
          previousRetentionDays: WorkspaceRetentionDays.nullable(),
          newRetentionDays: WorkspaceRetentionDays.nullable(),
          occurredAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();

export type WorkspaceSubmissionAccessRole = z.infer<typeof WorkspaceSubmissionAccessRole>;
export type WorkspaceSubmissionEffectiveRole = z.infer<typeof WorkspaceSubmissionEffectiveRole>;
export type WorkspaceSubmissionList = z.infer<typeof WorkspaceSubmissionList>;
export type WorkspaceSubmissionDetail = z.infer<typeof WorkspaceSubmissionDetail>;
export type WorkspaceSubmissionAccessList = z.infer<typeof WorkspaceSubmissionAccessList>;
export type WorkspaceDocumentRetentionState = z.infer<typeof WorkspaceDocumentRetentionState>;
export type WorkspaceAccessEventList = z.infer<typeof WorkspaceAccessEventList>;
