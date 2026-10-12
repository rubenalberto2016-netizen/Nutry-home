// @polsia:user-owned
export type RetentionDays = 30 | 90 | 180 | 365 | null;

export function calculateDocumentExpiry(
  createdAt: Date,
  retentionDays: RetentionDays,
): Date | null {
  if (retentionDays === null) return null;
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);
  return expiresAt;
}

export function isDocumentEligibleForDeletion(input: {
  createdAt: Date;
  retentionDays: RetentionDays;
  hasContent: boolean;
  deletedAt: Date | null;
  now?: Date;
}): boolean {
  if (!input.hasContent || input.deletedAt !== null || input.retentionDays === null) return false;
  const expiresAt = calculateDocumentExpiry(input.createdAt, input.retentionDays);
  return expiresAt !== null && expiresAt.getTime() <= (input.now ?? new Date()).getTime();
}
