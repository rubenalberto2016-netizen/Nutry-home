// @polsia:user-owned
import { describe, expect, it } from 'vitest';
import { resolveSubmissionPermissions } from '@/lib/business/workspace-security';

const memberInput = {
  actorId: 'member-1',
  memberWorkspaceId: 'workspace-1',
  submissionWorkspaceId: 'workspace-1',
  workspaceOwnerId: 'owner-1',
  workspaceOwnerRole: 'MEMBER',
  submissionUserId: 'sender-1',
};

describe('permisos por expediente', () => {
  it('no expone expedientes de otro espacio aunque exista una concesión', () => {
    const result = resolveSubmissionPermissions({ ...memberInput, submissionWorkspaceId: 'workspace-2', grantRole: 'REVISOR' });
    expect(result.canView).toBe(false);
    expect(result.canReadDocuments).toBe(false);
  });

  it('permite que LECTOR vea respuestas y metadatos, pero no bytes', () => {
    const result = resolveSubmissionPermissions({ ...memberInput, grantRole: 'LECTOR' });
    expect(result.role).toBe('LECTOR');
    expect(result.canView).toBe(true);
    expect(result.canReadDocuments).toBe(false);
  });

  it('permite que REVISOR abra documentos y que la revocación quite ese acceso', () => {
    const reviewer = resolveSubmissionPermissions({ ...memberInput, grantRole: 'REVISOR' });
    const revoked = resolveSubmissionPermissions({ ...memberInput, grantRole: null });
    expect(reviewer.canReadDocuments).toBe(true);
    expect(revoked.canView).toBe(false);
    expect(revoked.canReadDocuments).toBe(false);
  });

  it('conserva el acceso del remitente y la administración de la persona propietaria', () => {
    const sender = resolveSubmissionPermissions({
      ...memberInput,
      actorId: 'sender-1',
      grantRole: null,
    });
    const owner = resolveSubmissionPermissions({
      ...memberInput,
      actorId: 'owner-1',
      workspaceOwnerRole: 'OWNER',
      grantRole: null,
    });
    expect(sender.canReadDocuments).toBe(true);
    expect(owner.canManage).toBe(true);
    expect(owner.canReadDocuments).toBe(true);
  });
});
