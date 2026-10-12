// @polsia:user-owned
import { z } from 'zod';

export const SubscriptionStatus = z.enum([
  'none',
  'pending',
  'active',
  'cancelled',
  'payment_failed',
  'suspended',
  'expired',
]);

export const SubscriptionOverview = z.object({
  workspaceId: z.string().nullable(),
  workspaceName: z.string().nullable(),
  role: z.enum(['OWNER', 'MEMBER']).nullable(),
  isOwner: z.boolean(),
  hasAccess: z.boolean(),
  status: SubscriptionStatus,
  paidThrough: z.string().datetime().nullable(),
  canCancel: z.boolean(),
  checkoutTotalUsd: z.number().int().nullable(),
  requestStatus: z.enum(['not_started', 'received']),
  paymentStatus: z.enum([
    'not_started',
    'pending',
    'unverifiable',
    'failed',
    'cancelled',
    'confirmed',
  ]),
  accessStatus: z.enum(['closed', 'enabled', 'expired']),
});

export const CheckoutUrl = z.object({ url: z.string().url() });

export const CancellationResult = z.object({
  status: z.literal('cancelled'),
  paidThrough: z.string().datetime().nullable(),
});

export const AddWorkspaceMember = z.object({
  email: z.string().trim().email().max(320),
});

export const WorkspaceMemberList = z.object({
  workspaceId: z.string().nullable(),
  canManage: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      email: z.string().nullable(),
      name: z.string().nullable(),
      role: z.enum(['OWNER', 'MEMBER']),
      createdAt: z.string().datetime(),
    }),
  ),
});

export type SubscriptionOverview = z.infer<typeof SubscriptionOverview>;
export type WorkspaceMemberList = z.infer<typeof WorkspaceMemberList>;
