// @polsia:user-owned
import { Prisma, PrismaClient } from '@prisma/client';
import { isDocumentEligibleForDeletion, type RetentionDays } from './retention-policy.js';

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  const now = new Date();
  const policies = await prisma.workspaceDocumentRetention.findMany({
    where: { retentionDays: { not: null } },
    select: { workspaceId: true, retentionDays: true },
  });

  for (const policy of policies) {
    const retentionDays = validRetentionDays(policy.retentionDays);
    if (retentionDays === null) continue;
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const documents = await prisma.financialAgentSubmissionDocument.findMany({
      where: {
        submission: { workspaceId: policy.workspaceId },
        createdAt: { lte: cutoff },
        content: { not: null },
        deletedAt: null,
      },
      select: { id: true, submissionId: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    for (const document of documents) {
      if (
        !isDocumentEligibleForDeletion({
          createdAt: document.createdAt,
          retentionDays,
          hasContent: true,
          deletedAt: null,
          now,
        })
      ) {
        continue;
      }
      await prisma.$transaction(async (transaction) => {
        const currentPolicy = await transaction.workspaceDocumentRetention.findUnique({
          where: { workspaceId: policy.workspaceId },
          select: { retentionDays: true },
        });
        if (currentPolicy?.retentionDays !== retentionDays) return;
        const deleted = await transaction.financialAgentSubmissionDocument.updateMany({
          where: {
            id: document.id,
            submission: { workspaceId: policy.workspaceId },
            createdAt: { lte: cutoff },
            content: { not: null },
            deletedAt: null,
          },
          data: { content: null, deletedAt: now },
        });
        if (deleted.count !== 1) return;
        await transaction.workspaceAccessEvent.create({
          data: {
            workspaceId: policy.workspaceId,
            submissionId: document.submissionId,
            documentId: document.id,
            actorLabel: 'Proceso de retención',
            action: 'DOCUMENT_DELETED',
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
  }
}

function validRetentionDays(value: number | null): Exclude<RetentionDays, null> | null {
  return value === 30 || value === 90 || value === 180 || value === 365 ? value : null;
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
