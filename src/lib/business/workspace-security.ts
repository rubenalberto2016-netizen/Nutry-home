// @polsia:user-owned
import type {
  WorkspaceSubmissionAccessRole,
  WorkspaceSubmissionEffectiveRole,
} from '@/lib/contracts/workspace-security';

export interface SubmissionPermissionInput {
  actorId: string;
  memberWorkspaceId: string | null;
  submissionWorkspaceId: string;
  workspaceOwnerId: string;
  workspaceOwnerRole: string | null;
  submissionUserId: string;
  grantRole: WorkspaceSubmissionAccessRole | null;
}

export interface SubmissionPermissions {
  role: WorkspaceSubmissionEffectiveRole | null;
  isMember: boolean;
  isOwner: boolean;
  isSender: boolean;
  canView: boolean;
  canReadDocuments: boolean;
  canManage: boolean;
}

export function resolveSubmissionPermissions(
  input: SubmissionPermissionInput,
): SubmissionPermissions {
  const isMember = input.memberWorkspaceId === input.submissionWorkspaceId;
  const isOwner =
    isMember && input.actorId === input.workspaceOwnerId && input.workspaceOwnerRole === 'OWNER';
  const isSender = isMember && input.actorId === input.submissionUserId;
  const role: WorkspaceSubmissionEffectiveRole | null = !isMember
    ? null
    : isOwner
      ? 'PROPIETARIO'
      : isSender
        ? 'REMITENTE'
        : input.grantRole;
  const canView = role !== null;
  const canReadDocuments = isMember && (isOwner || isSender || input.grantRole === 'REVISOR');

  return {
    role,
    isMember,
    isOwner,
    isSender,
    canView,
    canReadDocuments,
    canManage: isOwner,
  };
}
