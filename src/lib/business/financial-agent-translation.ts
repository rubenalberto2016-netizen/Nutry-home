// @polsia:user-owned
// Traduce propuestas por fragmentos ordenados usando el proxy de Polsia.
import 'server-only';
import { AiConfigurationError, chat } from '@/lib/ai/client';
import { FinancialAgentAiProxyError } from '@/lib/business/financial-agent-ai-errors';

const MAX_TRANSLATION_CHUNK_CHARACTERS = 6000;

function splitLongParagraph(paragraph: string) {
  const chunks: Array<{ text: string; separatorAfter: string }> = [];
  let start = 0;

  while (start < paragraph.length) {
    let end = Math.min(start + MAX_TRANSLATION_CHUNK_CHARACTERS, paragraph.length);
    if (end < paragraph.length) {
      const space = paragraph.lastIndexOf(' ', end);
      const lineBreak = paragraph.lastIndexOf('\n', end);
      const boundary = Math.max(space, lineBreak);
      if (boundary > start + Math.floor(MAX_TRANSLATION_CHUNK_CHARACTERS / 2)) end = boundary;
    }

    let contentEnd = end;
    while (contentEnd > start && /\s/.test(paragraph[contentEnd - 1] ?? '')) contentEnd -= 1;
    const text = paragraph.slice(start, contentEnd);
    if (!text) {
      end = Math.min(start + MAX_TRANSLATION_CHUNK_CHARACTERS, paragraph.length);
      contentEnd = end;
    }
    const separatorAfter = paragraph.slice(contentEnd, end);
    chunks.push({ text: paragraph.slice(start, contentEnd), separatorAfter });
    start = end;
  }

  return chunks;
}

function splitSource(text: string) {
  const parts = text.split(/(\n[\t ]*\n)/);
  const chunks: Array<{ text: string; separatorAfter: string }> = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? '';
    if (/^\n[\t ]*\n$/.test(part)) {
      const previous = chunks[chunks.length - 1];
      if (previous) previous.separatorAfter += part;
      continue;
    }
    if (!part) continue;

    const paragraphs =
      part.length > MAX_TRANSLATION_CHUNK_CHARACTERS
        ? splitLongParagraph(part)
        : [{ text: part, separatorAfter: '' }];
    chunks.push(...paragraphs);
  }

  return chunks;
}

const SYSTEM_INSTRUCTION = [
  'Traduce fielmente del inglés jurídico al español neutro.',
  'No añadas interpretación, asesoría legal, explicaciones ni contenido que no esté en la fuente.',
  'Conserva nombres propios y definidos, cifras, fechas, citas, referencias, títulos, listas, tablas y saltos de línea.',
  'Mantén una terminología uniforme en todos los fragmentos.',
  'Devuelve únicamente la traducción.',
].join(' ');

export async function translateFinancialAgentText(sourceText: string) {
  const chunks = splitSource(sourceText);
  const translated: string[] = [];

  for (const chunk of chunks) {
    let result: string;
    try {
      result = await chat({
        task: 'general',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: chunk.text },
        ],
      });
    } catch (error) {
      if (error instanceof AiConfigurationError) throw error;
      throw new FinancialAgentAiProxyError();
    }
    if (!result.trim()) throw new Error('La IA devolvió una traducción vacía.');
    translated.push(result.trim(), chunk.separatorAfter);
  }

  return translated.join('');
}
