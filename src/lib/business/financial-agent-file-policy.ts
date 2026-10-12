// @polsia:user-owned
// Límites y comprobaciones de formato para adjuntos privados de evaluaciones.

export const MAX_FINANCIAL_AGENT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FINANCIAL_AGENT_SUBMISSION_BYTES = 10 * 1024 * 1024;

const fileTypes = {
  '.pdf': { mimeType: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  '.jpg': { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  '.jpeg': { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  '.png': {
    mimeType: 'image/png',
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  '.csv': { mimeType: 'text/csv', signature: [] },
  '.xlsx': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
} as const;

export const FINANCIAL_AGENT_FILE_ACCEPT = Object.entries(fileTypes)
  .flatMap(([extension, { mimeType }]) => [extension, mimeType])
  .join(',');

export type FinancialAgentFilePolicyErrorKind = 'invalid' | 'too_large';

export class FinancialAgentFilePolicyError extends Error {
  constructor(
    message: string,
    readonly kind: FinancialAgentFilePolicyErrorKind,
  ) {
    super(message);
    this.name = 'FinancialAgentFilePolicyError';
  }
}

export function validateFinancialAgentFileMetadata(file: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const fileName = file.fileName.trim();
  const hasUnsafeCharacter = [...fileName].some((character) => {
    const codePoint = character.charCodeAt(0);
    return character === '/' || character === '\\' || codePoint <= 31 || codePoint === 127;
  });
  if (!fileName || fileName.length > 255 || hasUnsafeCharacter) {
    throw new FinancialAgentFilePolicyError('El nombre del archivo no es válido.', 'invalid');
  }
  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0) {
    throw new FinancialAgentFilePolicyError('El archivo está vacío o no es válido.', 'invalid');
  }
  if (file.sizeBytes > MAX_FINANCIAL_AGENT_FILE_BYTES) {
    throw new FinancialAgentFilePolicyError('Cada archivo admite hasta 5 MiB.', 'too_large');
  }

  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const expected = fileTypes[extension as keyof typeof fileTypes];
  if (!expected || file.mimeType.trim().toLowerCase() !== expected.mimeType) {
    throw new FinancialAgentFilePolicyError(
      'Usa PDF, JPG, PNG, CSV o XLSX con su tipo de archivo correspondiente.',
      'invalid',
    );
  }
  return expected;
}

export function validateFinancialAgentSubmissionSize(sizes: number[]) {
  const totalBytes = sizes.reduce((total, size) => total + size, 0);
  if (totalBytes > MAX_FINANCIAL_AGENT_SUBMISSION_BYTES) {
    throw new FinancialAgentFilePolicyError(
      'La entrega admite hasta 10 MiB en total.',
      'too_large',
    );
  }
  return totalBytes;
}

export function decodeAndValidateFinancialAgentFile(file: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}) {
  const expected = validateFinancialAgentFileMetadata(file);
  if (file.base64.length > Math.ceil(MAX_FINANCIAL_AGENT_FILE_BYTES / 3) * 4) {
    throw new FinancialAgentFilePolicyError('Cada archivo admite hasta 5 MiB.', 'too_large');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) {
    throw new FinancialAgentFilePolicyError(
      'El archivo recibido no tiene una codificación válida.',
      'invalid',
    );
  }

  const padding = file.base64.endsWith('==') ? 2 : file.base64.endsWith('=') ? 1 : 0;
  const decodedSize = (file.base64.length / 4) * 3 - padding;
  if (decodedSize > MAX_FINANCIAL_AGENT_FILE_BYTES) {
    throw new FinancialAgentFilePolicyError('Cada archivo admite hasta 5 MiB.', 'too_large');
  }
  if (decodedSize !== file.sizeBytes) {
    throw new FinancialAgentFilePolicyError(
      'El tamaño recibido no coincide con el archivo.',
      'invalid',
    );
  }

  let binary: string;
  try {
    binary = atob(file.base64);
  } catch {
    throw new FinancialAgentFilePolicyError(
      'El archivo recibido no tiene una codificación válida.',
      'invalid',
    );
  }
  if (btoa(binary) !== file.base64) {
    throw new FinancialAgentFilePolicyError(
      'El archivo recibido no tiene una codificación válida.',
      'invalid',
    );
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (expected.signature.length > 0) {
    const matches = expected.signature.every((byte, index) => bytes[index] === byte);
    if (!matches) {
      throw new FinancialAgentFilePolicyError(
        'El contenido no coincide con el formato declarado.',
        'invalid',
      );
    }
  } else {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!text.trim() || text.includes('\u0000')) throw new Error('invalid csv');
    } catch {
      throw new FinancialAgentFilePolicyError(
        'El contenido no es un CSV de texto válido.',
        'invalid',
      );
    }
  }
  return bytes;
}
