// @polsia:user-owned
// Extrae texto de los formatos de adjunto admitidos; las páginas escaneadas usan visión.
import 'server-only';
import { Buffer } from 'node:buffer';
import { resolve, sep } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AiConfigurationError, analyzeImage } from '@/lib/ai/client';
import { FinancialAgentAiProxyError } from '@/lib/business/financial-agent-ai-errors';
import {
  decodeAndValidateFinancialAgentFile,
  validateFinancialAgentFileMetadata,
} from '@/lib/business/financial-agent-file-policy';

export class FinancialAgentDocumentTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialAgentDocumentTextError';
  }
}

function imageDataUrl(content: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(content).toString('base64')}`;
}

async function readImage(content: Uint8Array, mimeType: string) {
  try {
    return await analyzeImage({
      imageUrl: imageDataUrl(content, mimeType),
      task: 'document-extraction',
      prompt:
        'Transcribe todo el texto legible de esta página de un documento jurídico. Conserva títulos, párrafos, tablas, cifras, fechas, citas y referencias. Devuelve solo el texto transcrito; si no hay texto legible, devuelve una cadena vacía.',
    });
  } catch (error) {
    if (error instanceof AiConfigurationError) throw error;
    throw new FinancialAgentAiProxyError();
  }
}

async function readPdf(content: Uint8Array) {
  const document = await getDocument({
    data: new Uint8Array(content),
    standardFontDataUrl: `${resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')}${sep}`,
  }).promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const contentPage = await page.getTextContent();
      const pageText = contentPage.items
        .filter((item): item is typeof item & { str: string } => 'str' in item)
        .map((item) => item.str)
        .join(' ')
        .trim();

      if (pageText) {
        pages.push(`Página ${pageNumber}\n${pageText}`);
        continue;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.5, 1800 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale: Math.max(scale, 0.25) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const scanText = await readImage(Buffer.from(canvas.toBuffer('image/png')), 'image/png');
      if (scanText.trim()) pages.push(`Página ${pageNumber}\n${scanText.trim()}`);
    }
  } finally {
    await document.destroy();
  }

  return pages.join('\n\n');
}

function readCsv(content: Uint8Array) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
  const rows = parse(text, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  return rows
    .map((row, rowIndex) => {
      const columns = row.map((value, columnIndex) => `${columnIndex + 1}: ${value}`).join('\t');
      return `Fila ${rowIndex + 1}\t${columns}`;
    })
    .join('\n');
}

function excelCellText(value: ExcelJS.CellValue) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('result' in value) return String(value.result ?? '');
    return '';
  }
  return value == null ? '' : String(value);
}

async function readXlsx(content: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(content));
  const sheets: string[] = [];

  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const value = excelCellText(cell.value);
        if (value.trim()) cells.push(`${cell.address}: ${value}`);
      });
      if (cells.length > 0) rows.push(cells.join('\t'));
    });
    if (rows.length > 0) sheets.push(`Hoja ${worksheet.name}\n${rows.join('\n')}`);
  });

  return sheets.join('\n\n');
}

export async function extractFinancialAgentDocumentText(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Uint8Array;
}) {
  const expected = validateFinancialAgentFileMetadata(input);
  if (input.content.byteLength !== input.sizeBytes) {
    throw new FinancialAgentDocumentTextError(
      'El tamaño del documento no coincide con su registro.',
    );
  }
  const content = decodeAndValidateFinancialAgentFile({
    ...input,
    base64: Buffer.from(input.content).toString('base64'),
  });

  let extracted = '';
  if (expected.mimeType === 'application/pdf') {
    extracted = await readPdf(content);
  } else if (expected.mimeType === 'image/jpeg' || expected.mimeType === 'image/png') {
    extracted = await readImage(content, expected.mimeType);
  } else if (expected.mimeType === 'text/csv') {
    extracted = readCsv(content);
  } else if (
    expected.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    extracted = await readXlsx(content);
  }

  if (!extracted.trim()) {
    throw new FinancialAgentDocumentTextError(
      'No se encontró texto legible en el documento. Comprueba que no esté vacío o vuelve a cargar una versión clara.',
    );
  }
  return extracted;
}
