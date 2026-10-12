// @polsia:user-owned
import { describe, expect, it } from 'vitest';
import {
  calculateDocumentExpiry,
  isDocumentEligibleForDeletion,
} from '../../jobs/retention-policy';

describe('retención documental', () => {
  const createdAt = new Date('2026-01-01T08:00:00.000Z');

  it('calcula vencimientos desde la fecha de carga y conserva por defecto', () => {
    expect(calculateDocumentExpiry(createdAt, 30)?.toISOString()).toBe('2026-01-31T08:00:00.000Z');
    expect(calculateDocumentExpiry(createdAt, null)).toBeNull();
  });

  it('no elimina antes del plazo y solo es elegible una vez mientras conserva bytes', () => {
    expect(
      isDocumentEligibleForDeletion({
        createdAt,
        retentionDays: 30,
        hasContent: true,
        deletedAt: null,
        now: new Date('2026-01-30T08:00:00.000Z'),
      }),
    ).toBe(false);
    expect(
      isDocumentEligibleForDeletion({
        createdAt,
        retentionDays: 30,
        hasContent: true,
        deletedAt: null,
        now: new Date('2026-01-31T08:00:00.000Z'),
      }),
    ).toBe(true);
    expect(
      isDocumentEligibleForDeletion({
        createdAt,
        retentionDays: 30,
        hasContent: false,
        deletedAt: null,
        now: new Date('2026-02-01T08:00:00.000Z'),
      }),
    ).toBe(false);
    expect(
      isDocumentEligibleForDeletion({
        createdAt,
        retentionDays: 30,
        hasContent: true,
        deletedAt: new Date('2026-01-31T08:00:00.000Z'),
        now: new Date('2026-02-01T08:00:00.000Z'),
      }),
    ).toBe(false);
  });
});
