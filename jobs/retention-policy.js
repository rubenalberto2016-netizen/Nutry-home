"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDocumentExpiry = calculateDocumentExpiry;
exports.isDocumentEligibleForDeletion = isDocumentEligibleForDeletion;
function calculateDocumentExpiry(createdAt, retentionDays) {
    if (retentionDays === null)
        return null;
    const expiresAt = new Date(createdAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);
    return expiresAt;
}
function isDocumentEligibleForDeletion(input) {
    if (!input.hasContent || input.deletedAt !== null || input.retentionDays === null)
        return false;
    const expiresAt = calculateDocumentExpiry(input.createdAt, input.retentionDays);
    return expiresAt !== null && expiresAt.getTime() <= (input.now ?? new Date()).getTime();
}
