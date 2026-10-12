import { describe, expect, it } from 'vitest';
import {
  decodeAndValidateFinancialAgentFile,
  FinancialAgentFilePolicyError,
  MAX_FINANCIAL_AGENT_FILE_BYTES,
  MAX_FINANCIAL_AGENT_SUBMISSION_BYTES,
  validateFinancialAgentFileMetadata,
  validateFinancialAgentSubmissionSize,
} from '@/lib/business/financial-agent-file-policy';

function encodedFile(fileName: string, mimeType: string, content: Uint8Array) {
  return {
    fileName,
    mimeType,
    sizeBytes: content.byteLength,
    base64: Buffer.from(content).toString('base64'),
  };
}

describe('política de archivos de evaluaciones financieras', () => {
  it('rechaza Base64 inválido y contenido que no coincide con su formato', () => {
    expect(() =>
      decodeAndValidateFinancialAgentFile({
        fileName: 'balance.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
        base64: '%%%=',
      }),
    ).toThrow(FinancialAgentFilePolicyError);
    expect(() =>
      decodeAndValidateFinancialAgentFile(
        encodedFile('balance.pdf', 'application/pdf', new TextEncoder().encode('not a PDF')),
      ),
    ).toThrow('El contenido no coincide');
  });

  it('acepta firmas PDF, JPG, PNG y XLSX y texto CSV UTF-8', () => {
    const validFiles = [
      encodedFile('balance.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.7 sample')),
      encodedFile('foto.jpg', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x00])),
      encodedFile(
        'foto.png',
        'image/png',
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      encodedFile('datos.csv', 'text/csv', new TextEncoder().encode('periodo,importe\n2025,100')),
      encodedFile(
        'libro.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]),
      ),
    ];
    for (const file of validFiles) {
      expect(decodeAndValidateFinancialAgentFile(file)).toHaveLength(file.sizeBytes);
    }
  });

  it('comprueba el tipo MIME y el máximo de 5 MiB por archivo', () => {
    expect(() =>
      validateFinancialAgentFileMetadata({
        fileName: 'balance.pdf',
        mimeType: 'text/plain',
        sizeBytes: 10,
      }),
    ).toThrow(FinancialAgentFilePolicyError);
    expect(() =>
      validateFinancialAgentFileMetadata({
        fileName: 'balance.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MAX_FINANCIAL_AGENT_FILE_BYTES + 1,
      }),
    ).toThrow('hasta 5 MiB');
  });

  it('limita el total de una entrega a 10 MiB', () => {
    expect(validateFinancialAgentSubmissionSize([5 * 1024 * 1024, 5 * 1024 * 1024])).toBe(
      MAX_FINANCIAL_AGENT_SUBMISSION_BYTES,
    );
    expect(() =>
      validateFinancialAgentSubmissionSize([5 * 1024 * 1024, 5 * 1024 * 1024 + 1]),
    ).toThrow('hasta 10 MiB');
  });
});
